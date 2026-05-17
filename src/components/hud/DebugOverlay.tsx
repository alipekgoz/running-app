import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { uiColors, uiHud, uiRadius, uiSpacing, uiTypography } from '../../config/uiConfig';

type DebugOverlayProps = {
  debugLines: readonly string[];
  expanded: boolean;
  fetchOnlineDisabled: boolean;
  onClearSavedTerritories: () => void;
  onFetchOnlineTerritories: () => void;
  onResetIdentity: () => void;
  onToggle: () => void;
};

function DebugOverlayComponent({
  debugLines,
  expanded,
  fetchOnlineDisabled,
  onClearSavedTerritories,
  onFetchOnlineTerritories,
  onResetIdentity,
  onToggle,
}: DebugOverlayProps) {
  return (
    <View style={styles.container}>
      <Pressable onPress={onToggle} style={({ pressed }) => [styles.header, pressed ? styles.pressed : null]}>
        <View>
          <Text style={styles.title}>Debug</Text>
          <Text style={styles.subtitle}>Telemetry and diagnostics</Text>
        </View>
        <Text style={styles.toggle}>{expanded ? 'Hide' : 'Show'}</Text>
      </Pressable>
      {expanded ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
          <View style={styles.content}>
            {debugLines.map((line) => (
              <Text key={line} style={styles.line}>
                {line}
              </Text>
            ))}
            <Pressable
              disabled={fetchOnlineDisabled}
              onPress={onFetchOnlineTerritories}
              style={({ pressed }) => [
                styles.actionButton,
                fetchOnlineDisabled ? styles.disabledButton : null,
                pressed && !fetchOnlineDisabled ? styles.pressed : null,
              ]}
            >
              <Text style={styles.actionLabel}>Fetch Online Territories</Text>
            </Pressable>
            <Pressable
              onPress={onClearSavedTerritories}
              style={({ pressed }) => [styles.actionButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.actionLabel}>Clear Saved Territories</Text>
            </Pressable>
            <Pressable onPress={onResetIdentity} style={({ pressed }) => [styles.actionButton, pressed ? styles.pressed : null]}>
              <Text style={styles.actionLabel}>Reset Player Identity</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    backgroundColor: uiColors.debugOverlay,
    borderColor: uiColors.cardBorder,
    borderRadius: uiRadius.md,
    borderWidth: 1,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: uiColors.cardBorder,
    borderRadius: uiRadius.sm,
    borderWidth: 1,
    marginTop: uiSpacing.md,
    paddingHorizontal: uiSpacing.md,
    paddingVertical: uiSpacing.sm,
  },
  actionLabel: {
    color: uiColors.primaryText,
    fontSize: uiTypography.label,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.4,
  },
  content: {
    paddingBottom: uiSpacing.md,
    paddingHorizontal: uiSpacing.md,
    paddingTop: uiSpacing.xs,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: uiSpacing.md,
    paddingVertical: uiSpacing.sm,
  },
  line: {
    color: uiColors.secondaryText,
    fontSize: uiTypography.caption,
    marginTop: uiSpacing.xs,
  },
  pressed: {
    opacity: 0.84,
  },
  scrollView: {
    maxHeight: uiHud.debugMaxHeight,
  },
  scrollContent: {
    flexGrow: 1,
  },
  subtitle: {
    color: uiColors.secondaryText,
    fontSize: uiTypography.caption,
    marginTop: 2,
  },
  title: {
    color: uiColors.primaryText,
    fontSize: uiTypography.body,
    fontWeight: '700',
  },
  toggle: {
    color: uiColors.secondaryText,
    fontSize: uiTypography.label,
    fontWeight: '600',
  },
});

export const DebugOverlay = memo(DebugOverlayComponent);
