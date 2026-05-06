import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { RouteLine } from '../components/map/RouteLine';
import { DEFAULT_MAP_CENTER, MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE_URL } from '../config/mapboxConfig';
import type { Coordinates, GpsPoint } from '../types';
import { getGpsPointRejectionReason } from '../utils/gpsFilter';
import { analyzePolygonArea } from '../utils/geo/calculatePolygonArea';
import { analyzePolygonCandidate } from '../utils/geo/isPolygonCandidate';
import { routeToGeoJSON } from '../utils/routeToGeoJSON';

if (MAPBOX_ACCESS_TOKEN) {
  void Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
}

export function MapScreen() {
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [locationDebugText, setLocationDebugText] = useState('Waiting for location request...');
  const [isTracking, setIsTracking] = useState(false);
  const [routePoints, setRoutePoints] = useState<GpsPoint[]>([]);
  const [lastRejectedReason, setLastRejectedReason] = useState<string | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const routeGeoJSON = useMemo(() => routeToGeoJSON(routePoints), [routePoints]);
  const isRouteLineRendered = routeGeoJSON !== null;
  const polygonAnalysis = useMemo(() => analyzePolygonCandidate(routePoints), [routePoints]);
  const polygonAreaAnalysis = useMemo(
    () => analyzePolygonArea(routePoints, polygonAnalysis.isCandidate),
    [polygonAnalysis.isCandidate, routePoints],
  );
  const cameraCenterCoordinate = useMemo<[number, number]>(
    () => [
      currentLocation?.longitude ?? DEFAULT_MAP_CENTER.longitude,
      currentLocation?.latitude ?? DEFAULT_MAP_CENTER.latitude,
    ],
    [currentLocation],
  );
  const lastRoutePoint = routePoints.at(-1) ?? null;

  useEffect(() => {
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

        const servicesEnabled = await Location.hasServicesEnabledAsync();
        const providerStatus = await Location.getProviderStatusAsync();

        if (!servicesEnabled) {
          setLocationError('Location services are turned off on the emulator. Enable device location and try again.');
          setLocationDebugText(
            `Services off. GPS: ${String(providerStatus.gpsAvailable)} Network: ${String(providerStatus.networkAvailable)}`,
          );
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

    void loadCurrentLocation();

    return () => {
      locationSubscriptionRef.current?.remove();
    };
  }, []);

  async function startTracking(): Promise<void> {
    try {
      setLocationError(null);
      setLastRejectedReason(null);
      setRoutePoints([]);
      setLocationDebugText('Starting GPS tracking...');

      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setLocationError('Location permission was denied. Enable it in Android settings to start tracking.');
        setLocationDebugText(`Tracking permission status: ${permission.status}`);
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();

      if (!servicesEnabled) {
        setLocationError('Location services are turned off. Turn them on before starting tracking.');
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
        <RouteLine geoJSON={routeGeoJSON} isPolygonCandidate={polygonAnalysis.isCandidate} />
      </Mapbox.MapView>
      {isLoadingLocation ? (
        <View style={styles.overlay}>
          <ActivityIndicator size="small" />
          <Text style={styles.overlayText}>Getting current location...</Text>
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
        <Text style={styles.debugTitle}>Tracking Debug</Text>
        <Text style={styles.debugText}>{locationDebugText}</Text>
        <Text style={styles.debugText}>Tracking active: {isTracking ? 'Yes' : 'No'}</Text>
        <Text style={styles.debugText}>Accepted points: {routePoints.length}</Text>
        <Text style={styles.debugText}>Route point count: {routePoints.length}</Text>
        <Text style={styles.debugText}>Route line rendered: {isRouteLineRendered ? 'Yes' : 'No'}</Text>
        <Text style={styles.debugText}>GeoJSON valid: {routeGeoJSON ? 'Yes' : 'No'}</Text>
        <Text style={styles.debugText}>Polygon candidate: {polygonAnalysis.isCandidate ? 'Yes' : 'No'}</Text>
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
  controls: {
    flexDirection: 'row',
    gap: 12,
    left: 16,
    position: 'absolute',
    right: 16,
    top: 96,
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
  stopButton: {
    backgroundColor: '#b42318',
  },
  debugPanel: {
    backgroundColor: 'rgba(17, 17, 17, 0.82)',
    borderRadius: 12,
    bottom: 16,
    left: 16,
    padding: 12,
    position: 'absolute',
    right: 16,
  },
  debugText: {
    color: '#f3f3f3',
    fontSize: 13,
    marginTop: 4,
  },
  debugTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
