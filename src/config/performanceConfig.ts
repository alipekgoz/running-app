export const PERFORMANCE_CONFIG = {
  enablePerformanceDebug: true,
  fetchDebounceMs: 300,
  maxPolygonPointsBeforeSimplify: 80,
  maxRenderedLocalTerritories: 120,
  maxRenderedOnlineTerritories: 250,
  polygonSimplificationTolerance: 0.00005,
  viewportPaddingRatio: 0.2,
} as const;
