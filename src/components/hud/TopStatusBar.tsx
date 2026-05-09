import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { uiColors, uiRadius, uiSpacing, uiTypography } from '../../config/uiConfig';

type TopStatusBarProps = {
  backendConfigured: boolean;
  gpsReady: boolean;
  playerIdShort: string;
  trackingActive: boolean;
};

function TopStatusBarComponent({
  backendConfigured,
  gpsReady,
  playerIdShort,
  trackingActive,
}: TopStatusBarProps) {
  return (
    <View style={styles.container}>
      <StatusChip accentColor={gpsReady ? uiColors.statusGps : uiColors.warning} label={gpsReady ? 'GPS Live' : 'GPS Check'} />
      <StatusChip
        accentColor={backendConfigured ? uiColors.savedTerritory : uiColors.statusIdle}
        label={backendConfigured ? 'Sync Ready' : 'Sync Off'}
      />
      <StatusChip
        accentColor={trackingActive ? uiColors.success : uiColors.statusIdle}
        label={trackingActive ? 'Tracking' : 'Paused'}
      />
      <StatusChip accentColor={uiColors.primaryText} label={playerIdShort} />
    </View>
  );
}

type StatusChipProps = {
  accentColor: string;
  label: string;
};

function StatusChip({ accentColor, label }: StatusChipProps) {
  return (
    <View style={styles.chip}>
      <View style={[styles.dot, { backgroundColor: accentColor }]} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    backgroundColor: uiColors.cardOverlay,
    borderColor: uiColors.cardBorder,
    borderRadius: uiRadius.chip,
    borderWidth: 1,
    flexDirection: 'row',
    gap: uiSpacing.sm,
    paddingHorizontal: uiSpacing.md,
    paddingVertical: uiSpacing.sm,
  },
  chipText: {
    color: uiColors.primaryText,
    fontSize: uiTypography.label,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: uiSpacing.sm,
  },
  dot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
});

export const TopStatusBar = memo(TopStatusBarComponent);
