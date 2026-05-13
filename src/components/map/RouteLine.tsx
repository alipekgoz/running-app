import Mapbox from '@rnmapbox/maps';
import { memo, useMemo } from 'react';

import { polygonCandidateRouteLineStyle, routeLineStyle } from '../../config/mapStyleConfig';
import type { RouteLineFeature } from '../../utils/routeToGeoJSON';

const ROUTE_SOURCE_ID = 'live-route-source';
const ROUTE_LAYER_ID = 'live-route-line';

type RouteLineProps = {
  geoJSON: RouteLineFeature | null;
  isPolygonCandidate?: boolean;
};

function RouteLineComponent({ geoJSON, isPolygonCandidate = false }: RouteLineProps) {
  if (!geoJSON) {
    return null;
  }

  const lineStyle = useMemo(
    () => (isPolygonCandidate ? polygonCandidateRouteLineStyle : routeLineStyle),
    [isPolygonCandidate],
  );

  return (
    <Mapbox.ShapeSource id={ROUTE_SOURCE_ID} shape={geoJSON}>
      <Mapbox.LineLayer id={ROUTE_LAYER_ID} style={lineStyle} />
    </Mapbox.ShapeSource>
  );
}

export const RouteLine = memo(RouteLineComponent);
