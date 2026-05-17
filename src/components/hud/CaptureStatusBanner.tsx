import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { uiColors, uiRadius, uiSpacing, uiTypography } from '../../config/uiConfig';

type CaptureStatusTone = 'available' | 'failed' | 'success';

type CaptureStatusBannerProps = {
  label?: string;
  message: string;
  tone: CaptureStatusTone;
  visible: boolean;
};

function CaptureStatusBannerComponent({ label, message, tone, visible }: CaptureStatusBannerProps) {
  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.container, toneStyles[tone].container]}>
      <Text style={styles.label}>{label ?? toneStyles[tone].title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const toneStyles = {
  available: {
    container: {
      borderColor: uiColors.warning,
    },
    title: 'Capture Available',
  },
  failed: {
    container: {
      borderColor: uiColors.error,
    },
    title: 'Capture Failed',
  },
  success: {
    container: {
      borderColor: uiColors.success,
    },
    title: 'Territory Captured',
  },
} satisfies Record<CaptureStatusTone, { container: { borderColor: string }; title: string }>;

const styles = StyleSheet.create({
  container: {
    backgroundColor: uiColors.cardOverlayStrong,
    borderRadius: uiRadius.md,
    borderWidth: 1,
    left: uiSpacing.md,
    maxWidth: 420,
    padding: uiSpacing.md,
    position: 'absolute',
    right: uiSpacing.md,
    top: 76,
    zIndex: 26,
  },
  label: {
    color: uiColors.primaryText,
    fontSize: uiTypography.label,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  message: {
    color: uiColors.secondaryText,
    fontSize: uiTypography.body,
    marginTop: uiSpacing.xs,
  },
});

export const CaptureStatusBanner = memo(CaptureStatusBannerComponent);
