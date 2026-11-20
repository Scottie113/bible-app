import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Settings from app.json, plus a web base path when the site is published in a
 * sub-folder (GitHub Pages serves it at https://<user>.github.io/<repo>/).
 * The deploy workflow sets WEB_BASE_URL=/<repo>; local development leaves it unset.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const baseUrl = process.env.WEB_BASE_URL;
  return {
    ...(config as ExpoConfig),
    experiments: { ...config.experiments, ...(baseUrl ? { baseUrl } : {}) },
  };
};
