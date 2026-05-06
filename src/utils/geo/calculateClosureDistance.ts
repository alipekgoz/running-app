import type { Coordinates } from '../../types';
import { calculateDistanceMeters } from '../gpsFilter';
import { isValidCoordinate } from './coordinateValidation';

export function calculateClosureDistance(coordinates: readonly Coordinates[]): number | null {
  if (coordinates.length < 2) {
    return null;
  }

  const firstCoordinate = coordinates[0];
  const lastCoordinate = coordinates[coordinates.length - 1];

  if (!isValidCoordinate(firstCoordinate) || !isValidCoordinate(lastCoordinate)) {
    return null;
  }

  return calculateDistanceMeters(firstCoordinate, lastCoordinate);
}
