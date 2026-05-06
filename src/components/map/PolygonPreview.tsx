import Mapbox from '@rnmapbox/maps';
import { memo } from 'react';

import { polygonPreviewFillStyle, polygonPreviewOutlineStyle } from '../../config/mapStyleConfig';
import type { PolygonPreviewFeature } from '../../utils/geo/routeToPolygonGeoJSON';

const POLYGON_PREVIEW_SOURCE_ID = 'polygon-preview-source';
const POLYGON_PREVIEW_FILL_LAYER_ID = 'polygon-preview-fill';
const POLYGON_PREVIEW_OUTLINE_LAYER_ID = 'polygon-preview-outline';

type PolygonPreviewProps = {
  geoJSON: PolygonPreviewFeature | null;
};

function PolygonPreviewComponent({ geoJSON }: PolygonPreviewProps) {
  if (!geoJSON) {
    return null;
  }

  return (
    <Mapbox.ShapeSource id={POLYGON_PREVIEW_SOURCE_ID} shape={geoJSON}>
      <Mapbox.FillLayer id={POLYGON_PREVIEW_FILL_LAYER_ID} style={polygonPreviewFillStyle} />
      <Mapbox.LineLayer id={POLYGON_PREVIEW_OUTLINE_LAYER_ID} style={polygonPreviewOutlineStyle} />
    </Mapbox.ShapeSource>
  );
}

export const PolygonPreview = memo(PolygonPreviewComponent);
