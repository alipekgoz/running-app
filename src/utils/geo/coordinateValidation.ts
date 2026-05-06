import type { Coordinates } from '../../types';

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isValidLatitude(latitude: number | null | undefined): latitude is number {
  return isFiniteNumber(latitude) && latitude >= -90 && latitude <= 90;
}

export function isValidLongitude(longitude: number | null | undefined): longitude is number {
  return isFiniteNumber(longitude) && longitude >= -180 && longitude <= 180;
}

export function isValidCoordinate(coordinate: Coordinates | null | undefined): coordinate is Coordinates {
  return (
    coordinate != null &&
    isValidLatitude(coordinate.latitude) &&
    isValidLongitude(coordinate.longitude)
  );
}

export function filterValidCoordinates<T extends Coordinates>(coordinates: readonly T[]): T[] {
  return coordinates.filter(isValidCoordinate);
}
