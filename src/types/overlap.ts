export type TerritoryOverlapAnalysis = {
  estimatedOverlapPercent: number;
  hasOverlap: boolean;
  overlapCount: number;
  overlappingMineCount: number;
  overlappingOthersCount: number;
  overlappingTerritoryIds: string[];
};
