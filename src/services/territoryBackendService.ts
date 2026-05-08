import type { LocalSavedTerritory } from '../types';
import { getSupabaseConfigStatus } from '../config/supabaseConfig';
import { getSupabaseClient } from './supabaseClient';

type UploadResult = {
  message: string;
  success: boolean;
};

function toTerritoryInsertPayload(territory: LocalSavedTerritory) {
  return {
    area_hectare: territory.areaHectare,
    area_m2: territory.areaM2,
    coordinates: territory.coordinates,
    created_at: territory.createdAt,
    device_id: null,
    id: territory.id,
    source_route_point_count: territory.sourceRoutePointCount,
    sync_status: 'synced',
  };
}

export function isBackendConfigured(): boolean {
  return getSupabaseConfigStatus().isConfigured && getSupabaseClient() !== null;
}

export async function uploadTerritory(territory: LocalSavedTerritory): Promise<UploadResult> {
  const supabase = getSupabaseClient();

  if (!isBackendConfigured() || !supabase) {
    return {
      message: 'Backend is not configured.',
      success: false,
    };
  }

  try {
    const { error } = await supabase.from('territories').insert(toTerritoryInsertPayload(territory));

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

export async function uploadTerritories(territories: readonly LocalSavedTerritory[]): Promise<UploadResult> {
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
    const { error } = await supabase.from('territories').insert(territories.map(toTerritoryInsertPayload));

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
