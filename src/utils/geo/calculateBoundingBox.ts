import type { Coordinates } from '../../types';
import { filterValidCoordinates } from './coordinateValidation';

export type BoundingBox = {
  maxLatitude: number;
  maxLongitude: number;
  minLatitude: number;
  minLongitude: number;
};

export function calculateBoundingBox(coordinates: readonly Coordinates[]): BoundingBox | null {
  const validCoordinates = filterValidCoordinates(coordinates);

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
