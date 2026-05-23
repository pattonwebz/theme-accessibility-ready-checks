import { test } from '@playwright/test';
// import { recordResult } from '../helpers/result-collector';
// Uncomment above and implement when writing the real test

/**
 * Check 04: Controls
 * Check IDs: controls-1, controls-2, controls-mobile-1
 * Templates: all 8
 * Viewports: desktop + mobile
 * Tool: Playwright (getByRole, accessible name checks)
 * 
 * Tests that buttons and links have accessible names, mobile menu has accessible name.
 */
test.describe('check-04: controls', () => {
  test.todo('controls-1 — verify all buttons have accessible names (all templates, desktop)');
  test.todo('controls-2 — verify all links have accessible names (all templates, desktop)');
  test.todo('controls-1 — verify all buttons have accessible names (all templates, mobile)');
  test.todo('controls-2 — verify all links have accessible names (all templates, mobile)');
  test.todo('controls-mobile-1 — verify mobile menu has accessible name (all templates, mobile)');
});
