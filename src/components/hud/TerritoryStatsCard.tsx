import { StyleSheet, Text, View } from 'react-native';

import { uiColors, uiRadius, uiSpacing, uiTypography } from '../../config/uiConfig';
import type { ConflictSeverity } from '../../types';

type TerritoryStatsCardProps = {
  areaHectareLabel: string;
  areaM2Label: string;
  conflictLabel: string;
  conflictSeverity: ConflictSeverity;
  savedTerritoryCount: number;
  syncStatus: string;
  trackingStateLabel: 'Idle' | 'Tracking';
};

function TerritoryStatsCardComponent({
  areaHectareLabel,
  areaM2Label,
  conflictLabel,
  conflictSeverity,
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
        <View style={styles.conflictBlock}>
          <Text style={styles.footerLabel}>Conflict</Text>
          <View style={[styles.conflictBadge, getConflictBadgeStyle(conflictSeverity)]}>
            <Text numberOfLines={1} style={styles.conflictBadgeText}>
              {conflictLabel}
            </Text>
          </View>
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
  conflictBadge: {
    borderRadius: uiRadius.chip,
    borderWidth: 1,
    marginTop: uiSpacing.xs,
    paddingHorizontal: uiSpacing.sm,
    paddingVertical: uiSpacing.xs,
  },
  conflictBadgeText: {
    color: uiColors.primaryText,
    fontSize: uiTypography.caption,
    fontWeight: '700',
  },
  conflictBlock: {
    minWidth: 108,
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

function getConflictBadgeStyle(conflictSeverity: ConflictSeverity) {
  switch (conflictSeverity) {
    case 'low':
      return {
        backgroundColor: 'rgba(250,204,21,0.18)',
        borderColor: 'rgba(250,204,21,0.45)',
      };
    case 'medium':
      return {
        backgroundColor: 'rgba(249,115,22,0.18)',
        borderColor: 'rgba(249,115,22,0.5)',
      };
    case 'high':
      return {
        backgroundColor: 'rgba(255,98,98,0.18)',
        borderColor: 'rgba(255,98,98,0.52)',
      };
    case 'none':
    default:
      return {
        backgroundColor: 'rgba(0,210,106,0.12)',
        borderColor: 'rgba(0,210,106,0.35)',
      };
  }
}
