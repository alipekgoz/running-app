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
