import { diff, type Geometry, type Polygon, type Position, type Ring } from 'martinez-polygon-clipping';

import type { Coordinates } from '../types';
import { calculatePolygonArea } from './geo/calculatePolygonArea';
import { filterValidCoordinates } from './geo/coordinateValidation';

export type CarveTerritoryGeometryResult = {
  areaHectare: number;
  areaM2: number;
  carvedCoordinates: Coordinates[] | null;
  discardedFragmentCount: number;
  fragmentCount: number;
  geometryChanged: boolean;
  geometryValid: boolean;
  hadHoles: boolean;
  removedCompletely: boolean;
};

function ensureClosedCoordinates(coordinates: readonly Coordinates[]): Coordinates[] {
  if (coordinates.length === 0) {
    return [];
  }

  const firstCoordinate = coordinates[0];
  const lastCoordinate = coordinates[coordinates.length - 1];

  if (firstCoordinate.latitude === lastCoordinate.latitude && firstCoordinate.longitude === lastCoordinate.longitude) {
    return [...coordinates];
  }

  return [...coordinates, firstCoordinate];
}

function ensureClosedRing(ring: readonly Position[]): Ring {
  if (ring.length === 0) {
    return [];
  }

  const firstPosition = ring[0];
  const lastPosition = ring[ring.length - 1];

  if (firstPosition[0] === lastPosition[0] && firstPosition[1] === lastPosition[1]) {
    return [...ring];
  }

  return [...ring, firstPosition];
}

function stripClosingPosition(ring: readonly Position[]): Position[] {
  if (ring.length < 2) {
    return [...ring];
  }

  const firstPosition = ring[0];
  const lastPosition = ring[ring.length - 1];

  if (firstPosition[0] === lastPosition[0] && firstPosition[1] === lastPosition[1]) {
    return [...ring.slice(0, -1)];
  }

  return [...ring];
}

function toRing(coordinates: readonly Coordinates[]): Ring {
  const closedCoordinates = ensureClosedCoordinates(filterValidCoordinates(coordinates));

  return closedCoordinates.map((coordinate) => [coordinate.longitude, coordinate.latitude] as Position);
}

function toCoordinates(ring: readonly Position[]): Coordinates[] {
  const openRing = stripClosingPosition(ring);

  return openRing.map(([longitude, latitude]) => ({
    latitude,
    longitude,
  }));
}

function getDistanceSquared(from: Position, to: Position): number {
  const longitudeDelta = from[0] - to[0];
  const latitudeDelta = from[1] - to[1];

  return longitudeDelta * longitudeDelta + latitudeDelta * latitudeDelta;
}

function rotatePositions(positions: readonly Position[], startIndex: number): Position[] {
  if (positions.length === 0) {
    return [];
  }

  return [
    ...positions.slice(startIndex),
    ...positions.slice(0, startIndex),
  ];
}

function bridgeHoleIntoOuterRing(outerRing: readonly Position[], holeRing: readonly Position[]): Ring {
  const outerPositions = stripClosingPosition(outerRing);
  const holePositions = stripClosingPosition(holeRing);

  if (outerPositions.length < 3 || holePositions.length < 3) {
    return ensureClosedRing(outerPositions);
  }

  let bestOuterIndex = 0;
  let bestHoleIndex = 0;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;

  for (let outerIndex = 0; outerIndex < outerPositions.length; outerIndex += 1) {
    for (let holeIndex = 0; holeIndex < holePositions.length; holeIndex += 1) {
      const nextDistanceSquared = getDistanceSquared(outerPositions[outerIndex], holePositions[holeIndex]);

      if (nextDistanceSquared < bestDistanceSquared) {
        bestDistanceSquared = nextDistanceSquared;
        bestOuterIndex = outerIndex;
        bestHoleIndex = holeIndex;
      }
    }
  }

  const rotatedOuter = rotatePositions(outerPositions, bestOuterIndex);
  const rotatedHole = rotatePositions([...holePositions].reverse(), holePositions.length - 1 - bestHoleIndex);
  const anchorOuter = rotatedOuter[0];
  const anchorHole = rotatedHole[0];
  const bridgedPositions: Position[] = [
    anchorOuter,
    ...rotatedHole,
    anchorHole,
    anchorOuter,
    ...rotatedOuter.slice(1),
  ];

  return ensureClosedRing(bridgedPositions);
}

function flattenPolygon(polygon: Polygon): Ring {
  const [outerRing, ...holeRings] = polygon;

  if (!outerRing) {
    return [];
  }

  return holeRings.reduce<Ring>((currentRing, holeRing) => bridgeHoleIntoOuterRing(currentRing, holeRing), outerRing);
}

function normalizeGeometry(geometry: Geometry): Polygon[] {
  if (geometry.length === 0) {
    return [];
  }

  const firstItem = geometry[0];

  if (Array.isArray(firstItem) && Array.isArray(firstItem[0]) && typeof firstItem[0][0] === 'number') {
    return [geometry as Polygon];
  }

  return geometry as Polygon[];
}

function getCoordinateSignature(coordinates: readonly Coordinates[]): string {
  return coordinates
    .map((coordinate) => `${coordinate.latitude.toFixed(6)}:${coordinate.longitude.toFixed(6)}`)
    .join('|');
}

export function carveTerritoryGeometry(
  enemyCoordinates: readonly Coordinates[],
  playerCoordinates: readonly Coordinates[],
): CarveTerritoryGeometryResult {
  const subjectRing = toRing(enemyCoordinates);
  const clippingRing = toRing(playerCoordinates);

  if (subjectRing.length < 4 || clippingRing.length < 4) {
    return {
      areaHectare: 0,
      areaM2: 0,
      carvedCoordinates: null,
      discardedFragmentCount: 0,
      fragmentCount: 0,
      geometryChanged: false,
      geometryValid: false,
      hadHoles: false,
      removedCompletely: false,
    };
  }

  const differenceGeometry = diff([subjectRing], [clippingRing]);

  if (!differenceGeometry) {
    return {
      areaHectare: 0,
      areaM2: 0,
      carvedCoordinates: null,
      discardedFragmentCount: 0,
      fragmentCount: 0,
      geometryChanged: true,
      geometryValid: true,
      hadHoles: false,
      removedCompletely: true,
    };
  }

  const polygons = normalizeGeometry(differenceGeometry);
  const enemySignature = getCoordinateSignature(toCoordinates(subjectRing));
  const candidates = polygons
    .map((polygon) => {
      const flattenedRing = flattenPolygon(polygon);
      const nextCoordinates = toCoordinates(flattenedRing);
      const nextArea = calculatePolygonArea(nextCoordinates, true);

      if (!nextArea) {
        return null;
      }

      return {
        areaHectare: nextArea.areaHectare,
        areaM2: nextArea.areaM2,
        carvedCoordinates: nextCoordinates,
        hadHoles: polygon.length > 1,
      };
    })
    .filter(
      (
        candidate,
      ): candidate is {
        areaHectare: number;
        areaM2: number;
        carvedCoordinates: Coordinates[];
        hadHoles: boolean;
      } => candidate !== null,
    );

  if (candidates.length === 0) {
    return {
      areaHectare: 0,
      areaM2: 0,
      carvedCoordinates: null,
      discardedFragmentCount: polygons.length,
      fragmentCount: polygons.length,
      geometryChanged: true,
      geometryValid: false,
      hadHoles: polygons.some((polygon) => polygon.length > 1),
      removedCompletely: false,
    };
  }

  const selectedCandidate = candidates.reduce((largestCandidate, currentCandidate) =>
    currentCandidate.areaM2 > largestCandidate.areaM2 ? currentCandidate : largestCandidate,
  );
  const selectedSignature = getCoordinateSignature(selectedCandidate.carvedCoordinates);

  return {
    areaHectare: selectedCandidate.areaHectare,
    areaM2: selectedCandidate.areaM2,
    carvedCoordinates: selectedCandidate.carvedCoordinates,
    discardedFragmentCount: candidates.length > 0 ? candidates.length - 1 : 0,
    fragmentCount: polygons.length,
    geometryChanged: selectedSignature !== enemySignature,
    geometryValid: true,
    hadHoles: candidates.some((candidate) => candidate.hadHoles),
    removedCompletely: false,
  };
}
