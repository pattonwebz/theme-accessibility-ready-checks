import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/fixtures';

const TEMPLATE = 'front-page' as const;

type FocusedSkipLink = {
  href: string;
  text: string;
  visibility: string;
};

async function focusFirstSkipLink(page: Page, url: string, viewport: string): Promise<FocusedSkipLink> {
  await page.goto(url);
  await page.keyboard.press('Tab');

  const focusedSkipLink = await page.evaluate<FocusedSkipLink | null>(() => {
    const activeElement = document.activeElement;

    if (!(activeElement instanceof HTMLAnchorElement)) {
      return null;
    }

    const href = activeElement.getAttribute('href');
    if (!href?.startsWith('#')) {
      return null;
    }

    return {
      href,
      text: activeElement.textContent?.trim() ?? '',
      visibility: window.getComputedStyle(activeElement).visibility,
    };
  });

  expect(
    focusedSkipLink,
    `Expected the first focused element after pressing Tab on homepage (${viewport}) to be an in-page skip link.`,
  ).not.toBeNull();

  return focusedSkipLink as FocusedSkipLink;
}

test.describe('check-01: skip links', () => {
  test.describe('front-page (homepage)', () => {
    test('skip-1 — first focusable element is a skip link', async ({ page, templateUrl }, testInfo) => {
      const viewport = testInfo.project.name;
      const skipLink = await focusFirstSkipLink(page, templateUrl(TEMPLATE), viewport);

      expect(
        skipLink.href,
        `Expected the first focused link on homepage (${viewport}) to point to an in-page target.`,
      ).toMatch(/^#.+/);
    });

    test('skip-1 — focused skip link becomes visible', async ({ page, templateUrl }, testInfo) => {
      const viewport = testInfo.project.name;
      const skipLink = await focusFirstSkipLink(page, templateUrl(TEMPLATE), viewport);
      const focusedLink = page.locator('a:focus');
      const box = await focusedLink.boundingBox();

      expect(
        skipLink.visibility,
        `Expected the focused skip link on homepage (${viewport}) to not use visibility:hidden.`,
      ).not.toBe('hidden');
      expect(box, `Expected the focused skip link on homepage (${viewport}) to have a bounding box.`).not.toBeNull();
      expect(
        box?.width ?? 0,
        `Expected the focused skip link on homepage (${viewport}) to have a non-zero width.`,
      ).toBeGreaterThan(0);
      expect(
        box?.height ?? 0,
        `Expected the focused skip link on homepage (${viewport}) to have a non-zero height.`,
      ).toBeGreaterThan(0);
    });

    test('skip-1 — skip link target exists', async ({ page, templateUrl }, testInfo) => {
      const viewport = testInfo.project.name;
      const skipLink = await focusFirstSkipLink(page, templateUrl(TEMPLATE), viewport);

      const target = page.locator(skipLink.href);
      await expect(
        target,
        `Expected the skip link target ${skipLink.href} to exist on homepage (${viewport}).`,
      ).toHaveCount(1);
    });

    test('skip-1 — activating the skip link moves to main content', async ({ page, templateUrl }, testInfo) => {
      const viewport = testInfo.project.name;
      const skipLink = await focusFirstSkipLink(page, templateUrl(TEMPLATE), viewport);

      const target = page.locator(skipLink.href);
      await expect(
        target,
        `Expected the skip link target ${skipLink.href} to exist before activation on homepage (${viewport}).`,
      ).toHaveCount(1);

      await page.keyboard.press('Enter');

      await expect.poll(
        async () => target.evaluate((element) => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }

          const rect = element.getBoundingClientRect();
          const isInViewport = rect.width > 0
            && rect.height > 0
            && rect.bottom > 0
            && rect.top < window.innerHeight;

          return document.activeElement === element || isInViewport;
        }),
        {
          message: `Expected activating the skip link on homepage (${viewport}) to move focus to ${skipLink.href} or bring it into view.`,
        },
      ).toBe(true);
    });
  });
});
