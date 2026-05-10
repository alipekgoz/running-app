import Mapbox from '@rnmapbox/maps';
import { memo, useMemo } from 'react';

import {
  conflictSeverityStyleConfig,
  onlineTerritoryConflictOutlineBaseStyle,
  onlineTerritoryMineFillStyle,
  onlineTerritoryMineOutlineStyle,
  onlineTerritoryOtherFillStyle,
  onlineTerritoryOtherOutlineStyle,
} from '../../config/mapStyleConfig';
import type { ConflictSeverity, Coordinates, OnlineTerritory } from '../../types';

type OnlineTerritoryFeature = {
  geometry: {
    coordinates: [number, number][][];
    type: 'Polygon';
  };
  properties: {
    isConflicting: boolean;
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
  conflictSeverity: ConflictSeverity;
  conflictingTerritoryIds: readonly string[];
  territories: readonly OnlineTerritory[];
};

const ONLINE_TERRITORIES_SOURCE_ID = 'online-territories-source';
const ONLINE_TERRITORIES_MINE_FILL_LAYER_ID = 'online-territories-mine-fill';
const ONLINE_TERRITORIES_MINE_OUTLINE_LAYER_ID = 'online-territories-mine-outline';
const ONLINE_TERRITORIES_OTHER_FILL_LAYER_ID = 'online-territories-other-fill';
const ONLINE_TERRITORIES_OTHER_OUTLINE_LAYER_ID = 'online-territories-other-outline';
const ONLINE_TERRITORIES_CONFLICT_MINE_OUTLINE_LAYER_ID = 'online-territories-conflict-mine-outline';
const ONLINE_TERRITORIES_CONFLICT_OTHER_OUTLINE_LAYER_ID = 'online-territories-conflict-other-outline';

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

function toFeatureCollection(
  territories: readonly OnlineTerritory[],
  conflictingTerritoryIds: ReadonlySet<string>,
): OnlineTerritoryFeatureCollection | null {
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
          isConflicting: conflictingTerritoryIds.has(territory.id),
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

function OnlineTerritoriesLayerComponent({
  conflictSeverity,
  conflictingTerritoryIds,
  territories,
}: OnlineTerritoriesLayerProps) {
  const conflictingTerritoryIdSet = useMemo(() => new Set(conflictingTerritoryIds), [conflictingTerritoryIds]);
  const featureCollection = useMemo(
    () => toFeatureCollection(territories, conflictingTerritoryIdSet),
    [conflictingTerritoryIdSet, territories],
  );
  const conflictStyle = conflictSeverityStyleConfig[conflictSeverity];

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
      <Mapbox.LineLayer
        filter={['all', ['==', ['get', 'isMine'], true], ['==', ['get', 'isConflicting'], true]]}
        id={ONLINE_TERRITORIES_CONFLICT_MINE_OUTLINE_LAYER_ID}
        style={{
          ...onlineTerritoryConflictOutlineBaseStyle,
          lineColor: conflictStyle.color,
          lineOpacity: conflictStyle.territoryOpacityBoost,
          lineWidth: onlineTerritoryMineOutlineStyle.lineWidth + conflictStyle.territoryLineWidthBoost,
        }}
      />
      <Mapbox.LineLayer
        filter={['all', ['==', ['get', 'isMine'], false], ['==', ['get', 'isConflicting'], true]]}
        id={ONLINE_TERRITORIES_CONFLICT_OTHER_OUTLINE_LAYER_ID}
        style={{
          ...onlineTerritoryConflictOutlineBaseStyle,
          lineColor: conflictStyle.color,
          lineOpacity: conflictStyle.territoryOpacityBoost,
          lineWidth: onlineTerritoryOtherOutlineStyle.lineWidth + conflictStyle.territoryLineWidthBoost,
        }}
      />
    </Mapbox.ShapeSource>
  );
}

export const OnlineTerritoriesLayer = memo(OnlineTerritoriesLayerComponent);
