import type { Coordinates, ViewportBounds } from '../../types';
import { calculateBoundingBox } from './calculateBoundingBox';

type TerritoryLike = {
  coordinates: Coordinates[];
};

function intersectsViewport(
  territoryCoordinates: readonly Coordinates[],
  viewportBounds: ViewportBounds,
): boolean {
  const boundingBox = calculateBoundingBox(territoryCoordinates);

  if (!boundingBox) {
    return false;
  }

  return !(
    boundingBox.maxLongitude < viewportBounds.west ||
    boundingBox.minLongitude > viewportBounds.east ||
    boundingBox.maxLatitude < viewportBounds.south ||
    boundingBox.minLatitude > viewportBounds.north
  );
}

export function filterTerritoriesByViewport<TTerritory extends TerritoryLike>(
  territories: readonly TTerritory[],
  viewportBounds: ViewportBounds | null,
): TTerritory[] {
  if (!viewportBounds) {
    return [...territories];
  }

  return territories.filter((territory) => intersectsViewport(territory.coordinates, viewportBounds));
}
