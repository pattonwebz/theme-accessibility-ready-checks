import type { Page } from '@playwright/test';
import { test, expect, ACTIVE_TEMPLATES } from '../helpers/fixtures';
import { recordResult } from '../helpers/result-collector';
import type { CheckResult, ViolationDetail } from '../../src/types/checks';

const MOBILE_VIEWPORT_WIDTH = 320;
const CLIPPING_TOLERANCE_PX = 5;
const TEXT_SPACING_CSS = `
  * {
    line-height: 1.5 !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important;
  }

  p {
    margin-bottom: 2em !important;
  }
`;

async function gotoTemplate(page: Page, url: string): Promise<void> {
  await page.goto(url);
}

async function getHorizontalOverflowViolations(page: Page): Promise<ViolationDetail[]> {
  return page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const violations: ViolationDetail[] = [];

    const documentScrollWidth = document.documentElement.scrollWidth;
    if (documentScrollWidth > clientWidth) {
      violations.push({
        selector: 'html',
        message: `documentElement.scrollWidth (${documentScrollWidth}px) exceeds clientWidth (${clientWidth}px).`,
      });
    }

    const bodyScrollWidth = document.body?.scrollWidth ?? 0;
    if (bodyScrollWidth > clientWidth) {
      violations.push({
        selector: 'body',
        message: `body.scrollWidth (${bodyScrollWidth}px) exceeds clientWidth (${clientWidth}px).`,
      });
    }

    return violations;
  });
}

async function getTextClippingViolations(page: Page, tolerancePx = CLIPPING_TOLERANCE_PX): Promise<ViolationDetail[]> {
  return page.evaluate((tolerance) => {
    function getSelector(element: Element): string {
      const parts: string[] = [];
      let current: Element | null = element;

      while (current && parts.length < 5) {
        let part = current.tagName.toLowerCase();
        if (current.id) {
          part += `#${current.id}`;
          parts.unshift(part);
          break;
        }

        const classList = [...current.classList].slice(0, 2);
        if (classList.length > 0) {
          part += classList.map((name) => `.${name}`).join('');
        }

        const parent: Element | null = current.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter((child) => child.tagName === current?.tagName);
          if (siblings.length > 1) {
            part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
          }
        }

        parts.unshift(part);
        current = parent;
      }

      return parts.join(' > ');
    }

    function getSnippet(element: Element): string {
      return element.outerHTML.replace(/\s+/g, ' ').trim().slice(0, 200);
    }

    const violations: ViolationDetail[] = [];
    const elements = [...document.querySelectorAll<HTMLElement>('body *')];

    for (const element of elements) {
      const style = window.getComputedStyle(element);
      const clipsText = style.overflow === 'hidden' || style.overflowY === 'hidden';
      const text = (element.innerText || element.textContent || '').trim();

      if (!clipsText || !text) {
        continue;
      }

      // Skip elements intentionally hidden via the screen-reader-text / visually-hidden
      // pattern (e.g. WordPress skip links): position:absolute with 1×1 px client area.
      // These are deliberately offscreen and are not a reflow concern.
      if (element.clientWidth <= 1 && element.clientHeight <= 1) {
        continue;
      }

      if (element.scrollHeight <= element.clientHeight + tolerance) {
        continue;
      }

      violations.push({
        selector: getSelector(element),
        snippet: getSnippet(element),
        message: `Element clips text vertically (scrollHeight ${element.scrollHeight}px, clientHeight ${element.clientHeight}px).`,
      });
    }

    return violations;
  }, tolerancePx);
}

async function getMinWidthAndOverflowViolations(
  page: Page,
  viewportWidth: number,
  tolerancePx = CLIPPING_TOLERANCE_PX,
): Promise<ViolationDetail[]> {
  return page.evaluate(({ maxWidth, tolerance }) => {
    function getSelector(element: Element): string {
      const parts: string[] = [];
      let current: Element | null = element;

      while (current && parts.length < 5) {
        let part = current.tagName.toLowerCase();
        if (current.id) {
          part += `#${current.id}`;
          parts.unshift(part);
          break;
        }

        const classList = [...current.classList].slice(0, 2);
        if (classList.length > 0) {
          part += classList.map((name) => `.${name}`).join('');
        }

        const parent: Element | null = current.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter((child) => child.tagName === current?.tagName);
          if (siblings.length > 1) {
            part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
          }
        }

        parts.unshift(part);
        current = parent;
      }

      return parts.join(' > ');
    }

    function getSnippet(element: Element): string {
      return element.outerHTML.replace(/\s+/g, ' ').trim().slice(0, 200);
    }

    const violations: ViolationDetail[] = [];
    const elements = [...document.querySelectorAll<HTMLElement>('body *')];

    for (const element of elements) {
      const style = window.getComputedStyle(element);
      const minWidth = Number.parseFloat(style.minWidth);
      const hasMinWidthViolation = Number.isFinite(minWidth) && minWidth > maxWidth;

      if (hasMinWidthViolation) {
        violations.push({
          selector: getSelector(element),
          snippet: getSnippet(element),
          message: `Computed min-width ${Math.round(minWidth)}px exceeds ${maxWidth}px viewport width.`,
        });
      }

      const clipsOverflow = style.overflow === 'hidden' || style.overflowX === 'hidden';
      if (!clipsOverflow) {
        continue;
      }

      // Skip elements intentionally hidden via the screen-reader-text / visually-hidden
      // pattern (e.g. WordPress skip links): position:absolute with 1×1 px client area.
      if (element.clientWidth <= 1 && element.clientHeight <= 1) {
        continue;
      }

      if (element.scrollWidth <= element.clientWidth + tolerance) {
        continue;
      }

      violations.push({
        selector: getSelector(element),
        snippet: getSnippet(element),
        message: `Element clips horizontal content (scrollWidth ${element.scrollWidth}px, clientWidth ${element.clientWidth}px).`,
      });
    }

    return violations;
  }, { maxWidth: viewportWidth, tolerance: tolerancePx });
}

function recordCheckResult(result: CheckResult, violations: ViolationDetail[]): void {
  recordResult(violations.length > 0 ? { ...result, detail: violations } : result);
}

/**
 * Check 13: Reflow
 * Check IDs: reflow-1, reflow-2, reflow-3
 * Templates: ACTIVE_TEMPLATES
 * Viewports: mobile (320px)
 * Tool: Playwright (viewport resize, scroll detection, CSS injection for text-spacing)
 */
test.describe('check-13: reflow', () => {
  for (const templateName of ACTIVE_TEMPLATES) {
    test(`reflow-1 — no horizontal scrolling at 320px on ${templateName}`, async ({ page, templateUrl }, testInfo) => {
      testInfo.skip(testInfo.project.name !== 'mobile', 'Reflow checks are mobile-only');

      const startedAt = Date.now();
      await gotoTemplate(page, templateUrl(templateName));
      const violations = await getHorizontalOverflowViolations(page);

      const result: CheckResult = {
        checkId: 'reflow-1',
        template: templateName,
        viewport: 'mobile',
        status: violations.length === 0 ? 'pass' : 'fail',
        durationMs: Date.now() - startedAt,
      };

      recordCheckResult(result, violations);
      expect(
        violations,
        `Expected no horizontal scrolling at 320px on ${templateName}.`,
      ).toHaveLength(0);
    });

    test(`reflow-2 — text spacing increase without content loss on ${templateName}`, async ({ page, templateUrl }, testInfo) => {
      testInfo.skip(testInfo.project.name !== 'mobile', 'Reflow checks are mobile-only');

      const startedAt = Date.now();
      await gotoTemplate(page, templateUrl(templateName));
      await page.addStyleTag({ content: TEXT_SPACING_CSS });
      await page.waitForTimeout(300);
      const violations = await getTextClippingViolations(page);

      const result: CheckResult = {
        checkId: 'reflow-2',
        template: templateName,
        viewport: 'mobile',
        status: violations.length === 0 ? 'pass' : 'fail',
        durationMs: Date.now() - startedAt,
      };

      recordCheckResult(result, violations);
      expect(
        violations,
        `Expected increased text spacing to avoid clipping on ${templateName}.`,
      ).toHaveLength(0);
    });

    test(`reflow-3 — content not clipped at min widths on ${templateName}`, async ({ page, templateUrl }, testInfo) => {
      testInfo.skip(testInfo.project.name !== 'mobile', 'Reflow checks are mobile-only');

      const startedAt = Date.now();
      await gotoTemplate(page, templateUrl(templateName));
      const violations = await getMinWidthAndOverflowViolations(page, MOBILE_VIEWPORT_WIDTH);

      const result: CheckResult = {
        checkId: 'reflow-3',
        template: templateName,
        viewport: 'mobile',
        status: violations.length === 0 ? 'pass' : 'fail',
        durationMs: Date.now() - startedAt,
      };

      recordCheckResult(result, violations);
      expect(
        violations,
        `Expected natural layout to avoid min-width and clipping issues on ${templateName}.`,
      ).toHaveLength(0);
    });
  }
});
