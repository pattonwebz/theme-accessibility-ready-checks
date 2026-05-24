import { test, expect, ACTIVE_TEMPLATES } from '../helpers/fixtures';
import { recordResult } from '../helpers/result-collector';
import { runAxeRules } from '../helpers/axe-helpers';
import type { CheckResult, ViolationDetail } from '../../src/types/checks';

type SuspiciousImage = {
  alt: string;
  html: string;
  selector: string;
};

const SUSPICIOUS_ALT_VALUES = ['image', 'photo', 'picture', 'graphic', 'icon', 'logo'] as const;

async function findSuspiciousImages(page: Parameters<typeof runAxeRules>[0]): Promise<SuspiciousImage[]> {
  return page.evaluate((suspiciousValues) => {
    const suspicious = new Set(suspiciousValues);

    function getSelector(el: Element): string {
      if (el.id) {
        return `#${CSS.escape(el.id)}`;
      }

      const parts: string[] = [];
      let current: Element | null = el;
      let depth = 0;

      while (current && current.nodeType === Node.ELEMENT_NODE && depth < 6) {
        depth++;
        let part = current.tagName.toLowerCase();

        if (current.id) {
          part = `#${CSS.escape(current.id)}`;
          parts.unshift(part);
          break;
        }

        const siblings = current.parentElement
          ? [...current.parentElement.children].filter((child) => child.tagName === current?.tagName)
          : [];

        if (siblings.length > 1 && current.parentElement) {
          part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }

        parts.unshift(part);
        current = current.parentElement;
      }

      return parts.join(' > ');
    }

    return [...document.querySelectorAll('img[alt]')]
      .filter((img) => {
        const isDecorative = img.getAttribute('role') === 'presentation' || img.getAttribute('aria-hidden') === 'true';
        if (isDecorative) {
          return false;
        }

        const alt = img.getAttribute('alt');
        if (alt === null) {
          return false;
        }

        const normalizedAlt = alt.trim().toLowerCase();
        return normalizedAlt.length > 0 && suspicious.has(normalizedAlt);
      })
      .map((img) => ({
        alt: img.getAttribute('alt') ?? '',
        html: img.outerHTML,
        selector: getSelector(img),
      }));
  }, [...SUSPICIOUS_ALT_VALUES]);
}

/**
 * Check 11: Alt Text
 * Check ID: alt-text-1
 * Templates: all 8
 * Viewports: desktop
 * Tool: axe-core (image-alt, role-img-alt rules) + custom DOM check for suspicious patterns
 */
test.describe('check-11: alt text', () => {
  for (const template of ACTIVE_TEMPLATES) {
    test(`alt-text-1 — ${template}`, async ({ page, templateUrl }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'Only runs in the desktop project.');

      await page.goto(templateUrl(template));

      const axeViolations = await runAxeRules(page, ['image-alt', 'role-img-alt']);
      const suspiciousImages = await findSuspiciousImages(page);

      const violations: ViolationDetail[] = [
        ...axeViolations.flatMap((violation) =>
          violation.nodes.map((node) => ({
            selector: node.target[0] ?? node.target.join(', '),
            snippet: node.html,
            message: node.failureSummary ?? violation.description,
            wcag: 'SC 1.1.1',
          })),
        ),
        ...suspiciousImages.map((img) => ({
          selector: img.selector,
          snippet: img.html,
          message: `Suspicious alt text: "${img.alt}"`,
          wcag: 'SC 1.1.1',
        })),
      ];

      const result: CheckResult = {
        checkId: 'alt-text-1',
        template,
        viewport: 'desktop',
        status: violations.length === 0 ? 'pass' : 'fail',
        ...(violations.length > 0 ? { detail: violations } : {}),
      };

      recordResult(result);

      expect(
        result.status,
        violations.length > 0
          ? `Found ${violations.length} alt text issue(s) on ${template}: ${violations.map((violation) => `${violation.selector} => ${violation.message}`).join(' | ')}`
          : `Expected alt text checks to pass on ${template}.`,
      ).toBe('pass');
    });
  }
});
