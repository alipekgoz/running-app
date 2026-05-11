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
import { estimateCapturedTerritoryCoverageRatio } from './analyzeTerritoryOverlap';
import { filterValidCoordinates } from './geo/coordinateValidation';

export type TerritoryCaptureOperation = {
  capturedTerritoryIds: string[];
  newLocalTerritory: LocalSavedTerritory;
  previousOwnerIds: string[];
  result: TerritoryCaptureResult;
};

function isCaptureAllowed(claimValidationResult: ClaimValidationResult, previewCoordinates: readonly Coordinates[]): boolean {
  const validPreviewCoordinates = filterValidCoordinates(previewCoordinates);

  return (
    validPreviewCoordinates.length >= 3 &&
    claimValidationResult.isCaptureAllowed &&
    claimValidationResult.isCaptureCandidate &&
    claimValidationResult.overlapsOthers
  );
}

export function executeTerritoryCapture(
  territoryPreviewPayload: TerritoryPreviewPayload | null,
  onlineTerritories: readonly OnlineTerritory[],
  claimValidationResult: ClaimValidationResult,
): TerritoryCaptureOperation {
  const captureTimestamp = new Date().toISOString();

  if (!territoryPreviewPayload || !isCaptureAllowed(claimValidationResult, territoryPreviewPayload.coordinates)) {
    return {
      capturedTerritoryIds: [],
      newLocalTerritory: {
        areaHectare: 0,
        areaM2: 0,
        coordinates: [],
        createdAt: captureTimestamp,
        id: createId(),
        sourceRoutePointCount: 0,
        status: 'local_saved',
      },
      previousOwnerIds: [],
      result: {
        captureReason: 'capture_failed',
        captureTimestamp,
        capturedTerritoryIds: [],
        didCapture: false,
        previousOwnerIds: [],
      },
    };
  }

  const validPreviewCoordinates = filterValidCoordinates(territoryPreviewPayload.coordinates);
  const capturedTerritories = onlineTerritories.filter((territory) => {
    if (territory.isMine === true) {
      return false;
    }

    const coveragePercent = estimateCapturedTerritoryCoverageRatio(validPreviewCoordinates, territory.coordinates) * 100;
    return coveragePercent >= CLAIM_RULE_CONFIG.captureCandidateThresholdPercent;
  });

  if (capturedTerritories.length === 0) {
    return {
      capturedTerritoryIds: [],
      newLocalTerritory: {
        ...territoryPreviewPayload,
        id: createId(),
        status: 'local_saved',
      },
      previousOwnerIds: [],
      result: {
        captureReason: 'capture_failed',
        captureTimestamp,
        capturedTerritoryIds: [],
        didCapture: false,
        previousOwnerIds: [],
      },
    };
  }

  const newTerritoryId = createId();
  const previousOwnerIds = [...new Set(capturedTerritories.map((territory) => territory.deviceId).filter((ownerId): ownerId is string => ownerId != null))];
  const capturedTerritoryIds = capturedTerritories.map((territory) => territory.id);
  const newLocalTerritory: LocalSavedTerritory = {
    ...territoryPreviewPayload,
    createdAt: captureTimestamp,
    id: newTerritoryId,
    status: 'local_saved',
  };

  return {
    capturedTerritoryIds,
    newLocalTerritory,
    previousOwnerIds,
    result: {
      captureReason: 'enemy_territory_captured',
      captureTimestamp,
      capturedTerritoryIds,
      didCapture: true,
      newTerritoryId,
      previousOwnerIds,
    },
  };
}
