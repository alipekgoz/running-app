import type { Coordinates } from './location';

export type TerritoryPreviewPayload = {
  areaHectare: number;
  areaM2: number;
  coordinates: Coordinates[];
  createdAt: string;
  sourceRoutePointCount: number;
};

export type LocalSavedTerritory = TerritoryPreviewPayload & {
  id: string;
  status: 'local_saved';
};

export type OnlineTerritory = {
  areaHectare: number;
  areaM2: number;
  coordinates: Coordinates[];
  createdAt: string;
  deviceId: string | null;
  id: string;
  isMine?: boolean;
  sourceRoutePointCount: number;
  syncStatus: string;
  updatedAt: string;
  userId?: string | null;
};

export type ViewportBounds = {
  center: Coordinates;
  east: number;
  north: number;
  south: number;
  west: number;
  zoomLevel: number;
};
