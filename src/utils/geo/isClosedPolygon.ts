import type { Coordinates } from '../../types';
import { isValidCoordinate } from './coordinateValidation';

type IsClosedPolygonOptions = {
  minimumPointCount?: number;
};

export function isClosedPolygon(
  coordinates: readonly Coordinates[],
  options: IsClosedPolygonOptions = {},
): boolean {
  const { minimumPointCount = 4 } = options;

  if (coordinates.length < minimumPointCount) {
    return false;
  }

  const firstCoordinate = coordinates[0];
  const lastCoordinate = coordinates[coordinates.length - 1];

  if (!isValidCoordinate(firstCoordinate) || !isValidCoordinate(lastCoordinate)) {
    return false;
  }

  return (
    firstCoordinate.latitude === lastCoordinate.latitude &&
    firstCoordinate.longitude === lastCoordinate.longitude
  );
}
