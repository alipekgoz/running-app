import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { uiColors, uiHud, uiRadius, uiSpacing, uiTypography } from '../../config/uiConfig';

type CaptureConfirmationCardProps = {
  coveragePercentLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  visible: boolean;
};

function CaptureConfirmationCardComponent({
  coveragePercentLabel,
  onCancel,
  onConfirm,
  visible,
}: CaptureConfirmationCardProps) {
  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View style={styles.card}>
        <Text style={styles.title}>Capture Territory?</Text>
        <Text style={styles.body}>
          Enemy coverage is {coveragePercentLabel}. Confirm to transfer this overlapping territory to your ownership.
        </Text>
        <View style={styles.actions}>
          <Pressable onPress={onCancel} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}>
            <Text style={styles.secondaryLabel}>Cancel</Text>
          </Pressable>
          <Pressable onPress={onConfirm} style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null]}>
            <Text style={styles.primaryLabel}>Capture</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: uiSpacing.sm,
    marginTop: uiSpacing.md,
  },
  body: {
    color: uiColors.secondaryText,
    fontSize: uiTypography.body,
    lineHeight: 20,
    marginTop: uiSpacing.xs,
  },
  card: {
    backgroundColor: uiColors.cardOverlayStrong,
    borderColor: uiColors.warning,
    borderRadius: uiRadius.card,
    borderWidth: 1,
    maxWidth: 360,
    padding: uiSpacing.md,
    width: '100%',
  },
  pressed: {
    opacity: 0.84,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: uiColors.warning,
    borderRadius: uiRadius.chip,
    flex: 1,
    justifyContent: 'center',
    minHeight: uiHud.compactButtonHeight,
    paddingHorizontal: uiSpacing.md,
  },
  primaryLabel: {
    color: uiColors.primaryText,
    fontSize: uiTypography.body,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: uiColors.cardOverlay,
    borderColor: uiColors.cardBorder,
    borderRadius: uiRadius.chip,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: uiHud.compactButtonHeight,
    paddingHorizontal: uiSpacing.md,
  },
  secondaryLabel: {
    color: uiColors.primaryText,
    fontSize: uiTypography.body,
    fontWeight: '600',
  },
  title: {
    color: uiColors.primaryText,
    fontSize: uiTypography.title,
    fontWeight: '700',
  },
  wrapper: {
    bottom: uiHud.bottomInsetPadding + 140,
    left: uiSpacing.md,
    position: 'absolute',
    right: uiSpacing.md,
    zIndex: uiHud.zIndex.overlay,
  },
});

export const CaptureConfirmationCard = memo(CaptureConfirmationCardComponent);
