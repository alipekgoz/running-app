export const routeLineStyle = {
  lineCap: 'round',
  lineColor: '#38BDF8',
  lineJoin: 'round',
  lineOpacity: 0.95,
  lineWidth: 5,
} as const;

export const polygonCandidateRouteLineStyle = {
  ...routeLineStyle,
  lineColor: '#00D26A',
  lineWidth: 6,
} as const;

export const polygonPreviewFillStyle = {
  fillColor: '#38BDF8',
  fillOpacity: 0.18,
} as const;

export const polygonPreviewOutlineStyle = {
  lineColor: '#38BDF8',
  lineOpacity: 0.95,
  lineWidth: 2.5,
} as const;

export const polygonPreviewOverlapFillStyle = {
  fillColor: '#F59E0B',
  fillOpacity: 0.22,
} as const;

export const polygonPreviewOverlapOutlineStyle = {
  lineColor: '#F97316',
  lineOpacity: 0.98,
  lineWidth: 3,
} as const;

export const conflictSeverityStyleConfig = {
  high: {
    color: '#FF6262',
    fillOpacity: 0.28,
    lineOpacity: 1,
    lineWidth: 3.6,
    territoryLineWidthBoost: 2.6,
    territoryOpacityBoost: 1,
  },
  low: {
    color: '#FACC15',
    fillOpacity: 0.2,
    lineOpacity: 0.96,
    lineWidth: 2.8,
    territoryLineWidthBoost: 1.2,
    territoryOpacityBoost: 0.9,
  },
  medium: {
    color: '#F97316',
    fillOpacity: 0.24,
    lineOpacity: 0.98,
    lineWidth: 3.2,
    territoryLineWidthBoost: 1.8,
    territoryOpacityBoost: 0.95,
  },
  none: {
    color: '#38BDF8',
    fillOpacity: 0.18,
    lineOpacity: 0.95,
    lineWidth: 2.5,
    territoryLineWidthBoost: 0,
    territoryOpacityBoost: 0.85,
  },
} as const;

export const savedTerritoryFillStyle = {
  fillColor: '#8B5CF6',
  fillOpacity: 0.22,
} as const;

export const savedTerritoryOutlineStyle = {
  lineColor: '#8B5CF6',
  lineOpacity: 0.95,
  lineWidth: 2.5,
} as const;

export const onlineTerritoryMineFillStyle = {
  fillColor: '#00D26A',
  fillOpacity: 0.18,
} as const;

export const onlineTerritoryMineOutlineStyle = {
  lineColor: '#00D26A',
  lineOpacity: 0.9,
  lineWidth: 2,
} as const;

export const onlineTerritoryOtherFillStyle = {
  fillColor: '#8B5CF6',
  fillOpacity: 0.12,
} as const;

export const onlineTerritoryOtherOutlineStyle = {
  lineColor: '#C4B5FD',
  lineOpacity: 0.85,
  lineWidth: 1.5,
} as const;

export const onlineTerritoryConflictOutlineBaseStyle = {
  lineBlur: 0.4,
  lineOpacity: 0.92,
} as const;
