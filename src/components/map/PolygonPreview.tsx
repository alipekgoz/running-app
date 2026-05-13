import Mapbox from '@rnmapbox/maps';
import { memo, useMemo } from 'react';

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
  isClaimRejected: boolean;
};

function PolygonPreviewComponent({ conflictSeverity, geoJSON, isClaimRejected }: PolygonPreviewProps) {
  if (!geoJSON) {
    return null;
  }

  const conflictStyle = conflictSeverityStyleConfig[isClaimRejected ? 'high' : conflictSeverity];
  const fillStyle = useMemo(
    () =>
      conflictSeverity === 'none'
        ? polygonPreviewFillStyle
        : {
            ...polygonPreviewFillStyle,
            fillColor: conflictStyle.color,
            fillOpacity: conflictStyle.fillOpacity,
          },
    [conflictSeverity, conflictStyle],
  );
  const outlineStyle = useMemo(
    () =>
      conflictSeverity === 'none'
        ? polygonPreviewOutlineStyle
        : {
            ...polygonPreviewOutlineStyle,
            lineColor: conflictStyle.color,
            lineOpacity: conflictStyle.lineOpacity,
            lineWidth: isClaimRejected ? conflictStyle.lineWidth + 0.4 : conflictStyle.lineWidth,
          },
    [conflictSeverity, conflictStyle, isClaimRejected],
  );

  return (
    <Mapbox.ShapeSource id={POLYGON_PREVIEW_SOURCE_ID} shape={geoJSON}>
      <Mapbox.FillLayer id={POLYGON_PREVIEW_FILL_LAYER_ID} style={fillStyle} />
      <Mapbox.LineLayer id={POLYGON_PREVIEW_OUTLINE_LAYER_ID} style={outlineStyle} />
    </Mapbox.ShapeSource>
  );
}

export const PolygonPreview = memo(PolygonPreviewComponent);
