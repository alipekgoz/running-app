import { TRACKING_CONFIG } from '../config/trackingConfig';
import type { Coordinates, GpsPoint } from '../types';

const EARTH_RADIUS_METERS = 6371000;
const MILLISECONDS_PER_HOUR = 3_600_000;

export type GpsPointRejectionReason = 'accuracy too low' | 'distance too small' | 'speed too high' | null;

export function isAccuracyValid(point: GpsPoint): boolean {
  const isValid = point.accuracyMeters <= TRACKING_CONFIG.maxAccuracyMeters;

  if (!isValid) {
    console.log('GPS point rejected: accuracy too low', {
      accuracyMeters: point.accuracyMeters,
      maxAccuracyMeters: TRACKING_CONFIG.maxAccuracyMeters,
      point,
    });
  }

  return isValid;
}

export function calculateDistanceMeters(a: Coordinates, b: Coordinates): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);

  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const angularDistance = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return EARTH_RADIUS_METERS * angularDistance;
}

export function calculateSpeedKmh(previousPoint: GpsPoint, currentPoint: GpsPoint): number {
  const distanceMeters = calculateDistanceMeters(previousPoint, currentPoint);
  const elapsedMs = currentPoint.timestamp - previousPoint.timestamp;

  if (elapsedMs <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  return (distanceMeters / elapsedMs) * MILLISECONDS_PER_HOUR / 1000;
}

export function shouldAcceptGpsPoint(previousPoint: GpsPoint | null, currentPoint: GpsPoint): boolean {
  return getGpsPointRejectionReason(previousPoint, currentPoint) === null;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function getGpsPointRejectionReason(
  previousPoint: GpsPoint | null,
  currentPoint: GpsPoint,
): GpsPointRejectionReason {
  if (!isAccuracyValid(currentPoint)) {
    return 'accuracy too low';
  }

  if (!previousPoint) {
    return null;
  }

  const distanceMeters = calculateDistanceMeters(previousPoint, currentPoint);

  if (distanceMeters < TRACKING_CONFIG.minDistanceBetweenPointsMeters) {
    console.log('GPS point rejected: distance too small', {
      distanceMeters,
      minDistanceBetweenPointsMeters: TRACKING_CONFIG.minDistanceBetweenPointsMeters,
      previousPoint,
      currentPoint,
    });
    return 'distance too small';
  }

  const speedKmh = calculateSpeedKmh(previousPoint, currentPoint);

  if (speedKmh > TRACKING_CONFIG.maxRunningSpeedKmh) {
    console.log('GPS point rejected: speed too high', {
      speedKmh,
      maxRunningSpeedKmh: TRACKING_CONFIG.maxRunningSpeedKmh,
      previousPoint,
      currentPoint,
    });
    return 'speed too high';
  }

  return null;
}
