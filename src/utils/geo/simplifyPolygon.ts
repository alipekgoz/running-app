import type { Coordinates } from '../../types';
import { filterValidCoordinates } from './coordinateValidation';

function areCoordinatesEqual(left: Coordinates, right: Coordinates): boolean {
  return left.latitude === right.latitude && left.longitude === right.longitude;
}

function getDistanceSquared(left: Coordinates, right: Coordinates): number {
  const latitudeDelta = left.latitude - right.latitude;
  const longitudeDelta = left.longitude - right.longitude;

  return latitudeDelta * latitudeDelta + longitudeDelta * longitudeDelta;
}

export function simplifyPolygon(
  coordinates: readonly Coordinates[],
  tolerance: number,
): Coordinates[] {
  const validCoordinates = filterValidCoordinates(coordinates);

  if (validCoordinates.length < 3 || tolerance <= 0) {
    return [...validCoordinates];
  }

  const isClosed = validCoordinates.length > 1 && areCoordinatesEqual(validCoordinates[0], validCoordinates[validCoordinates.length - 1]);
  const openCoordinates = isClosed ? validCoordinates.slice(0, -1) : [...validCoordinates];

  if (openCoordinates.length < 4) {
    return [...validCoordinates];
  }

  const minimumDistanceSquared = tolerance * tolerance;
  const simplifiedCoordinates: Coordinates[] = [openCoordinates[0]];

  for (let coordinateIndex = 1; coordinateIndex < openCoordinates.length - 1; coordinateIndex += 1) {
    const currentCoordinate = openCoordinates[coordinateIndex];
    const previousKeptCoordinate = simplifiedCoordinates[simplifiedCoordinates.length - 1];

    if (getDistanceSquared(currentCoordinate, previousKeptCoordinate) >= minimumDistanceSquared) {
      simplifiedCoordinates.push(currentCoordinate);
    }
  }

  const lastCoordinate = openCoordinates[openCoordinates.length - 1];

  if (!areCoordinatesEqual(simplifiedCoordinates[simplifiedCoordinates.length - 1], lastCoordinate)) {
    simplifiedCoordinates.push(lastCoordinate);
  }

  if (simplifiedCoordinates.length < 3) {
    return [...validCoordinates];
  }

  return isClosed ? [...simplifiedCoordinates, simplifiedCoordinates[0]] : simplifiedCoordinates;
}
