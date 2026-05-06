import type { PolygonAreaAnalysis } from './calculatePolygonArea';
import type { PolygonCandidateAnalysis } from './isPolygonCandidate';
import type { Coordinates } from '../../types';
import { filterValidCoordinates } from './coordinateValidation';

type PolygonGeometry = {
  coordinates: [number, number][][];
  type: 'Polygon';
};

export type PolygonPreviewFeature = {
  geometry: PolygonGeometry;
  properties: {
    pointCount: number;
  };
  type: 'Feature';
};

export type PolygonPreviewRejectionReason =
  | 'not a polygon candidate'
  | 'polygon area invalid'
  | 'not enough valid points'
  | null;

export type PolygonPreviewAnalysis = {
  geoJSON: PolygonPreviewFeature | null;
  isRendered: boolean;
  pointCount: number;
  rejectionReason: PolygonPreviewRejectionReason;
  validPointCount: number;
};

function ensureClosedRing(coordinates: readonly Coordinates[]): Coordinates[] {
  if (coordinates.length === 0) {
    return [];
  }

  const firstCoordinate = coordinates[0];
  const lastCoordinate = coordinates[coordinates.length - 1];

  if (
    firstCoordinate.latitude === lastCoordinate.latitude &&
    firstCoordinate.longitude === lastCoordinate.longitude
  ) {
    return [...coordinates];
  }

  return [...coordinates, firstCoordinate];
}

export function routeToPolygonGeoJSON(
  coordinates: readonly Coordinates[],
  polygonCandidateAnalysis: PolygonCandidateAnalysis,
  polygonAreaAnalysis: PolygonAreaAnalysis,
): PolygonPreviewFeature | null {
  if (!polygonCandidateAnalysis.isCandidate || !polygonAreaAnalysis.isValid) {
    return null;
  }

  const validCoordinates = filterValidCoordinates(coordinates);

  if (validCoordinates.length < 3) {
    return null;
  }

  const closedRing = ensureClosedRing(validCoordinates);

  if (closedRing.length < 4) {
    return null;
  }

  return {
    geometry: {
      coordinates: [closedRing.map((coordinate) => [coordinate.longitude, coordinate.latitude])],
      type: 'Polygon',
    },
    properties: {
      pointCount: closedRing.length,
    },
    type: 'Feature',
  };
}

export function analyzePolygonPreview(
  coordinates: readonly Coordinates[],
  polygonCandidateAnalysis: PolygonCandidateAnalysis,
  polygonAreaAnalysis: PolygonAreaAnalysis,
): PolygonPreviewAnalysis {
  const validCoordinates = filterValidCoordinates(coordinates);
  const pointCount = coordinates.length;
  const validPointCount = validCoordinates.length;

  if (!polygonCandidateAnalysis.isCandidate) {
    return {
      geoJSON: null,
      isRendered: false,
      pointCount,
      rejectionReason: 'not a polygon candidate',
      validPointCount,
    };
  }

  if (!polygonAreaAnalysis.isValid) {
    return {
      geoJSON: null,
      isRendered: false,
      pointCount,
      rejectionReason: 'polygon area invalid',
      validPointCount,
    };
  }

  if (validPointCount < 3) {
    return {
      geoJSON: null,
      isRendered: false,
      pointCount,
      rejectionReason: 'not enough valid points',
      validPointCount,
    };
  }

  const geoJSON = routeToPolygonGeoJSON(coordinates, polygonCandidateAnalysis, polygonAreaAnalysis);

  return {
    geoJSON,
    isRendered: geoJSON !== null,
    pointCount,
    rejectionReason: geoJSON ? null : 'not enough valid points',
    validPointCount,
  };
}
