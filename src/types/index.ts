import type { Coordinates } from './location';
import type { PolygonAreaResult } from './geo';
import type { LocalSavedTerritory, TerritoryPreviewPayload } from './territory';

export type { Coordinates } from './location';
export type { PolygonAreaResult } from './geo';
export type { LocalSavedTerritory, TerritoryPreviewPayload } from './territory';

export type GpsPoint = Coordinates & {
  accuracyMeters: number;
  speedKmh?: number;
  timestamp: number;
};

export type Region = {
  id: string;
  ownerId: string;
  areaM2: number;
  coordinates: Coordinates[];
  createdAt: string;
};
