import { test, expect } from '../helpers/fixtures';
import { recordResult } from '../helpers/result-collector';
import type { CheckResult } from '../../src/types/checks';

/**
 * Check 16 — Accessibility Statement
 *
 * WP requirement: Themes must include an accessibility statement describing the
 * known level of conformance and any known limitations.
 *
 * Automated portion: fetches the theme's readme.txt and checks for keywords
 * indicating an accessibility statement is present. A pass here is a strong
 * signal but NOT a substitute for manual review — the content must be
 * meaningful, not just mention the word "accessibility".
 *
 * Reference: https://wpaccessibility.org/docs/topics/theme-guidelines/accessibility-statement/
 */

const STATEMENT_PATTERNS = [
  /accessibility\s+statement/i,
  /wcag\s+\d/i,
  /accessibility\s+(conformance|compliance|commitment|support)/i,
  /meets?\s+(wcag|accessibility)/i,
  /level\s+(a|aa|aaa)\s+conformance/i,
];

test.describe('check-16 — accessibility statement present in theme readme', () => {
  test('readme', async ({ request, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'readme.txt fetch — only needs to run once, skipped on mobile project.');
    const themeSlug = process.env.A11Y_THEME_SLUG ?? '';

    if (!themeSlug) {
      const result: CheckResult = {
        checkId: 'a11y-statement-1',
        template: 'front-page',
        viewport: 'desktop',
        status: 'not-evaluated',
        reason: 'A11Y_THEME_SLUG not set — cannot locate theme readme. Manual review required.',
      };
      await recordResult(result);
      return;
    }

    const readmeUrl = `${baseURL}/wp-content/themes/${themeSlug}/readme.txt`;
    const response = await request.get(readmeUrl, { failOnStatusCode: false });

    if (!response.ok()) {
      const result: CheckResult = {
        checkId: 'a11y-statement-1',
        template: 'front-page',
        viewport: 'desktop',
        status: 'not-evaluated',
        reason: `readme.txt not accessible at ${readmeUrl} (${response.status()}). Manual review required.`,
      };
      await recordResult(result);
      return;
    }

    const body = await response.text();
    const hasStatement = STATEMENT_PATTERNS.some((pattern) => pattern.test(body));

    const result: CheckResult = {
      checkId: 'a11y-statement-1',
      template: 'front-page',
      viewport: 'desktop',
      status: hasStatement ? 'pass' : 'fail',
      detail: hasStatement
        ? 'readme.txt contains accessibility statement language.'
        : 'readme.txt does not appear to contain an accessibility statement. Manual review required to confirm.',
    };

    expect(
      hasStatement,
      `Expected theme readme.txt at ${readmeUrl} to contain an accessibility statement (keywords: "accessibility statement", "WCAG", "conformance"). Manual review still recommended to verify statement quality.`,
    ).toBe(true);

    await recordResult(result);
  });
});
