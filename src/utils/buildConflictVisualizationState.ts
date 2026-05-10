import type { ConflictSeverity, ConflictVisualizationState, TerritoryOverlapAnalysis } from '../types';

export const CONFLICT_VISUALIZATION_THRESHOLDS = {
  high: 40,
  low: 1,
  medium: 15,
} as const;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

export function getConflictSeverity(overlapPercent: number): ConflictSeverity {
  const normalizedPercent = clampPercent(overlapPercent);

  if (normalizedPercent >= CONFLICT_VISUALIZATION_THRESHOLDS.high) {
    return 'high';
  }

  if (normalizedPercent >= CONFLICT_VISUALIZATION_THRESHOLDS.medium) {
    return 'medium';
  }

  if (normalizedPercent >= CONFLICT_VISUALIZATION_THRESHOLDS.low) {
    return 'low';
  }

  return 'none';
}

export function buildConflictVisualizationState(
  overlapAnalysis: TerritoryOverlapAnalysis,
): ConflictVisualizationState {
  const overlapPercent = clampPercent(overlapAnalysis.estimatedOverlapPercent);
  const severity = getConflictSeverity(overlapPercent);

  return {
    hasConflict: overlapAnalysis.hasOverlap,
    overlapPercent,
    overlapsMine: overlapAnalysis.overlappingMineCount > 0,
    overlapsOthers: overlapAnalysis.overlappingOthersCount > 0,
    severity,
  };
}
