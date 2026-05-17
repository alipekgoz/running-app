import { type RealtimeChannel, type RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import type { TerritoryRealtimeEvent, TerritoryRealtimeEventType } from '../types';
import { isBackendConfigured, parseOnlineTerritoryRow, type TerritoryRow } from './territoryBackendService';
import { getSupabaseClient } from './supabaseClient';

type TerritoryRealtimeSubscriptionOptions = {
  onConnectionChange?: (connected: boolean) => void;
  onError?: (message: string | null) => void;
  onEvent?: (event: TerritoryRealtimeEvent) => void;
};

type TerritoryRealtimeSubscription = {
  enabled: boolean;
  unsubscribe: () => Promise<void>;
};

function getTerritoryIdFromPayloadRow(row: Partial<TerritoryRow> | Record<string, never>): string | null {
  return typeof row.id === 'string' && row.id.trim().length > 0 ? row.id : null;
}

function toTerritoryRealtimeEvent(
  payload: RealtimePostgresChangesPayload<TerritoryRow>,
): TerritoryRealtimeEvent | null {
  const receivedAt = new Date().toISOString();
  const type = payload.eventType as TerritoryRealtimeEventType;

  if (type === 'DELETE') {
    const territoryId = getTerritoryIdFromPayloadRow(payload.old);

    if (!territoryId) {
      return null;
    }

    return {
      receivedAt,
      territoryId,
      type,
    };
  }

  const territory = parseOnlineTerritoryRow(payload.new);

  if (!territory) {
    return null;
  }

  return {
    receivedAt,
    territory,
    territoryId: territory.id,
    type,
  };
}

export function subscribeToTerritoryRealtime(
  options: TerritoryRealtimeSubscriptionOptions,
): TerritoryRealtimeSubscription {
  const supabase = getSupabaseClient();

  if (!isBackendConfigured() || !supabase) {
    options.onConnectionChange?.(false);
    options.onError?.(null);

    return {
      enabled: false,
      unsubscribe: async () => undefined,
    };
  }

  const channel: RealtimeChannel = supabase.channel(`territories-realtime-${Date.now()}`);
  const handleRealtimePayload = (payload: RealtimePostgresChangesPayload<TerritoryRow>): void => {
    const nextEvent = toTerritoryRealtimeEvent(payload);

    if (!nextEvent) {
      options.onError?.(`Realtime payload could not be parsed for ${payload.eventType}.`);
      return;
    }

    options.onError?.(null);
    options.onEvent?.(nextEvent);
  };

  channel
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'territories' }, handleRealtimePayload)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'territories' }, handleRealtimePayload)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'territories' }, handleRealtimePayload)
    .subscribe((status) => {
      const isConnected = status === 'SUBSCRIBED';

      options.onConnectionChange?.(isConnected);

      if (status === 'CHANNEL_ERROR') {
        options.onError?.('Realtime channel error.');
      }

      if (status === 'TIMED_OUT') {
        options.onError?.('Realtime subscription timed out.');
      }

      if (status === 'CLOSED') {
        options.onError?.('Realtime channel closed.');
      }
    });

  return {
    enabled: true,
    unsubscribe: async () => {
      options.onConnectionChange?.(false);
      await supabase.removeChannel(channel);
    },
  };
}
