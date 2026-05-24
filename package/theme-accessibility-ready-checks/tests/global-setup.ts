import type { FullConfig } from '@playwright/test';
import { TEMPLATE_PATHS } from '../src/types/checks';
import type { TemplateName } from '../src/types/checks';

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL    = process.env.A11Y_BASE_URL  ?? config.projects[0]?.use?.baseURL ?? 'http://localhost:8080';
  const themeSlug  = process.env.A11Y_THEME_SLUG ?? '(not set — using active theme)';
  const outputDir  = process.env.A11Y_OUTPUT_DIR ?? 'a11y-results';
  const viewports  = config.projects.map((p) => p.name).join(', ');
  const timestamp  = new Date().toISOString();

  const requested = process.env.A11Y_TEMPLATES?.trim();
  const activeTemplates: TemplateName[] = requested
    ? requested.split(',').map((s) => s.trim() as TemplateName).filter((t) => t in TEMPLATE_PATHS)
    : Object.keys(TEMPLATE_PATHS) as TemplateName[];
  const templatesLabel = activeTemplates.length === Object.keys(TEMPLATE_PATHS).length
    ? `all (${activeTemplates.length})`
    : activeTemplates.join(', ');

  const W = 56;
  const row = (label: string, value: string): string => {
    const content = `  ${label.padEnd(12)}${value}`;
    return `│${content.padEnd(W - 2)}│`;
  };

  console.log('');
  console.log(`┌${'─'.repeat(W - 2)}┐`);
  console.log(`│  Theme Accessibility Ready Checks${''.padEnd(W - 36)}│`);
  console.log(`├${'─'.repeat(W - 2)}┤`);
  console.log(row('Site URL:', baseURL));
  console.log(row('Theme:', themeSlug));
  console.log(row('Templates:', templatesLabel));
  console.log(row('Output:', outputDir));
  console.log(row('Viewports:', viewports));
  console.log(row('Started:', timestamp));
  console.log(`└${'─'.repeat(W - 2)}┘`);
  console.log('');
}
