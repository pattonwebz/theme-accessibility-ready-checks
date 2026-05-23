import { test, expect, ACTIVE_TEMPLATES } from '../helpers/fixtures';
import { recordResult } from '../helpers/result-collector';
import type { CheckResult } from '../../src/types/checks';

/**
 * Check 12: Accessible Audio, Video, Animations
 * Manual only — automated tools cannot verify caption quality or animation behaviour.
 * Emits not-evaluated for all templates.
 */
test.describe('check-12: audio/video (manual)', () => {
  for (const template of ACTIVE_TEMPLATES) {
    test(`not-evaluated on ${template}`, async () => {
      const result: CheckResult = {
        checkId: 'audio-video-1',
        template,
        viewport: 'desktop',
        status: 'not-evaluated',
      };
      recordResult(result);
      expect(result.status).toBe('not-evaluated');
    });
  }
});
