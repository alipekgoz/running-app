export const TRACKING_CONFIG = {
  maxAccuracyMeters: 20,
  minDistanceBetweenPointsMeters: 5,
  maxRunningSpeedKmh: 12,
  polygonClosureDistanceMeters: 15,
  minPolygonPoints: 10,
  minPolygonAreaM2: 50,
  polygonClosureDebounceMs: 2000,
  minPointsBeforeClosureCheck: 15,
} as const;
