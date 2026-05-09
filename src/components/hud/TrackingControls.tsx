import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { uiColors, uiHud, uiRadius, uiSpacing, uiTypography } from '../../config/uiConfig';

type TrackingControlsProps = {
  canSaveTerritory: boolean;
  canSync: boolean;
  isTracking: boolean;
  onSaveTerritory: () => void;
  onStartTracking: () => void;
  onStopTracking: () => void;
  onSyncTerritories: () => void;
};

function TrackingControlsComponent({
  canSaveTerritory,
  canSync,
  isTracking,
  onSaveTerritory,
  onStartTracking,
  onStopTracking,
  onSyncTerritories,
}: TrackingControlsProps) {
  return (
    <View style={styles.container}>
      <Pressable
        disabled={isTracking}
        onPress={onStartTracking}
        style={({ pressed }) => [
          styles.primaryButton,
          styles.startButton,
          isTracking ? styles.disabledButton : null,
          pressed && !isTracking ? styles.pressed : null,
        ]}
      >
        <Text style={styles.primaryLabel}>Start Run</Text>
      </Pressable>
      <Pressable
        disabled={!isTracking}
        onPress={onStopTracking}
        style={({ pressed }) => [
          styles.secondaryPill,
          styles.stopPill,
          !isTracking ? styles.disabledButton : null,
          pressed && isTracking ? styles.pressed : null,
        ]}
      >
        <Text style={styles.secondaryLabel}>Stop</Text>
      </Pressable>
      <View style={styles.utilityRow}>
        <MiniActionButton disabled={!canSaveTerritory} label="Save" onPress={onSaveTerritory} tone="neutral" />
        <MiniActionButton disabled={!canSync} label="Sync" onPress={onSyncTerritories} tone="accent" />
      </View>
    </View>
  );
}

type MiniActionButtonProps = {
  disabled: boolean;
  label: string;
  onPress: () => void;
  tone: 'accent' | 'neutral';
};

function MiniActionButton({ disabled, label, onPress, tone }: MiniActionButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.miniButton,
        tone === 'accent' ? styles.accentMiniButton : null,
        disabled ? styles.disabledButton : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  accentMiniButton: {
    backgroundColor: 'rgba(139,92,246,0.22)',
  },
  container: {
    gap: uiSpacing.sm,
  },
  disabledButton: {
    opacity: 0.4,
  },
  miniButton: {
    alignItems: 'center',
    backgroundColor: uiColors.cardOverlayStrong,
    borderColor: uiColors.cardBorder,
    borderRadius: uiRadius.chip,
    borderWidth: 1,
    flex: 1,
    height: uiHud.compactButtonHeight,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: uiRadius.lg,
    height: uiHud.buttonHeight,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: uiHud.shadowOpacity,
    shadowRadius: 20,
  },
  primaryLabel: {
    color: uiColors.primaryText,
    fontSize: uiTypography.title,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryLabel: {
    color: uiColors.primaryText,
    fontSize: uiTypography.body,
    fontWeight: '600',
  },
  secondaryPill: {
    alignItems: 'center',
    borderRadius: uiRadius.chip,
    height: uiHud.compactButtonHeight,
    justifyContent: 'center',
  },
  startButton: {
    backgroundColor: uiColors.success,
  },
  stopPill: {
    backgroundColor: uiColors.trackingStop,
  },
  utilityRow: {
    flexDirection: 'row',
    gap: uiSpacing.sm,
  },
});

export const TrackingControls = memo(TrackingControlsComponent);
