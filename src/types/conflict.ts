export type ConflictSeverity = 'none' | 'low' | 'medium' | 'high';

export type ConflictVisualizationState = {
  hasConflict: boolean;
  overlapPercent: number;
  overlapsMine: boolean;
  overlapsOthers: boolean;
  severity: ConflictSeverity;
};
