import { CLAIM_RULE_CONFIG } from '../config/claimRulesConfig';
import type {
  ClaimValidationResult,
  ConflictVisualizationState,
  Coordinates,
  OnlineTerritory,
  TerritoryOverlapAnalysis,
} from '../types';
import { estimateTerritoryCoverageRatio } from './analyzeTerritoryOverlap';
import { filterValidCoordinates } from './geo/coordinateValidation';

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

function getEstimatedEnemyCoveragePercent(
  onlineTerritories: readonly OnlineTerritory[],
  previewPolygon: readonly Coordinates[],
): number {
  const validPreviewPolygon = filterValidCoordinates(previewPolygon);

  if (validPreviewPolygon.length < 3) {
    return 0;
  }

  let highestEnemyCoverageRatio = 0;

  for (const territory of onlineTerritories) {
    if (territory.isMine === true) {
      continue;
    }

    const nextCoverageRatio = estimateTerritoryCoverageRatio(validPreviewPolygon, territory.coordinates);
    highestEnemyCoverageRatio = Math.max(highestEnemyCoverageRatio, nextCoverageRatio);
  }

  return clampPercent(highestEnemyCoverageRatio * 100);
}

export function validateTerritoryClaim(
  overlapAnalysis: TerritoryOverlapAnalysis,
  conflictVisualizationState: ConflictVisualizationState,
  onlineTerritories: readonly OnlineTerritory[],
  previewPolygon: readonly Coordinates[],
): ClaimValidationResult {
  const validPreviewPolygon = filterValidCoordinates(previewPolygon);
  const overlapPercent = clampPercent(overlapAnalysis.estimatedOverlapPercent);
  const estimatedEnemyCoveragePercent = getEstimatedEnemyCoveragePercent(onlineTerritories, validPreviewPolygon);
  const isCaptureCandidate = estimatedEnemyCoveragePercent >= CLAIM_RULE_CONFIG.captureCandidateThresholdPercent;

  if (validPreviewPolygon.length < 3) {
    return {
      estimatedEnemyCoveragePercent,
      isCaptureCandidate: false,
      isClaimAllowed: false,
      overlapPercent,
      overlapsMine: conflictVisualizationState.overlapsMine,
      overlapsOthers: conflictVisualizationState.overlapsOthers,
      rejectReason: 'invalid_polygon',
    };
  }

  const hasRejectingEnemyOverlap =
    overlapPercent >= CLAIM_RULE_CONFIG.rejectOverlapThresholdPercent && conflictVisualizationState.overlapsOthers;

  if (hasRejectingEnemyOverlap) {
    return {
      estimatedEnemyCoveragePercent,
      isCaptureCandidate,
      isClaimAllowed: false,
      overlapPercent,
      overlapsMine: conflictVisualizationState.overlapsMine,
      overlapsOthers: conflictVisualizationState.overlapsOthers,
      rejectReason:
        conflictVisualizationState.severity === 'high'
          ? 'high_conflict'
          : 'enemy_overlap',
    };
  }

  return {
    estimatedEnemyCoveragePercent,
    isCaptureCandidate,
    isClaimAllowed: true,
    overlapPercent,
    overlapsMine: conflictVisualizationState.overlapsMine,
    overlapsOthers: conflictVisualizationState.overlapsOthers,
    rejectReason: 'none',
  };
}
