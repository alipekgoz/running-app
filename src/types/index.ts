import type { Coordinates } from './location';
import type { ClaimRejectReason, ClaimValidationResult } from './claim';
import type { PolygonAreaResult } from './geo';
import type { PlayerProfile } from './player';
import type { ConflictSeverity, ConflictVisualizationState } from './conflict';
import type { LocalSavedTerritory, OnlineTerritory, TerritoryPreviewPayload } from './territory';
import type { OverlapComparableTerritory, TerritoryOverlapAnalysis } from './overlap';

export type { Coordinates } from './location';
export type { ClaimRejectReason, ClaimValidationResult } from './claim';
export type { PolygonAreaResult } from './geo';
export type { PlayerProfile } from './player';
export type { ConflictSeverity, ConflictVisualizationState } from './conflict';
export type { LocalSavedTerritory, OnlineTerritory, TerritoryPreviewPayload } from './territory';
export type { OverlapComparableTerritory, TerritoryOverlapAnalysis } from './overlap';

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
