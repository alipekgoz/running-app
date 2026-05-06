import { POLYGON_CONFIG } from '../../config/polygonConfig';
import type { Coordinates } from '../../types';
import { calculateDistanceMeters } from '../gpsFilter';
import { calculateBoundingBox, type BoundingBox } from './calculateBoundingBox';
import { calculateClosureDistance } from './calculateClosureDistance';
import { filterValidCoordinates } from './coordinateValidation';

export type PolygonCandidateRejectionReason =
  | 'not enough valid points'
  | 'closure too far'
  | 'bounding box missing'
  | 'bounding box too small'
  | 'shape area too small'
  | 'too many duplicate points'
  | null;

export type PolygonCandidateAnalysis = {
  boundingBox: BoundingBox | null;
  boundingBoxAreaM2: number | null;
  boundingBoxHeightMeters: number | null;
  boundingBoxWidthMeters: number | null;
  closureDistanceMeters: number | null;
  isCandidate: boolean;
  pointCount: number;
  rejectionReason: PolygonCandidateRejectionReason;
  validPointCount: number;
};

const METERS_PER_DEGREE_LATITUDE = 111_320;
const MINIMUM_BUCKET_SIZE_DEGREES = 0.00001;

function toLongitudeBucketSize(latitude: number): number {
  const latitudeRadians = (latitude * Math.PI) / 180;
  const metersPerDegreeLongitude = Math.max(
    Math.cos(latitudeRadians) * METERS_PER_DEGREE_LATITUDE,
    1,
  );

  return Math.max(
    POLYGON_CONFIG.duplicatePointToleranceMeters / metersPerDegreeLongitude,
    MINIMUM_BUCKET_SIZE_DEGREES,
  );
}

function buildDuplicateKey(coordinate: Coordinates): string {
  const latitudeBucketSize = Math.max(
    POLYGON_CONFIG.duplicatePointToleranceMeters / METERS_PER_DEGREE_LATITUDE,
    MINIMUM_BUCKET_SIZE_DEGREES,
  );
  const longitudeBucketSize = toLongitudeBucketSize(coordinate.latitude);
  const latitudeBucket = Math.round(coordinate.latitude / latitudeBucketSize);
  const longitudeBucket = Math.round(coordinate.longitude / longitudeBucketSize);

  return `${latitudeBucket}:${longitudeBucket}`;
}

function calculateBoundingBoxMetrics(
  boundingBox: BoundingBox | null,
): Pick<PolygonCandidateAnalysis, 'boundingBoxAreaM2' | 'boundingBoxHeightMeters' | 'boundingBoxWidthMeters'> {
  if (!boundingBox) {
    return {
      boundingBoxAreaM2: null,
      boundingBoxHeightMeters: null,
      boundingBoxWidthMeters: null,
    };
  }

  const southWest = {
    latitude: boundingBox.minLatitude,
    longitude: boundingBox.minLongitude,
  };
  const northWest = {
    latitude: boundingBox.maxLatitude,
    longitude: boundingBox.minLongitude,
  };
  const southEast = {
    latitude: boundingBox.minLatitude,
    longitude: boundingBox.maxLongitude,
  };
  const boundingBoxHeightMeters = calculateDistanceMeters(southWest, northWest);
  const boundingBoxWidthMeters = calculateDistanceMeters(southWest, southEast);

  return {
    boundingBoxAreaM2: boundingBoxHeightMeters * boundingBoxWidthMeters,
    boundingBoxHeightMeters,
    boundingBoxWidthMeters,
  };
}

function calculateDuplicatePointRatio(validCoordinates: readonly Coordinates[]): number {
  if (validCoordinates.length === 0) {
    return 1;
  }

  const uniqueCoordinateKeys = new Set(validCoordinates.map(buildDuplicateKey));

  return 1 - uniqueCoordinateKeys.size / validCoordinates.length;
}

export function analyzePolygonCandidate(coordinates: readonly Coordinates[]): PolygonCandidateAnalysis {
  const validCoordinates = filterValidCoordinates(coordinates);
  const pointCount = coordinates.length;
  const validPointCount = validCoordinates.length;
  const closureDistanceMeters = calculateClosureDistance(validCoordinates);
  const boundingBox = calculateBoundingBox(validCoordinates);
  const boundingBoxMetrics = calculateBoundingBoxMetrics(boundingBox);
  const duplicatePointRatio = calculateDuplicatePointRatio(validCoordinates);

  let rejectionReason: PolygonCandidateRejectionReason = null;

  if (validPointCount < POLYGON_CONFIG.minimumPolygonPoints) {
    rejectionReason = 'not enough valid points';
  } else if (closureDistanceMeters == null || closureDistanceMeters > POLYGON_CONFIG.closureDistanceMeters) {
    rejectionReason = 'closure too far';
  } else if (!boundingBox) {
    rejectionReason = 'bounding box missing';
  } else if (
    (boundingBoxMetrics.boundingBoxWidthMeters ?? 0) < POLYGON_CONFIG.minimumBoundingBoxSizeMeters ||
    (boundingBoxMetrics.boundingBoxHeightMeters ?? 0) < POLYGON_CONFIG.minimumBoundingBoxSizeMeters
  ) {
    rejectionReason = 'bounding box too small';
  } else if ((boundingBoxMetrics.boundingBoxAreaM2 ?? 0) < POLYGON_CONFIG.minimumBoundingBoxAreaM2) {
    rejectionReason = 'shape area too small';
  } else if (duplicatePointRatio > POLYGON_CONFIG.maximumDuplicatePointRatio) {
    rejectionReason = 'too many duplicate points';
  }

  return {
    boundingBox,
    ...boundingBoxMetrics,
    closureDistanceMeters,
    isCandidate: rejectionReason === null,
    pointCount,
    rejectionReason,
    validPointCount,
  };
}

export function isPolygonCandidate(coordinates: readonly Coordinates[]): boolean {
  return analyzePolygonCandidate(coordinates).isCandidate;
}
