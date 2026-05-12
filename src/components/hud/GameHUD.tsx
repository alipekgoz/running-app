import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { uiHud, uiSpacing } from '../../config/uiConfig';
import type { ConflictSeverity } from '../../types';
import { DebugOverlay } from './DebugOverlay';
import { PlayerIdentityCard } from './PlayerIdentityCard';
import { TerritoryStatsCard } from './TerritoryStatsCard';
import { TopStatusBar } from './TopStatusBar';
import { TrackingControls } from './TrackingControls';

type GameHUDProps = {
  areaHectareLabel: string;
  areaM2Label: string;
  backendConfigured: boolean;
  canSaveTerritory: boolean;
  canSync: boolean;
  claimLabel: string;
  claimSeverity: ConflictSeverity;
  conflictLabel: string;
  conflictSeverity: ConflictSeverity;
  debugLines: readonly string[];
  debugOpen: boolean;
  gpsReady: boolean;
  onClearTerritories: () => void;
  onFetchOnlineTerritories: () => void;
  onResetIdentity: () => void;
  onSaveTerritory: () => void;
  onStartTracking: () => void;
  onStopTracking: () => void;
  onSyncTerritories: () => void;
  onToggleDebug: () => void;
  playerCreatedAt: string;
  playerIdShort: string;
  playerLoaded: boolean;
  playerStorageValid: boolean;
  savedTerritoryCount: number;
  syncStatus: string;
  trackingActive: boolean;
};

function GameHUDComponent(props: GameHUDProps) {
  const insets = useSafeAreaInsets();
  const trackingStateLabel: 'Idle' | 'Tracking' = props.trackingActive ? 'Tracking' : 'Idle';

  return (
    <SafeAreaView edges={['top', 'bottom']} pointerEvents="box-none" style={styles.safeArea}>
      <View
        pointerEvents="box-none"
        style={[
          styles.container,
          {
            paddingBottom: Math.max(insets.bottom, uiSpacing.sm),
            paddingTop: Math.max(insets.top, uiHud.topInsetPadding),
          },
        ]}
      >
        <TopStatusBar
          backendConfigured={props.backendConfigured}
          gpsReady={props.gpsReady}
          playerIdShort={props.playerIdShort}
          trackingActive={props.trackingActive}
        />
        <View pointerEvents="box-none" style={styles.middleCluster}>
          <TerritoryStatsCard
            areaHectareLabel={props.areaHectareLabel}
            areaM2Label={props.areaM2Label}
            claimLabel={props.claimLabel}
            claimSeverity={props.claimSeverity}
            conflictLabel={props.conflictLabel}
            conflictSeverity={props.conflictSeverity}
            savedTerritoryCount={props.savedTerritoryCount}
            syncStatus={props.syncStatus}
            trackingStateLabel={trackingStateLabel}
          />
          <PlayerIdentityCard
            playerCreatedAt={props.playerCreatedAt}
            playerIdShort={props.playerIdShort}
            playerLoaded={props.playerLoaded}
            playerStorageValid={props.playerStorageValid}
          />
        </View>
        <View pointerEvents="box-none" style={styles.bottomCluster}>
          <DebugOverlay
            debugLines={props.debugLines}
            expanded={props.debugOpen}
            onClearSavedTerritories={props.onClearTerritories}
            onFetchOnlineTerritories={props.onFetchOnlineTerritories}
            onResetIdentity={props.onResetIdentity}
            onToggle={props.onToggleDebug}
          />
          <TrackingControls
            canSaveTerritory={props.canSaveTerritory}
            canSync={props.canSync}
            isTracking={props.trackingActive}
            onSaveTerritory={props.onSaveTerritory}
            onStartTracking={props.onStartTracking}
            onStopTracking={props.onStopTracking}
            onSyncTerritories={props.onSyncTerritories}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bottomCluster: {
    alignSelf: 'stretch',
    flexShrink: 0,
    gap: uiSpacing.sm,
    marginTop: 'auto',
  },
  container: {
    flex: 1,
    gap: uiSpacing.md,
    paddingHorizontal: uiSpacing.md,
  },
  middleCluster: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: uiSpacing.sm,
    justifyContent: 'space-between',
    marginTop: uiSpacing.sm,
  },
  safeArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: uiHud.zIndex.hud,
  },
});

export const GameHUD = GameHUDComponent;
