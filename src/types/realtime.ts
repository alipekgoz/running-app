import type { OnlineTerritory } from './territory';

export type TerritoryRealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export type TerritoryRealtimeEvent = {
  receivedAt: string;
  territory?: OnlineTerritory | null;
  territoryId: string;
  type: TerritoryRealtimeEventType;
};
