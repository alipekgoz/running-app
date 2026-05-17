export const uiColors = {
  accentText: '#F5F7FA',
  backdrop: '#0F1115',
  cardBorder: 'rgba(255,255,255,0.08)',
  cardOverlay: 'rgba(15,17,21,0.64)',
  cardOverlayStrong: 'rgba(15,17,21,0.84)',
  debugOverlay: 'rgba(10,12,16,0.72)',
  error: '#FF6262',
  inactive: 'rgba(255,255,255,0.22)',
  primaryText: '#FFFFFF',
  savedTerritory: '#8B5CF6',
  secondaryText: 'rgba(255,255,255,0.72)',
  statusGps: '#38BDF8',
  statusIdle: 'rgba(255,255,255,0.55)',
  success: '#00D26A',
  trackingStop: '#FF6262',
  warning: '#F59E0B',
} as const;

export const uiSpacing = {
  lg: 18,
  md: 12,
  sm: 8,
  xl: 24,
  xs: 4,
  xxl: 32,
} as const;

export const uiRadius = {
  card: 18,
  chip: 999,
  lg: 24,
  md: 16,
  sm: 12,
} as const;

export const uiTypography = {
  body: 14,
  caption: 11,
  headline: 28,
  label: 12,
  metric: 24,
  title: 16,
} as const;

export const uiHud = {
  bottomInsetPadding: 96,
  buttonHeight: 54,
  compactButtonHeight: 42,
  debugMaxHeight: 240,
  shadowOpacity: 0.22,
  topInsetPadding: 12,
  zIndex: {
    debug: 30,
    hud: 20,
    overlay: 25,
  },
} as const;
