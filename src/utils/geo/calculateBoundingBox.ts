import type { Coordinates } from '../../types';

export type BoundingBox = {
  maxLatitude: number;
  maxLongitude: number;
  minLatitude: number;
  minLongitude: number;
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isValidCoordinate(coordinate: Coordinates | null | undefined): coordinate is Coordinates {
  return (
    coordinate != null &&
    isFiniteNumber(coordinate.latitude) &&
    isFiniteNumber(coordinate.longitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180
  );
}

export function calculateBoundingBox(coordinates: readonly Coordinates[]): BoundingBox | null {
  const validCoordinates = coordinates.filter(isValidCoordinate);

  if (validCoordinates.length === 0) {
    return null;
  }

  let minLatitude = validCoordinates[0].latitude;
  let maxLatitude = validCoordinates[0].latitude;
  let minLongitude = validCoordinates[0].longitude;
  let maxLongitude = validCoordinates[0].longitude;

  for (const coordinate of validCoordinates.slice(1)) {
    minLatitude = Math.min(minLatitude, coordinate.latitude);
    maxLatitude = Math.max(maxLatitude, coordinate.latitude);
    minLongitude = Math.min(minLongitude, coordinate.longitude);
    maxLongitude = Math.max(maxLongitude, coordinate.longitude);
  }

  return {
    maxLatitude,
    maxLongitude,
    minLatitude,
    minLongitude,
  };
}
