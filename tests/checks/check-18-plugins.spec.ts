import { test, expect } from '../helpers/fixtures';
import { recordResult } from '../helpers/result-collector';
import type { CheckResult } from '../../src/types/checks';

/**
 * Check 18: Must Not Recommend Inaccessible Plugins
 * Manual only — requires human review of bundled/recommended plugins.
 * Emits not-evaluated.
 */
test.describe('check-18: plugin review (manual)', () => {
  test('not-evaluated', async () => {
    const result: CheckResult = {
      checkId: 'plugin-review-1',
      template: 'front-page',
      viewport: 'desktop',
      status: 'not-evaluated',
    };
    recordResult(result);
    expect(result.status).toBe('not-evaluated');
  });
});
