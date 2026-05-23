import { test as base } from '@playwright/test';
import { TEMPLATE_PATHS } from '../../src/types/checks';
import type { TemplateName } from '../../src/types/checks';

type A11yFixtures = {
  templateUrl: (name: TemplateName) => string;
};

export const test = base.extend<A11yFixtures>({
  templateUrl: async ({ baseURL }, use) => {
    await use((name: TemplateName) => `${baseURL ?? ''}${TEMPLATE_PATHS[name]}`);
  },
});

export { expect } from '@playwright/test';
