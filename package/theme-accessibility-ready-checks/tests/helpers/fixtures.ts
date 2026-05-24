import { test as base } from '@playwright/test';
import { TEMPLATE_PATHS } from '../../src/types/checks';
import type { TemplateName } from '../../src/types/checks';

export const ACTIVE_TEMPLATES: TemplateName[] = (() => {
  const requested = process.env.A11Y_TEMPLATES;
  if (!requested?.trim()) return Object.keys(TEMPLATE_PATHS) as TemplateName[];
  return requested
    .split(',')
    .map((s) => s.trim() as TemplateName)
    .filter((t) => t in TEMPLATE_PATHS);
})();

type A11yFixtures = {
  templateUrl: (name: TemplateName) => string;
};

export const test = base.extend<A11yFixtures>({
  templateUrl: async ({ baseURL }, use) => {
    await use((name: TemplateName) => `${baseURL ?? ''}${TEMPLATE_PATHS[name]}`);
  },
});

export { expect } from '@playwright/test';
