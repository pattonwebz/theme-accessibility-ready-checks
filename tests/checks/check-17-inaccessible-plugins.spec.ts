import { test } from '../helpers/fixtures';
import { recordResult } from '../helpers/result-collector';
import type { CheckResult } from '../../src/types/checks';

/**
 * Check 17 — Must not recommend or require inaccessible plugins
 *
 * WP requirement: Themes must not recommend or require plugins that are known
 * to introduce accessibility barriers.
 *
 * This check cannot be automated — it requires a human reviewer to inspect any
 * plugins listed as required or recommended by the theme and evaluate whether
 * they have known accessibility problems.
 *
 * Reference: https://wpaccessibility.org/docs/topics/theme-guidelines/no-inaccessible-plugins/
 */
test.describe('check-17 — no inaccessible plugins required (manual review required)', () => {
  test('not-evaluated', async () => {
    const result: CheckResult = {
      checkId: 'plugin-review-1',
      template: 'front-page',
      viewport: 'desktop',
      status: 'not-evaluated',
      reason: 'Manual review required: confirm no required or recommended plugins introduce known accessibility barriers.',
    };
    await recordResult(result);
  });
});
