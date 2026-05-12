import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { uiColors, uiRadius, uiSpacing, uiTypography } from '../../config/uiConfig';

type PlayerIdentityCardProps = {
  playerCreatedAt: string;
  playerIdShort: string;
  playerLoaded: boolean;
  playerStorageValid: boolean;
};

function PlayerIdentityCardComponent({
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
