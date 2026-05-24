import { test } from '../helpers/fixtures';
import { recordResult } from '../helpers/result-collector';
import type { CheckResult } from '../../src/types/checks';

/**
 * Check 16 — Accessibility Statement
 *
 * WP requirement: Themes must include an accessibility statement describing the
 * known level of conformance and any known limitations.
 *
 * This check cannot be automated — it requires a human reviewer to confirm that
 * an accessibility statement exists and contains meaningful content.
 *
 * Reference: https://wpaccessibility.org/docs/topics/theme-guidelines/accessibility-statement/
 */
test.describe('check-16 — accessibility statement (manual review required)', () => {
  test('not-evaluated', async () => {
    const result: CheckResult = {
      checkId: 'a11y-statement-1',
      template: 'front-page',
      viewport: 'desktop',
      status: 'not-evaluated',
      reason: 'Manual review required: confirm the theme ships an accessibility statement with meaningful conformance information.',
    };
    await recordResult(result);
  });
});
