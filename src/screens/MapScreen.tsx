import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RouteLine } from '../components/map/RouteLine';
import { PolygonPreview } from '../components/map/PolygonPreview';
import { SavedTerritoriesLayer } from '../components/map/SavedTerritoriesLayer';
import { DEFAULT_MAP_CENTER, MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE_URL } from '../config/mapboxConfig';
import type { Coordinates, GpsPoint, LocalSavedTerritory } from '../types';
import {
  clearSavedTerritories as clearSavedTerritoriesFromStorage,
  loadSavedTerritories,
  saveSavedTerritories,
} from '../services/territoryStorageService';
import { getGpsPointRejectionReason } from '../utils/gpsFilter';
import { analyzePolygonArea } from '../utils/geo/calculatePolygonArea';
import { buildTerritoryPreviewPayload } from '../utils/geo/buildTerritoryPreviewPayload';
import { analyzePolygonCandidate } from '../utils/geo/isPolygonCandidate';
import { analyzePolygonPreview } from '../utils/geo/routeToPolygonGeoJSON';
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
  const [lastRejectedReason, setLastRejectedReason] = useState<string | null>(null);
  const [hasAutoSavedCurrentRoute, setHasAutoSavedCurrentRoute] = useState(false);
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

    void hydrateSavedTerritories();
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
  }, [hasAutoSavedCurrentRoute, territoryPreviewPayload, territoryPreviewSignature]);

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

  function stopTracking(): void {
    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;
    setIsTracking(false);
    setLocationDebugText('GPS tracking stopped.');
  }

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

  function saveTerritory(trigger: 'auto' | 'manual' = 'manual'): void {
    if (!territoryPreviewPayload || !territoryPreviewSignature) {
      setLastSaveStatus('Preview is not ready to save.');
      return;
    }

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
        id: `${territoryPreviewPayload.createdAt}-${territoryPreviewPayload.sourceRoutePointCount}`,
        status: 'local_saved',
      };

      if (trigger === 'auto') {
        setHasAutoSavedCurrentRoute(true);
      }

      setLastSaveStatus(
        trigger === 'auto'
          ? `Auto-saved territory ${previousTerritories.length + 1}.`
          : `Saved territory ${previousTerritories.length + 1}.`,
      );
      return [...previousTerritories, nextTerritory];
    });
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
      <View style={styles.controls}>
        <Pressable
          disabled={isTracking}
          onPress={() => {
            void startTracking();
          }}
          style={({ pressed }) => [
            styles.button,
            styles.startButton,
            isTracking ? styles.buttonDisabled : null,
            pressed && !isTracking ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.buttonText}>Start</Text>
        </Pressable>
        <Pressable
          disabled={!isSaveTerritoryEnabled}
          onPress={() => {
            saveTerritory('manual');
          }}
          style={({ pressed }) => [
            styles.button,
            styles.saveButton,
            !isSaveTerritoryEnabled ? styles.buttonDisabled : null,
            pressed && isSaveTerritoryEnabled ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.buttonText}>Save Territory</Text>
        </Pressable>
      </View>
      <View style={styles.secondaryControls}>
        <Pressable
          onPress={() => {
            void clearSavedTerritories();
          }}
          style={({ pressed }) => [
            styles.button,
            styles.clearButton,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.buttonText}>Clear Saved Territories</Text>
        </Pressable>
        <Pressable
          disabled={!isTracking}
          onPress={stopTracking}
          style={({ pressed }) => [
            styles.button,
            styles.stopButton,
            !isTracking ? styles.buttonDisabled : null,
            pressed && isTracking ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.buttonText}>Stop</Text>
        </Pressable>
      </View>
      <View style={styles.debugPanel}>
        <Pressable
          onPress={() => {
            setIsDebugPanelExpanded((previousValue) => !previousValue);
          }}
          style={({ pressed }) => [
            styles.debugHeader,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.debugTitle}>Tracking Debug</Text>
          <Text style={styles.debugToggleText}>{isDebugPanelExpanded ? 'Hide' : 'Show'}</Text>
        </Pressable>
        <View style={styles.debugSummary}>
          <Text style={styles.debugText}>Tracking active: {isTracking ? 'Yes' : 'No'}</Text>
          <Text style={styles.debugText}>Accepted points: {routePoints.length}</Text>
          <Text style={styles.debugText}>Polygon candidate: {polygonAnalysis.isCandidate ? 'Yes' : 'No'}</Text>
          <Text style={styles.debugText}>Area valid: {polygonAreaAnalysis.isValid ? 'Yes' : 'No'}</Text>
          <Text style={styles.debugText}>Saved territories: {savedTerritories.length}</Text>
          <Text style={styles.debugText}>Persisted loaded: {territoriesLoading ? 'Loading' : 'Yes'}</Text>
        </View>
        {isDebugPanelExpanded ? (
          <ScrollView
            contentContainerStyle={styles.debugScrollContent}
            showsVerticalScrollIndicator={false}
            style={styles.debugScrollView}
          >
            <Text style={styles.debugText}>{locationDebugText}</Text>
            <Text style={styles.debugText}>Route point count: {routePoints.length}</Text>
            <Text style={styles.debugText}>Route line rendered: {isRouteLineRendered ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>GeoJSON valid: {routeGeoJSON ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>
              Closure distance: {formatMeters(polygonAnalysis.closureDistanceMeters)}
            </Text>
            <Text style={styles.debugText}>
              Route bounding box: {formatBoundingBoxDebugText(polygonAnalysis)}
            </Text>
            <Text style={styles.debugText}>
              Polygon rejection: {polygonAnalysis.rejectionReason ?? 'None'}
            </Text>
            <Text style={styles.debugText}>
              Polygon area m2: {formatAreaSquareMeters(polygonAreaAnalysis.result?.areaM2 ?? null)}
            </Text>
            <Text style={styles.debugText}>
              Polygon area hectare: {formatAreaHectare(polygonAreaAnalysis.result?.areaHectare ?? null)}
            </Text>
            <Text style={styles.debugText}>Area calculation valid: {polygonAreaAnalysis.isValid ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>
              Area rejection: {polygonAreaAnalysis.rejectionReason ?? 'None'}
            </Text>
            <Text style={styles.debugText}>
              Polygon preview rendered: {polygonPreviewAnalysis.isRendered ? 'Yes' : 'No'}
            </Text>
            <Text style={styles.debugText}>
              Preview rejection: {polygonPreviewAnalysis.rejectionReason ?? 'None'}
            </Text>
            <Text style={styles.debugText}>
              Fill area m2: {formatAreaSquareMeters(polygonAreaAnalysis.result?.areaM2 ?? null)}
            </Text>
            <Text style={styles.debugText}>
              Fill point count: {polygonPreviewAnalysis.geoJSON?.properties.pointCount ?? 0}
            </Text>
            <Text style={styles.debugText}>Saved territory count: {savedTerritories.length}</Text>
            <Text style={styles.debugText}>
              Storage error: {territoriesStorageError ?? 'None'}
            </Text>
            <Text style={styles.debugText}>
              Last saved area m2: {formatAreaSquareMeters(lastSavedTerritory?.areaM2 ?? null)}
            </Text>
            <Text style={styles.debugText}>Save button enabled: {isSaveTerritoryEnabled ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>Last save status: {lastSaveStatus}</Text>
            <Text style={styles.debugText}>
              Last coordinate:{' '}
              {lastRoutePoint
                ? `${lastRoutePoint.latitude.toFixed(6)}, ${lastRoutePoint.longitude.toFixed(6)}`
                : currentLocation
                  ? `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`
                  : 'No location yet'}
            </Text>
            <Text style={styles.debugText}>
              Last rejected reason: {lastRejectedReason ?? 'None'}
            </Text>
          </ScrollView>
        ) : null}
      </View>
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
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  subtitle: {
    color: '#666666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  overlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 12,
    left: 16,
    padding: 12,
    position: 'absolute',
    right: 16,
    top: 16,
  },
  overlayText: {
    color: '#333333',
    fontSize: 14,
    marginTop: 6,
  },
  overlayTitle: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#175cd3',
    borderRadius: 10,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
    left: 16,
    position: 'absolute',
    right: 16,
    top: 96,
  },
  secondaryControls: {
    flexDirection: 'row',
    gap: 12,
    left: 16,
    position: 'absolute',
    right: 16,
    top: 152,
  },
  button: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: '#167c45',
  },
  saveButton: {
    backgroundColor: '#0f766e',
  },
  clearButton: {
    backgroundColor: '#6b7280',
  },
  stopButton: {
    backgroundColor: '#b42318',
  },
  debugPanel: {
    backgroundColor: 'rgba(17, 17, 17, 0.82)',
    borderRadius: 12,
    bottom: 16,
    left: 16,
    position: 'absolute',
    right: 16,
  },
  debugHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  debugScrollContent: {
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  debugScrollView: {
    maxHeight: '35%',
  },
  debugSummary: {
    paddingBottom: 12,
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  debugText: {
    color: '#f3f3f3',
    fontSize: 13,
    marginTop: 4,
  },
  debugToggleText: {
    color: '#d0d5dd',
    fontSize: 13,
    fontWeight: '600',
  },
  debugTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
