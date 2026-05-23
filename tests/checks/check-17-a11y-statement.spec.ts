import { test, expect } from '../helpers/fixtures';
import { recordResult } from '../helpers/result-collector';
import type { CheckResult } from '../../src/types/checks';

/**
 * Check 17: Accessibility Statement
 * Manual only — requires human review of statement content.
 * Emits not-evaluated.
 */
test.describe('check-17: accessibility statement (manual)', () => {
  test('not-evaluated', async () => {
    const result: CheckResult = {
      checkId: 'a11y-statement-1',
      template: 'front-page',
      viewport: 'desktop',
      status: 'not-evaluated',
    };
    recordResult(result);
    expect(result.status).toBe('not-evaluated');
  });
});
