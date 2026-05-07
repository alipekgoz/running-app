import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Coordinates, LocalSavedTerritory } from '../types';

const SAVED_TERRITORIES_STORAGE_KEY = 'running_app:saved_territories';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidCoordinate(value: unknown): value is Coordinates {
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

function isValidLocalSavedTerritory(value: unknown): value is LocalSavedTerritory {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const territory = value as Record<string, unknown>;

  return (
    typeof territory.id === 'string' &&
    territory.id.length > 0 &&
    Array.isArray(territory.coordinates) &&
    territory.coordinates.every(isValidCoordinate) &&
    isFiniteNumber(territory.areaM2) &&
    isFiniteNumber(territory.areaHectare) &&
    typeof territory.createdAt === 'string' &&
    territory.createdAt.length > 0 &&
    isFiniteNumber(territory.sourceRoutePointCount) &&
    territory.status === 'local_saved'
  );
}

export async function loadSavedTerritories(): Promise<LocalSavedTerritory[]> {
  try {
    const rawValue = await AsyncStorage.getItem(SAVED_TERRITORIES_STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    const parsedValue: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(isValidLocalSavedTerritory);
  } catch (error) {
    console.log('territoryStorageService load error:', error);
    return [];
  }
}

export async function saveSavedTerritories(territories: readonly LocalSavedTerritory[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVED_TERRITORIES_STORAGE_KEY, JSON.stringify(territories));
  } catch (error) {
    console.log('territoryStorageService save error:', error);
    throw error;
  }
}

export async function clearSavedTerritories(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SAVED_TERRITORIES_STORAGE_KEY);
  } catch (error) {
    console.log('territoryStorageService clear error:', error);
    throw error;
  }
}
