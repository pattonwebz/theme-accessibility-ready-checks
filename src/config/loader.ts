import path from 'path';
import { defaults } from './defaults';
import { a11yConfigSchema } from './schema';
import type { A11yConfig } from '../types/config';

export function loadConfig(): A11yConfig {
  let userConfig: Partial<A11yConfig> = {};

  const configPath = path.resolve(process.cwd(), 'a11y.config.ts');
  try {
    // tsx must be registered before require() can load .ts files
    // In practice this runs after tsx is in the require chain via setup scripts
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(configPath) as { default?: Partial<A11yConfig> } | Partial<A11yConfig>;
    userConfig = (mod as { default?: Partial<A11yConfig> }).default ?? (mod as Partial<A11yConfig>);
  } catch {
    // No config file found — use defaults only
  }

  const merged: A11yConfig = {
    theme: { ...defaults.theme, ...userConfig.theme },
    themeSlug: process.env.A11Y_THEME_SLUG || userConfig.themeSlug || defaults.themeSlug,
    checks: { ...defaults.checks, ...userConfig.checks },
    viewports: userConfig.viewports ?? defaults.viewports,
    templates: { ...defaults.templates, ...userConfig.templates },
    wordpress: { ...defaults.wordpress, ...userConfig.wordpress },
    output: { ...defaults.output, ...userConfig.output },
  };

  const result = a11yConfigSchema.safeParse(merged);
  if (!result.success) {
    console.error('[a11y-config] Invalid configuration:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}
