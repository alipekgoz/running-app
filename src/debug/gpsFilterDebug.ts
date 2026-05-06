import type { GpsPoint } from '../types';
import {
  calculateDistanceMeters,
  calculateSpeedKmh,
  isAccuracyValid,
  shouldAcceptGpsPoint,
} from '../utils/gpsFilter';

const samplePoints: GpsPoint[] = [
  {
    latitude: 41.0082,
    longitude: 28.9784,
    accuracyMeters: 6,
    timestamp: 1_000,
  },
  {
    latitude: 41.00821,
    longitude: 28.97841,
    accuracyMeters: 7,
    timestamp: 2_000,
  },
  {
    latitude: 41.0088,
    longitude: 28.9792,
    accuracyMeters: 5,
    timestamp: 4_000,
  },
  {
    latitude: 41.0083,
    longitude: 28.9785,
    accuracyMeters: 45,
    timestamp: 7_000,
  },
];

export function runGpsFilterDebug(): void {
  const [firstPoint, secondPoint, thirdPoint, fourthPoint] = samplePoints;

  console.log('GPS filter debug started');
  console.log('First point accuracy valid:', isAccuracyValid(firstPoint));
  console.log('Second point distance from first (m):', calculateDistanceMeters(firstPoint, secondPoint));
  console.log('Third point speed from second (km/h):', calculateSpeedKmh(secondPoint, thirdPoint));
  console.log('Accept second point:', shouldAcceptGpsPoint(firstPoint, secondPoint));
  console.log('Accept third point:', shouldAcceptGpsPoint(secondPoint, thirdPoint));
  console.log('Accept fourth point:', shouldAcceptGpsPoint(thirdPoint, fourthPoint));
}
