import type { Coordinates, LocalSavedTerritory, OnlineTerritory } from '../types';
import { getSupabaseConfigStatus } from '../config/supabaseConfig';
import { getSupabaseClient } from './supabaseClient';

type UploadResult = {
  message: string;
  success: boolean;
};

type FetchTerritoriesResult = {
  message: string;
  success: boolean;
  territories: OnlineTerritory[];
};

type TerritoryRow = {
  area_hectare?: unknown;
  area_m2?: unknown;
  coordinates?: unknown;
  created_at?: unknown;
  device_id?: unknown;
  id?: unknown;
  source_route_point_count?: unknown;
  sync_status?: unknown;
  updated_at?: unknown;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isCoordinate(value: unknown): value is Coordinates {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const coordinate = value as Record<string, unknown>;

  return (
    isFiniteNumber(coordinate.latitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    isFiniteNumber(coordinate.longitude) &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180
  );
}

function toOnlineTerritory(row: TerritoryRow): OnlineTerritory | null {
  if (
    !isNonEmptyString(row.id) ||
    !Array.isArray(row.coordinates) ||
    !row.coordinates.every(isCoordinate) ||
    !isFiniteNumber(row.area_m2) ||
    !isFiniteNumber(row.area_hectare) ||
    !isFiniteNumber(row.source_route_point_count) ||
    !isNonEmptyString(row.created_at) ||
    !isNonEmptyString(row.updated_at) ||
    !isNonEmptyString(row.sync_status)
  ) {
    return null;
  }

  return {
    areaHectare: row.area_hectare,
    areaM2: row.area_m2,
    coordinates: row.coordinates,
    createdAt: row.created_at,
    deviceId: isNonEmptyString(row.device_id) ? row.device_id : null,
    id: row.id,
    sourceRoutePointCount: row.source_route_point_count,
    syncStatus: row.sync_status,
    updatedAt: row.updated_at,
  };
}

function toTerritoryInsertPayload(territory: LocalSavedTerritory, playerId?: string | null) {
  return {
    area_hectare: territory.areaHectare,
    area_m2: territory.areaM2,
    coordinates: territory.coordinates,
    created_at: territory.createdAt,
    device_id: playerId ?? null,
    id: territory.id,
    source_route_point_count: territory.sourceRoutePointCount,
    sync_status: 'synced',
  };
}

export function isBackendConfigured(): boolean {
  return getSupabaseConfigStatus().isConfigured && getSupabaseClient() !== null;
}

export async function fetchTerritories(): Promise<FetchTerritoriesResult> {
  const supabase = getSupabaseClient();

  if (!isBackendConfigured() || !supabase) {
    return {
      message: 'Backend is not configured.',
      success: false,
      territories: [],
    };
  }

  try {
    const { data, error } = await supabase
      .from('territories')
      .select('id, device_id, coordinates, area_m2, area_hectare, source_route_point_count, created_at, updated_at, sync_status')
      .order('created_at', { ascending: false });

    if (error) {
      return {
        message: error.message,
        success: false,
        territories: [],
      };
    }

    const rows = Array.isArray(data) ? (data as TerritoryRow[]) : [];
    const territories = rows
      .map((row) => toOnlineTerritory(row))
      .filter((territory): territory is OnlineTerritory => territory !== null);

    return {
      message: `Fetched ${territories.length} online territories.`,
      success: true,
      territories,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown fetch error';

    return {
      message: errorMessage,
      success: false,
      territories: [],
    };
  }
}

export async function fetchTerritoriesForViewport(): Promise<FetchTerritoriesResult> {
  return fetchTerritories();
}

export async function uploadTerritory(
  territory: LocalSavedTerritory,
  playerId?: string | null,
): Promise<UploadResult> {
  const supabase = getSupabaseClient();

  if (!isBackendConfigured() || !supabase) {
    return {
      message: 'Backend is not configured.',
      success: false,
    };
  }

  try {
    const { error } = await supabase.from('territories').insert(toTerritoryInsertPayload(territory, playerId));

    if (error) {
      return {
        message: error.message,
        success: false,
      };
    }

    return {
      message: 'Territory uploaded successfully.',
      success: true,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';

    return {
      message: errorMessage,
      success: false,
    };
  }
}

export async function uploadTerritories(
  territories: readonly LocalSavedTerritory[],
  playerId?: string | null,
): Promise<UploadResult> {
  const supabase = getSupabaseClient();

  if (!isBackendConfigured() || !supabase) {
    return {
      message: 'Backend is not configured.',
      success: false,
    };
  }

  if (territories.length === 0) {
    return {
      message: 'No local territories to sync.',
      success: false,
    };
  }

  try {
    const { error } = await supabase.from('territories').insert(
      territories.map((territory) => toTerritoryInsertPayload(territory, playerId)),
    );

    if (error) {
      return {
        message: error.message,
        success: false,
      };
    }

    return {
      message: `Uploaded ${territories.length} territories.`,
      success: true,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown batch upload error';

    return {
      message: errorMessage,
      success: false,
    };
  }
}
