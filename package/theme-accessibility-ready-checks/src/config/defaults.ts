import type { A11yConfig } from '../types/config';

export const defaults: A11yConfig = {
  theme: {
    name: 'unknown',
    path: process.env.A11Y_THEME_PATH ?? '',
  },
  themeSlug: process.env.A11Y_THEME_SLUG || undefined,
  checks: {
    enabled: 'all',
  },
  viewports: ['desktop', 'mobile'],
  templates: {},
  wordpress: {
    baseUrl: process.env.A11Y_BASE_URL ?? 'http://localhost:8080',
  },
  output: {
    dir: process.env.A11Y_OUTPUT_DIR ?? 'a11y-results',
    json: true,
    html: true,
  },
};
