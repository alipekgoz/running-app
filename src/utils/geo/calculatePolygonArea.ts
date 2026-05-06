import { POLYGON_CONFIG } from '../../config/polygonConfig';
import type { PolygonAreaResult } from '../../types/geo';
import type { Coordinates } from '../../types';
import { filterValidCoordinates } from './coordinateValidation';

export type PolygonAreaRejectionReason =
  | 'not a polygon candidate'
  | 'not enough valid points'
  | 'area below minimum threshold'
  | null;

export type PolygonAreaAnalysis = {
  isValid: boolean;
  pointCount: number;
  rejectionReason: PolygonAreaRejectionReason;
  result: PolygonAreaResult | null;
  validPointCount: number;
};

const METERS_PER_DEGREE_LATITUDE = 111_320;
const SQUARE_METERS_PER_HECTARE = 10_000;

function ensureClosedPolygon(coordinates: readonly Coordinates[]): Coordinates[] {
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

function toLocalMeters(
  coordinate: Coordinates,
  origin: Coordinates,
): { x: number; y: number } {
  const latitudeRadians = (origin.latitude * Math.PI) / 180;
  const metersPerDegreeLongitude = Math.cos(latitudeRadians) * METERS_PER_DEGREE_LATITUDE;

  return {
    x: (coordinate.longitude - origin.longitude) * metersPerDegreeLongitude,
    y: (coordinate.latitude - origin.latitude) * METERS_PER_DEGREE_LATITUDE,
  };
}

function calculateShoelaceArea(closedCoordinates: readonly Coordinates[]): number {
  const origin = closedCoordinates[0];
  let signedArea = 0;

  for (let index = 0; index < closedCoordinates.length - 1; index += 1) {
    const currentPoint = toLocalMeters(closedCoordinates[index], origin);
    const nextPoint = toLocalMeters(closedCoordinates[index + 1], origin);

    signedArea += currentPoint.x * nextPoint.y - nextPoint.x * currentPoint.y;
  }

  return Math.abs(signedArea) / 2;
}

export function calculatePolygonArea(
  coordinates: readonly Coordinates[],
  isPolygonCandidate: boolean,
): PolygonAreaResult | null {
  if (!isPolygonCandidate) {
    return null;
  }

  const validCoordinates = filterValidCoordinates(coordinates);

  if (validCoordinates.length < 3) {
    return null;
  }

  const closedCoordinates = ensureClosedPolygon(validCoordinates);
  const areaM2 = calculateShoelaceArea(closedCoordinates);

  if (!Number.isFinite(areaM2) || areaM2 < POLYGON_CONFIG.minimumPolygonAreaM2) {
    return null;
  }

  return {
    areaHectare: areaM2 / SQUARE_METERS_PER_HECTARE,
    areaM2,
    pointCount: closedCoordinates.length,
  };
}

export function analyzePolygonArea(
  coordinates: readonly Coordinates[],
  isPolygonCandidate: boolean,
): PolygonAreaAnalysis {
  const validCoordinates = filterValidCoordinates(coordinates);
  const pointCount = coordinates.length;
  const validPointCount = validCoordinates.length;

  if (!isPolygonCandidate) {
    return {
      isValid: false,
      pointCount,
      rejectionReason: 'not a polygon candidate',
      result: null,
      validPointCount,
    };
  }

  if (validPointCount < 3) {
    return {
      isValid: false,
      pointCount,
      rejectionReason: 'not enough valid points',
      result: null,
      validPointCount,
    };
  }

  const result = calculatePolygonArea(validCoordinates, true);

  if (!result) {
    return {
      isValid: false,
      pointCount,
      rejectionReason: 'area below minimum threshold',
      result: null,
      validPointCount,
    };
  }

  return {
    isValid: true,
    pointCount,
    rejectionReason: null,
    result,
    validPointCount,
  };
}
