export type TerritoryOverlapAnalysis = {
  estimatedOverlapPercent: number;
  hasOverlap: boolean;
  overlapCount: number;
  overlappingMineCount: number;
  overlappingOthersCount: number;
  overlappingTerritoryIds: string[];
};

export type OverlapComparableTerritory = {
  coordinates: import('./location').Coordinates[];
  id: string;
  isMine: boolean;
};
