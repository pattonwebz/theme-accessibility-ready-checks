import type { CheckId, TemplateName, Viewport } from './checks';

export interface A11yConfig {
  theme: {
    name: string;
    path: string;   // Absolute or relative path to theme directory
  };
  themeSlug?: string;
  checks: {
    enabled: 'all' | CheckId[];
    skip?: CheckId[];
  };
  viewports: Viewport[];
  templates: {
    paths?: Partial<Record<TemplateName, string>>;
  };
  wordpress: {
    baseUrl: string;
  };
  output: {
    dir: string;
    json: boolean;
    html: boolean;
  };
}
