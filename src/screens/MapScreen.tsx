import Mapbox from '@rnmapbox/maps';
import type { User } from '@supabase/supabase-js';
import * as Location from 'expo-location';
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Dimensions, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { CaptureConfirmationCard } from '../components/hud/CaptureConfirmationCard';
import { CaptureStatusBanner } from '../components/hud/CaptureStatusBanner';
import { GameHUD } from '../components/hud/GameHUD';
import { COOLDOWN_CONFIG } from '../config/cooldownConfig';
import { PERFORMANCE_CONFIG } from '../config/performanceConfig';
import { OnlineTerritoriesLayer } from '../components/map/OnlineTerritoriesLayer';
import { RouteLine } from '../components/map/RouteLine';
import { PolygonPreview } from '../components/map/PolygonPreview';
import { SavedTerritoriesLayer } from '../components/map/SavedTerritoriesLayer';
import { DEFAULT_MAP_CENTER, MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE_URL } from '../config/mapboxConfig';
import { uiColors, uiRadius, uiSpacing, uiTypography } from '../config/uiConfig';
import type {
  AuthState,
  CooldownReason,
  CooldownState,
  Coordinates,
  GpsPoint,
  LocalSavedTerritory,
  OnlineTerritory,
  OverlapComparableTerritory,
  PlayerProfile,
  TerritoryRealtimeEvent,
  TerritoryPreviewPayload,
  ViewportBounds,
} from '../types';
import { getSupabaseConfigStatus } from '../config/supabaseConfig';
import {
  getCurrentSession,
  onAuthStateChange,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from '../services/authService';
import {
  clearPlayerIdentity,
  loadOrCreatePlayerProfile,
  wasPlayerStorageValid,
} from '../services/playerIdentityService';
import {
  createOrUpdateRemoteProfile,
  linkAnonymousProfileToUser,
  updateLocalPlayerProfile,
} from '../services/profileService';
import {
  clearSavedTerritories as clearSavedTerritoriesFromStorage,
  loadSavedTerritories,
  saveSavedTerritories,
} from '../services/territoryStorageService';
import { subscribeToTerritoryRealtime } from '../services/territoryRealtimeService';
import {
  fetchTerritoriesForViewport,
  isBackendConfigured,
  transferTerritoryOwnership,
  uploadTerritory,
  uploadTerritories,
} from '../services/territoryBackendService';
import { CLAIM_RULE_CONFIG } from '../config/claimRulesConfig';
import { getGpsPointRejectionReason } from '../utils/gpsFilter';
import { analyzePolygonArea } from '../utils/geo/calculatePolygonArea';
import { calculateViewportBounds } from '../utils/geo/calculateViewportBounds';
import { analyzeTerritoryOverlap } from '../utils/analyzeTerritoryOverlap';
import { buildConflictVisualizationState } from '../utils/buildConflictVisualizationState';
import { buildTerritoryPreviewPayload } from '../utils/geo/buildTerritoryPreviewPayload';
import { filterTerritoriesByViewport } from '../utils/geo/filterTerritoriesByViewport';
import { analyzePolygonCandidate } from '../utils/geo/isPolygonCandidate';
import { analyzePolygonPreview } from '../utils/geo/routeToPolygonGeoJSON';
import { simplifyPolygon } from '../utils/geo/simplifyPolygon';
import { createId } from '../utils/createId';
import { executeTerritoryCapture } from '../utils/executeTerritoryCapture';
import { checkCooldown } from '../utils/checkCooldown';
import { routeToGeoJSON } from '../utils/routeToGeoJSON';
import { validateTerritoryClaim } from '../utils/validateTerritoryClaim';

if (MAPBOX_ACCESS_TOKEN) {
  void Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
}

type SaveResult = {
  reason: 'saved' | 'captured' | 'duplicate' | 'cooldown' | 'invalid' | 'failed';
  saved: boolean;
  shouldAutoStop: boolean;
};

type AutoSaveBlockedReason =
  | 'none'
  | 'tracking_inactive'
  | 'preview_missing'
  | 'preview_not_rendered'
  | 'area_invalid'
  | 'already_auto_saved'
  | 'capture_prompt_visible'
  | 'capture_processing'
  | 'claim_not_allowed'
  | 'claim_cooldown_active';

type RefreshOnlineTerritoriesReason = 'manual' | 'startup' | 'capture' | 'carve' | 'sync' | 'realtime' | 'auto_sync';

type RenderTerritoryMetrics = {
  renderedSavedTerritories: LocalSavedTerritory[];
  renderedOnlineTerritories: OnlineTerritory[];
  savedPointsAfterSimplify: number;
  savedPointsBeforeSimplify: number;
  simplificationApplied: boolean;
  visibleOnlineTerritories: OnlineTerritory[];
  visibleSavedTerritories: LocalSavedTerritory[];
};

type MapCameraChangedEvent = Parameters<NonNullable<ComponentProps<typeof Mapbox.MapView>['onCameraChanged']>>[0];
type EffectiveOwnerMode = 'auth' | 'device';
type EffectiveOwnerContext = {
  authUserId: string | null;
  effectiveOwnerId: string | null;
  mode: EffectiveOwnerMode;
  playerId: string | null;
};

const INITIAL_AUTH_STATE: AuthState = {
  email: null,
  error: null,
  isAuthenticated: false,
  loading: true,
  userId: null,
};

function normalizeAuthInput(value: string): string {
  return value.trim();
}

export function MapScreen() {
  const autoSaveSuccessBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownTickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
  const [locallySyncedTerritoryIds, setLocallySyncedTerritoryIds] = useState<string[]>([]);
  const [lastRejectedReason, setLastRejectedReason] = useState<string | null>(null);
  const [lastCooldownBlockReason, setLastCooldownBlockReason] = useState<CooldownReason>('none');
  const [lastCarveApplied, setLastCarveApplied] = useState(false);
  const [lastFullCaptureApplied, setLastFullCaptureApplied] = useState(false);
  const [lastCarvedTerritoryIds, setLastCarvedTerritoryIds] = useState<string[]>([]);
  const [lastResultingGeometryValid, setLastResultingGeometryValid] = useState(true);
  const [hasAutoSavedCurrentRoute, setHasAutoSavedCurrentRoute] = useState(false);
  const [hasCapturedCurrentRoute, setHasCapturedCurrentRoute] = useState(false);
  const [isAutoSaveTimerActive, setIsAutoSaveTimerActive] = useState(false);
  const [currentPlayerProfile, setCurrentPlayerProfile] = useState<PlayerProfile | null>(null);
  const [isPlayerLoaded, setIsPlayerLoaded] = useState(false);
  const [isPlayerStorageValid, setIsPlayerStorageValid] = useState(true);
  const [playerIdentityStatus, setPlayerIdentityStatus] = useState('Player identity not loaded yet.');
  const [authState, setAuthState] = useState<AuthState>(INITIAL_AUTH_STATE);
  const [authEmailInput, setAuthEmailInput] = useState('');
  const [authPasswordInput, setAuthPasswordInput] = useState('');
  const [onlineTerritories, setOnlineTerritories] = useState<OnlineTerritory[]>([]);
  const [onlineTerritoriesLoading, setOnlineTerritoriesLoading] = useState(false);
  const [onlineTerritoriesError, setOnlineTerritoriesError] = useState<string | null>(null);
  const [lastFetchStatus, setLastFetchStatus] = useState('No online fetch yet.');
  const [lastFetchReason, setLastFetchReason] = useState<RefreshOnlineTerritoriesReason | null>(null);
  const [lastFetchDurationMs, setLastFetchDurationMs] = useState<number | null>(null);
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [lastRealtimeEventType, setLastRealtimeEventType] = useState<TerritoryRealtimeEvent['type'] | null>(null);
  const [lastRealtimeTerritoryId, setLastRealtimeTerritoryId] = useState<string | null>(null);
  const [lastRealtimeEventAt, setLastRealtimeEventAt] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [capturePromptVisible, setCapturePromptVisible] = useState(false);
  const [captureStatusLabel, setCaptureStatusLabel] = useState<string | undefined>(undefined);
  const [captureStatusMessage, setCaptureStatusMessage] = useState<string | null>(null);
  const [captureStatusTone, setCaptureStatusTone] = useState<'available' | 'failed' | 'success'>('available');
  const [isCaptureProcessing, setIsCaptureProcessing] = useState(false);
  const [autoSaveSuccessMessage, setAutoSaveSuccessMessage] = useState<string | null>(null);
  const [lastSaveResultReason, setLastSaveResultReason] = useState<SaveResult['reason'] | null>(null);
  const [lastSaveResultShouldAutoStop, setLastSaveResultShouldAutoStop] = useState<boolean | null>(null);
  const [cooldownState, setCooldownState] = useState<CooldownState>({});
  const [cooldownNowMs, setCooldownNowMs] = useState(() => Date.now());
  const [currentViewportBounds, setCurrentViewportBounds] = useState<ViewportBounds | null>(null);
  const [debouncedViewportBounds, setDebouncedViewportBounds] = useState<ViewportBounds | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCameraViewportBoundsRef = useRef<ViewportBounds | null>(null);
  const lastCameraViewportUpdateAtRef = useRef(0);
  const realtimeFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeEventBufferRef = useRef<Map<string, TerritoryRealtimeEvent>>(new Map());
  const realtimeFallbackRefreshPendingRef = useRef(false);
  const pendingAutoSyncTerritoryIdsRef = useRef<Set<string>>(new Set());
  const saveTerritoryRef = useRef<((trigger?: 'auto' | 'manual') => Promise<SaveResult>) | null>(null);
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
  const initialZoomLevel = currentLocation ? 15 : 11;
  const cameraCenterCoordinate = useMemo<[number, number]>(
    () => [
      currentLocation?.longitude ?? DEFAULT_MAP_CENTER.longitude,
      currentLocation?.latitude ?? DEFAULT_MAP_CENTER.latitude,
    ],
    [currentLocation],
  );
  const fallbackViewportBounds = useMemo(
    () =>
      calculateViewportBounds({
        aspectRatio: Dimensions.get('window').width / Math.max(Dimensions.get('window').height, 1),
        center: currentLocation ?? DEFAULT_MAP_CENTER,
        paddingRatio: PERFORMANCE_CONFIG.viewportPaddingRatio,
        zoomLevel: initialZoomLevel,
      }),
    [currentLocation, initialZoomLevel],
  );
  useEffect(() => {
    lastCameraViewportBoundsRef.current = currentViewportBounds ?? fallbackViewportBounds;
  }, [currentViewportBounds, fallbackViewportBounds]);
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
  const currentAuthUserId = authState.userId;
  const currentDevicePlayerId = currentPlayerProfile?.playerId ?? null;
  const currentProfileUserId = currentPlayerProfile?.userId ?? null;
  const currentEmail = currentPlayerProfile?.email ?? authState.email;
  const effectiveOwnerContext = useMemo(
    () => getEffectiveOwnerContext(currentAuthUserId, currentDevicePlayerId),
    [currentAuthUserId, currentDevicePlayerId],
  );
  const claimCooldown = useMemo(
    () => checkCooldown('claim', cooldownState, cooldownNowMs),
    [cooldownNowMs, cooldownState],
  );
  const captureCooldown = useMemo(
    () => checkCooldown('capture', cooldownState, cooldownNowMs),
    [cooldownNowMs, cooldownState],
  );
  const startStopCooldown = useMemo(
    () => checkCooldown('start_stop', cooldownState, cooldownNowMs),
    [cooldownNowMs, cooldownState],
  );
  const syncCooldown = useMemo(
    () => checkCooldown('sync', cooldownState, cooldownNowMs),
    [cooldownNowMs, cooldownState],
  );
  const onlineTerritoriesWithOwnership = useMemo(
    () =>
      onlineTerritories.map((territory) => ({
        ...territory,
        isMine: isOnlineTerritoryMine(territory, effectiveOwnerContext),
      })),
    [effectiveOwnerContext, onlineTerritories],
  );
  const enemyOnlineTerritories = useMemo(
    () => onlineTerritoriesWithOwnership.filter((territory) => territory.isMine !== true),
    [onlineTerritoriesWithOwnership],
  );
  const unsyncedSavedTerritories = useMemo(
    () => getUnsyncedSavedTerritories(savedTerritories, onlineTerritoriesWithOwnership, locallySyncedTerritoryIds),
    [locallySyncedTerritoryIds, onlineTerritoriesWithOwnership, savedTerritories],
  );
  const displayOnlineTerritories = useMemo(
    () => getDisplayOnlineTerritories(onlineTerritoriesWithOwnership, savedTerritories),
    [onlineTerritoriesWithOwnership, savedTerritories],
  );
  const renderViewportBounds = currentViewportBounds ?? fallbackViewportBounds;
  const isSyncEnabled = backendConfigured && unsyncedSavedTerritories.length > 0 && syncCooldown.allowed;
  const canFetchOnlineTerritories = backendConfigured && syncCooldown.allowed && !onlineTerritoriesLoading;
  const canStartTracking = !isTracking && startStopCooldown.allowed;
  const canStopTracking = isTracking && startStopCooldown.allowed;
  const renderTerritoryMetrics = useMemo<RenderTerritoryMetrics>(() => {
    const visibleOnlineTerritories = filterTerritoriesByViewport(displayOnlineTerritories, renderViewportBounds);
    const visibleSavedTerritories = filterTerritoriesByViewport(savedTerritories, renderViewportBounds);
    const limitedOnlineTerritories = limitTerritoriesForRender(
      visibleOnlineTerritories,
      PERFORMANCE_CONFIG.maxRenderedOnlineTerritories,
      renderViewportBounds,
    );
    const limitedSavedTerritories = limitTerritoriesForRender(
      visibleSavedTerritories,
      PERFORMANCE_CONFIG.maxRenderedLocalTerritories,
      renderViewportBounds,
    );
    let simplificationApplied = false;
    let savedPointsBeforeSimplify = 0;
    let savedPointsAfterSimplify = 0;
    const renderedOnlineTerritories = limitedOnlineTerritories.map((territory) => {
      savedPointsBeforeSimplify += territory.coordinates.length;
      const simplifiedCoordinates =
        territory.coordinates.length > PERFORMANCE_CONFIG.maxPolygonPointsBeforeSimplify
          ? simplifyPolygon(territory.coordinates, PERFORMANCE_CONFIG.polygonSimplificationTolerance)
          : [...territory.coordinates];

      savedPointsAfterSimplify += simplifiedCoordinates.length;
      simplificationApplied = simplificationApplied || simplifiedCoordinates.length !== territory.coordinates.length;

      return {
        ...territory,
        coordinates: simplifiedCoordinates,
      };
    });
    const renderedSavedTerritories = limitedSavedTerritories.map((territory) => {
      savedPointsBeforeSimplify += territory.coordinates.length;
      const simplifiedCoordinates =
        territory.coordinates.length > PERFORMANCE_CONFIG.maxPolygonPointsBeforeSimplify
          ? simplifyPolygon(territory.coordinates, PERFORMANCE_CONFIG.polygonSimplificationTolerance)
          : [...territory.coordinates];

      savedPointsAfterSimplify += simplifiedCoordinates.length;
      simplificationApplied = simplificationApplied || simplifiedCoordinates.length !== territory.coordinates.length;

      return {
        ...territory,
        coordinates: simplifiedCoordinates,
      };
    });

    return {
      renderedOnlineTerritories,
      renderedSavedTerritories,
      savedPointsAfterSimplify,
      savedPointsBeforeSimplify,
      simplificationApplied,
      visibleOnlineTerritories,
      visibleSavedTerritories,
    };
  }, [displayOnlineTerritories, renderViewportBounds, savedTerritories]);
  const overlapComparableOnlineTerritories = useMemo(
    () =>
      onlineTerritoriesWithOwnership.filter(
        (territory) => territory.isMine === true || territory.userId != null || territory.deviceId != null,
      ),
    [onlineTerritoriesWithOwnership],
  );
  const overlapComparableTerritories = useMemo(
    () => buildOverlapComparableTerritories(overlapComparableOnlineTerritories, savedTerritories),
    [overlapComparableOnlineTerritories, savedTerritories],
  );
  const territoryOverlapAnalysis = useMemo(
    () => analyzeTerritoryOverlap(territoryPreviewPayload?.coordinates ?? [], overlapComparableTerritories),
    [overlapComparableTerritories, territoryPreviewPayload?.coordinates],
  );
  const conflictVisualizationState = useMemo(
    () => buildConflictVisualizationState(territoryOverlapAnalysis),
    [territoryOverlapAnalysis],
  );
  const conflictLabel = useMemo(
    () => formatConflictLabel(conflictVisualizationState.severity),
    [conflictVisualizationState.severity],
  );
  const claimValidationResult = useMemo(
    () =>
      validateTerritoryClaim(
        territoryOverlapAnalysis,
        conflictVisualizationState,
        enemyOnlineTerritories,
        territoryPreviewPayload?.coordinates ?? [],
      ),
    [
      conflictVisualizationState,
      enemyOnlineTerritories,
      territoryOverlapAnalysis,
      territoryPreviewPayload?.coordinates,
    ],
  );
  const territoryInteractionPlan = useMemo(
    () => executeTerritoryCapture(territoryPreviewPayload, enemyOnlineTerritories, claimValidationResult),
    [claimValidationResult, enemyOnlineTerritories, territoryPreviewPayload],
  );
  const claimLabel = useMemo(() => formatClaimLabel(claimValidationResult), [claimValidationResult]);
  const handleMapCameraChanged = useCallback((state: MapCameraChangedEvent): void => {
    const center = state?.properties?.center;
    const bounds = state?.properties?.bounds;
    const zoomLevel = state?.properties?.zoom;

    if (
      !Array.isArray(center) ||
      center.length < 2 ||
      typeof center[0] !== 'number' ||
      typeof center[1] !== 'number' ||
      !Number.isFinite(center[0]) ||
      !Number.isFinite(center[1]) ||
      !bounds ||
      !Array.isArray(bounds.ne) ||
      !Array.isArray(bounds.sw) ||
      bounds.ne.length < 2 ||
      bounds.sw.length < 2 ||
      typeof bounds.ne[0] !== 'number' ||
      typeof bounds.ne[1] !== 'number' ||
      typeof bounds.sw[0] !== 'number' ||
      typeof bounds.sw[1] !== 'number' ||
      !Number.isFinite(bounds.ne[0]) ||
      !Number.isFinite(bounds.ne[1]) ||
      !Number.isFinite(bounds.sw[0]) ||
      !Number.isFinite(bounds.sw[1]) ||
      typeof zoomLevel !== 'number' ||
      !Number.isFinite(zoomLevel)
    ) {
      return;
    }

    const nextViewportBounds = calculateViewportBounds({
      center: {
        latitude: center[1],
        longitude: center[0],
      },
      paddingRatio: PERFORMANCE_CONFIG.viewportPaddingRatio,
      visibleBounds: {
        ne: [bounds.ne[0], bounds.ne[1]],
        sw: [bounds.sw[0], bounds.sw[1]],
      },
      zoomLevel,
    });
    const previousBounds = lastCameraViewportBoundsRef.current;
    const now = Date.now();

    if (
      previousBounds &&
      !haveViewportBoundsChanged(previousBounds, nextViewportBounds)
    ) {
      return;
    }

    if (now - lastCameraViewportUpdateAtRef.current < PERFORMANCE_CONFIG.cameraChangeThrottleMs) {
      return;
    }

    lastCameraViewportBoundsRef.current = nextViewportBounds;
    lastCameraViewportUpdateAtRef.current = now;
    setCurrentViewportBounds(nextViewportBounds);
  }, []);
  const playerIdShort = useMemo(() => formatPlayerIdShort(currentPlayerProfile?.playerId ?? null), [currentPlayerProfile?.playerId]);
  const gpsReady = currentLocation !== null && !locationError && isLocationServicesEnabled;
  const captureCoveragePercentLabel = useMemo(
    () => `${claimValidationResult.estimatedEnemyCoveragePercent.toFixed(1)}%`,
    [claimValidationResult.estimatedEnemyCoveragePercent],
  );
  const capturePromptSignature = useMemo(() => {
    if (!territoryPreviewPayload || !claimValidationResult.isCaptureAllowed) {
      return null;
    }

    const overlappingTerritoryIds = [...territoryOverlapAnalysis.overlappingTerritoryIds].sort();
    const roundedCoveragePercent = Math.round(claimValidationResult.estimatedEnemyCoveragePercent);

    if (overlappingTerritoryIds.length === 0) {
      return `capture:${roundedCoveragePercent}:${territoryPreviewPayload.sourceRoutePointCount}`;
    }

    return `capture:${overlappingTerritoryIds.join(',')}:${roundedCoveragePercent}`;
  }, [
    claimValidationResult.estimatedEnemyCoveragePercent,
    claimValidationResult.isCaptureAllowed,
    territoryOverlapAnalysis.overlappingTerritoryIds,
    territoryPreviewPayload,
  ]);
  const [lastCapturePromptSignature, setLastCapturePromptSignature] = useState<string | null>(null);
  const autoSaveBlockedReason = useMemo<AutoSaveBlockedReason>(() => {
    if (!isTracking) {
      return 'tracking_inactive';
    }

    if (!territoryPreviewPayload || !territoryPreviewSignature) {
      return 'preview_missing';
    }

    if (!polygonPreviewAnalysis.isRendered) {
      return 'preview_not_rendered';
    }

    if (!polygonAreaAnalysis.isValid) {
      return 'area_invalid';
    }

    if (hasAutoSavedCurrentRoute) {
      return 'already_auto_saved';
    }

    if (capturePromptVisible) {
      return 'capture_prompt_visible';
    }

    if (isCaptureProcessing) {
      return 'capture_processing';
    }

    if (!claimValidationResult.isClaimAllowed) {
      return 'claim_not_allowed';
    }

    if (!claimCooldown.allowed && !claimValidationResult.isCaptureAllowed) {
      return 'claim_cooldown_active';
    }

    return 'none';
  }, [
    capturePromptVisible,
    claimCooldown.allowed,
    claimValidationResult.isCaptureAllowed,
    claimValidationResult.isClaimAllowed,
    hasAutoSavedCurrentRoute,
    isCaptureProcessing,
    isTracking,
    polygonAreaAnalysis.isValid,
    polygonPreviewAnalysis.isRendered,
    territoryPreviewPayload,
    territoryPreviewSignature,
  ]);
  const autoSaveEligible = autoSaveBlockedReason === 'none';
  const debugLines = useMemo(
    () => [
      `Location: ${locationDebugText}`,
      `Route point count: ${routePoints.length}`,
      `Performance debug enabled: ${PERFORMANCE_CONFIG.enablePerformanceDebug ? 'Yes' : 'No'}`,
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
      `Enemy online territory count: ${enemyOnlineTerritories.length}`,
      `Displayed online territory count: ${displayOnlineTerritories.length}`,
      `Visible online territories count: ${renderTerritoryMetrics.visibleOnlineTerritories.length}`,
      `Rendered online territories count: ${renderTerritoryMetrics.renderedOnlineTerritories.length}`,
      `Rendered saved territories count: ${renderTerritoryMetrics.renderedSavedTerritories.length}`,
      `Last fetch reason: ${lastFetchReason ?? 'None'}`,
      `Last fetch duration ms: ${lastFetchDurationMs ?? 0}`,
      `Realtime enabled: ${isRealtimeEnabled ? 'Yes' : 'No'}`,
      `Realtime connected: ${isRealtimeConnected ? 'Yes' : 'No'}`,
      `Last realtime event type: ${lastRealtimeEventType ?? 'None'}`,
      `Last realtime territory id: ${lastRealtimeTerritoryId ?? 'None'}`,
      `Last realtime event at: ${lastRealtimeEventAt ?? 'None'}`,
      `Realtime error: ${realtimeError ?? 'None'}`,
      `Render simplification applied: ${renderTerritoryMetrics.simplificationApplied ? 'Yes' : 'No'}`,
      `Render polygon points before simplify: ${renderTerritoryMetrics.savedPointsBeforeSimplify}`,
      `Render polygon points after simplify: ${renderTerritoryMetrics.savedPointsAfterSimplify}`,
      `Unsynced saved territory count: ${unsyncedSavedTerritories.length}`,
      `Overlap detected: ${territoryOverlapAnalysis.hasOverlap ? 'Yes' : 'No'}`,
      `Overlap count: ${territoryOverlapAnalysis.overlapCount}`,
      `Overlapping mine count: ${territoryOverlapAnalysis.overlappingMineCount}`,
      `Overlapping others count: ${territoryOverlapAnalysis.overlappingOthersCount}`,
      `Estimated overlap percent: ${territoryOverlapAnalysis.estimatedOverlapPercent.toFixed(1)}%`,
      `Overlapping territory ids count: ${territoryOverlapAnalysis.overlappingTerritoryIds.length}`,
      `Own overlap count: ${territoryOverlapAnalysis.overlappingMineCount}`,
      `Enemy carve target count: ${territoryInteractionPlan.enemyOverlapTargetIds.length}`,
      `Conflict severity: ${conflictVisualizationState.severity}`,
      `Overlap percent rounded: ${Math.round(conflictVisualizationState.overlapPercent)}%`,
      `Overlaps mine: ${conflictVisualizationState.overlapsMine ? 'Yes' : 'No'}`,
      `Overlaps others: ${conflictVisualizationState.overlapsOthers ? 'Yes' : 'No'}`,
      `Overlap telemetry percent: ${claimValidationResult.overlapPercent.toFixed(1)}%`,
      `Claim allowed: ${claimValidationResult.isClaimAllowed ? 'Yes' : 'No'}`,
      `Claim reject reason: ${claimValidationResult.rejectReason}`,
      `Capture candidate: ${claimValidationResult.isCaptureCandidate ? 'Yes' : 'No'}`,
      `Capture allowed: ${claimValidationResult.isCaptureAllowed ? 'Yes' : 'No'}`,
      `Estimated enemy coverage percent: ${claimValidationResult.estimatedEnemyCoveragePercent.toFixed(1)}%`,
      `Capture prompt visible: ${capturePromptVisible ? 'Yes' : 'No'}`,
      `Capture prompt signature: ${capturePromptSignature ?? 'None'}`,
      `Last shown capture prompt signature: ${lastCapturePromptSignature ?? 'None'}`,
      `Has captured current route: ${hasCapturedCurrentRoute ? 'Yes' : 'No'}`,
      `Capture processing: ${isCaptureProcessing ? 'Yes' : 'No'}`,
      `Auto-save eligible: ${autoSaveEligible ? 'Yes' : 'No'}`,
      `Auto-save blocked reason: ${autoSaveBlockedReason}`,
      `Auto-save timer active: ${isAutoSaveTimerActive ? 'Yes' : 'No'}`,
      `Has auto-saved current route: ${hasAutoSavedCurrentRoute ? 'Yes' : 'No'}`,
      `Tracking active: ${isTracking ? 'Yes' : 'No'}`,
      `Preview payload exists: ${territoryPreviewPayload ? 'Yes' : 'No'}`,
      `Capture telemetry enemy coverage: ${claimValidationResult.estimatedEnemyCoveragePercent.toFixed(1)}%`,
      `Carve applied: ${lastCarveApplied ? 'Yes' : 'No'}`,
      `Full capture applied: ${lastFullCaptureApplied ? 'Yes' : 'No'}`,
      `Carved enemy ids count: ${lastCarvedTerritoryIds.length}`,
      `Carved territory ids: ${lastCarvedTerritoryIds.length > 0 ? lastCarvedTerritoryIds.join(', ') : 'None'}`,
      `Resulting geometry valid: ${lastResultingGeometryValid ? 'Yes' : 'No'}`,
      `Claim overlap percent: ${claimValidationResult.overlapPercent.toFixed(1)}%`,
      `Claim cooldown remaining: ${formatCooldownRemaining(claimCooldown.remainingMs)}`,
      `Capture cooldown remaining: ${formatCooldownRemaining(captureCooldown.remainingMs)}`,
      `Start/stop cooldown remaining: ${formatCooldownRemaining(startStopCooldown.remainingMs)}`,
      `Sync cooldown remaining: ${formatCooldownRemaining(syncCooldown.remainingMs)}`,
      `Last cooldown block reason: ${lastCooldownBlockReason}`,
      `Online fetch loading: ${onlineTerritoriesLoading ? 'Yes' : 'No'}`,
      `Last fetch status: ${lastFetchStatus}`,
      `Fetch error: ${onlineTerritoriesError ?? 'None'}`,
      `Backend configured: ${backendConfigured ? 'Yes' : 'No'}`,
      `Auth configured: ${supabaseConfigStatus.isConfigured ? 'Yes' : 'No'}`,
      `Auth authenticated: ${authState.isAuthenticated ? 'Yes' : 'No'}`,
      `Auth loading: ${authState.loading ? 'Yes' : 'No'}`,
      `Auth error: ${authState.error ?? 'None'}`,
      `Auth user id: ${authState.userId ?? 'None'}`,
      `Auth email: ${authState.email ?? 'None'}`,
      `Effective owner mode: ${effectiveOwnerContext.mode}`,
      `Effective owner id: ${effectiveOwnerContext.effectiveOwnerId ?? 'None'}`,
      `Current player short id: ${playerIdShort}`,
      `Storage error: ${territoriesStorageError ?? 'None'}`,
      `Current device player id: ${currentDevicePlayerId ?? 'Unavailable'}`,
      `Current auth user id: ${currentAuthUserId ?? 'Unavailable'}`,
      `Current profile user id: ${currentProfileUserId ?? 'Unavailable'}`,
      `Current profile email: ${currentEmail ?? 'Unavailable'}`,
      `Profile username: ${currentPlayerProfile?.username ?? 'Unavailable'}`,
      `Profile display name: ${currentPlayerProfile?.displayName ?? 'Unavailable'}`,
      `Profile is anonymous: ${currentPlayerProfile?.isAnonymous == null ? 'Unavailable' : currentPlayerProfile.isAnonymous ? 'Yes' : 'No'}`,
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
      `Last save result reason: ${lastSaveResultReason ?? 'None'}`,
      `Last save result should auto-stop: ${lastSaveResultShouldAutoStop == null ? 'None' : lastSaveResultShouldAutoStop ? 'Yes' : 'No'}`,
      `Last coordinate: ${formatCoordinateLabel(lastRoutePoint, currentLocation)}`,
      `Last rejected reason: ${lastRejectedReason ?? 'None'}`,
    ],
    [
      authState,
      currentLocation,
      currentPlayerProfile,
      currentAuthUserId,
      currentDevicePlayerId,
      currentEmail,
      currentProfileUserId,
      backendConfigured,
      effectiveOwnerContext,
      capturePromptSignature,
      isPlayerLoaded,
      isPlayerStorageValid,
      isCaptureProcessing,
      isRealtimeConnected,
      isRealtimeEnabled,
      isTracking,
      isRouteLineRendered,
      isSaveTerritoryEnabled,
      isSyncEnabled,
      autoSaveBlockedReason,
      autoSaveEligible,
      isAutoSaveTimerActive,
      canFetchOnlineTerritories,
      capturePromptVisible,
      captureCooldown.remainingMs,
      claimCooldown.remainingMs,
      cooldownState,
      cooldownNowMs,
      lastCooldownBlockReason,
      lastFetchDurationMs,
      lastFetchReason,
      lastFetchStatus,
      lastRealtimeEventAt,
      lastRealtimeEventType,
      lastRealtimeTerritoryId,
      lastRejectedReason,
      lastRoutePoint,
      lastSaveStatus,
      lastSaveResultReason,
      lastSaveResultShouldAutoStop,
      lastSavedTerritory?.areaM2,
      lastSyncStatus,
      locationDebugText,
      onlineTerritoriesError,
      onlineTerritoriesLoading,
      displayOnlineTerritories.length,
      renderTerritoryMetrics,
      enemyOnlineTerritories.length,
      onlineTerritoriesWithOwnership.length,
      lastCarveApplied,
      lastCarvedTerritoryIds,
      lastCapturePromptSignature,
      lastFullCaptureApplied,
      lastResultingGeometryValid,
      hasAutoSavedCurrentRoute,
      hasCapturedCurrentRoute,
      playerIdentityStatus,
      playerIdShort,
      realtimeError,
      claimValidationResult,
      conflictVisualizationState,
      polygonAnalysis,
      polygonAreaAnalysis,
      polygonPreviewAnalysis,
      routeGeoJSON,
      routePoints.length,
      savedTerritories.length,
      startStopCooldown.remainingMs,
      supabaseConfigStatus.isConfigured,
      syncCooldown.remainingMs,
      territoryOverlapAnalysis,
      territoryInteractionPlan.enemyOverlapTargetIds.length,
      territoryPreviewPayload,
      territoriesStorageError,
      unsyncedSavedTerritories.length,
    ],
  );

  useEffect(() => {
    async function syncProfileForAuthUser(user: User | null): Promise<void> {
      if (!user) {
        const anonymousProfile = await updateLocalPlayerProfile({
          email: null,
          isAnonymous: true,
          userId: null,
        });

        setCurrentPlayerProfile(anonymousProfile);
        return;
      }

      const linkedProfile = await linkAnonymousProfileToUser(user.id);
      const hydratedProfile = await updateLocalPlayerProfile({
        email: user.email ?? linkedProfile.email ?? null,
        isAnonymous: false,
        userId: user.id,
      });

      setCurrentPlayerProfile(hydratedProfile);

      const remoteResult = await createOrUpdateRemoteProfile(hydratedProfile);

      if (!remoteResult.success && remoteResult.error) {
        setAuthState((previousState) => ({
          ...previousState,
          error: previousState.error ?? `Profile sync: ${remoteResult.error}`,
        }));
      } else {
        setCurrentPlayerProfile(remoteResult.profile);
      }
    }

    async function hydrateAuthState(): Promise<void> {
      try {
        const session = await getCurrentSession();
        const user = session?.user ?? null;

        setAuthState({
          email: user?.email ?? null,
          error: null,
          isAuthenticated: user != null,
          loading: false,
          userId: user?.id ?? null,
        });

        await syncProfileForAuthUser(user);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown auth hydrate error';

        setAuthState({
          email: null,
          error: errorMessage,
          isAuthenticated: false,
          loading: false,
          userId: null,
        });
      }
    }

    void hydrateAuthState();

    const unsubscribe = onAuthStateChange((_, session) => {
      const user = session?.user ?? null;

      setAuthState({
        email: user?.email ?? null,
        error: null,
        isAuthenticated: user != null,
        loading: false,
        userId: user?.id ?? null,
      });

      void syncProfileForAuthUser(user);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const clearAutoSaveTimer = useCallback((): void => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }

    setIsAutoSaveTimerActive(false);
  }, []);
  const clearRealtimeFlushTimer = useCallback((): void => {
    if (realtimeFlushTimeoutRef.current) {
      clearTimeout(realtimeFlushTimeoutRef.current);
      realtimeFlushTimeoutRef.current = null;
    }
  }, []);

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

      await refreshOnlineTerritories('startup');
    }

    void hydrateSavedTerritories();
    void hydratePlayerIdentity();
    void hydrateOnlineTerritories();
    void loadCurrentLocation();

    cooldownTickIntervalRef.current = setInterval(() => {
      setCooldownNowMs(Date.now());
    }, 1000);

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState !== 'active') {
        return;
      }

      void refreshLocationServicesStatus();
    });

    return () => {
      locationSubscriptionRef.current?.remove();
      clearAutoSaveTimer();
      autoSaveSuccessBannerTimeoutRef.current && clearTimeout(autoSaveSuccessBannerTimeoutRef.current);
      cooldownTickIntervalRef.current && clearInterval(cooldownTickIntervalRef.current);
      appStateSubscription.remove();
    };
  }, [clearAutoSaveTimer]);

  useEffect(() => {
    if (!CLAIM_RULE_CONFIG.captureConfirmationEnabled || hasAutoSavedCurrentRoute || hasCapturedCurrentRoute) {
      setCapturePromptVisible(false);
    }
  }, [hasAutoSavedCurrentRoute, hasCapturedCurrentRoute]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedViewportBounds(renderViewportBounds);
    }, PERFORMANCE_CONFIG.fetchDebounceMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [renderViewportBounds]);

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

  useEffect(() => {
    const savedTerritoryIds = new Set(savedTerritories.map((territory) => territory.id));

    setLocallySyncedTerritoryIds((previousIds) => previousIds.filter((territoryId) => savedTerritoryIds.has(territoryId)));
  }, [savedTerritories]);

  const updateCooldownTimestamp = useCallback((key: keyof CooldownState, timestamp = new Date().toISOString()): void => {
    setCooldownState((previousState) => ({
      ...previousState,
      [key]: timestamp,
    }));
    setCooldownNowMs(Date.now());
  }, []);
  const markTerritoriesAsLocallySynced = useCallback((territoryIds: readonly string[]): void => {
    if (territoryIds.length === 0) {
      return;
    }

    setLocallySyncedTerritoryIds((previousIds) => {
      const nextIds = new Set(previousIds);

      for (const territoryId of territoryIds) {
        nextIds.add(territoryId);
      }

      return [...nextIds];
    });
  }, []);

  const refreshOnlineTerritories = useCallback(async (reason: RefreshOnlineTerritoriesReason): Promise<void> => {
    if (!backendConfigured) {
      setOnlineTerritories([]);
      setOnlineTerritoriesError(null);
      setLastFetchReason(reason);
      setLastFetchDurationMs(0);
      setLastFetchStatus('Backend config missing. Online fetch skipped.');
      return;
    }

    if (reason === 'manual' && !syncCooldown.allowed) {
      const cooldownMessage = `Sync cooldown active: ${formatCooldownSeconds(syncCooldown.remainingMs)}s remaining`;

      setLastCooldownBlockReason(syncCooldown.reason);
      setLastFetchReason(reason);
      setLastFetchDurationMs(0);
      setLastFetchStatus(cooldownMessage);
      return;
    }

    const fetchStartedAt = Date.now();

    try {
      setOnlineTerritoriesLoading(true);
      setOnlineTerritoriesError(null);
      setLastFetchReason(reason);
      if (reason === 'manual' || reason === 'sync') {
        updateCooldownTimestamp('lastSyncAt');
      }
      const result = await fetchTerritoriesForViewport({ bounds: debouncedViewportBounds ?? renderViewportBounds });
      const fetchDurationMs = Date.now() - fetchStartedAt;

      setLastFetchDurationMs(fetchDurationMs);

      if (!result.success) {
        setOnlineTerritories([]);
        setOnlineTerritoriesError(result.message);
        setLastFetchStatus(`Fetch failed: ${result.message}`);
        return;
      }

      setOnlineTerritories(result.territories);
      setLastFetchStatus(result.message);
      setLastCooldownBlockReason('none');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown online fetch error';

      setOnlineTerritories([]);
      setOnlineTerritoriesError(errorMessage);
      setLastFetchDurationMs(Date.now() - fetchStartedAt);
      setLastFetchStatus(`Fetch failed: ${errorMessage}`);
    } finally {
      setOnlineTerritoriesLoading(false);
    }
  }, [
    backendConfigured,
    debouncedViewportBounds,
    renderViewportBounds,
    syncCooldown.allowed,
    syncCooldown.reason,
    syncCooldown.remainingMs,
    updateCooldownTimestamp,
  ]);
  const syncSingleTerritoryAfterSave = useCallback(async (
    territory: LocalSavedTerritory,
    trigger: 'auto' | 'manual',
  ): Promise<void> => {
    if (!backendConfigured) {
      setLastSyncStatus(
        trigger === 'auto'
          ? 'Auto-sync skipped: backend config missing.'
          : 'Sync skipped: backend config missing.',
      );
      return;
    }

    if (
      locallySyncedTerritoryIds.includes(territory.id) ||
      pendingAutoSyncTerritoryIdsRef.current.has(territory.id)
    ) {
      return;
    }

    pendingAutoSyncTerritoryIdsRef.current.add(territory.id);
    setLastSyncStatus(trigger === 'auto' ? 'Auto-syncing saved territory...' : 'Syncing saved territory...');

    try {
      const result = await uploadTerritory(
        territory,
        currentPlayerProfile?.playerId ?? null,
        currentAuthUserId ?? null,
      );

      if (!result.success) {
        setLastSyncStatus(
          trigger === 'auto'
            ? `Auto-sync failed: ${result.message}. Local save kept.`
            : `Sync failed: ${result.message}`,
        );
        return;
      }

      markTerritoriesAsLocallySynced([territory.id]);
      setLastSyncStatus(trigger === 'auto' ? `Auto-sync complete: ${result.message}` : result.message);
      setLastCooldownBlockReason('none');
      await refreshOnlineTerritories(trigger === 'auto' ? 'auto_sync' : 'sync');
    } finally {
      pendingAutoSyncTerritoryIdsRef.current.delete(territory.id);
    }
  }, [
    backendConfigured,
    currentAuthUserId,
    currentPlayerProfile?.playerId,
    locallySyncedTerritoryIds,
    markTerritoriesAsLocallySynced,
    refreshOnlineTerritories,
  ]);
  const applyRealtimeEvents = useCallback((events: readonly TerritoryRealtimeEvent[]): void => {
    if (events.length === 0) {
      return;
    }

    setOnlineTerritories((previousTerritories) => {
      const territoryMap = new Map(previousTerritories.map((territory) => [territory.id, territory]));

      for (const event of events) {
        if (event.type === 'DELETE') {
          territoryMap.delete(event.territoryId);
          continue;
        }

        if (!event.territory) {
          continue;
        }

        territoryMap.set(event.territoryId, event.territory);
      }

      return [...territoryMap.values()].sort((leftTerritory, rightTerritory) =>
        rightTerritory.createdAt.localeCompare(leftTerritory.createdAt),
      );
    });
  }, []);
  const flushRealtimeEvents = useCallback((): void => {
    clearRealtimeFlushTimer();

    const bufferedEvents = [...realtimeEventBufferRef.current.values()];
    realtimeEventBufferRef.current.clear();

    if (realtimeFallbackRefreshPendingRef.current) {
      realtimeFallbackRefreshPendingRef.current = false;
      void refreshOnlineTerritories('realtime');
      return;
    }

    applyRealtimeEvents(bufferedEvents);
  }, [applyRealtimeEvents, clearRealtimeFlushTimer, refreshOnlineTerritories]);
  const handleRealtimeEvent = useCallback((event: TerritoryRealtimeEvent): void => {
    setLastRealtimeEventType(event.type);
    setLastRealtimeTerritoryId(event.territoryId);
    setLastRealtimeEventAt(event.receivedAt);
    setRealtimeError(null);

    if ((event.type === 'INSERT' || event.type === 'UPDATE') && !event.territory) {
      realtimeFallbackRefreshPendingRef.current = true;
    } else {
      realtimeEventBufferRef.current.set(event.territoryId, event);
    }

    if (realtimeEventBufferRef.current.size > PERFORMANCE_CONFIG.maxRealtimeEventsBuffered) {
      realtimeEventBufferRef.current.clear();
      realtimeFallbackRefreshPendingRef.current = true;
    }

    clearRealtimeFlushTimer();
    realtimeFlushTimeoutRef.current = setTimeout(() => {
      flushRealtimeEvents();
    }, PERFORMANCE_CONFIG.realtimeDebounceMs);
  }, [clearRealtimeFlushTimer, flushRealtimeEvents]);

  useEffect(() => {
    if (!backendConfigured) {
      setIsRealtimeEnabled(false);
      setIsRealtimeConnected(false);
      setRealtimeError(null);
      return;
    }

    const subscription = subscribeToTerritoryRealtime({
      onConnectionChange: (connected) => {
        setIsRealtimeConnected(connected);
      },
      onError: (message) => {
        setRealtimeError(message);
      },
      onEvent: (event) => {
        handleRealtimeEvent(event);
      },
    });

    setIsRealtimeEnabled(subscription.enabled);

    return () => {
      clearRealtimeFlushTimer();
      realtimeEventBufferRef.current.clear();
      realtimeFallbackRefreshPendingRef.current = false;
      void subscription.unsubscribe();
    };
  }, [backendConfigured, clearRealtimeFlushTimer, handleRealtimeEvent]);

  async function startTracking(): Promise<void> {
    if (!startStopCooldown.allowed) {
      const cooldownMessage = `Start/stop cooldown active: ${formatCooldownSeconds(startStopCooldown.remainingMs)}s remaining`;

      setLastCooldownBlockReason(startStopCooldown.reason);
      setLocationDebugText(cooldownMessage);
      return;
    }

    try {
      setLocationError(null);
      setLastRejectedReason(null);
      setAutoSaveSuccessMessage(null);
      setLastCarveApplied(false);
      setLastFullCaptureApplied(false);
      setLastCarvedTerritoryIds([]);
      setLastResultingGeometryValid(true);
      setRoutePoints([]);
      setHasAutoSavedCurrentRoute(false);
      setHasCapturedCurrentRoute(false);
      setLastCapturePromptSignature(null);
      setLastSaveResultReason(null);
      setLastSaveResultShouldAutoStop(null);
      setCapturePromptVisible(false);
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
      updateCooldownTimestamp('lastStartStopAt');
      setLastCooldownBlockReason('none');
      setLocationDebugText('GPS tracking started.');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown tracking error';

      console.log('MapScreen startTracking error:', error);
      setLocationError(`Tracking could not be started: ${errorMessage}`);
      setLocationDebugText(`Tracking start error: ${errorMessage}`);
    }
  }

  const stopTrackingCore = useCallback((reason: 'auto_save' | 'manual', updateCooldown: boolean): void => {
    clearAutoSaveTimer();
    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;
    setIsTracking(false);
    setLocationDebugText(
      reason === 'auto_save'
        ? 'Tracking stopped automatically after territory save.'
        : 'GPS tracking stopped.',
    );
    if (updateCooldown) {
      updateCooldownTimestamp('lastStartStopAt');
      setLastCooldownBlockReason('none');
    }
  }, [clearAutoSaveTimer, updateCooldownTimestamp]);

  const stopTracking = useCallback((reason: 'auto_save' | 'manual' = 'manual'): void => {
    stopTrackingCore(reason, reason === 'manual');
  }, [stopTrackingCore]);

  const showAutoSaveSuccessBanner = useCallback((message = 'Bölgeniz kaydedildi'): void => {
    if (autoSaveSuccessBannerTimeoutRef.current) {
      clearTimeout(autoSaveSuccessBannerTimeoutRef.current);
    }

    setAutoSaveSuccessMessage(message);
    autoSaveSuccessBannerTimeoutRef.current = setTimeout(() => {
      setAutoSaveSuccessMessage(null);
      autoSaveSuccessBannerTimeoutRef.current = null;
    }, 2500);
  }, []);

  function openLocationSettings(): void {
    void Linking.openSettings();
  }

  async function clearSavedTerritories(): Promise<void> {
    try {
      setTerritoriesStorageError(null);
      await clearSavedTerritoriesFromStorage();
      pendingAutoSyncTerritoryIdsRef.current.clear();
      setLocallySyncedTerritoryIds([]);
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

    if (!syncCooldown.allowed) {
      setLastCooldownBlockReason(syncCooldown.reason);
      setLastSyncStatus(`Sync cooldown active: ${formatCooldownSeconds(syncCooldown.remainingMs)}s remaining`);
      return;
    }

    if (unsyncedSavedTerritories.length === 0) {
      setLastSyncStatus('No local territories to sync.');
      return;
    }

    updateCooldownTimestamp('lastSyncAt');
    const result = await uploadTerritories(
      unsyncedSavedTerritories,
      currentPlayerProfile?.playerId ?? null,
      currentAuthUserId ?? null,
    );

    setLastSyncStatus(result.success ? result.message : `Sync failed: ${result.message}`);
    if (result.success) {
      markTerritoriesAsLocallySynced(unsyncedSavedTerritories.map((territory) => territory.id));
      setLastCooldownBlockReason('none');
      await refreshOnlineTerritories('sync');
    }
  }

  async function resetPlayerIdentity(): Promise<void> {
    try {
      setPlayerIdentityStatus('Resetting player identity...');
      await clearPlayerIdentity();
      const nextProfile = await loadOrCreatePlayerProfile();
      if (authState.isAuthenticated && authState.userId) {
        const relinkedProfile = await linkAnonymousProfileToUser(authState.userId);
        setCurrentPlayerProfile({
          ...relinkedProfile,
          email: authState.email ?? relinkedProfile.email ?? null,
        });
      } else {
        setCurrentPlayerProfile(nextProfile);
      }
      setIsPlayerStorageValid(wasPlayerStorageValid());
      setIsPlayerLoaded(true);
      setPlayerIdentityStatus('Player identity reset complete.');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown reset error';

      setIsPlayerStorageValid(false);
      setPlayerIdentityStatus(`Player identity reset failed: ${errorMessage}`);
    }
  }

  async function handleEmailAuth(mode: 'sign_in' | 'sign_up'): Promise<void> {
    const email = normalizeAuthInput(authEmailInput);
    const password = authPasswordInput;

    if (!email || !password) {
      setAuthState((previousState) => ({
        ...previousState,
        error: 'Email and password are required.',
        loading: false,
      }));
      return;
    }

    setAuthState((previousState) => ({
      ...previousState,
      error: null,
      loading: true,
    }));

    const result =
      mode === 'sign_up'
        ? await signUpWithEmail(email, password)
        : await signInWithEmail(email, password);

    setAuthState((previousState) => ({
      ...previousState,
      email: result.user?.email ?? previousState.email,
      error: result.error,
      isAuthenticated: result.user != null || result.session?.user != null,
      loading: false,
      userId: result.user?.id ?? result.session?.user?.id ?? previousState.userId,
    }));
  }

  async function handleSignOut(): Promise<void> {
    setAuthState((previousState) => ({
      ...previousState,
      error: null,
      loading: true,
    }));

    const result = await signOut();

    if (!result.success && result.error) {
      setAuthState((previousState) => ({
        ...previousState,
        error: result.error,
        loading: false,
      }));
      return;
    }

    const anonymousProfile = await updateLocalPlayerProfile({
      email: null,
      isAnonymous: true,
      userId: null,
    });

    setCurrentPlayerProfile(anonymousProfile);
    setAuthPasswordInput('');
    setAuthState({
      email: null,
      error: null,
      isAuthenticated: false,
      loading: false,
      userId: null,
    });
  }

  async function confirmTerritoryCapture(): Promise<void> {
    if (!territoryPreviewPayload) {
      setLastSaveResultReason('invalid');
      setLastSaveResultShouldAutoStop(false);
      setCaptureStatusTone('failed');
      setCaptureStatusMessage('Capture failed: preview is not ready.');
      return;
    }

    if (!claimValidationResult.isCaptureAllowed) {
      setLastSaveResultReason('invalid');
      setLastSaveResultShouldAutoStop(false);
      setCapturePromptVisible(false);
      setCaptureStatusTone('failed');
      setCaptureStatusMessage('Capture failed: territory is no longer eligible.');
      return;
    }

    if (!backendConfigured) {
      setLastSaveResultReason('failed');
      setLastSaveResultShouldAutoStop(false);
      setCaptureStatusTone('failed');
      setCaptureStatusMessage('Capture failed: backend is not configured.');
      return;
    }

    if (!captureCooldown.allowed) {
      setLastSaveResultReason('cooldown');
      setLastSaveResultShouldAutoStop(false);
      const cooldownMessage = `Capture cooldown active: ${formatCooldownSeconds(captureCooldown.remainingMs)}s remaining`;

      setLastCooldownBlockReason(captureCooldown.reason);
      setCaptureStatusTone('failed');
      setCaptureStatusLabel(undefined);
      setCaptureStatusMessage(cooldownMessage);
      setLastSaveStatus(cooldownMessage);
      return;
    }

    const captureOperation = territoryInteractionPlan;

    if (!captureOperation.result.didCapture) {
      setLastSaveResultReason('failed');
      setLastSaveResultShouldAutoStop(false);
      setCapturePromptVisible(false);
      setCaptureStatusLabel(undefined);
      setCaptureStatusTone('failed');
      setCaptureStatusMessage('Capture failed: no enemy territory met the threshold.');
      return;
    }

    try {
      setIsCaptureProcessing(true);
      const backendResult = await transferTerritoryOwnership(
        captureOperation.result.capturedTerritoryIds,
        captureOperation.carvedTerritories,
        captureOperation.newLocalTerritory,
        currentPlayerProfile?.playerId ?? null,
        currentAuthUserId ?? null,
      );

      if (!backendResult.success) {
        setLastSaveResultReason('failed');
        setLastSaveResultShouldAutoStop(false);
        setCaptureStatusLabel(undefined);
        setCaptureStatusTone('failed');
        setCaptureStatusMessage(`Capture failed: ${backendResult.message}`);
        setLastSyncStatus(`Capture sync failed: ${backendResult.message}`);
        return;
      }

      setSavedTerritories((previousTerritories) => {
        const filteredTerritories = previousTerritories.filter(
          (territory) => !captureOperation.result.capturedTerritoryIds.includes(territory.id),
        );

        return [...filteredTerritories, captureOperation.newLocalTerritory];
      });
      setCapturePromptVisible(false);
      setHasCapturedCurrentRoute(true);
      setLastSaveResultReason('captured');
      setLastSaveResultShouldAutoStop(false);
      setLastCarveApplied(captureOperation.result.carvedTerritoryIds.length > 0);
      setLastFullCaptureApplied(captureOperation.result.didCapture);
      setLastCarvedTerritoryIds(captureOperation.result.carvedTerritoryIds);
      setLastResultingGeometryValid(captureOperation.geometryValid);
      setCaptureStatusLabel(captureOperation.result.didCapture ? 'Territory captured' : 'Enemy territory reduced');
      setCaptureStatusTone('success');
      setCaptureStatusMessage(
        captureOperation.result.didCapture ? 'Territory captured' : 'Enemy territory reduced',
      );
      setLastSaveStatus('Capture completed.');
      setLastSyncStatus(backendResult.message);
      updateCooldownTimestamp('lastCaptureAt');
      setLastCooldownBlockReason('none');
      await refreshOnlineTerritories('capture');
    } finally {
      setIsCaptureProcessing(false);
    }
  }

  const saveTerritory = useCallback(async (trigger: 'auto' | 'manual' = 'manual'): Promise<SaveResult> => {
    if (!territoryPreviewPayload || !territoryPreviewSignature) {
      setLastSaveStatus('Preview is not ready to save.');
      setLastSaveResultReason('invalid');
      setLastSaveResultShouldAutoStop(false);
      return { reason: 'invalid', saved: false, shouldAutoStop: false };
    }

    if (claimValidationResult.isCaptureAllowed && trigger === 'manual') {
      if (capturePromptSignature) {
        setLastCapturePromptSignature(capturePromptSignature);
      }
      setCapturePromptVisible(true);
      setCaptureStatusLabel(undefined);
      setCaptureStatusTone('available');
      setCaptureStatusMessage(`Enemy coverage ${captureCoveragePercentLabel}. Confirm to capture.`);
      setLastSaveStatus('Capture available. Waiting for confirmation.');
      setLastSaveResultReason('failed');
      setLastSaveResultShouldAutoStop(false);
      return { reason: 'failed', saved: false, shouldAutoStop: false };
    }

    if (!claimValidationResult.isClaimAllowed) {
      setLastSaveStatus(
        trigger === 'auto'
          ? `Auto-save blocked: ${formatClaimRejectReason(claimValidationResult.rejectReason)}`
          : `Save blocked: ${formatClaimRejectReason(claimValidationResult.rejectReason)}`,
      );
      setLastSaveResultReason('invalid');
      setLastSaveResultShouldAutoStop(false);
      return { reason: 'invalid', saved: false, shouldAutoStop: false };
    }

    if (!claimCooldown.allowed && !claimValidationResult.isCaptureAllowed) {
      setLastCooldownBlockReason(claimCooldown.reason);
      setLastSaveStatus(`Claim cooldown active: ${formatCooldownSeconds(claimCooldown.remainingMs)}s remaining`);
      setLastSaveResultReason('cooldown');
      setLastSaveResultShouldAutoStop(false);
      return { reason: 'cooldown', saved: false, shouldAutoStop: false };
    }

    const previousTerritories = savedTerritories;
    const duplicateTerritory = previousTerritories.find((savedTerritory) =>
      isDuplicateTerritoryByTolerance(savedTerritory, territoryPreviewPayload),
    );

    if (duplicateTerritory) {
      setLastSaveStatus(trigger === 'auto' ? 'Auto-save skipped: already saved.' : 'This territory is already saved.');
      setLastSaveResultReason('duplicate');
      setLastSaveResultShouldAutoStop(false);
      return { reason: 'duplicate', saved: false, shouldAutoStop: false };
    }

    const didFullCapture =
      claimValidationResult.isCaptureAllowed &&
      territoryInteractionPlan.result.didCapture &&
      territoryInteractionPlan.maxEnemyCoveragePercent >= CLAIM_RULE_CONFIG.captureCandidateThresholdPercent;
    const nextTerritory: LocalSavedTerritory = didFullCapture
      ? territoryInteractionPlan.newLocalTerritory
      : {
          ...territoryPreviewPayload,
          id: createId(),
          status: 'local_saved',
        };

    setSavedTerritories([...previousTerritories, nextTerritory]);
    setLastSaveStatus(
      didFullCapture
        ? 'Bölge ele geçirildi.'
        : trigger === 'auto'
          ? `Auto-saved territory ${previousTerritories.length + 1}.`
          : `Saved territory ${previousTerritories.length + 1}.`,
    );
    updateCooldownTimestamp('lastClaimAt');
    setLastCooldownBlockReason('none');
    setLastCarveApplied(territoryInteractionPlan.result.carvedTerritoryIds.length > 0);
    setLastFullCaptureApplied(didFullCapture);
    setLastCarvedTerritoryIds(territoryInteractionPlan.result.carvedTerritoryIds);
    setLastResultingGeometryValid(territoryInteractionPlan.geometryValid);
    if (capturePromptSignature) {
      setLastCapturePromptSignature(capturePromptSignature);
    }
    setCapturePromptVisible(false);

    if (didFullCapture) {
      setHasCapturedCurrentRoute(true);
      setHasAutoSavedCurrentRoute(trigger === 'auto');

      if (backendConfigured) {
        const backendResult = await transferTerritoryOwnership(
          territoryInteractionPlan.result.capturedTerritoryIds,
          territoryInteractionPlan.carvedTerritories,
          nextTerritory,
          currentPlayerProfile?.playerId ?? null,
          currentAuthUserId ?? null,
        );

        if (backendResult.success) {
          markTerritoriesAsLocallySynced([nextTerritory.id]);
          setCaptureStatusLabel('Territory captured');
          setCaptureStatusTone('success');
          setCaptureStatusMessage('Bölge ele geçirildi');
          setLastSyncStatus(backendResult.message);
          await refreshOnlineTerritories('capture');
        } else {
          setCaptureStatusLabel('Territory captured locally');
          setCaptureStatusTone('failed');
          setCaptureStatusMessage(`Bölge yerelde kaydedildi. Backend senkronu başarısız: ${backendResult.message}`);
          setLastSyncStatus(`Capture sync failed: ${backendResult.message}`);
        }
      } else {
        setCaptureStatusLabel('Territory captured');
        setCaptureStatusTone('success');
        setCaptureStatusMessage('Bölge ele geçirildi');
      }

      if (trigger === 'auto') {
        showAutoSaveSuccessBanner('Bölge ele geçirildi');
      }

      setLastSaveResultReason('captured');
      setLastSaveResultShouldAutoStop(trigger === 'auto');
      return {
        reason: 'captured',
        saved: true,
        shouldAutoStop: trigger === 'auto',
      };
    }

    if (backendConfigured && territoryInteractionPlan.result.carvedTerritoryIds.length > 0) {
      const backendResult = await transferTerritoryOwnership(
        [],
        territoryInteractionPlan.carvedTerritories,
        nextTerritory,
        currentPlayerProfile?.playerId ?? null,
        currentAuthUserId ?? null,
      );

      if (backendResult.success) {
        markTerritoriesAsLocallySynced([nextTerritory.id]);
        setCaptureStatusLabel('Enemy territory reduced');
        setCaptureStatusTone('success');
        setCaptureStatusMessage('New territory claimed');
        setLastSyncStatus(backendResult.message);
        await refreshOnlineTerritories('carve');
      } else {
        setCaptureStatusLabel(undefined);
        setCaptureStatusTone('failed');
        setCaptureStatusMessage(`Territory update failed: ${backendResult.message}`);
        setLastSyncStatus(`Partial carve sync failed: ${backendResult.message}`);
      }
    } else {
      setCaptureStatusLabel(undefined);
      setCaptureStatusMessage(null);
    }

    if (trigger === 'auto') {
      showAutoSaveSuccessBanner(
        territoryInteractionPlan.result.carvedTerritoryIds.length > 0 ? 'New territory claimed' : 'Bölgeniz kaydedildi',
      );
    }
    if (territoryInteractionPlan.result.carvedTerritoryIds.length === 0) {
      await syncSingleTerritoryAfterSave(nextTerritory, trigger);
    }
    setLastSaveResultReason('saved');
    setLastSaveResultShouldAutoStop(trigger === 'auto');
    return {
      reason: 'saved',
      saved: true,
      shouldAutoStop: trigger === 'auto',
    };
  }, [
    backendConfigured,
    capturePromptSignature,
    captureCoveragePercentLabel,
    claimCooldown.allowed,
    claimCooldown.reason,
    claimCooldown.remainingMs,
    claimValidationResult,
    currentAuthUserId,
    currentPlayerProfile?.playerId,
    markTerritoriesAsLocallySynced,
    refreshOnlineTerritories,
    savedTerritories,
    showAutoSaveSuccessBanner,
    syncSingleTerritoryAfterSave,
    territoryInteractionPlan,
    territoryPreviewPayload,
    territoryPreviewSignature,
    updateCooldownTimestamp,
  ]);

  useEffect(() => {
    saveTerritoryRef.current = saveTerritory;
  }, [saveTerritory]);

  useEffect(() => {
    if (!autoSaveEligible) {
      clearAutoSaveTimer();

      if (autoSaveBlockedReason === 'claim_not_allowed') {
        setLastSaveStatus(`Claim blocked: ${formatClaimRejectReason(claimValidationResult.rejectReason)}`);
      }

      if (autoSaveBlockedReason === 'claim_cooldown_active') {
        setLastSaveStatus(`Claim cooldown active: ${formatCooldownSeconds(claimCooldown.remainingMs)}s remaining`);
      }

      return;
    }

    if (autoSaveTimeoutRef.current) {
      return;
    }

    setIsAutoSaveTimerActive(true);
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveTimeoutRef.current = null;
      setIsAutoSaveTimerActive(false);

      void (async () => {
        const result = await saveTerritoryRef.current?.('auto');

        if (result?.saved && result.shouldAutoStop) {
          setHasAutoSavedCurrentRoute(true);
          stopTrackingCore('auto_save', false);
        }
      })();
    }, 2000);
  }, [
    autoSaveBlockedReason,
    autoSaveEligible,
    claimCooldown.remainingMs,
    claimValidationResult.rejectReason,
    clearAutoSaveTimer,
    stopTrackingCore,
  ]);

  useEffect(() => {
    return () => {
      clearAutoSaveTimer();
    };
  }, [clearAutoSaveTimer]);

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
      <Mapbox.MapView onCameraChanged={handleMapCameraChanged} style={styles.map} styleURL={MAPBOX_STYLE_URL}>
        <Mapbox.Camera centerCoordinate={cameraCenterCoordinate} zoomLevel={initialZoomLevel} />
        {currentLocation ? <Mapbox.LocationPuck visible /> : null}
        <OnlineTerritoriesLayer
          conflictSeverity={conflictVisualizationState.severity}
          conflictingTerritoryIds={territoryOverlapAnalysis.overlappingTerritoryIds}
          territories={renderTerritoryMetrics.renderedOnlineTerritories}
        />
        <SavedTerritoriesLayer territories={renderTerritoryMetrics.renderedSavedTerritories} />
        <PolygonPreview
          conflictSeverity={conflictVisualizationState.severity}
          geoJSON={polygonPreviewAnalysis.geoJSON}
          isClaimRejected={!claimValidationResult.isClaimAllowed && territoryPreviewPayload !== null}
        />
        <RouteLine geoJSON={routeGeoJSON} isPolygonCandidate={polygonAnalysis.isCandidate} />
      </Mapbox.MapView>
      <CaptureStatusBanner
        label={captureStatusLabel}
        message={captureStatusMessage ?? ''}
        tone={captureStatusTone}
        visible={captureStatusMessage !== null}
      />
      <CaptureStatusBanner
        label="Kayit Basarili"
        message={autoSaveSuccessMessage ?? ''}
        tone="success"
        visible={autoSaveSuccessMessage !== null}
      />
      <CaptureConfirmationCard
        coveragePercentLabel={captureCoveragePercentLabel}
        onCancel={() => {
          setCapturePromptVisible(false);
          setCaptureStatusLabel(undefined);
          setCaptureStatusMessage('Capture cancelled.');
          setCaptureStatusTone('failed');
        }}
        onConfirm={() => {
          void confirmTerritoryCapture();
        }}
        visible={capturePromptVisible && !isCaptureProcessing}
      />
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
        authEmail={authEmailInput}
        authLoading={authState.loading}
        authPassword={authPasswordInput}
        backendConfigured={backendConfigured}
        canFetchOnlineTerritories={canFetchOnlineTerritories}
        canStartTracking={canStartTracking}
        canStopTracking={canStopTracking}
        canSaveTerritory={
          isSaveTerritoryEnabled &&
          ((claimValidationResult.isClaimAllowed && claimCooldown.allowed) || claimValidationResult.isCaptureAllowed)
        }
        canSync={isSyncEnabled}
        claimLabel={claimLabel}
        claimSeverity={getClaimSeverity(claimValidationResult)}
        conflictLabel={conflictLabel}
        conflictSeverity={conflictVisualizationState.severity}
        debugLines={debugLines}
        debugOpen={isDebugPanelExpanded}
        gpsReady={gpsReady}
        onAuthEmailChange={setAuthEmailInput}
        onAuthPasswordChange={setAuthPasswordInput}
        onClearTerritories={() => {
          void clearSavedTerritories();
        }}
        onFetchOnlineTerritories={() => {
          void refreshOnlineTerritories('manual');
        }}
        onResetIdentity={() => {
          void resetPlayerIdentity();
        }}
        onSaveTerritory={() => {
          void saveTerritory('manual');
        }}
        onSignIn={() => {
          void handleEmailAuth('sign_in');
        }}
        onSignOut={() => {
          void handleSignOut();
        }}
        onSignUp={() => {
          void handleEmailAuth('sign_up');
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
        playerIdShort={playerIdShort}
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

function formatCooldownSeconds(remainingMs: number): string {
  return Math.ceil(Math.max(0, remainingMs) / 1000).toString();
}

function formatCooldownRemaining(remainingMs: number): string {
  if (remainingMs <= 0) {
    return 'Ready';
  }

  return `${formatCooldownSeconds(remainingMs)}s`;
}

function isDuplicateTerritoryByTolerance(
  savedTerritory: LocalSavedTerritory,
  territoryPreviewPayload: TerritoryPreviewPayload,
): boolean {
  const areaDifference = Math.abs(savedTerritory.areaM2 - territoryPreviewPayload.areaM2);
  const pointDifference = Math.abs(savedTerritory.sourceRoutePointCount - territoryPreviewPayload.sourceRoutePointCount);

  return (
    areaDifference <= COOLDOWN_CONFIG.duplicateAreaToleranceM2 &&
    pointDifference <= COOLDOWN_CONFIG.duplicatePointCountTolerance
  );
}

function hasMeaningfulNumberDelta(previousValue: number, nextValue: number, epsilon: number): boolean {
  return Math.abs(previousValue - nextValue) > epsilon;
}

function haveViewportBoundsChanged(previousBounds: ViewportBounds, nextBounds: ViewportBounds): boolean {
  return (
    hasMeaningfulNumberDelta(
      previousBounds.center.latitude,
      nextBounds.center.latitude,
      PERFORMANCE_CONFIG.viewportCenterEpsilon,
    ) ||
    hasMeaningfulNumberDelta(
      previousBounds.center.longitude,
      nextBounds.center.longitude,
      PERFORMANCE_CONFIG.viewportCenterEpsilon,
    ) ||
    hasMeaningfulNumberDelta(previousBounds.north, nextBounds.north, PERFORMANCE_CONFIG.viewportBoundsEpsilon) ||
    hasMeaningfulNumberDelta(previousBounds.south, nextBounds.south, PERFORMANCE_CONFIG.viewportBoundsEpsilon) ||
    hasMeaningfulNumberDelta(previousBounds.east, nextBounds.east, PERFORMANCE_CONFIG.viewportBoundsEpsilon) ||
    hasMeaningfulNumberDelta(previousBounds.west, nextBounds.west, PERFORMANCE_CONFIG.viewportBoundsEpsilon) ||
    hasMeaningfulNumberDelta(previousBounds.zoomLevel, nextBounds.zoomLevel, PERFORMANCE_CONFIG.viewportZoomEpsilon)
  );
}

function getEffectiveOwnerContext(authUserId: string | null, playerId: string | null): EffectiveOwnerContext {
  if (authUserId) {
    return {
      authUserId,
      effectiveOwnerId: authUserId,
      mode: 'auth',
      playerId,
    };
  }

  return {
    authUserId: null,
    effectiveOwnerId: playerId,
    mode: 'device',
    playerId,
  };
}

function isOnlineTerritoryMine(
  territory: Pick<OnlineTerritory, 'deviceId' | 'userId'>,
  ownerContext: EffectiveOwnerContext,
): boolean {
  if (ownerContext.mode === 'auth') {
    return territory.userId != null && territory.userId === ownerContext.authUserId;
  }

  return (
    territory.userId == null &&
    territory.deviceId != null &&
    ownerContext.playerId != null &&
    territory.deviceId === ownerContext.playerId
  );
}

function getDistanceToViewportCenter(
  coordinates: readonly Coordinates[],
  viewportBounds: ViewportBounds | null,
): number {
  if (!viewportBounds || coordinates.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  const firstCoordinate = coordinates[0];
  const latitudeDelta = firstCoordinate.latitude - viewportBounds.center.latitude;
  const longitudeDelta = firstCoordinate.longitude - viewportBounds.center.longitude;

  return latitudeDelta * latitudeDelta + longitudeDelta * longitudeDelta;
}

function limitTerritoriesForRender<TTerritory extends { coordinates: Coordinates[]; createdAt: string }>(
  territories: readonly TTerritory[],
  limit: number,
  viewportBounds: ViewportBounds | null,
): TTerritory[] {
  if (territories.length <= limit) {
    return [...territories];
  }

  return [...territories]
    .sort((leftTerritory, rightTerritory) => {
      const leftDistance = getDistanceToViewportCenter(leftTerritory.coordinates, viewportBounds);
      const rightDistance = getDistanceToViewportCenter(rightTerritory.coordinates, viewportBounds);

      if (Number.isFinite(leftDistance) && Number.isFinite(rightDistance) && leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return rightTerritory.createdAt.localeCompare(leftTerritory.createdAt);
    })
    .slice(0, limit);
}

function buildOverlapComparableTerritories(
  onlineTerritories: readonly OnlineTerritory[],
  savedTerritories: readonly LocalSavedTerritory[],
): OverlapComparableTerritory[] {
  const mergedTerritories = new Map<string, OverlapComparableTerritory>();

  for (const territory of onlineTerritories) {
    const geometrySignature = getTerritoryGeometrySignature(territory.coordinates);
    const dedupeKey = `geometry:${geometrySignature}`;

    if (!mergedTerritories.has(dedupeKey)) {
      mergedTerritories.set(dedupeKey, {
        coordinates: territory.coordinates,
        id: territory.id,
        isMine: territory.isMine === true,
      });
      continue;
    }

    const existingTerritory = mergedTerritories.get(dedupeKey);

    if (existingTerritory && !existingTerritory.isMine && territory.isMine === true) {
      mergedTerritories.set(dedupeKey, {
        coordinates: territory.coordinates,
        id: territory.id,
        isMine: true,
      });
    }
  }

  for (const territory of savedTerritories) {
    const geometrySignature = getTerritoryGeometrySignature(territory.coordinates);
    const dedupeKey = `geometry:${geometrySignature}`;

    if (mergedTerritories.has(dedupeKey)) {
      const existingTerritory = mergedTerritories.get(dedupeKey);

      if (existingTerritory && !existingTerritory.isMine) {
        mergedTerritories.set(dedupeKey, {
          coordinates: territory.coordinates,
          id: territory.id,
          isMine: true,
        });
      }
      continue;
    }

    mergedTerritories.set(dedupeKey, {
      coordinates: territory.coordinates,
      id: territory.id,
      isMine: true,
    });
  }

  return [...mergedTerritories.values()];
}

function getTerritoryGeometrySignature(coordinates: readonly Coordinates[]): string {
  return coordinates
    .map((coordinate) => `${coordinate.latitude.toFixed(5)}:${coordinate.longitude.toFixed(5)}`)
    .sort()
    .join('|');
}

function getUnsyncedSavedTerritories(
  savedTerritories: readonly LocalSavedTerritory[],
  onlineTerritories: readonly OnlineTerritory[],
  locallySyncedTerritoryIds: readonly string[],
): LocalSavedTerritory[] {
  const locallySyncedTerritoryIdSet = new Set(locallySyncedTerritoryIds);
  const syncedGeometrySignatures = new Set(
    onlineTerritories
      .filter((territory) => territory.isMine === true)
      .map((territory) => getTerritoryGeometrySignature(territory.coordinates)),
  );

  return savedTerritories.filter(
    (territory) =>
      !locallySyncedTerritoryIdSet.has(territory.id) &&
      !syncedGeometrySignatures.has(getTerritoryGeometrySignature(territory.coordinates)),
  );
}

function getDisplayOnlineTerritories(
  onlineTerritories: readonly OnlineTerritory[],
  savedTerritories: readonly LocalSavedTerritory[],
): OnlineTerritory[] {
  const localGeometrySignatures = new Set(savedTerritories.map((territory) => getTerritoryGeometrySignature(territory.coordinates)));

  return onlineTerritories.filter((territory) => {
    if (territory.isMine !== true) {
      return true;
    }

    return !localGeometrySignatures.has(getTerritoryGeometrySignature(territory.coordinates));
  });
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

function formatConflictLabel(severity: 'none' | 'low' | 'medium' | 'high'): string {
  switch (severity) {
    case 'low':
      return 'Minor Overlap';
    case 'medium':
      return 'Territory Conflict';
    case 'high':
      return 'High Conflict';
    case 'none':
    default:
      return 'No Conflict';
  }
}

function formatClaimLabel(claimValidationResult: ReturnType<typeof validateTerritoryClaim>): string {
  if (claimValidationResult.isCaptureCandidate) {
    return 'Capture Candidate';
  }

  if (!claimValidationResult.isClaimAllowed) {
    if (claimValidationResult.rejectReason === 'high_conflict') {
      return 'Territory Conflict';
    }

    if (claimValidationResult.rejectReason === 'enemy_overlap') {
      return 'Enemy Territory';
    }

    return 'Claim Blocked';
  }

  return 'Claim Allowed';
}

function getClaimSeverity(claimValidationResult: ReturnType<typeof validateTerritoryClaim>): 'none' | 'low' | 'medium' | 'high' {
  if (!claimValidationResult.isClaimAllowed) {
    return claimValidationResult.rejectReason === 'high_conflict' ? 'high' : 'medium';
  }

  if (claimValidationResult.isCaptureCandidate) {
    return 'high';
  }

  if (claimValidationResult.overlapPercent >= CLAIM_RULE_CONFIG.smallOverlapAllowancePercent) {
    return 'low';
  }

  return 'none';
}

function formatClaimRejectReason(rejectReason: ReturnType<typeof validateTerritoryClaim>['rejectReason']): string {
  switch (rejectReason) {
    case 'enemy_overlap':
      return 'enemy overlap detected';
    case 'high_conflict':
      return 'high conflict with enemy territory';
    case 'invalid_polygon':
      return 'invalid polygon';
    case 'none':
    default:
      return 'none';
  }
}

function formatPlayerIdShort(playerId: string | null): string {
  if (!playerId) {
    return 'Player ----';
  }

  return `Player ${playerId.slice(0, 8)}`;
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
