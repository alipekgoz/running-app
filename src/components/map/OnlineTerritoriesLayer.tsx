import Mapbox from '@rnmapbox/maps';
import { memo, useMemo } from 'react';

import {
  onlineTerritoryMineFillStyle,
  onlineTerritoryMineOutlineStyle,
  onlineTerritoryOtherFillStyle,
  onlineTerritoryOtherOutlineStyle,
} from '../../config/mapStyleConfig';
import type { Coordinates, OnlineTerritory } from '../../types';

type OnlineTerritoryFeature = {
  geometry: {
    coordinates: [number, number][][];
    type: 'Polygon';
  };
  properties: {
    id: string;
    isMine: boolean;
  };
  type: 'Feature';
};

type OnlineTerritoryFeatureCollection = {
  features: OnlineTerritoryFeature[];
  type: 'FeatureCollection';
};

type OnlineTerritoriesLayerProps = {
  territories: readonly OnlineTerritory[];
};

const ONLINE_TERRITORIES_SOURCE_ID = 'online-territories-source';
const ONLINE_TERRITORIES_MINE_FILL_LAYER_ID = 'online-territories-mine-fill';
const ONLINE_TERRITORIES_MINE_OUTLINE_LAYER_ID = 'online-territories-mine-outline';
const ONLINE_TERRITORIES_OTHER_FILL_LAYER_ID = 'online-territories-other-fill';
const ONLINE_TERRITORIES_OTHER_OUTLINE_LAYER_ID = 'online-territories-other-outline';

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

function toFeatureCollection(territories: readonly OnlineTerritory[]): OnlineTerritoryFeatureCollection | null {
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
          id: territory.id,
          isMine: territory.isMine === true,
        },
        type: 'Feature' as const,
      };
    })
    .filter((feature): feature is OnlineTerritoryFeature => feature !== null);

  if (features.length === 0) {
    return null;
  }

  return {
    features,
    type: 'FeatureCollection',
  };
}

function OnlineTerritoriesLayerComponent({ territories }: OnlineTerritoriesLayerProps) {
  const featureCollection = useMemo(() => toFeatureCollection(territories), [territories]);

  if (!featureCollection) {
    return null;
  }

  return (
    <Mapbox.ShapeSource id={ONLINE_TERRITORIES_SOURCE_ID} shape={featureCollection}>
      <Mapbox.FillLayer
        filter={['==', ['get', 'isMine'], true]}
        id={ONLINE_TERRITORIES_MINE_FILL_LAYER_ID}
        style={onlineTerritoryMineFillStyle}
      />
      <Mapbox.LineLayer
        filter={['==', ['get', 'isMine'], true]}
        id={ONLINE_TERRITORIES_MINE_OUTLINE_LAYER_ID}
        style={onlineTerritoryMineOutlineStyle}
      />
      <Mapbox.FillLayer
        filter={['==', ['get', 'isMine'], false]}
        id={ONLINE_TERRITORIES_OTHER_FILL_LAYER_ID}
        style={onlineTerritoryOtherFillStyle}
      />
      <Mapbox.LineLayer
        filter={['==', ['get', 'isMine'], false]}
        id={ONLINE_TERRITORIES_OTHER_OUTLINE_LAYER_ID}
        style={onlineTerritoryOtherOutlineStyle}
      />
    </Mapbox.ShapeSource>
  );
}

export const OnlineTerritoriesLayer = memo(OnlineTerritoriesLayerComponent);
