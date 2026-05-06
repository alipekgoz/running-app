import type { GpsPoint } from '../types';
import { isValidCoordinate } from './geo/coordinateValidation';

type LineStringGeometry = {
  coordinates: [number, number][];
  type: 'LineString';
};

export type RouteLineFeature = {
  geometry: LineStringGeometry;
  properties: {
    pointCount: number;
  };
  type: 'Feature';
};

export function routeToGeoJSON(routePoints: readonly GpsPoint[]): RouteLineFeature | null {
  const coordinates: [number, number][] = [];

  for (const point of routePoints) {
    if (!isValidCoordinate(point)) {
      continue;
    }

    coordinates.push([point.longitude, point.latitude]);
  }

  if (coordinates.length < 2) {
    return null;
  }

  return {
    geometry: {
      coordinates,
      type: 'LineString',
    },
    properties: {
      pointCount: coordinates.length,
    },
    type: 'Feature',
  };
}
