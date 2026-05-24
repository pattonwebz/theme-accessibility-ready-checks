import type { Page } from '@playwright/test';
import { test, expect, ACTIVE_TEMPLATES } from '../helpers/fixtures';
import { recordResult } from '../helpers/result-collector';
import type { CheckResult, TemplateName, ViolationDetail } from '../../src/types/checks';

const MAX_TAB_STEPS = 20;
const INTERACTION_DELAY_MS = 200;
const CONTROL_MARKER_ATTR = 'data-a11y-context-change-id';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

type ElementSnapshot = {
  selector: string;
  snippet: string;
  tagName: string;
  type: string | null;
  text: string;
};

type RelevantControl = ElementSnapshot & {
  marker: string;
  kind: 'select' | 'text-input' | 'textarea';
};

async function prepareForTraversal(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
}

async function countVisibleFocusableElements(page: Page): Promise<number> {
  return page.evaluate((selector) => {
    const isVisible = (element: Element): boolean => {
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    return Array.from(document.querySelectorAll(selector)).filter((element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      if (element.tabIndex < 0) {
        return false;
      }

      return isVisible(element);
    }).length;
  }, FOCUSABLE_SELECTOR);
}

async function getVisibleDialogSelectors(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const isVisible = (element: Element): boolean => {
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const getSelector = (element: Element): string => {
      if (element.id) {
        return `#${element.id}`;
      }

      const className = (element.getAttribute('class') ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .join('.');
      const base = `${element.tagName.toLowerCase()}${className ? `.${className}` : ''}`;
      const siblings = element.parentElement
        ? Array.from(element.parentElement.children).filter((candidate) => candidate.tagName === element.tagName)
        : [];
      const index = siblings.indexOf(element);
      return index >= 0 ? `${base}:nth-of-type(${index + 1})` : base;
    };

    return Array.from(document.querySelectorAll('dialog, [role="dialog"], [aria-modal="true"]'))
      .filter((element) => isVisible(element))
      .map((element) => getSelector(element));
  });
}

async function getActiveElementSnapshot(page: Page): Promise<ElementSnapshot | null> {
  return page.evaluate(() => {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement) || activeElement === document.body || activeElement === document.documentElement) {
      return null;
    }

    const normaliseText = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim();
    const getSelector = (element: HTMLElement): string => {
      if (element.id) {
        return `#${element.id}`;
      }

      const className = (element.getAttribute('class') ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .join('.');
      const base = `${element.tagName.toLowerCase()}${className ? `.${className}` : ''}`;
      const siblings = element.parentElement
        ? Array.from(element.parentElement.children).filter((candidate) => candidate.tagName === element.tagName)
        : [];
      const index = siblings.indexOf(element);
      return index >= 0 ? `${base}:nth-of-type(${index + 1})` : base;
    };

    return {
      selector: getSelector(activeElement),
      snippet: activeElement.outerHTML.slice(0, 200),
      tagName: activeElement.tagName.toLowerCase(),
      type: activeElement instanceof HTMLInputElement ? activeElement.type : null,
      text: normaliseText(
        activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
          ? activeElement.value
          : activeElement.textContent,
      ),
    };
  });
}

async function collectRelevantControls(page: Page): Promise<RelevantControl[]> {
  return page.evaluate((markerAttr) => {
    const normaliseText = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim();
    const isVisible = (element: Element): boolean => {
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const getSelector = (element: HTMLElement): string => {
      if (element.id) {
        return `#${element.id}`;
      }

      const className = (element.getAttribute('class') ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .join('.');
      const base = `${element.tagName.toLowerCase()}${className ? `.${className}` : ''}`;
      const siblings = element.parentElement
        ? Array.from(element.parentElement.children).filter((candidate) => candidate.tagName === element.tagName)
        : [];
      const index = siblings.indexOf(element);
      return index >= 0 ? `${base}:nth-of-type(${index + 1})` : base;
    };

    for (const marked of Array.from(document.querySelectorAll(`[${markerAttr}]`))) {
      marked.removeAttribute(markerAttr);
    }

    const controls = Array.from(document.querySelectorAll('select, textarea, input'))
      .filter((element): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        if (!isVisible(element)) {
          return false;
        }

        if (element instanceof HTMLInputElement) {
          return ['text', 'email', 'search'].includes(element.type) && !element.readOnly && !element.disabled;
        }

        if (element instanceof HTMLTextAreaElement) {
          return !element.readOnly && !element.disabled;
        }

        return !element.disabled;
      });

    return controls.map((control, index) => {
      const marker = `control-${index}`;
      control.setAttribute(markerAttr, marker);

      return {
        marker,
        kind: control instanceof HTMLSelectElement
          ? 'select'
          : control instanceof HTMLTextAreaElement
            ? 'textarea'
            : 'text-input',
        selector: getSelector(control),
        snippet: control.outerHTML.slice(0, 200),
        tagName: control.tagName.toLowerCase(),
        type: control instanceof HTMLInputElement ? control.type : null,
        text: normaliseText(
          control instanceof HTMLSelectElement
            ? control.selectedOptions[0]?.textContent ?? ''
            : control.value,
        ),
      };
    });
  }, CONTROL_MARKER_ATTR);
}

function createResult(
  checkId: 'context-change-1' | 'context-change-2',
  template: TemplateName,
  status: CheckResult['status'],
  detail?: string | ViolationDetail[],
  reason?: string,
): CheckResult {
  return {
    checkId,
    template,
    viewport: 'desktop',
    status,
    detail,
    reason,
  };
}

test.describe('check-14: context changes', () => {
  for (const templateName of ACTIVE_TEMPLATES) {
    test(`context-change-1 — no context change on focus on ${templateName}`, async ({ page, templateUrl }, testInfo) => {
      testInfo.skip(testInfo.project.name !== 'desktop', 'Context change checks are desktop-only');
      testInfo.annotations.push({
        type: 'note',
        description: 'Automated heuristic: tabs through up to 20 focusable elements and checks for obvious navigation, modal, or new-window context changes.',
      });

      await page.goto(templateUrl(templateName));
      await prepareForTraversal(page);

      const originalUrl = page.url();
      const baselinePageCount = page.context().pages().length;
      const baselineDialogs = await getVisibleDialogSelectors(page);
      const focusableCount = await countVisibleFocusableElements(page);

      if (focusableCount === 0) {
        const reason = 'No visible focusable elements were found on the page.';
        testInfo.annotations.push({ type: 'not-applicable', description: reason });
        recordResult(createResult('context-change-1', templateName, 'not-applicable', undefined, reason));
        return;
      }

      const violations: ViolationDetail[] = [];

      for (let step = 0; step < Math.min(MAX_TAB_STEPS, focusableCount); step += 1) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(INTERACTION_DELAY_MS);

        const focusedElement = await getActiveElementSnapshot(page);
        const currentUrl = page.url();
        const currentPageCount = page.context().pages().length;
        const currentDialogs = await getVisibleDialogSelectors(page);
        const detailTarget = focusedElement ?? {
          selector: 'document.activeElement',
          snippet: '',
          tagName: 'unknown',
          type: null,
          text: '',
        };

        if (currentUrl !== originalUrl) {
          violations.push({
            selector: detailTarget.selector,
            snippet: detailTarget.snippet,
            message: `Focus moved to ${detailTarget.selector} and changed the URL from ${originalUrl} to ${currentUrl}.`,
            wcag: '3.2.1',
          });
          break;
        }

        if (currentPageCount > baselinePageCount) {
          violations.push({
            selector: detailTarget.selector,
            snippet: detailTarget.snippet,
            message: `Focusing ${detailTarget.selector} opened ${currentPageCount - baselinePageCount} additional page(s) or tab(s).`,
            wcag: '3.2.1',
          });
          break;
        }

        if (currentDialogs.length > baselineDialogs.length) {
          const newDialogs = currentDialogs.filter((selector) => !baselineDialogs.includes(selector));
          violations.push({
            selector: detailTarget.selector,
            snippet: detailTarget.snippet,
            message: `Focusing ${detailTarget.selector} opened a dialog automatically: ${newDialogs.join(', ') || currentDialogs.join(', ')}.`,
            wcag: '3.2.1',
          });
          break;
        }
      }

      const result = createResult(
        'context-change-1',
        templateName,
        violations.length > 0 ? 'fail' : 'pass',
        violations.length > 0
          ? violations
          : `Tabbed through up to ${Math.min(MAX_TAB_STEPS, focusableCount)} focusable elements without an obvious context change.`,
      );
      recordResult(result);

      expect(
        violations,
        `Expected focusing elements on ${templateName} not to trigger automatic navigation, dialogs, or new tabs. Violations: ${violations.map((violation) => `${violation.selector}: ${violation.message}`).join(' | ')}`,
      ).toHaveLength(0);
    });

    test(`context-change-2 — no context change on input on ${templateName}`, async ({ page, templateUrl }, testInfo) => {
      testInfo.skip(testInfo.project.name !== 'desktop', 'Context change checks are desktop-only');
      testInfo.annotations.push({
        type: 'note',
        description: 'Automated heuristic: changes visible text inputs, textareas, and selects, then checks for obvious navigation, modal, or new-window context changes.',
      });

      await page.goto(templateUrl(templateName));

      const originalUrl = page.url();
      const baselinePageCount = page.context().pages().length;
      const baselineDialogs = await getVisibleDialogSelectors(page);
      const controls = await collectRelevantControls(page);

      if (controls.length === 0) {
        const reason = 'No visible text inputs, textareas, or selects were found on the page.';
        testInfo.annotations.push({ type: 'not-applicable', description: reason });
        recordResult(createResult('context-change-2', templateName, 'not-applicable', undefined, reason));
        return;
      }

      const violations: ViolationDetail[] = [];

      for (const control of controls) {
        const locator = page.locator(`[${CONTROL_MARKER_ATTR}="${control.marker}"]`);
        if (await locator.count() === 0) {
          continue;
        }

        await locator.focus();
        await page.waitForTimeout(INTERACTION_DELAY_MS);

        if (control.kind === 'select') {
          await page.keyboard.press('ArrowDown');
        } else {
          await page.keyboard.type('a');
        }

        await page.waitForTimeout(INTERACTION_DELAY_MS);

        const currentUrl = page.url();
        const currentPageCount = page.context().pages().length;
        const currentDialogs = await getVisibleDialogSelectors(page);

        if (currentUrl !== originalUrl) {
          violations.push({
            selector: control.selector,
            snippet: control.snippet,
            message: `Changing ${control.selector} triggered navigation from ${originalUrl} to ${currentUrl}.`,
            wcag: '3.2.2',
          });
          break;
        }

        if (currentPageCount > baselinePageCount) {
          violations.push({
            selector: control.selector,
            snippet: control.snippet,
            message: `Changing ${control.selector} opened ${currentPageCount - baselinePageCount} additional page(s) or tab(s).`,
            wcag: '3.2.2',
          });
          break;
        }

        if (currentDialogs.length > baselineDialogs.length) {
          const newDialogs = currentDialogs.filter((selector) => !baselineDialogs.includes(selector));
          violations.push({
            selector: control.selector,
            snippet: control.snippet,
            message: `Changing ${control.selector} opened a dialog automatically: ${newDialogs.join(', ') || currentDialogs.join(', ')}.`,
            wcag: '3.2.2',
          });
          break;
        }
      }

      const result = createResult(
        'context-change-2',
        templateName,
        violations.length > 0 ? 'fail' : 'pass',
        violations.length > 0
          ? violations
          : `Interacted with ${controls.length} relevant form control(s) without an obvious context change.`,
      );
      recordResult(result);

      expect(
        violations,
        `Expected changing inputs on ${templateName} not to trigger automatic navigation, dialogs, or new tabs. Violations: ${violations.map((violation) => `${violation.selector}: ${violation.message}`).join(' | ')}`,
      ).toHaveLength(0);
    });
  }
});
