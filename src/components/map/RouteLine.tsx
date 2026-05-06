import Mapbox from '@rnmapbox/maps';
import { memo } from 'react';

import { routeLineStyle } from '../../config/mapStyleConfig';
import type { RouteLineFeature } from '../../utils/routeToGeoJSON';

const ROUTE_SOURCE_ID = 'live-route-source';
const ROUTE_LAYER_ID = 'live-route-line';

type RouteLineProps = {
  geoJSON: RouteLineFeature | null;
};

function RouteLineComponent({ geoJSON }: RouteLineProps) {
  if (!geoJSON) {
    return null;
  }

  return (
    <Mapbox.ShapeSource id={ROUTE_SOURCE_ID} shape={geoJSON}>
      <Mapbox.LineLayer id={ROUTE_LAYER_ID} style={routeLineStyle} />
    </Mapbox.ShapeSource>
  );
}

export const RouteLine = memo(RouteLineComponent);
