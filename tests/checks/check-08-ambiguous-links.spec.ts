import { test } from '@playwright/test';
// import { recordResult } from '../helpers/result-collector';
// Uncomment above and implement when writing the real test

/**
 * Check 08: Ambiguous Links
 * Check ID: link-ambiguous-1
 * Templates: all 8
 * Viewports: desktop
 * Tool: Playwright (getByRole('link') + text content check)
 * 
 * Tests that no links have ambiguous text like "click here", "read more", "learn more" without context.
 */
test.describe('check-08: ambiguous links', () => {
  test.skip('link-ambiguous-1 — verify no ambiguous link text on all templates', async () => {});
});
