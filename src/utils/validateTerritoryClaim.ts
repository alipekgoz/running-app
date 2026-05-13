import { CLAIM_RULE_CONFIG } from '../config/claimRulesConfig';
import type {
  ClaimValidationResult,
  ConflictVisualizationState,
  Coordinates,
  OnlineTerritory,
  TerritoryOverlapAnalysis,
} from '../types';
import { estimateCapturedTerritoryCoverageRatio } from './analyzeTerritoryOverlap';
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
    if (territory.isMine === true || territory.deviceId == null) {
      continue;
    }

    const nextCoverageRatio = estimateCapturedTerritoryCoverageRatio(validPreviewPolygon, territory.coordinates);
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
  const hasEnemyOverlap = conflictVisualizationState.overlapsOthers;
  const isCaptureCandidate =
    hasEnemyOverlap && estimatedEnemyCoveragePercent >= CLAIM_RULE_CONFIG.captureCandidateThresholdPercent;
  const isCaptureAllowed = isCaptureCandidate && hasEnemyOverlap;

  if (validPreviewPolygon.length < 3) {
    return {
      estimatedEnemyCoveragePercent,
      isCaptureCandidate: false,
      isCaptureAllowed: false,
      isClaimAllowed: false,
      overlapPercent,
      overlapsMine: conflictVisualizationState.overlapsMine,
      overlapsOthers: hasEnemyOverlap,
      rejectReason: 'invalid_polygon',
    };
  }

  return {
    estimatedEnemyCoveragePercent,
    isCaptureCandidate,
    isCaptureAllowed,
    isClaimAllowed: true,
    overlapPercent,
    overlapsMine: conflictVisualizationState.overlapsMine,
    overlapsOthers: hasEnemyOverlap,
    rejectReason: 'none',
  };
}
