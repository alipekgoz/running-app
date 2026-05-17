import type { Coordinates, LocalSavedTerritory, OnlineTerritory, TerritoryCaptureResult, ViewportBounds } from '../types';
import { getSupabaseConfigStatus } from '../config/supabaseConfig';
import { filterTerritoriesByViewport } from '../utils/geo/filterTerritoriesByViewport';
import { getSupabaseClient } from './supabaseClient';

type UploadResult = {
  message: string;
  success: boolean;
};

type FetchTerritoriesResult = {
  didApplyViewportFilter?: boolean;
  message: string;
  success: boolean;
  territories: OnlineTerritory[];
};

type FetchTerritoriesForViewportOptions = {
  bounds?: ViewportBounds | null;
};

type CaptureTransferResult = {
  message: string;
  success: boolean;
  territoryCaptureResult: TerritoryCaptureResult;
};

export type CarvedTerritoryUpdate = {
  areaHectare: number;
  areaM2: number;
  coordinates: Coordinates[];
  id: string;
  sourceRoutePointCount: number;
};

export type TerritoryRow = {
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

export function parseOnlineTerritoryRow(row: TerritoryRow): OnlineTerritory | null {
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
      didApplyViewportFilter: false,
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
        didApplyViewportFilter: false,
        message: error.message,
        success: false,
        territories: [],
      };
    }

    const rows = Array.isArray(data) ? (data as TerritoryRow[]) : [];
    const territories = rows
      .map((row) => parseOnlineTerritoryRow(row))
      .filter((territory): territory is OnlineTerritory => territory !== null);

    return {
      didApplyViewportFilter: false,
      message: `Fetched ${territories.length} online territories.`,
      success: true,
      territories,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown fetch error';

    return {
      didApplyViewportFilter: false,
      message: errorMessage,
      success: false,
      territories: [],
    };
  }
}

export async function fetchTerritoriesForViewport(
  options: FetchTerritoriesForViewportOptions = {},
): Promise<FetchTerritoriesResult> {
  const baseResult = await fetchTerritories();

  if (!baseResult.success || !options.bounds) {
    return baseResult;
  }

  const filteredTerritories = filterTerritoriesByViewport(baseResult.territories, options.bounds);

  return {
    didApplyViewportFilter: true,
    message:
      `Fetched ${baseResult.territories.length} online territories. ` +
      `Viewport filtered to ${filteredTerritories.length}. ` +
      'Spatial filtering is not configured server-side yet; client-side viewport filtering was applied.',
    success: true,
    territories: filteredTerritories,
  };
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
    const { error } = await supabase.from('territories').upsert(
      toTerritoryInsertPayload(territory, playerId),
      { onConflict: 'id' },
    );

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
    const { error } = await supabase.from('territories').upsert(
      territories.map((territory) => toTerritoryInsertPayload(territory, playerId)),
      { onConflict: 'id' },
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

export async function transferTerritoryOwnership(
  capturedTerritoryIds: readonly string[],
  carvedTerritories: readonly CarvedTerritoryUpdate[],
  newTerritory: LocalSavedTerritory,
  playerId?: string | null,
): Promise<CaptureTransferResult> {
  const supabase = getSupabaseClient();
  const captureTimestamp = new Date().toISOString();

  if (!isBackendConfigured() || !supabase) {
    return {
      message: 'Backend is not configured.',
      success: false,
      territoryCaptureResult: {
        captureReason: 'capture_failed',
        captureTimestamp,
        carvedTerritoryIds: carvedTerritories.map((territory) => territory.id),
        capturedTerritoryIds: [...capturedTerritoryIds],
        didCapture: false,
        previousOwnerIds: [],
      },
    };
  }

  if (capturedTerritoryIds.length === 0 && carvedTerritories.length === 0) {
    return {
      message: 'No territory interaction targets were found.',
      success: false,
      territoryCaptureResult: {
        captureReason: 'capture_failed',
        captureTimestamp,
        carvedTerritoryIds: [],
        capturedTerritoryIds: [],
        didCapture: false,
        previousOwnerIds: [],
      },
    };
  }

  try {
    if (capturedTerritoryIds.length > 0) {
      const { error: deleteError } = await supabase.from('territories').delete().in('id', [...capturedTerritoryIds]);

      if (deleteError) {
        return {
          message: deleteError.message,
          success: false,
          territoryCaptureResult: {
            captureReason: 'capture_failed',
            captureTimestamp,
            carvedTerritoryIds: carvedTerritories.map((territory) => territory.id),
            capturedTerritoryIds: [...capturedTerritoryIds],
            didCapture: false,
            previousOwnerIds: [],
          },
        };
      }
    }

    for (const carvedTerritory of carvedTerritories) {
      const { error: updateError } = await supabase
        .from('territories')
        .update({
          area_hectare: carvedTerritory.areaHectare,
          area_m2: carvedTerritory.areaM2,
          coordinates: carvedTerritory.coordinates,
          source_route_point_count: carvedTerritory.sourceRoutePointCount,
        })
        .eq('id', carvedTerritory.id);

      if (updateError) {
        return {
          message: updateError.message,
          success: false,
          territoryCaptureResult: {
            captureReason: 'capture_failed',
            captureTimestamp,
            carvedTerritoryIds: carvedTerritories.map((territory) => territory.id),
            capturedTerritoryIds: [...capturedTerritoryIds],
            didCapture: false,
            previousOwnerIds: [],
          },
        };
      }
    }

    const { error: insertError } = await supabase.from('territories').insert(toTerritoryInsertPayload(newTerritory, playerId));

    if (insertError) {
      return {
        message: insertError.message,
        success: false,
        territoryCaptureResult: {
          captureReason: 'capture_failed',
          captureTimestamp,
          carvedTerritoryIds: carvedTerritories.map((territory) => territory.id),
          capturedTerritoryIds: [...capturedTerritoryIds],
          didCapture: false,
          previousOwnerIds: [],
        },
      };
    }

    const captureReason: TerritoryCaptureResult['captureReason'] =
      capturedTerritoryIds.length > 0
        ? 'enemy_territory_captured'
        : carvedTerritories.length > 0
          ? 'enemy_territory_reduced'
          : 'territory_claimed';

    return {
      message:
        capturedTerritoryIds.length > 0
          ? `Captured ${capturedTerritoryIds.length} territory slot${capturedTerritoryIds.length === 1 ? '' : 's'}.`
          : `Reduced ${carvedTerritories.length} enemy territory slot${carvedTerritories.length === 1 ? '' : 's'}.`,
      success: true,
      territoryCaptureResult: {
        captureReason,
        captureTimestamp,
        carvedTerritoryIds: carvedTerritories.map((territory) => territory.id),
        capturedTerritoryIds: [...capturedTerritoryIds],
        didCapture: capturedTerritoryIds.length > 0,
        newTerritoryId: newTerritory.id,
        previousOwnerIds: [],
      },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown capture transfer error';

    return {
      message: errorMessage,
      success: false,
      territoryCaptureResult: {
        captureReason: 'capture_failed',
        captureTimestamp,
        carvedTerritoryIds: carvedTerritories.map((territory) => territory.id),
        capturedTerritoryIds: [...capturedTerritoryIds],
        didCapture: false,
        previousOwnerIds: [],
      },
    };
  }
}
