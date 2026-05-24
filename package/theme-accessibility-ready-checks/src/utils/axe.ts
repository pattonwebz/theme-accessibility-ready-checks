import type { Page } from '@playwright/test';
import type { AxeResults, RunOptions } from 'axe-core';

export async function runAxe(page: Page, options?: RunOptions): Promise<AxeResults> {
  await page.addScriptTag({ path: require.resolve('axe-core') });
  return page.evaluate((opts) => {
    return (window as unknown as { axe: { run: (ctx: Document, o: RunOptions) => Promise<AxeResults> } })
      .axe.run(document, opts);
  }, (options ?? {}) as RunOptions);
}

export async function runAxeRules(page: Page, rules: string[]): Promise<AxeResults> {
  return runAxe(page, {
    runOnly: { type: 'rule', values: rules },
  });
}
