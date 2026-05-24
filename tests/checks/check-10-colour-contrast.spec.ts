import type { CheckResult, ViolationDetail } from '../../src/types/checks';
import { runAxeRules } from '../helpers/axe-helpers';
import { test, expect, ACTIVE_TEMPLATES } from '../helpers/fixtures';
import { recordResult } from '../helpers/result-collector';

function mapViolationDetails(violations: Awaited<ReturnType<typeof runAxeRules>>): ViolationDetail[] {
  return violations.flatMap((violation) =>
    violation.nodes.map((node) => ({
      selector: node.target.join(' > '),
      snippet: node.html,
      message: node.failureSummary ?? violation.description,
      wcag: 'SC 1.4.3',
    })),
  );
}

/**
 * Check 10: Colour Contrast
 * Check ID: contrast-1
 * Templates: all 8
 * Viewports: desktop
 * Tool: axe-core (color-contrast rule)
 */
test.describe('check-10: colour contrast', () => {
  test.describe('contrast-1 — verify colour contrast meets WCAG AA on all templates', () => {
    for (const template of ACTIVE_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        test.skip(testInfo.project.name !== 'desktop', 'Only runs in the desktop project.');

        await page.goto(templateUrl(template));

        const axeViolations = await runAxeRules(page, ['color-contrast']);
        const violations = mapViolationDetails(axeViolations);

        const result: CheckResult = {
          checkId: 'contrast-1',
          template,
          viewport: 'desktop',
          status: violations.length === 0 ? 'pass' : 'fail',
          ...(violations.length > 0 ? { detail: violations } : {}),
        };

        recordResult(result);
        expect(result.status, `Found ${violations.length} contrast violation(s)`).toBe('pass');
      });
    }
  });
});
