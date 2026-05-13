import type { Coordinates, ViewportBounds } from '../../types';

type VisibleBounds = {
  ne: readonly [number, number];
  sw: readonly [number, number];
};

type CalculateViewportBoundsArgs = {
  aspectRatio?: number;
  center: Coordinates;
  paddingRatio?: number;
  visibleBounds?: VisibleBounds | null;
  zoomLevel: number;
};

function clampLatitude(latitude: number): number {
  return Math.max(-85, Math.min(85, latitude));
}

function clampLongitude(longitude: number): number {
  if (longitude < -180) {
    return longitude + 360;
  }

  if (longitude > 180) {
    return longitude - 360;
  }

  return longitude;
}

export function calculateViewportBounds({
  aspectRatio = 1,
  center,
  paddingRatio = 0,
  visibleBounds,
  zoomLevel,
}: CalculateViewportBoundsArgs): ViewportBounds {
  if (visibleBounds) {
    const east = Math.max(visibleBounds.ne[0], visibleBounds.sw[0]);
    const west = Math.min(visibleBounds.ne[0], visibleBounds.sw[0]);
    const north = Math.max(visibleBounds.ne[1], visibleBounds.sw[1]);
    const south = Math.min(visibleBounds.ne[1], visibleBounds.sw[1]);
    const latitudePadding = (north - south) * paddingRatio;
    const longitudePadding = (east - west) * paddingRatio;

    return {
      center,
      east: clampLongitude(east + longitudePadding),
      north: clampLatitude(north + latitudePadding),
      south: clampLatitude(south - latitudePadding),
      west: clampLongitude(west - longitudePadding),
      zoomLevel,
    };
  }

  const latitudeRadians = (center.latitude * Math.PI) / 180;
  const baseLongitudeSpan = 360 / 2 ** zoomLevel;
  const aspectAdjustedLongitudeSpan = baseLongitudeSpan * Math.max(1, aspectRatio);
  const latitudeSpan = aspectAdjustedLongitudeSpan * Math.max(0.2, 1 / Math.max(aspectRatio, 0.2)) * Math.cos(latitudeRadians);
  const paddedLongitudeSpan = aspectAdjustedLongitudeSpan * (1 + paddingRatio * 2);
  const paddedLatitudeSpan = latitudeSpan * (1 + paddingRatio * 2);

  return {
    center,
    east: clampLongitude(center.longitude + paddedLongitudeSpan / 2),
    north: clampLatitude(center.latitude + paddedLatitudeSpan / 2),
    south: clampLatitude(center.latitude - paddedLatitudeSpan / 2),
    west: clampLongitude(center.longitude - paddedLongitudeSpan / 2),
    zoomLevel,
  };
}
