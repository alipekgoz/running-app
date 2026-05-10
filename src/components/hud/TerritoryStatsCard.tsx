import { StyleSheet, Text, View } from 'react-native';

import { uiColors, uiRadius, uiSpacing, uiTypography } from '../../config/uiConfig';

type TerritoryStatsCardProps = {
  areaHectareLabel: string;
  areaM2Label: string;
  savedTerritoryCount: number;
  syncStatus: string;
  trackingStateLabel: 'Idle' | 'Tracking';
};

function TerritoryStatsCardComponent({
  areaHectareLabel,
  areaM2Label,
  savedTerritoryCount,
  syncStatus,
  trackingStateLabel,
}: TerritoryStatsCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Territory</Text>
      <View style={styles.metricRow}>
        <View style={styles.metricBlock}>
          <Text style={styles.metricValue}>{areaM2Label}</Text>
          <Text style={styles.metricLabel}>Area m²</Text>
        </View>
        <View style={styles.metricBlock}>
          <Text style={styles.metricValue}>{areaHectareLabel}</Text>
          <Text style={styles.metricLabel}>Hectare</Text>
        </View>
      </View>
      <View style={styles.footerRow}>
        <View>
          <Text style={styles.footerLabel}>Saved</Text>
          <Text style={styles.footerValue}>{savedTerritoryCount}</Text>
        </View>
        <View>
          <Text style={styles.footerLabel}>State</Text>
          <Text style={[styles.footerValue, trackingStateLabel === 'Tracking' ? styles.trackingOn : null]}>
            {trackingStateLabel}
          </Text>
        </View>
        <View style={styles.syncBlock}>
          <Text style={styles.footerLabel}>Sync</Text>
          <Text numberOfLines={1} style={styles.syncValue}>
            {syncStatus}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: uiColors.cardOverlay,
    borderColor: uiColors.cardBorder,
    borderRadius: uiRadius.card,
    borderWidth: 1,
    padding: uiSpacing.lg,
  },
  footerLabel: {
    color: uiColors.secondaryText,
    fontSize: uiTypography.caption,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  footerRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: uiSpacing.lg,
    marginTop: uiSpacing.md,
  },
  footerValue: {
    color: uiColors.primaryText,
    fontSize: uiTypography.body,
    fontWeight: '600',
    marginTop: uiSpacing.xs,
  },
  kicker: {
    color: uiColors.secondaryText,
    fontSize: uiTypography.label,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metricBlock: {
    flex: 1,
  },
  metricLabel: {
    color: uiColors.secondaryText,
    fontSize: uiTypography.label,
    marginTop: uiSpacing.xs,
  },
  metricRow: {
    flexDirection: 'row',
    gap: uiSpacing.md,
    marginTop: uiSpacing.sm,
  },
  metricValue: {
    color: uiColors.primaryText,
    fontSize: uiTypography.metric,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  syncBlock: {
    flex: 1,
  },
  syncValue: {
    color: uiColors.primaryText,
    fontSize: uiTypography.body,
    fontWeight: '600',
    marginTop: uiSpacing.xs,
  },
  trackingOn: {
    color: uiColors.success,
  },
});

export const TerritoryStatsCard = TerritoryStatsCardComponent;
