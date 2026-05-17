import type { Coordinates } from './location';
import type { ClaimRejectReason, ClaimValidationResult, TerritoryCaptureResult } from './claim';
import type { PolygonAreaResult } from './geo';
import type { PlayerProfile } from './player';
import type { ConflictSeverity, ConflictVisualizationState } from './conflict';
import type { CooldownCheckResult, CooldownReason, CooldownState } from './cooldown';
import type { LocalSavedTerritory, OnlineTerritory, TerritoryPreviewPayload, ViewportBounds } from './territory';
import type { OverlapComparableTerritory, TerritoryOverlapAnalysis } from './overlap';
import type { TerritoryRealtimeEvent, TerritoryRealtimeEventType } from './realtime';

export type { Coordinates } from './location';
export type { ClaimRejectReason, ClaimValidationResult, TerritoryCaptureResult } from './claim';
export type { PolygonAreaResult } from './geo';
export type { PlayerProfile } from './player';
export type { ConflictSeverity, ConflictVisualizationState } from './conflict';
export type { CooldownCheckResult, CooldownReason, CooldownState } from './cooldown';
export type { LocalSavedTerritory, OnlineTerritory, TerritoryPreviewPayload, ViewportBounds } from './territory';
export type { OverlapComparableTerritory, TerritoryOverlapAnalysis } from './overlap';
export type { TerritoryRealtimeEvent, TerritoryRealtimeEventType } from './realtime';

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
