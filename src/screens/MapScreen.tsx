import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { GameHUD } from '../components/hud/GameHUD';
import { OnlineTerritoriesLayer } from '../components/map/OnlineTerritoriesLayer';
import { RouteLine } from '../components/map/RouteLine';
import { PolygonPreview } from '../components/map/PolygonPreview';
import { SavedTerritoriesLayer } from '../components/map/SavedTerritoriesLayer';
import { DEFAULT_MAP_CENTER, MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE_URL } from '../config/mapboxConfig';
import { uiColors, uiRadius, uiSpacing, uiTypography } from '../config/uiConfig';
import type { Coordinates, GpsPoint, LocalSavedTerritory, OnlineTerritory, PlayerProfile } from '../types';
import { getSupabaseConfigStatus } from '../config/supabaseConfig';
import {
  clearPlayerIdentity,
  loadOrCreatePlayerProfile,
  wasPlayerStorageValid,
} from '../services/playerIdentityService';
import {
  clearSavedTerritories as clearSavedTerritoriesFromStorage,
  loadSavedTerritories,
  saveSavedTerritories,
} from '../services/territoryStorageService';
import { fetchTerritories, isBackendConfigured, uploadTerritories } from '../services/territoryBackendService';
import { getGpsPointRejectionReason } from '../utils/gpsFilter';
import { analyzePolygonArea } from '../utils/geo/calculatePolygonArea';
import { buildTerritoryPreviewPayload } from '../utils/geo/buildTerritoryPreviewPayload';
import { analyzePolygonCandidate } from '../utils/geo/isPolygonCandidate';
import { analyzePolygonPreview } from '../utils/geo/routeToPolygonGeoJSON';
import { createId } from '../utils/createId';
import { routeToGeoJSON } from '../utils/routeToGeoJSON';

if (MAPBOX_ACCESS_TOKEN) {
  void Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
}

export function MapScreen() {
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocationServicesEnabled, setIsLocationServicesEnabled] = useState(true);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [locationDebugText, setLocationDebugText] = useState('Waiting for location request...');
  const [isTracking, setIsTracking] = useState(false);
  const [isDebugPanelExpanded, setIsDebugPanelExpanded] = useState(false);
  const [routePoints, setRoutePoints] = useState<GpsPoint[]>([]);
  const [savedTerritories, setSavedTerritories] = useState<LocalSavedTerritory[]>([]);
  const [territoriesLoading, setTerritoriesLoading] = useState(true);
  const [territoriesStorageError, setTerritoriesStorageError] = useState<string | null>(null);
  const [lastSaveStatus, setLastSaveStatus] = useState('No save yet.');
  const [lastSyncStatus, setLastSyncStatus] = useState('No sync yet.');
  const [lastRejectedReason, setLastRejectedReason] = useState<string | null>(null);
  const [hasAutoSavedCurrentRoute, setHasAutoSavedCurrentRoute] = useState(false);
  const [currentPlayerProfile, setCurrentPlayerProfile] = useState<PlayerProfile | null>(null);
  const [isPlayerLoaded, setIsPlayerLoaded] = useState(false);
  const [isPlayerStorageValid, setIsPlayerStorageValid] = useState(true);
  const [playerIdentityStatus, setPlayerIdentityStatus] = useState('Player identity not loaded yet.');
  const [onlineTerritories, setOnlineTerritories] = useState<OnlineTerritory[]>([]);
  const [onlineTerritoriesLoading, setOnlineTerritoriesLoading] = useState(false);
  const [onlineTerritoriesError, setOnlineTerritoriesError] = useState<string | null>(null);
  const [lastFetchStatus, setLastFetchStatus] = useState('No online fetch yet.');
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routeGeoJSON = useMemo(() => routeToGeoJSON(routePoints), [routePoints]);
  const isRouteLineRendered = routeGeoJSON !== null;
  const polygonAnalysis = useMemo(() => analyzePolygonCandidate(routePoints), [routePoints]);
  const polygonAreaAnalysis = useMemo(
    () => analyzePolygonArea(routePoints, polygonAnalysis.isCandidate),
    [polygonAnalysis.isCandidate, routePoints],
  );
  const polygonPreviewAnalysis = useMemo(
    () => analyzePolygonPreview(routePoints, polygonAnalysis, polygonAreaAnalysis),
    [polygonAnalysis, polygonAreaAnalysis, routePoints],
  );
  const territoryPreviewPayload = useMemo(
    () => buildTerritoryPreviewPayload(routePoints, polygonAreaAnalysis, polygonPreviewAnalysis),
    [polygonAreaAnalysis, polygonPreviewAnalysis, routePoints],
  );
  const isSaveTerritoryEnabled = territoryPreviewPayload !== null;
  const cameraCenterCoordinate = useMemo<[number, number]>(
    () => [
      currentLocation?.longitude ?? DEFAULT_MAP_CENTER.longitude,
      currentLocation?.latitude ?? DEFAULT_MAP_CENTER.latitude,
    ],
    [currentLocation],
  );
  const lastRoutePoint = routePoints.at(-1) ?? null;
  const lastSavedTerritory = savedTerritories.at(-1) ?? null;
  const territoryPreviewSignature = useMemo(
    () =>
      territoryPreviewPayload
        ? `${territoryPreviewPayload.areaM2.toFixed(2)}:${territoryPreviewPayload.sourceRoutePointCount}`
        : null,
    [territoryPreviewPayload],
  );
  const supabaseConfigStatus = useMemo(() => getSupabaseConfigStatus(), []);
  const backendConfigured = isBackendConfigured();
  const isSyncEnabled = backendConfigured && savedTerritories.length > 0;
  const onlineTerritoriesWithOwnership = useMemo(
    () =>
      onlineTerritories.map((territory) => ({
        ...territory,
        isMine:
          currentPlayerProfile?.playerId != null &&
          territory.deviceId != null &&
          territory.deviceId === currentPlayerProfile.playerId,
      })),
    [currentPlayerProfile?.playerId, onlineTerritories],
  );
  const playerIdShort = useMemo(() => formatPlayerIdShort(currentPlayerProfile?.playerId ?? null), [currentPlayerProfile?.playerId]);
  const playerCreatedAtLabel = useMemo(
    () => formatDateTimeLabel(currentPlayerProfile?.createdAt ?? null),
    [currentPlayerProfile?.createdAt],
  );
  const areaM2Label = useMemo(
    () => formatAreaMetricValue(polygonAreaAnalysis.result?.areaM2 ?? null, 1, '0.0'),
    [polygonAreaAnalysis.result?.areaM2],
  );
  const areaHectareLabel = useMemo(
    () => formatAreaMetricValue(polygonAreaAnalysis.result?.areaHectare ?? null, 4, '0.0000'),
    [polygonAreaAnalysis.result?.areaHectare],
  );
  const gpsReady = currentLocation !== null && !locationError && isLocationServicesEnabled;
  const debugLines = useMemo(
    () => [
      `Location: ${locationDebugText}`,
      `Route point count: ${routePoints.length}`,
      `Route line rendered: ${isRouteLineRendered ? 'Yes' : 'No'}`,
      `GeoJSON valid: ${routeGeoJSON ? 'Yes' : 'No'}`,
      `Closure distance: ${formatMeters(polygonAnalysis.closureDistanceMeters)}`,
      `Route bounding box: ${formatBoundingBoxDebugText(polygonAnalysis)}`,
      `Polygon rejection: ${polygonAnalysis.rejectionReason ?? 'None'}`,
      `Polygon area m2: ${formatAreaSquareMeters(polygonAreaAnalysis.result?.areaM2 ?? null)}`,
      `Polygon area hectare: ${formatAreaHectare(polygonAreaAnalysis.result?.areaHectare ?? null)}`,
      `Area calculation valid: ${polygonAreaAnalysis.isValid ? 'Yes' : 'No'}`,
      `Area rejection: ${polygonAreaAnalysis.rejectionReason ?? 'None'}`,
      `Preview rendered: ${polygonPreviewAnalysis.isRendered ? 'Yes' : 'No'}`,
      `Preview rejection: ${polygonPreviewAnalysis.rejectionReason ?? 'None'}`,
      `Fill point count: ${polygonPreviewAnalysis.geoJSON?.properties.pointCount ?? 0}`,
      `Saved territory count: ${savedTerritories.length}`,
      `Online territory count: ${onlineTerritoriesWithOwnership.length}`,
      `Online fetch loading: ${onlineTerritoriesLoading ? 'Yes' : 'No'}`,
      `Last fetch status: ${lastFetchStatus}`,
      `Fetch error: ${onlineTerritoriesError ?? 'None'}`,
      `Backend configured: ${backendConfigured ? 'Yes' : 'No'}`,
      `Current player short id: ${playerIdShort}`,
      `Storage error: ${territoriesStorageError ?? 'None'}`,
      `Current player id: ${currentPlayerProfile?.playerId ?? 'Unavailable'}`,
      `Player loaded: ${isPlayerLoaded ? 'Yes' : 'No'}`,
      `Player created at: ${currentPlayerProfile?.createdAt ?? 'Unavailable'}`,
      `Player last seen at: ${currentPlayerProfile?.lastSeenAt ?? 'Unavailable'}`,
      `Player storage valid: ${isPlayerStorageValid ? 'Yes' : 'No'}`,
      `Player app version: ${currentPlayerProfile?.appVersion ?? 'Unavailable'}`,
      `Player identity status: ${playerIdentityStatus}`,
      `Last sync status: ${lastSyncStatus}`,
      `Upload button enabled: ${isSyncEnabled ? 'Yes' : 'No'}`,
      `Supabase env status: ${supabaseConfigStatus.isConfigured ? 'Configured' : 'Missing values'}`,
      `Last saved area m2: ${formatAreaSquareMeters(lastSavedTerritory?.areaM2 ?? null)}`,
      `Save button enabled: ${isSaveTerritoryEnabled ? 'Yes' : 'No'}`,
      `Last save status: ${lastSaveStatus}`,
      `Last coordinate: ${formatCoordinateLabel(lastRoutePoint, currentLocation)}`,
      `Last rejected reason: ${lastRejectedReason ?? 'None'}`,
    ],
    [
      currentLocation,
      currentPlayerProfile,
      backendConfigured,
      isPlayerLoaded,
      isPlayerStorageValid,
      isRouteLineRendered,
      isSaveTerritoryEnabled,
      isSyncEnabled,
      lastFetchStatus,
      lastRejectedReason,
      lastRoutePoint,
      lastSaveStatus,
      lastSavedTerritory?.areaM2,
      lastSyncStatus,
      locationDebugText,
      onlineTerritoriesError,
      onlineTerritoriesLoading,
      onlineTerritoriesWithOwnership.length,
      playerIdentityStatus,
      playerIdShort,
      polygonAnalysis,
      polygonAreaAnalysis,
      polygonPreviewAnalysis,
      routeGeoJSON,
      routePoints.length,
      savedTerritories.length,
      supabaseConfigStatus.isConfigured,
      territoriesStorageError,
    ],
  );

  useEffect(() => {
    async function hydrateSavedTerritories(): Promise<void> {
      try {
        setTerritoriesStorageError(null);
        const storedTerritories = await loadSavedTerritories();

        setSavedTerritories(storedTerritories);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown storage load error';

        setTerritoriesStorageError(errorMessage);
        setSavedTerritories([]);
      } finally {
        setTerritoriesLoading(false);
      }
    }

    async function hydratePlayerIdentity(): Promise<void> {
      try {
        const playerProfile = await loadOrCreatePlayerProfile();
        setCurrentPlayerProfile(playerProfile);
        setIsPlayerStorageValid(wasPlayerStorageValid());
        setPlayerIdentityStatus('Player identity ready.');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown player identity error';

        setCurrentPlayerProfile(null);
        setIsPlayerStorageValid(false);
        setPlayerIdentityStatus(`Player identity failed: ${errorMessage}`);
      } finally {
        setIsPlayerLoaded(true);
      }
    }

    async function refreshLocationServicesStatus(): Promise<boolean> {
      const servicesEnabled = await Location.hasServicesEnabledAsync();

      setIsLocationServicesEnabled(servicesEnabled);

      if (!servicesEnabled) {
        setLocationDebugText('Location services are disabled on the device.');
      }

      return servicesEnabled;
    }

    async function loadCurrentLocation() {
      try {
        setLocationError(null);
        setLocationDebugText('Checking location permission...');

        const permission = await Location.requestForegroundPermissionsAsync();

        if (permission.status !== 'granted') {
          setLocationError('Location permission was denied. Enable it in Android settings to show your position.');
          setLocationDebugText(`Permission status: ${permission.status}`);
          return;
        }

        setLocationDebugText('Checking device location services...');

        const servicesEnabled = await refreshLocationServicesStatus();
        const providerStatus = await Location.getProviderStatusAsync();

        if (!servicesEnabled) {
          setLocationError(null);
          setLocationDebugText(`Services off. GPS: ${String(providerStatus.gpsAvailable)} Network: ${String(providerStatus.networkAvailable)}`);
          return;
        }

        setLocationDebugText('Trying last known location...');

        const lastKnownPosition = await Location.getLastKnownPositionAsync({
          maxAge: 60_000,
          requiredAccuracy: 100,
        });

        if (lastKnownPosition) {
          setCurrentLocation({
            latitude: lastKnownPosition.coords.latitude,
            longitude: lastKnownPosition.coords.longitude,
          });
          setLocationDebugText(
            `Last known: ${lastKnownPosition.coords.latitude.toFixed(6)}, ${lastKnownPosition.coords.longitude.toFixed(6)}`,
          );
        } else {
          setLocationDebugText('No last known location. Requesting fresh GPS position...');
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          mayShowUserSettingsDialog: true,
        });

        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationDebugText(
          `Current: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)} | accuracy: ${String(position.coords.accuracy)}`,
        );
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown location error';

        console.log('MapScreen location error:', error);
        setLocationError(`Current location could not be fetched: ${errorMessage}`);
        setLocationDebugText(`Location error: ${errorMessage}`);
      } finally {
        setIsLoadingLocation(false);
      }
    }

    async function hydrateOnlineTerritories(): Promise<void> {
      if (!backendConfigured) {
        setLastFetchStatus('Backend config missing. Online fetch skipped.');
        return;
      }

      await loadOnlineTerritories();
    }

    void hydrateSavedTerritories();
    void hydratePlayerIdentity();
    void hydrateOnlineTerritories();
    void loadCurrentLocation();

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState !== 'active') {
        return;
      }

      void refreshLocationServicesStatus();
    });

    return () => {
      locationSubscriptionRef.current?.remove();
      autoSaveTimeoutRef.current && clearTimeout(autoSaveTimeoutRef.current);
      appStateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (hasAutoSavedCurrentRoute) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      setLastSaveStatus('Auto-save skipped: already saved this route');
      return;
    }

    if (!territoryPreviewPayload || !territoryPreviewSignature) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      return;
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      saveTerritory('auto');
      autoSaveTimeoutRef.current = null;
    }, 2000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [hasAutoSavedCurrentRoute, saveTerritory, territoryPreviewPayload, territoryPreviewSignature]);

  useEffect(() => {
    if (territoriesLoading) {
      return;
    }

    async function persistSavedTerritories(): Promise<void> {
      try {
        setTerritoriesStorageError(null);
        await saveSavedTerritories(savedTerritories);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown storage save error';

        setTerritoriesStorageError(errorMessage);
      }
    }

    void persistSavedTerritories();
  }, [savedTerritories, territoriesLoading]);

  async function loadOnlineTerritories(): Promise<void> {
    if (!backendConfigured) {
      setOnlineTerritories([]);
      setOnlineTerritoriesError(null);
      setLastFetchStatus('Backend config missing. Online fetch skipped.');
      return;
    }

    try {
      setOnlineTerritoriesLoading(true);
      setOnlineTerritoriesError(null);
      const result = await fetchTerritories();

      if (!result.success) {
        setOnlineTerritories([]);
        setOnlineTerritoriesError(result.message);
        setLastFetchStatus(`Fetch failed: ${result.message}`);
        return;
      }

      setOnlineTerritories(result.territories);
      setLastFetchStatus(result.message);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown online fetch error';

      setOnlineTerritories([]);
      setOnlineTerritoriesError(errorMessage);
      setLastFetchStatus(`Fetch failed: ${errorMessage}`);
    } finally {
      setOnlineTerritoriesLoading(false);
    }
  }

  async function startTracking(): Promise<void> {
    try {
      setLocationError(null);
      setLastRejectedReason(null);
      setRoutePoints([]);
      setHasAutoSavedCurrentRoute(false);
      setLocationDebugText('Starting GPS tracking...');

      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setLocationError('Location permission was denied. Enable it in Android settings to start tracking.');
        setLocationDebugText(`Tracking permission status: ${permission.status}`);
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      setIsLocationServicesEnabled(servicesEnabled);

      if (!servicesEnabled) {
        setLocationError(null);
        setLocationDebugText('Tracking could not start because location services are disabled.');
        return;
      }

      locationSubscriptionRef.current?.remove();

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 1,
          mayShowUserSettingsDialog: true,
        },
        (position) => {
          const nextPoint = toGpsPoint(position);

          setCurrentLocation({
            latitude: nextPoint.latitude,
            longitude: nextPoint.longitude,
          });

          setRoutePoints((previousPoints) => {
            const previousPoint = previousPoints.at(-1) ?? null;
            const rejectionReason = getGpsPointRejectionReason(previousPoint, nextPoint);

            if (rejectionReason) {
              setLastRejectedReason(rejectionReason);
              setLocationDebugText(
                `Rejected point: ${rejectionReason ?? 'unknown'} @ ${nextPoint.latitude.toFixed(6)}, ${nextPoint.longitude.toFixed(6)}`,
              );
              return previousPoints;
            }

            setLastRejectedReason(null);
            setLocationDebugText(
              `Accepted point ${previousPoints.length + 1}: ${nextPoint.latitude.toFixed(6)}, ${nextPoint.longitude.toFixed(6)}`,
            );
            return [...previousPoints, nextPoint];
          });
        },
      );

      locationSubscriptionRef.current = subscription;
      setIsTracking(true);
      setLocationDebugText('GPS tracking started.');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown tracking error';

      console.log('MapScreen startTracking error:', error);
      setLocationError(`Tracking could not be started: ${errorMessage}`);
      setLocationDebugText(`Tracking start error: ${errorMessage}`);
    }
  }

  const stopTracking = useCallback((reason: 'auto_save' | 'manual' = 'manual'): void => {
    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;
    setIsTracking(false);
    setLocationDebugText(
      reason === 'auto_save'
        ? 'Tracking stopped automatically after territory save.'
        : 'GPS tracking stopped.',
    );
  }, []);

  function openLocationSettings(): void {
    void Linking.openSettings();
  }

  async function clearSavedTerritories(): Promise<void> {
    try {
      setTerritoriesStorageError(null);
      await clearSavedTerritoriesFromStorage();
      setSavedTerritories([]);
      setLastSaveStatus('Cleared saved territories.');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown clear storage error';

      setTerritoriesStorageError(errorMessage);
      setLastSaveStatus('Failed to clear saved territories.');
    }
  }

  async function syncLocalTerritories(): Promise<void> {
    if (!backendConfigured) {
      setLastSyncStatus('Backend config missing.');
      return;
    }

    const result = await uploadTerritories(savedTerritories, currentPlayerProfile?.playerId ?? null);

    setLastSyncStatus(result.success ? result.message : `Sync failed: ${result.message}`);
  }

  async function resetPlayerIdentity(): Promise<void> {
    try {
      setPlayerIdentityStatus('Resetting player identity...');
      await clearPlayerIdentity();
      const nextProfile = await loadOrCreatePlayerProfile();
      setCurrentPlayerProfile(nextProfile);
      setIsPlayerStorageValid(wasPlayerStorageValid());
      setIsPlayerLoaded(true);
      setPlayerIdentityStatus('Player identity reset complete.');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown reset error';

      setIsPlayerStorageValid(false);
      setPlayerIdentityStatus(`Player identity reset failed: ${errorMessage}`);
    }
  }

  function saveTerritory(trigger: 'auto' | 'manual' = 'manual'): void {
    if (!territoryPreviewPayload || !territoryPreviewSignature) {
      setLastSaveStatus('Preview is not ready to save.');
      return;
    }

    let saveSucceeded = false;
    let autoStopAfterSave = false;

    setSavedTerritories((previousTerritories) => {
      const lastSaved = previousTerritories.at(-1) ?? null;

      if (
        lastSaved &&
        Math.abs(lastSaved.areaM2 - territoryPreviewPayload.areaM2) < 0.01 &&
        lastSaved.sourceRoutePointCount === territoryPreviewPayload.sourceRoutePointCount
      ) {
        setLastSaveStatus(trigger === 'auto' ? 'Auto-save skipped: already saved.' : 'This territory is already saved.');
        return previousTerritories;
      }

      const nextTerritory: LocalSavedTerritory = {
        ...territoryPreviewPayload,
        id: createId(),
        status: 'local_saved',
      };

      saveSucceeded = true;

      if (trigger === 'auto') {
        setHasAutoSavedCurrentRoute(true);
        autoStopAfterSave = isTracking;
      }

      setLastSaveStatus(
        trigger === 'auto'
          ? `Auto-saved territory ${previousTerritories.length + 1}.`
          : `Saved territory ${previousTerritories.length + 1}.`,
      );
      return [...previousTerritories, nextTerritory];
    });

    if (!saveSucceeded) {
      return;
    }

    if (trigger === 'auto' && autoStopAfterSave) {
      stopTracking('auto_save');
      setLastSaveStatus('Territory saved. Tracking stopped automatically.');
    }
  }

  if (!MAPBOX_ACCESS_TOKEN) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.title}>Mapbox token missing</Text>
        <Text style={styles.subtitle}>
          Add `MAPBOX_ACCESS_TOKEN` to your `.env` file, then restart Expo and open the map again.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Mapbox.MapView style={styles.map} styleURL={MAPBOX_STYLE_URL}>
        <Mapbox.Camera centerCoordinate={cameraCenterCoordinate} zoomLevel={currentLocation ? 15 : 11} />
        {currentLocation ? <Mapbox.LocationPuck visible /> : null}
        <OnlineTerritoriesLayer territories={onlineTerritoriesWithOwnership} />
        <SavedTerritoriesLayer territories={savedTerritories} />
        <PolygonPreview geoJSON={polygonPreviewAnalysis.geoJSON} />
        <RouteLine geoJSON={routeGeoJSON} isPolygonCandidate={polygonAnalysis.isCandidate} />
      </Mapbox.MapView>
      {isLoadingLocation ? (
        <View style={styles.overlay}>
          <ActivityIndicator size="small" />
          <Text style={styles.overlayText}>Getting current location...</Text>
        </View>
      ) : null}
      {!isLocationServicesEnabled ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>Konum servisi kapalı</Text>
          <Text style={styles.overlayText}>
            Telefon konum servisi kapalı. GPS takibi için konumu açmalısın.
          </Text>
          <Pressable
            onPress={openLocationSettings}
            style={({ pressed }) => [
              styles.settingsButton,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <Text style={styles.buttonText}>Konum Ayarlarini Ac</Text>
          </Pressable>
        </View>
      ) : null}
      {locationError ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>Location unavailable</Text>
          <Text style={styles.overlayText}>{locationError}</Text>
        </View>
      ) : null}
      <GameHUD
        areaHectareLabel={areaHectareLabel}
        areaM2Label={areaM2Label}
        backendConfigured={backendConfigured}
        canSaveTerritory={isSaveTerritoryEnabled}
        canSync={isSyncEnabled}
        debugLines={debugLines}
        debugOpen={isDebugPanelExpanded}
        gpsReady={gpsReady}
        onClearTerritories={() => {
          void clearSavedTerritories();
        }}
        onFetchOnlineTerritories={() => {
          void loadOnlineTerritories();
        }}
        onResetIdentity={() => {
          void resetPlayerIdentity();
        }}
        onSaveTerritory={() => {
          saveTerritory('manual');
        }}
        onStartTracking={() => {
          void startTracking();
        }}
        onStopTracking={() => {
          stopTracking('manual');
        }}
        onSyncTerritories={() => {
          void syncLocalTerritories();
        }}
        onToggleDebug={() => {
          setIsDebugPanelExpanded((previousValue) => !previousValue);
        }}
        playerCreatedAt={playerCreatedAtLabel}
        playerIdShort={playerIdShort}
        playerLoaded={isPlayerLoaded}
        playerStorageValid={isPlayerStorageValid}
        savedTerritoryCount={savedTerritories.length}
        syncStatus={lastSyncStatus}
        trackingActive={isTracking}
      />
    </View>
  );
}

function formatMeters(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return 'N/A';
  }

  return `${value.toFixed(1)} m`;
}

function formatAreaSquareMeters(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return 'N/A';
  }

  return `${value.toFixed(1)} m2`;
}

function formatAreaHectare(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return 'N/A';
  }

  return `${value.toFixed(4)} ha`;
}

function formatBoundingBoxDebugText(
  polygonAnalysis: ReturnType<typeof analyzePolygonCandidate>,
): string {
  if (!polygonAnalysis.boundingBox) {
    return 'N/A';
  }

  return [
    `${polygonAnalysis.boundingBox.minLatitude.toFixed(5)}, ${polygonAnalysis.boundingBox.minLongitude.toFixed(5)}`,
    `${polygonAnalysis.boundingBox.maxLatitude.toFixed(5)}, ${polygonAnalysis.boundingBox.maxLongitude.toFixed(5)}`,
    `${formatMeters(polygonAnalysis.boundingBoxWidthMeters)} x ${formatMeters(polygonAnalysis.boundingBoxHeightMeters)}`,
  ].join(' -> ');
}

function formatAreaMetricValue(value: number | null, fractionDigits: number, fallback: string): string {
  if (value == null || !Number.isFinite(value)) {
    return fallback;
  }

  return value.toFixed(fractionDigits);
}

function formatPlayerIdShort(playerId: string | null): string {
  if (!playerId) {
    return 'Player ----';
  }

  return `Player ${playerId.slice(0, 8)}`;
}

function formatDateTimeLabel(value: string | null): string {
  if (!value) {
    return 'Unavailable';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
  });
}

function formatCoordinateLabel(lastRoutePoint: GpsPoint | null, currentLocation: Coordinates | null): string {
  if (lastRoutePoint) {
    return `${lastRoutePoint.latitude.toFixed(6)}, ${lastRoutePoint.longitude.toFixed(6)}`;
  }

  if (currentLocation) {
    return `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`;
  }

  return 'No location yet';
}

function toGpsPoint(position: Location.LocationObject): GpsPoint {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: position.coords.accuracy ?? Number.POSITIVE_INFINITY,
    speedKmh:
      position.coords.speed == null
        ? undefined
        : position.coords.speed * 3.6,
    timestamp: position.timestamp,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  messageContainer: {
    backgroundColor: uiColors.backdrop,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: uiSpacing.xl,
  },
  subtitle: {
    color: uiColors.secondaryText,
    fontSize: uiTypography.body,
    marginTop: uiSpacing.sm,
    textAlign: 'center',
  },
  title: {
    color: uiColors.primaryText,
    fontSize: uiTypography.headline,
    fontWeight: '600',
    textAlign: 'center',
  },
  overlay: {
    backgroundColor: uiColors.cardOverlayStrong,
    borderColor: uiColors.cardBorder,
    borderRadius: uiRadius.md,
    borderWidth: 1,
    left: uiSpacing.md,
    padding: uiSpacing.md,
    position: 'absolute',
    right: uiSpacing.md,
    top: uiSpacing.xl,
  },
  overlayText: {
    color: uiColors.secondaryText,
    fontSize: uiTypography.body,
    marginTop: uiSpacing.xs,
  },
  overlayTitle: {
    color: uiColors.primaryText,
    fontSize: uiTypography.title,
    fontWeight: '600',
  },
  settingsButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: uiColors.statusGps,
    borderRadius: uiRadius.sm,
    marginTop: uiSpacing.md,
    paddingHorizontal: uiSpacing.md,
    paddingVertical: uiSpacing.sm,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonText: {
    color: uiColors.primaryText,
    fontSize: uiTypography.body,
    fontWeight: '700',
  },
});
