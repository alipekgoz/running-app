export type ClaimRejectReason =
  | 'none'
  | 'enemy_overlap'
  | 'high_conflict'
  | 'invalid_polygon';

export type ClaimValidationResult = {
  estimatedEnemyCoveragePercent: number;
  isCaptureCandidate: boolean;
  isClaimAllowed: boolean;
  overlapPercent: number;
  overlapsMine: boolean;
  overlapsOthers: boolean;
  rejectReason: ClaimRejectReason;
};
