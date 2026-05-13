import { COOLDOWN_CONFIG } from '../config/cooldownConfig';
import type { CooldownCheckResult, CooldownReason, CooldownState } from '../types';

type CooldownAction = 'capture' | 'claim' | 'start_stop' | 'sync';

type CooldownRule = {
  durationMs: number;
  lastAt?: string;
  reason: CooldownReason;
};

function parseTimestamp(value?: string): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : null;
}

function evaluateCooldown(rule: CooldownRule, nowMs: number): CooldownCheckResult {
  const lastAtMs = parseTimestamp(rule.lastAt);

  if (lastAtMs === null) {
    return {
      allowed: true,
      reason: 'none',
      remainingMs: 0,
    };
  }

  const elapsedMs = Math.max(0, nowMs - lastAtMs);
  const remainingMs = Math.max(0, rule.durationMs - elapsedMs);

  if (remainingMs === 0) {
    return {
      allowed: true,
      reason: 'none',
      remainingMs: 0,
    };
  }

  return {
    allowed: false,
    reason: rule.reason,
    remainingMs,
  };
}

export function checkCooldown(action: CooldownAction, cooldownState: CooldownState, nowMs = Date.now()): CooldownCheckResult {
  switch (action) {
    case 'claim':
      return evaluateCooldown(
        {
          durationMs: COOLDOWN_CONFIG.claimCooldownMs,
          lastAt: cooldownState.lastClaimAt,
          reason: 'claim_cooldown',
        },
        nowMs,
      );
    case 'capture':
      return evaluateCooldown(
        {
          durationMs: COOLDOWN_CONFIG.captureCooldownMs,
          lastAt: cooldownState.lastCaptureAt,
          reason: 'capture_cooldown',
        },
        nowMs,
      );
    case 'start_stop':
      return evaluateCooldown(
        {
          durationMs: COOLDOWN_CONFIG.startStopCooldownMs,
          lastAt: cooldownState.lastStartStopAt,
          reason: 'start_stop_cooldown',
        },
        nowMs,
      );
    case 'sync':
      return evaluateCooldown(
        {
          durationMs: COOLDOWN_CONFIG.syncCooldownMs,
          lastAt: cooldownState.lastSyncAt,
          reason: 'sync_cooldown',
        },
        nowMs,
      );
    default: {
      const exhaustiveCheck: never = action;
      return exhaustiveCheck;
    }
  }
}
