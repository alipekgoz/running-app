import type { Coordinates } from './location';

export type TerritoryPreviewPayload = {
  areaHectare: number;
  areaM2: number;
  coordinates: Coordinates[];
  createdAt: string;
  sourceRoutePointCount: number;
};
