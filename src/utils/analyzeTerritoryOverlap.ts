import type { Coordinates, OverlapComparableTerritory, TerritoryOverlapAnalysis } from '../types';
import { calculateBoundingBox } from './geo/calculateBoundingBox';
import { filterValidCoordinates, isValidCoordinate } from './geo/coordinateValidation';

const DEFAULT_PROXIMITY_THRESHOLD_METERS = 12;
const DEFAULT_SAMPLE_GRID_SIZE = 6;

function ensureClosedRing(coordinates: readonly Coordinates[]): Coordinates[] {
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

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function getDistanceMeters(from: Coordinates, to: Coordinates): number {
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitudeRadians = toRadians(from.latitude);
  const toLatitudeRadians = toRadians(to.latitude);

  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(fromLatitudeRadians) *
      Math.cos(toLatitudeRadians) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);
  const angularDistance = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * angularDistance;
}

function isPointNearPolygon(
  point: Coordinates,
  polygon: readonly Coordinates[],
  proximityThresholdMeters: number,
): boolean {
  for (const polygonPoint of polygon) {
    if (getDistanceMeters(point, polygonPoint) <= proximityThresholdMeters) {
      return true;
    }
  }

  return false;
}

function isPointInsidePolygon(point: Coordinates, polygon: readonly Coordinates[]): boolean {
  if (polygon.length < 3) {
    return false;
  }

  let isInside = false;

  for (let currentIndex = 0, previousIndex = polygon.length - 1; currentIndex < polygon.length; previousIndex = currentIndex++) {
    const currentPoint = polygon[currentIndex];
    const previousPoint = polygon[previousIndex];
    const intersects =
      currentPoint.longitude > point.longitude !== previousPoint.longitude > point.longitude &&
      point.latitude <
        ((previousPoint.latitude - currentPoint.latitude) * (point.longitude - currentPoint.longitude)) /
          (previousPoint.longitude - currentPoint.longitude) +
          currentPoint.latitude;

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function getBoundingBoxIntersectionRatio(
  previewCoordinates: readonly Coordinates[],
  territoryCoordinates: readonly Coordinates[],
): number {
  const previewBoundingBox = calculateBoundingBox(previewCoordinates);
  const territoryBoundingBox = calculateBoundingBox(territoryCoordinates);

  if (!previewBoundingBox || !territoryBoundingBox) {
    return 0;
  }

  const intersectionWidth = Math.max(
    0,
    Math.min(previewBoundingBox.maxLongitude, territoryBoundingBox.maxLongitude) -
      Math.max(previewBoundingBox.minLongitude, territoryBoundingBox.minLongitude),
  );
  const intersectionHeight = Math.max(
    0,
    Math.min(previewBoundingBox.maxLatitude, territoryBoundingBox.maxLatitude) -
      Math.max(previewBoundingBox.minLatitude, territoryBoundingBox.minLatitude),
  );
  const previewWidth = Math.max(0, previewBoundingBox.maxLongitude - previewBoundingBox.minLongitude);
  const previewHeight = Math.max(0, previewBoundingBox.maxLatitude - previewBoundingBox.minLatitude);
  const previewArea = previewWidth * previewHeight;

  if (previewArea <= 0) {
    return 0;
  }

  return Math.min(1, (intersectionWidth * intersectionHeight) / previewArea);
}

function getApproximateCoverageRatio(
  sampledCoordinates: readonly Coordinates[],
  coveringCoordinates: readonly Coordinates[],
): number {
  const sampledBoundingBox = calculateBoundingBox(sampledCoordinates);

  if (!sampledBoundingBox) {
    return 0;
  }

  const sampledRing = ensureClosedRing(sampledCoordinates);
  const coveringRing = ensureClosedRing(coveringCoordinates);
  const sampleSteps = DEFAULT_SAMPLE_GRID_SIZE;
  let coveredSamples = 0;
  let sampledPolygonSamples = 0;

  for (let latitudeStep = 0; latitudeStep <= sampleSteps; latitudeStep += 1) {
    for (let longitudeStep = 0; longitudeStep <= sampleSteps; longitudeStep += 1) {
      const samplePoint: Coordinates = {
        latitude:
          sampledBoundingBox.minLatitude +
          ((sampledBoundingBox.maxLatitude - sampledBoundingBox.minLatitude) * latitudeStep) / sampleSteps,
        longitude:
          sampledBoundingBox.minLongitude +
          ((sampledBoundingBox.maxLongitude - sampledBoundingBox.minLongitude) * longitudeStep) / sampleSteps,
      };

      if (!isPointInsidePolygon(samplePoint, sampledRing)) {
        continue;
      }

      sampledPolygonSamples += 1;

      if (
        isPointInsidePolygon(samplePoint, coveringRing) ||
        isPointNearPolygon(samplePoint, coveringRing, DEFAULT_PROXIMITY_THRESHOLD_METERS)
      ) {
        coveredSamples += 1;
      }
    }
  }

  if (sampledPolygonSamples === 0) {
    return 0;
  }

  return coveredSamples / sampledPolygonSamples;
}

export function estimateTerritoryCoverageRatio(
  previewCoordinates: readonly Coordinates[],
  territoryCoordinates: readonly Coordinates[],
): number {
  const validPreviewCoordinates = ensureClosedRing(filterValidCoordinates(previewCoordinates));
  const validTerritoryCoordinates = ensureClosedRing(filterValidCoordinates(territoryCoordinates));

  if (validPreviewCoordinates.length < 4 || validTerritoryCoordinates.length < 4) {
    return 0;
  }

  return getApproximateCoverageRatio(validPreviewCoordinates, validTerritoryCoordinates);
}

export function estimateCapturedTerritoryCoverageRatio(
  previewCoordinates: readonly Coordinates[],
  territoryCoordinates: readonly Coordinates[],
): number {
  const validPreviewCoordinates = ensureClosedRing(filterValidCoordinates(previewCoordinates));
  const validTerritoryCoordinates = ensureClosedRing(filterValidCoordinates(territoryCoordinates));

  if (validPreviewCoordinates.length < 4 || validTerritoryCoordinates.length < 4) {
    return 0;
  }

  return getApproximateCoverageRatio(validTerritoryCoordinates, validPreviewCoordinates);
}

function getTerritoryOverlapRatio(
  previewCoordinates: readonly Coordinates[],
  territoryCoordinates: readonly Coordinates[],
): number {
  const boundingBoxRatio = getBoundingBoxIntersectionRatio(previewCoordinates, territoryCoordinates);

  if (boundingBoxRatio <= 0) {
    return 0;
  }

  const coverageRatio = getApproximateCoverageRatio(previewCoordinates, territoryCoordinates);
  const previewRing = ensureClosedRing(previewCoordinates);
  const territoryRing = ensureClosedRing(territoryCoordinates);
  const previewTouchesTerritory =
    previewRing.some((point) => isPointInsidePolygon(point, territoryRing)) ||
    territoryRing.some((point) => isPointInsidePolygon(point, previewRing));
  const proximityDetected =
    previewRing.some((point) => isPointNearPolygon(point, territoryRing, DEFAULT_PROXIMITY_THRESHOLD_METERS)) ||
    territoryRing.some((point) => isPointNearPolygon(point, previewRing, DEFAULT_PROXIMITY_THRESHOLD_METERS));

  if (coverageRatio > 0) {
    return Math.min(1, Math.max(boundingBoxRatio, coverageRatio));
  }

  if (previewTouchesTerritory) {
    return Math.min(1, Math.max(boundingBoxRatio, 0.35));
  }

  if (proximityDetected) {
    return Math.min(1, Math.max(boundingBoxRatio * 0.5, 0.12));
  }

  return 0;
}

export function analyzeTerritoryOverlap(
  previewCoordinates: readonly Coordinates[],
  territories: readonly OverlapComparableTerritory[],
): TerritoryOverlapAnalysis {
  const validPreviewCoordinates = ensureClosedRing(filterValidCoordinates(previewCoordinates));

  if (validPreviewCoordinates.length < 4) {
    return {
      estimatedOverlapPercent: 0,
      hasOverlap: false,
      overlapCount: 0,
      overlappingMineCount: 0,
      overlappingOthersCount: 0,
      overlappingTerritoryIds: [],
    };
  }

  const overlappingTerritories = territories.flatMap((territory) => {
    const validTerritoryCoordinates = ensureClosedRing(
      territory.coordinates.filter((coordinate): coordinate is Coordinates => isValidCoordinate(coordinate)),
    );

    if (validTerritoryCoordinates.length < 4) {
      return [];
    }

    const overlapRatio = getTerritoryOverlapRatio(validPreviewCoordinates, validTerritoryCoordinates);

    if (overlapRatio <= 0) {
      return [];
    }

    return [
      {
        id: territory.id,
        isMine: territory.isMine === true,
        overlapRatio,
      },
    ];
  });

  const estimatedOverlapPercent = clampPercentage(
    overlappingTerritories.reduce((highestRatio, territory) => Math.max(highestRatio, territory.overlapRatio), 0) * 100,
  );
  const overlappingMineCount = overlappingTerritories.filter((territory) => territory.isMine).length;
  const overlappingOthersCount = overlappingTerritories.length - overlappingMineCount;

  return {
    estimatedOverlapPercent,
    hasOverlap: overlappingTerritories.length > 0,
    overlapCount: overlappingTerritories.length,
    overlappingMineCount,
    overlappingOthersCount,
    overlappingTerritoryIds: overlappingTerritories.map((territory) => territory.id),
  };
}
