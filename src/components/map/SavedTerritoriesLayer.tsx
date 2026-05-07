import Mapbox from '@rnmapbox/maps';
import { memo, useMemo } from 'react';

import { savedTerritoryFillStyle, savedTerritoryOutlineStyle } from '../../config/mapStyleConfig';
import type { Coordinates, LocalSavedTerritory } from '../../types';

type SavedTerritoryFeature = {
  geometry: {
    coordinates: [number, number][][]; 
    type: 'Polygon';
  };
  properties: {
    areaM2: number;
    id: string;
    pointCount: number;
  };
  type: 'Feature';
};

type SavedTerritoryFeatureCollection = {
  features: SavedTerritoryFeature[];
  type: 'FeatureCollection';
};

type SavedTerritoriesLayerProps = {
  territories: readonly LocalSavedTerritory[];
};

const SAVED_TERRITORIES_SOURCE_ID = 'saved-territories-source';
const SAVED_TERRITORIES_FILL_LAYER_ID = 'saved-territories-fill';
const SAVED_TERRITORIES_OUTLINE_LAYER_ID = 'saved-territories-outline';

function ensureClosedRing(coordinates: readonly Coordinates[]): [number, number][] {
  if (coordinates.length === 0) {
    return [];
  }

  const ring = coordinates.map(
    (coordinate: Coordinates) => [coordinate.longitude, coordinate.latitude] as [number, number],
  );
  const firstCoordinate = ring[0];
  const lastCoordinate = ring[ring.length - 1];

  if (firstCoordinate[0] === lastCoordinate[0] && firstCoordinate[1] === lastCoordinate[1]) {
    return ring;
  }

  return [...ring, firstCoordinate];
}

function toFeatureCollection(territories: readonly LocalSavedTerritory[]): SavedTerritoryFeatureCollection | null {
  const features = territories
    .map((territory) => {
      const closedRing = ensureClosedRing(territory.coordinates);

      if (closedRing.length < 4) {
        return null;
      }

      return {
        geometry: {
          coordinates: [closedRing],
          type: 'Polygon' as const,
        },
        properties: {
          areaM2: territory.areaM2,
          id: territory.id,
          pointCount: closedRing.length,
        },
        type: 'Feature' as const,
      };
    })
    .filter((feature): feature is SavedTerritoryFeature => feature !== null);

  if (features.length === 0) {
    return null;
  }

  return {
    features,
    type: 'FeatureCollection',
  };
}

function SavedTerritoriesLayerComponent({ territories }: SavedTerritoriesLayerProps) {
  const featureCollection = useMemo(() => toFeatureCollection(territories), [territories]);

  if (!featureCollection) {
    return null;
  }

  return (
    <Mapbox.ShapeSource id={SAVED_TERRITORIES_SOURCE_ID} shape={featureCollection}>
      <Mapbox.FillLayer id={SAVED_TERRITORIES_FILL_LAYER_ID} style={savedTerritoryFillStyle} />
      <Mapbox.LineLayer id={SAVED_TERRITORIES_OUTLINE_LAYER_ID} style={savedTerritoryOutlineStyle} />
    </Mapbox.ShapeSource>
  );
}

export const SavedTerritoriesLayer = memo(SavedTerritoriesLayerComponent);
