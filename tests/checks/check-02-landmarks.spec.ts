import { test } from '../helpers/fixtures';
// import { recordResult } from '../helpers/result-collector';
// Uncomment above and implement when writing the real test

/**
 * Check 02: Landmarks
 * Check IDs: landmark-1, landmark-2, landmark-3, landmark-4, landmark-5, landmark-6
 * Templates: all 8
 * Viewports: desktop
 * Tool: Playwright + REST client (landmark-6 only)
 * 
 * Tests landmark structure: header, nav(s) with names, main, footer, no duplicates, html5 theme support.
 */
test.describe('check-02: landmarks', () => {
  test.todo('landmark-1 — verify header landmark exists (all templates)');
  test.todo('landmark-2 — verify nav landmark(s) exist with accessible names (all templates)');
  test.todo('landmark-3 — verify main landmark exists (all templates)');
  test.todo('landmark-4 — verify footer landmark exists (all templates)');
  test.todo('landmark-5 — verify no duplicate main/header/footer landmarks (all templates)');
  test.todo('landmark-6 — verify theme declares HTML5 theme support via REST endpoint');
});
