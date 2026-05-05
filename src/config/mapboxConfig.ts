import Mapbox from '@rnmapbox/maps';
import Constants from 'expo-constants';

declare const process: {
  env: Record<string, string | undefined>;
};

type ExpoExtra = {
  mapboxAccessToken?: string;
};

const expoExtra = Constants.expoConfig?.extra as ExpoExtra | undefined;

const rawMapboxToken =
  expoExtra?.mapboxAccessToken ??
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ??
  process.env.MAPBOX_ACCESS_TOKEN ??
  '';

export const MAPBOX_ACCESS_TOKEN = rawMapboxToken.trim();

export const MAPBOX_STYLE_URL = Mapbox.StyleURL.Street;

export const DEFAULT_MAP_CENTER = {
  latitude: 41.0082,
  longitude: 28.9784,
} as const;
