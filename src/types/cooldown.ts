export type CooldownState = {
  lastCaptureAt?: string;
  lastClaimAt?: string;
  lastStartStopAt?: string;
  lastSyncAt?: string;
};

export type CooldownReason =
  | 'none'
  | 'capture_cooldown'
  | 'claim_cooldown'
  | 'start_stop_cooldown'
  | 'sync_cooldown';

export type CooldownCheckResult = {
  allowed: boolean;
  reason: CooldownReason;
  remainingMs: number;
};
