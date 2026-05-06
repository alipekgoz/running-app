export const routeLineStyle = {
  lineCap: 'round',
  lineColor: '#ff5a36',
  lineJoin: 'round',
  lineOpacity: 0.9,
  lineWidth: 5,
} as const;

export const polygonCandidateRouteLineStyle = {
  ...routeLineStyle,
  lineColor: '#1f9d55',
  lineWidth: 6,
} as const;
