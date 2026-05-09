import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { uiColors, uiRadius, uiSpacing, uiTypography } from '../../config/uiConfig';

type PlayerIdentityCardProps = {
  onResetIdentity: () => void;
  playerCreatedAt: string;
  playerIdShort: string;
  playerLoaded: boolean;
  playerStorageValid: boolean;
};

function PlayerIdentityCardComponent({
  onResetIdentity,
  playerCreatedAt,
  playerIdShort,
  playerLoaded,
  playerStorageValid,
}: PlayerIdentityCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Runner</Text>
      <Text style={styles.playerId}>{playerIdShort}</Text>
      <Text style={styles.meta}>Loaded: {playerLoaded ? 'Yes' : 'No'}</Text>
      <Text style={styles.meta}>Storage: {playerStorageValid ? 'Valid' : 'Recovered'}</Text>
      <Text numberOfLines={1} style={styles.meta}>
        Created: {playerCreatedAt}
      </Text>
      <Pressable onPress={onResetIdentity} style={({ pressed }) => [styles.button, pressed ? styles.buttonPressed : null]}>
        <Text style={styles.buttonText}>Reset ID</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: uiRadius.sm,
    borderWidth: 1,
    marginTop: uiSpacing.md,
    paddingHorizontal: uiSpacing.md,
    paddingVertical: uiSpacing.sm,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonText: {
    color: uiColors.primaryText,
    fontSize: uiTypography.label,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: uiColors.cardOverlay,
    borderColor: uiColors.cardBorder,
    borderRadius: uiRadius.card,
    borderWidth: 1,
    padding: uiSpacing.lg,
    width: 148,
  },
  kicker: {
    color: uiColors.secondaryText,
    fontSize: uiTypography.label,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  meta: {
    color: uiColors.secondaryText,
    fontSize: uiTypography.caption,
    marginTop: uiSpacing.xs,
  },
  playerId: {
    color: uiColors.primaryText,
    fontSize: uiTypography.title,
    fontWeight: '700',
    marginTop: uiSpacing.sm,
  },
});

export const PlayerIdentityCard = memo(PlayerIdentityCardComponent);
