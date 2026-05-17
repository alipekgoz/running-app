import { StyleSheet, Text, View } from 'react-native';

import { uiColors, uiRadius, uiSpacing, uiTypography } from '../../config/uiConfig';
import type { ConflictSeverity } from '../../types';

type TerritoryStatsCardProps = {
  claimLabel: string;
  claimSeverity: ConflictSeverity;
  conflictLabel: string;
  conflictSeverity: ConflictSeverity;
  trackingStateLabel: 'Idle' | 'Tracking';
};

function TerritoryStatsCardComponent({
  claimLabel,
  claimSeverity,
  conflictLabel,
  conflictSeverity,
  trackingStateLabel,
}: TerritoryStatsCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Territory</Text>
      <View style={styles.metricGrid}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>State</Text>
          <Text style={[styles.metricValue, trackingStateLabel === 'Tracking' ? styles.trackingOn : null]}>
            {trackingStateLabel}
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Claim</Text>
          <View style={[styles.conflictBadge, getConflictBadgeStyle(claimSeverity)]}>
            <Text numberOfLines={1} style={styles.conflictBadgeText}>
              {claimLabel}
            </Text>
          </View>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Conflict</Text>
          <View style={[styles.conflictBadge, getConflictBadgeStyle(conflictSeverity)]}>
            <Text numberOfLines={1} style={styles.conflictBadgeText}>
              {conflictLabel}
            </Text>
          </View>
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
    maxWidth: 340,
    paddingHorizontal: uiSpacing.md,
    paddingVertical: uiSpacing.sm,
  },
  conflictBadge: {
    borderRadius: uiRadius.chip,
    borderWidth: 1,
    marginTop: uiSpacing.xs,
    minHeight: 30,
    paddingHorizontal: uiSpacing.sm,
    paddingVertical: 6,
  },
  conflictBadgeText: {
    color: uiColors.primaryText,
    fontSize: uiTypography.caption,
    fontWeight: '700',
  },
  kicker: {
    color: uiColors.secondaryText,
    fontSize: uiTypography.label,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: uiSpacing.sm,
    marginTop: uiSpacing.sm,
  },
  metricItem: {
    minWidth: 88,
  },
  metricLabel: {
    color: uiColors.secondaryText,
    fontSize: uiTypography.caption,
    letterSpacing: 0.3,
    marginTop: uiSpacing.xs,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: uiColors.primaryText,
    fontSize: uiTypography.body,
    fontWeight: '700',
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
