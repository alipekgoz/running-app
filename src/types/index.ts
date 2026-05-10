import type { Coordinates } from './location';
import type { PolygonAreaResult } from './geo';
import type { PlayerProfile } from './player';
import type { LocalSavedTerritory, OnlineTerritory, TerritoryPreviewPayload } from './territory';
import type { TerritoryOverlapAnalysis } from './overlap';

export type { Coordinates } from './location';
export type { PolygonAreaResult } from './geo';
export type { PlayerProfile } from './player';
export type { LocalSavedTerritory, OnlineTerritory, TerritoryPreviewPayload } from './territory';
export type { TerritoryOverlapAnalysis } from './overlap';

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
