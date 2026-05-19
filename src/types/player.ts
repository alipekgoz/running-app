export type PlayerProfile = {
  appVersion?: string;
  createdAt: string;
  displayName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  isAnonymous: boolean;
  lastSeenAt: string;
  playerId: string;
  userId?: string | null;
  username?: string | null;
};
