import { CLAIM_RULE_CONFIG } from '../config/claimRulesConfig';
import type {
  ClaimValidationResult,
  Coordinates,
  LocalSavedTerritory,
  OnlineTerritory,
  TerritoryCaptureResult,
  TerritoryPreviewPayload,
} from '../types';
import { createId } from './createId';
import { estimateCapturedTerritoryCoverageRatio, estimateTerritoryCoverageRatio } from './analyzeTerritoryOverlap';
import { carveTerritoryGeometry } from './carveTerritoryGeometry';
import { filterValidCoordinates } from './geo/coordinateValidation';

export type CarvedTerritoryUpdate = {
  areaHectare: number;
  areaM2: number;
  coordinates: Coordinates[];
  id: string;
  sourceRoutePointCount: number;
};

export type TerritoryInteractionPlan = {
  carvedTerritories: CarvedTerritoryUpdate[];
  fullCaptureApplied: boolean;
  geometryValid: boolean;
  maxEnemyCoveragePercent: number;
  newLocalTerritory: LocalSavedTerritory;
  previousOwnerIds: string[];
  result: TerritoryCaptureResult;
};

function isInteractionAllowed(
  claimValidationResult: ClaimValidationResult,
  previewCoordinates: readonly Coordinates[],
): boolean {
  const validPreviewCoordinates = filterValidCoordinates(previewCoordinates);

  return validPreviewCoordinates.length >= 3 && claimValidationResult.isClaimAllowed;
}

function createEmptyTerritory(captureTimestamp: string): LocalSavedTerritory {
  return {
    areaHectare: 0,
    areaM2: 0,
    coordinates: [],
    createdAt: captureTimestamp,
    id: createId(),
    sourceRoutePointCount: 0,
    status: 'local_saved',
  };
}

function getPreviousOwnerIds(territories: readonly OnlineTerritory[]): string[] {
  return [...new Set(territories.map((territory) => territory.deviceId).filter((ownerId): ownerId is string => ownerId != null))];
}

export function executeTerritoryCapture(
  territoryPreviewPayload: TerritoryPreviewPayload | null,
  onlineTerritories: readonly OnlineTerritory[],
  claimValidationResult: ClaimValidationResult,
): TerritoryInteractionPlan {
  const captureTimestamp = new Date().toISOString();

  if (!territoryPreviewPayload || !isInteractionAllowed(claimValidationResult, territoryPreviewPayload.coordinates)) {
    return {
      carvedTerritories: [],
      fullCaptureApplied: false,
      geometryValid: false,
      maxEnemyCoveragePercent: 0,
      newLocalTerritory: createEmptyTerritory(captureTimestamp),
      previousOwnerIds: [],
      result: {
        captureReason: 'capture_failed',
        captureTimestamp,
        carvedTerritoryIds: [],
        capturedTerritoryIds: [],
        didCapture: false,
        previousOwnerIds: [],
      },
    };
  }

  const validPreviewCoordinates = filterValidCoordinates(territoryPreviewPayload.coordinates);
  const overlappingEnemyTerritories = onlineTerritories.filter((territory) => {
    if (territory.isMine === true || territory.deviceId == null) {
      return false;
    }

    return (
      estimateTerritoryCoverageRatio(validPreviewCoordinates, territory.coordinates) > 0 ||
      estimateCapturedTerritoryCoverageRatio(validPreviewCoordinates, territory.coordinates) > 0
    );
  });
  const capturedTerritories: OnlineTerritory[] = [];
  const carvedTerritories: CarvedTerritoryUpdate[] = [];
  let geometryValid = true;
  let maxEnemyCoveragePercent = 0;

  for (const territory of overlappingEnemyTerritories) {
    const enemyCoveragePercent = estimateCapturedTerritoryCoverageRatio(validPreviewCoordinates, territory.coordinates) * 100;
    maxEnemyCoveragePercent = Math.max(maxEnemyCoveragePercent, enemyCoveragePercent);

    if (enemyCoveragePercent >= CLAIM_RULE_CONFIG.captureCandidateThresholdPercent) {
      capturedTerritories.push(territory);
      continue;
    }

    const carvedResult = carveTerritoryGeometry(territory.coordinates, validPreviewCoordinates);
    geometryValid = geometryValid && carvedResult.geometryValid;

    if (carvedResult.removedCompletely) {
      capturedTerritories.push(territory);
      continue;
    }

    if (!carvedResult.carvedCoordinates || !carvedResult.geometryChanged || !carvedResult.geometryValid) {
      continue;
    }

    carvedTerritories.push({
      areaHectare: carvedResult.areaHectare,
      areaM2: carvedResult.areaM2,
      coordinates: carvedResult.carvedCoordinates,
      id: territory.id,
      sourceRoutePointCount: carvedResult.carvedCoordinates.length,
    });
  }

  const newTerritoryId = createId();
  const previousOwnerIds = getPreviousOwnerIds([...capturedTerritories, ...overlappingEnemyTerritories.filter((territory) =>
    carvedTerritories.some((carvedTerritory) => carvedTerritory.id === territory.id),
  )]);
  const newLocalTerritory: LocalSavedTerritory = {
    ...territoryPreviewPayload,
    createdAt: captureTimestamp,
    id: newTerritoryId,
    status: 'local_saved',
  };
  const capturedTerritoryIds = capturedTerritories.map((territory) => territory.id);
  const carvedTerritoryIds = carvedTerritories.map((territory) => territory.id);
  const didCapture = capturedTerritoryIds.length > 0;
  const captureReason: TerritoryCaptureResult['captureReason'] =
    didCapture
      ? 'enemy_territory_captured'
      : carvedTerritoryIds.length > 0
        ? 'enemy_territory_reduced'
        : 'territory_claimed';

  return {
    carvedTerritories,
    fullCaptureApplied: didCapture,
    geometryValid,
    maxEnemyCoveragePercent,
    newLocalTerritory,
    previousOwnerIds,
    result: {
      captureReason,
      captureTimestamp,
      carvedTerritoryIds,
      capturedTerritoryIds,
      didCapture,
      newTerritoryId,
      previousOwnerIds,
    },
  };
}
