import type { PolygonAreaAnalysis } from './calculatePolygonArea';
import type { PolygonPreviewAnalysis } from './routeToPolygonGeoJSON';
import type { TerritoryPreviewPayload } from '../../types';
import { filterValidCoordinates } from './coordinateValidation';

export function buildTerritoryPreviewPayload(
  coordinates: readonly { latitude: number; longitude: number }[],
  polygonAreaAnalysis: PolygonAreaAnalysis,
  polygonPreviewAnalysis: PolygonPreviewAnalysis,
): TerritoryPreviewPayload | null {
  if (!polygonAreaAnalysis.isValid || !polygonAreaAnalysis.result || !polygonPreviewAnalysis.isRendered) {
    return null;
  }

  const validCoordinates = filterValidCoordinates(coordinates);

  if (validCoordinates.length < 3) {
    return null;
  }

  return {
    areaHectare: polygonAreaAnalysis.result.areaHectare,
    areaM2: polygonAreaAnalysis.result.areaM2,
    coordinates: validCoordinates,
    createdAt: new Date().toISOString(),
    sourceRoutePointCount: coordinates.length,
  };
}
