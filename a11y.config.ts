import type { A11yConfig } from './src/types/config';

const config: A11yConfig = {
  theme: {
    name: 'my-theme',
    path: process.env.THEME_PATH ?? '../my-theme',
  },
  themeSlug: process.env.A11Y_THEME_SLUG,
  checks: {
    enabled: 'all',
  },
  viewports: ['desktop', 'mobile'],
  templates: {},
  wordpress: {
    baseUrl: process.env.A11Y_BASE_URL ?? 'http://localhost:8080',
  },
  output: {
    dir: 'a11y-results',
    json: true,
    html: true,
  },
};

export default config;
