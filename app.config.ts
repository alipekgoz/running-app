import appJson from './app.json';

type ExpoConfig = typeof appJson.expo;

export default (): { expo: ExpoConfig & { extra: { mapboxAccessToken: string } } } => ({
  expo: {
    ...appJson.expo,
    extra: {
      mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN ?? '',
    },
  },
});
