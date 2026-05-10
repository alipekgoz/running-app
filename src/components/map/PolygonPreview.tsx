import Mapbox from '@rnmapbox/maps';
import { memo } from 'react';

import {
  conflictSeverityStyleConfig,
  polygonPreviewFillStyle,
  polygonPreviewOutlineStyle,
} from '../../config/mapStyleConfig';
import type { ConflictSeverity } from '../../types';
import type { PolygonPreviewFeature } from '../../utils/geo/routeToPolygonGeoJSON';

const POLYGON_PREVIEW_SOURCE_ID = 'polygon-preview-source';
const POLYGON_PREVIEW_FILL_LAYER_ID = 'polygon-preview-fill';
const POLYGON_PREVIEW_OUTLINE_LAYER_ID = 'polygon-preview-outline';

type PolygonPreviewProps = {
  conflictSeverity: ConflictSeverity;
  geoJSON: PolygonPreviewFeature | null;
};

function PolygonPreviewComponent({ conflictSeverity, geoJSON }: PolygonPreviewProps) {
  if (!geoJSON) {
    return null;
  }

  const conflictStyle = conflictSeverityStyleConfig[conflictSeverity];

  return (
    <Mapbox.ShapeSource id={POLYGON_PREVIEW_SOURCE_ID} shape={geoJSON}>
      <Mapbox.FillLayer
        id={POLYGON_PREVIEW_FILL_LAYER_ID}
        style={
          conflictSeverity === 'none'
            ? polygonPreviewFillStyle
            : {
                ...polygonPreviewFillStyle,
                fillColor: conflictStyle.color,
                fillOpacity: conflictStyle.fillOpacity,
              }
        }
      />
      <Mapbox.LineLayer
        id={POLYGON_PREVIEW_OUTLINE_LAYER_ID}
        style={
          conflictSeverity === 'none'
            ? polygonPreviewOutlineStyle
            : {
                ...polygonPreviewOutlineStyle,
                lineColor: conflictStyle.color,
                lineOpacity: conflictStyle.lineOpacity,
                lineWidth: conflictStyle.lineWidth,
              }
        }
      />
    </Mapbox.ShapeSource>
  );
}

export const PolygonPreview = memo(PolygonPreviewComponent);
