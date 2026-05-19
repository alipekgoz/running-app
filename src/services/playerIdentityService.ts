import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import type { PlayerProfile } from '../types';
import { createId } from '../utils/createId';

const PLAYER_ID_STORAGE_KEY = 'running_app:player_id';
const PLAYER_PROFILE_STORAGE_KEY = 'running_app:player_profile';

let currentPlayerProfile: PlayerProfile | null = null;
let lastStorageWasValid = true;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidPlayerProfile(value: unknown): value is PlayerProfile {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const profile = value as Record<string, unknown>;

  return (
    isNonEmptyString(profile.playerId) &&
    isNonEmptyString(profile.createdAt) &&
    isNonEmptyString(profile.lastSeenAt) &&
    (profile.isAnonymous === undefined || typeof profile.isAnonymous === 'boolean') &&
    (profile.appVersion === undefined || isNonEmptyString(profile.appVersion)) &&
    (profile.userId === undefined || profile.userId === null || isNonEmptyString(profile.userId)) &&
    (profile.email === undefined || profile.email === null || isNonEmptyString(profile.email)) &&
    (profile.username === undefined || profile.username === null || isNonEmptyString(profile.username)) &&
    (profile.displayName === undefined || profile.displayName === null || isNonEmptyString(profile.displayName)) &&
    (profile.avatarUrl === undefined || profile.avatarUrl === null || isNonEmptyString(profile.avatarUrl))
  );
}

function createPlayerProfile(playerId: string, createdAt: string): PlayerProfile {
  return {
    appVersion: Constants.expoConfig?.version,
    avatarUrl: null,
    createdAt,
    displayName: null,
    email: null,
    isAnonymous: true,
    lastSeenAt: createdAt,
    playerId,
    userId: null,
    username: null,
  };
}

async function persistPlayerIdentity(playerProfile: PlayerProfile): Promise<void> {
  await AsyncStorage.multiSet([
    [PLAYER_ID_STORAGE_KEY, playerProfile.playerId],
    [PLAYER_PROFILE_STORAGE_KEY, JSON.stringify(playerProfile)],
  ]);
}

export async function loadOrCreatePlayerId(): Promise<string> {
  const playerProfile = await loadOrCreatePlayerProfile();

  return playerProfile.playerId;
}

export async function loadOrCreatePlayerProfile(): Promise<PlayerProfile> {
  try {
    const [[, storedPlayerId], [, storedProfileValue]] = await AsyncStorage.multiGet([
      PLAYER_ID_STORAGE_KEY,
      PLAYER_PROFILE_STORAGE_KEY,
    ]);

    const parsedProfile = storedProfileValue ? (JSON.parse(storedProfileValue) as unknown) : null;
    const hasValidStoredId = isNonEmptyString(storedPlayerId);
    const hasValidStoredProfile = isValidPlayerProfile(parsedProfile);
    const storageIsValid =
      hasValidStoredId &&
      hasValidStoredProfile &&
      parsedProfile.playerId === storedPlayerId;

    if (storageIsValid) {
      const refreshedProfile: PlayerProfile = {
        ...parsedProfile,
        appVersion: parsedProfile.appVersion ?? Constants.expoConfig?.version,
        avatarUrl: parsedProfile.avatarUrl ?? null,
        displayName: parsedProfile.displayName ?? null,
        email: parsedProfile.email ?? null,
        isAnonymous: parsedProfile.isAnonymous ?? parsedProfile.userId == null,
        lastSeenAt: new Date().toISOString(),
        userId: parsedProfile.userId ?? null,
        username: parsedProfile.username ?? null,
      };

      await persistPlayerIdentity(refreshedProfile);
      currentPlayerProfile = refreshedProfile;
      lastStorageWasValid = true;

      return refreshedProfile;
    }

    const nextPlayerId = createId();
    const nextCreatedAt =
      hasValidStoredProfile && parsedProfile.playerId !== storedPlayerId
        ? parsedProfile.createdAt
        : new Date().toISOString();
    const nextProfile = createPlayerProfile(nextPlayerId, nextCreatedAt);

    await persistPlayerIdentity(nextProfile);
    currentPlayerProfile = nextProfile;
    lastStorageWasValid = false;

    return nextProfile;
  } catch (error) {
    console.log('playerIdentityService load/create error:', error);

    const fallbackProfile = createPlayerProfile(createId(), new Date().toISOString());

    try {
      await persistPlayerIdentity(fallbackProfile);
    } catch (persistError) {
      console.log('playerIdentityService fallback persist error:', persistError);
    }

    currentPlayerProfile = fallbackProfile;
    lastStorageWasValid = false;

    return fallbackProfile;
  }
}

export function getCurrentPlayerId(): string | null {
  return currentPlayerProfile?.playerId ?? null;
}

export function getCurrentPlayerProfile(): PlayerProfile | null {
  return currentPlayerProfile;
}

export function wasPlayerStorageValid(): boolean {
  return lastStorageWasValid;
}

export async function savePlayerProfile(playerProfile: PlayerProfile): Promise<void> {
  const nextProfile: PlayerProfile = {
    ...playerProfile,
    appVersion: playerProfile.appVersion ?? Constants.expoConfig?.version,
    avatarUrl: playerProfile.avatarUrl ?? null,
    displayName: playerProfile.displayName ?? null,
    email: playerProfile.email ?? null,
    isAnonymous: playerProfile.userId == null,
    lastSeenAt: playerProfile.lastSeenAt,
    userId: playerProfile.userId ?? null,
    username: playerProfile.username ?? null,
  };

  await persistPlayerIdentity(nextProfile);
  currentPlayerProfile = nextProfile;
}

export async function clearPlayerIdentity(): Promise<void> {
  currentPlayerProfile = null;
  lastStorageWasValid = false;
  await AsyncStorage.multiRemove([PLAYER_ID_STORAGE_KEY, PLAYER_PROFILE_STORAGE_KEY]);
}
