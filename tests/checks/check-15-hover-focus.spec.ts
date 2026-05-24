import type { Page } from '@playwright/test';
import { test, expect, ACTIVE_TEMPLATES } from '../helpers/fixtures';
import { recordResult } from '../helpers/result-collector';
import type { CheckResult, ViolationDetail } from '../../src/types/checks';

type HoverFocusCandidate = {
  triggerSelector: string;
  submenuSelector: string;
  triggerText: string;
  submenuText: string;
};

async function findHoverFocusCandidates(page: Page): Promise<HoverFocusCandidate[]> {
  return page.evaluate<HoverFocusCandidate[]>(() => {
    const buildSelector = (element: Element): string => {
      if (element instanceof HTMLElement && element.id) {
        const escapedId = CSS.escape(element.id);
        if (document.querySelectorAll(`#${escapedId}`).length === 1) {
          return `#${escapedId}`;
        }
      }

      const segments: string[] = [];
      let current: Element | null = element;

      while (current && current !== document.body && current.nodeType === Node.ELEMENT_NODE) {
        let segment = current.localName;
        const parent = current.parentElement;

        if (parent) {
          const siblingsOfSameType = Array.from(parent.children)
            .filter((sibling) => sibling.localName === current?.localName);
          if (siblingsOfSameType.length > 1) {
            segment += `:nth-of-type(${siblingsOfSameType.indexOf(current) + 1})`;
          }
        }

        segments.unshift(segment);
        current = parent;
      }

      return segments.join(' > ');
    };

    const textSummary = (element: Element): string => element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120) ?? '';
    const roots = Array.from(document.querySelectorAll('nav, [role="navigation"]'));
    const searchRoots = roots.length > 0 ? roots : [document.body];
    const candidates: HoverFocusCandidate[] = [];
    const seen = new Set<string>();

    for (const root of searchRoots) {
      const possibleParents = Array.from(root.querySelectorAll('li, .menu-item-has-children, .page_item_has_children, [aria-haspopup="true"], [aria-expanded]'));

      for (const parent of possibleParents) {
        let trigger: Element | null = null;
        let submenu: Element | null = null;

        if (parent.matches('li, .menu-item-has-children, .page_item_has_children')) {
          trigger = parent.querySelector(':scope > a, :scope > button, :scope > summary, :scope > [tabindex], :scope > [role="menuitem"]');
          submenu = parent.querySelector(':scope > ul, :scope > .sub-menu, :scope > [role="menu"], :scope > .dropdown-menu');
        }

        if (!trigger && parent instanceof HTMLElement) {
          trigger = parent;
        }

        if (!submenu && trigger instanceof HTMLElement) {
          const ariaControls = trigger.getAttribute('aria-controls');
          if (ariaControls) {
            submenu = document.getElementById(ariaControls);
          }
        }

        if (!submenu) {
          const sibling = trigger?.nextElementSibling;
          if (sibling?.matches('ul, .sub-menu, [role="menu"], .dropdown-menu')) {
            submenu = sibling;
          }
        }

        if (!(trigger instanceof HTMLElement) || !(submenu instanceof HTMLElement)) {
          continue;
        }

        const triggerSelector = buildSelector(trigger);
        const submenuSelector = buildSelector(submenu);
        const key = `${triggerSelector}::${submenuSelector}`;
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        candidates.push({
          triggerSelector,
          submenuSelector,
          triggerText: textSummary(trigger),
          submenuText: textSummary(submenu),
        });
      }
    }

    return candidates;
  });
}

async function isVisible(page: Page, selector: string): Promise<boolean> {
  try {
    return await page.locator(selector).first().evaluate((element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return !element.hidden
        && element.getAttribute('aria-hidden') !== 'true'
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number.parseFloat(style.opacity || '1') > 0
        && rect.width > 0
        && rect.height > 0;
    });
  } catch {
    return false;
  }
}

async function movePointerToElement(page: Page, selector: string): Promise<boolean> {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) {
    return false;
  }

  await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2), { steps: 10 });
  return true;
}

async function triggerByFocus(page: Page, candidate: HoverFocusCandidate): Promise<boolean> {
  const trigger = page.locator(candidate.triggerSelector).first();
  if (await trigger.count() === 0) {
    return false;
  }

  if (await isVisible(page, candidate.submenuSelector)) {
    return false;
  }

  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.focus().catch(() => undefined);
  await page.waitForTimeout(300);
  return isVisible(page, candidate.submenuSelector);
}

async function triggerByHover(page: Page, candidate: HoverFocusCandidate): Promise<boolean> {
  const trigger = page.locator(candidate.triggerSelector).first();
  if (await trigger.count() === 0) {
    return false;
  }

  if (await isVisible(page, candidate.submenuSelector)) {
    return false;
  }

  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.hover().catch(() => undefined);
  await page.waitForTimeout(300);
  return isVisible(page, candidate.submenuSelector);
}

function buildViolation(candidate: HoverFocusCandidate, message: string): ViolationDetail {
  const snippet = [candidate.triggerText, candidate.submenuText].filter(Boolean).join(' → ');
  return {
    selector: `${candidate.triggerSelector} -> ${candidate.submenuSelector}`,
    snippet: snippet || undefined,
    message,
    wcag: '1.4.13',
  };
}

test.describe('check-15: hover/focus content', () => {
  for (const templateName of ACTIVE_TEMPLATES) {
    test(`hover-focus-1 — hover/focus content is dismissable on ${templateName}`, async ({ page, templateUrl }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'Hover/focus checks are desktop-only');

      const url = templateUrl(templateName);
      await page.goto(url);

      const candidates = await findHoverFocusCandidates(page);
      const violations: ViolationDetail[] = [];
      let testedCandidate = false;

      for (const candidate of candidates) {
        await page.goto(url);

        const appearedOnFocus = await triggerByFocus(page, candidate);
        const appearedOnHover = appearedOnFocus ? false : await triggerByHover(page, candidate);
        if (!appearedOnFocus && !appearedOnHover) {
          continue;
        }

        testedCandidate = true;
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        if (await isVisible(page, candidate.submenuSelector)) {
          violations.push(buildViolation(candidate, 'Hover/focus content remained visible after pressing Escape.'));
        }
      }

      const result: CheckResult = testedCandidate
        ? {
            checkId: 'hover-focus-1',
            template: templateName,
            viewport: 'desktop',
            status: violations.length > 0 ? 'fail' : 'pass',
            detail: violations.length > 0 ? violations : undefined,
          }
        : {
            checkId: 'hover-focus-1',
            template: templateName,
            viewport: 'desktop',
            status: 'not-applicable',
            reason: 'No hover/focus-triggered content was detected on this template.',
          };

      recordResult(result);
      expect(violations, `Expected hover/focus content on ${templateName} to be dismissable with Escape.`).toEqual([]);
    });

    test(`hover-focus-2 — hover/focus content is hoverable and persistent on ${templateName}`, async ({ page, templateUrl }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'Hover/focus checks are desktop-only');

      const url = templateUrl(templateName);
      await page.goto(url);

      const candidates = await findHoverFocusCandidates(page);
      const violations: ViolationDetail[] = [];
      let testedCandidate = false;

      for (const candidate of candidates) {
        await page.goto(url);

        const appeared = await triggerByHover(page, candidate);
        if (!appeared) {
          continue;
        }

        testedCandidate = true;
        const movedToSubmenu = await movePointerToElement(page, candidate.submenuSelector);
        await page.waitForTimeout(300);

        if (!movedToSubmenu || !(await isVisible(page, candidate.submenuSelector))) {
          violations.push(buildViolation(candidate, 'Dropdown content did not remain visible while moving the pointer onto it.'));
        }
      }

      const result: CheckResult = testedCandidate
        ? {
            checkId: 'hover-focus-2',
            template: templateName,
            viewport: 'desktop',
            status: violations.length > 0 ? 'fail' : 'pass',
            detail: violations.length > 0 ? violations : undefined,
          }
        : {
            checkId: 'hover-focus-2',
            template: templateName,
            viewport: 'desktop',
            status: 'not-applicable',
            reason: 'No hover-triggered content was detected on this template.',
          };

      recordResult(result);
      expect(violations, `Expected hover-triggered content on ${templateName} to remain visible when hovered.`).toEqual([]);
    });
  }
});
