import type { PlayerProfile } from '../types';
import { getCurrentUser } from './authService';
import {
  getCurrentPlayerProfile,
  loadOrCreatePlayerProfile,
  savePlayerProfile,
} from './playerIdentityService';
import { getSupabaseClient } from './supabaseClient';

type RemoteProfileRow = {
  avatar_url?: string | null;
  device_id?: string | null;
  display_name?: string | null;
  id?: string;
  updated_at?: string;
  user_id?: string | null;
  username?: string | null;
};

function toRemoteProfilePayload(profile: PlayerProfile) {
  return {
    avatar_url: profile.avatarUrl ?? null,
    device_id: profile.playerId,
    display_name: profile.displayName ?? null,
    updated_at: new Date().toISOString(),
    user_id: profile.userId ?? null,
    username: profile.username ?? null,
  };
}

function mergeProfile(currentProfile: PlayerProfile, nextProfile: Partial<PlayerProfile>): PlayerProfile {
  const mergedProfile: PlayerProfile = {
    ...currentProfile,
    ...nextProfile,
    appVersion: nextProfile.appVersion ?? currentProfile.appVersion,
    avatarUrl: nextProfile.avatarUrl ?? currentProfile.avatarUrl ?? null,
    displayName: nextProfile.displayName ?? currentProfile.displayName ?? null,
    email: nextProfile.email ?? currentProfile.email ?? null,
    isAnonymous: nextProfile.isAnonymous ?? currentProfile.isAnonymous,
    lastSeenAt: nextProfile.lastSeenAt ?? new Date().toISOString(),
    userId: nextProfile.userId ?? currentProfile.userId ?? null,
    username: nextProfile.username ?? currentProfile.username ?? null,
  };

  return mergedProfile;
}

function isMissingColumnError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();

  return normalizedMessage.includes("could not find the 'user_id' column") || normalizedMessage.includes('column "user_id" does not exist');
}

export async function loadLocalPlayerProfile(): Promise<PlayerProfile> {
  return loadOrCreatePlayerProfile();
}

export async function updateLocalPlayerProfile(profile: Partial<PlayerProfile>): Promise<PlayerProfile> {
  const currentProfile = getCurrentPlayerProfile() ?? (await loadOrCreatePlayerProfile());
  const nextProfile = mergeProfile(currentProfile, profile);

  await savePlayerProfile(nextProfile);

  return nextProfile;
}

export async function createOrUpdateRemoteProfile(profile: PlayerProfile): Promise<{
  error: string | null;
  profile: PlayerProfile;
  success: boolean;
}> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      error: null,
      profile,
      success: false,
    };
  }

  try {
    let existingProfileId: string | null = null;

    if (profile.userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', profile.userId)
        .maybeSingle();

      if (error) {
        return {
          error: error.message,
          profile,
          success: false,
        };
      }

      existingProfileId = (data as RemoteProfileRow | null)?.id ?? null;
    }

    if (!existingProfileId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('device_id', profile.playerId)
        .maybeSingle();

      if (error) {
        return {
          error: error.message,
          profile,
          success: false,
        };
      }

      existingProfileId = (data as RemoteProfileRow | null)?.id ?? null;
    }

    const payload = {
      ...toRemoteProfilePayload(profile),
      ...(existingProfileId ? { id: existingProfileId } : {}),
    };
    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, existingProfileId ? { onConflict: 'id' } : undefined)
      .select('avatar_url, device_id, display_name, user_id, username')
      .maybeSingle();

    if (error) {
      return {
        error: error.message,
        profile,
        success: false,
      };
    }

    const remoteProfile = data as RemoteProfileRow | null;
    const mergedProfile = await updateLocalPlayerProfile({
      avatarUrl: remoteProfile?.avatar_url ?? profile.avatarUrl ?? null,
      displayName: remoteProfile?.display_name ?? profile.displayName ?? null,
      isAnonymous: profile.userId == null,
      userId: remoteProfile?.user_id ?? profile.userId ?? null,
      username: remoteProfile?.username ?? profile.username ?? null,
    });

    return {
      error: null,
      profile: mergedProfile,
      success: true,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown remote profile error',
      profile,
      success: false,
    };
  }
}

export async function linkAnonymousProfileToUser(userId: string): Promise<PlayerProfile> {
  const localProfile = await loadOrCreatePlayerProfile();
  const authUser = await getCurrentUser();
  const linkedProfile = await updateLocalPlayerProfile({
    email: authUser?.email ?? localProfile.email ?? null,
    isAnonymous: false,
    userId,
  });

  const remoteResult = await createOrUpdateRemoteProfile(linkedProfile);

  if (
    remoteResult.error &&
    !isMissingColumnError(remoteResult.error)
  ) {
    console.log('profileService linkAnonymousProfileToUser remote sync error:', remoteResult.error);
  }

  return remoteResult.profile;
}
