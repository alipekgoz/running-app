export type ClaimRejectReason =
  | 'none'
  | 'enemy_overlap'
  | 'high_conflict'
  | 'invalid_polygon';

export type ClaimValidationResult = {
  estimatedEnemyCoveragePercent: number;
  isCaptureCandidate: boolean;
  isCaptureAllowed: boolean;
  isClaimAllowed: boolean;
  overlapPercent: number;
  overlapsMine: boolean;
  overlapsOthers: boolean;
  rejectReason: ClaimRejectReason;
};

export type TerritoryCaptureResult = {
  captureReason:
    | 'none'
    | 'enemy_territory_captured'
    | 'enemy_territory_reduced'
    | 'territory_claimed'
    | 'capture_failed';
  captureTimestamp: string;
  carvedTerritoryIds: string[];
  capturedTerritoryIds: string[];
  didCapture: boolean;
  newTerritoryId?: string;
  previousOwnerIds: string[];
};
