import type { Page } from '@playwright/test';
import { test, expect, ACTIVE_TEMPLATES } from '../helpers/fixtures';
import type { TemplateName } from '../../src/types/checks';
import { TEMPLATE_PATHS } from '../../src/types/checks';

const ALL_TEMPLATES = ACTIVE_TEMPLATES;

/**
 * Evaluate landmark counts in the page DOM.
 *
 * Banner/contentinfo rules: <header>/<footer> only carry their implicit landmark
 * role when they are NOT nested inside sectioning content.
 */
async function getLandmarkCounts(page: Page) {
  return page.evaluate(() => {
    const SECTIONING = 'article, aside, main, nav, section';

    const banners = new Set([
      ...[...document.querySelectorAll('header')].filter(
        (el) => !el.closest(SECTIONING),
      ),
      ...document.querySelectorAll('[role="banner"]'),
    ]);

    const mains = new Set([
      ...document.querySelectorAll('main'),
      ...document.querySelectorAll('[role="main"]'),
    ]);

    const contentinfos = new Set([
      ...[...document.querySelectorAll('footer')].filter(
        (el) => !el.closest(SECTIONING),
      ),
      ...document.querySelectorAll('[role="contentinfo"]'),
    ]);

    const navs = [
      ...document.querySelectorAll('nav'),
      ...document.querySelectorAll('[role="navigation"]'),
    ];

    const navsWithoutNames = navs
      .filter((nav) => {
        const label = nav.getAttribute('aria-label')?.trim();
        if (label) return false;

        const labelledById = nav.getAttribute('aria-labelledby');
        if (labelledById) {
          const el = document.getElementById(labelledById);
          if (el?.textContent?.trim()) return false;
        }

        return true;
      })
      .map((nav) => {
        const clone = nav.cloneNode(false) as Element;
        return clone.outerHTML;
      });

    // Detect nav-like structures not wrapped in a proper <nav> or role="navigation".
    // Heuristics: class/id matching nav/menu patterns, or link-heavy lists in header/footer.
    const NAV_PATTERN = /\b(nav|menu|navigation)\b/i;

    const navLikeElements = (
      [...document.querySelectorAll('ul, ol, div, section')] as Element[]
    )
      .filter((el) => {
        if (el.closest('nav') || el.closest('[role="navigation"]')) return false;

        const cls = el.getAttribute('class') ?? '';
        const id  = el.getAttribute('id')    ?? '';

        if (NAV_PATTERN.test(cls) || NAV_PATTERN.test(id)) {
          return el.querySelectorAll('a[href]').length >= 2;
        }

        if (
          (el.tagName === 'UL' || el.tagName === 'OL') &&
          el.closest('header, footer') &&
          el.querySelectorAll('a[href]').length >= 3
        ) {
          return true;
        }

        return false;
      })
      .map((el) => {
        const clone = el.cloneNode(false) as Element;
        return clone.outerHTML;
      });

    return {
      bannerCount:      banners.size,
      mainCount:        mains.size,
      contentinfoCount: contentinfos.size,
      navCount:         navs.length,
      navsWithoutNames,
      navLikeElements,
    };
  });
}

/**
 * Check 02: Landmarks
 * Check IDs: landmark-1, landmark-2, landmark-3, landmark-4, landmark-5, landmark-6
 * Templates: all 8
 * Viewports: desktop, mobile
 * Tool: Playwright (landmark-1–5) + theme support check (landmark-6)
 */
test.describe('check-02: landmarks', () => {

  test.describe('landmark-1 — banner (header) landmark exists', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name;
        await page.goto(templateUrl(template));
        const { bannerCount } = await getLandmarkCounts(page);
        expect(
          bannerCount,
          `Expected a banner landmark (<header> or role="banner") on ${template} (${viewport}).`,
        ).toBeGreaterThanOrEqual(1);
      });
    }
  });

  test.describe('landmark-2 — nav landmarks have accessible names', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name;
        await page.goto(templateUrl(template));
        const { navCount, navsWithoutNames } = await getLandmarkCounts(page);
        expect(
          navCount,
          `Expected at least one navigation landmark (<nav> or role="navigation") on ${template} (${viewport}).`,
        ).toBeGreaterThanOrEqual(1);
        expect(
          navsWithoutNames,
          `All nav landmarks must have an accessible name (aria-label or aria-labelledby) on ${template} (${viewport}). Unnamed: ${navsWithoutNames.join(', ')}`,
        ).toHaveLength(0);
      });
    }
  });

  test.describe('landmark-3 — main landmark exists', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name;
        await page.goto(templateUrl(template));
        const { mainCount } = await getLandmarkCounts(page);
        expect(
          mainCount,
          `Expected a main landmark (<main> or role="main") on ${template} (${viewport}).`,
        ).toBeGreaterThanOrEqual(1);
      });
    }
  });

  test.describe('landmark-4 — contentinfo (footer) landmark exists', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name;
        await page.goto(templateUrl(template));
        const { contentinfoCount } = await getLandmarkCounts(page);
        expect(
          contentinfoCount,
          `Expected a contentinfo landmark (<footer> or role="contentinfo") on ${template} (${viewport}).`,
        ).toBeGreaterThanOrEqual(1);
      });
    }
  });

  test.describe('landmark-5 — no duplicate banner/main/contentinfo landmarks', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name;
        await page.goto(templateUrl(template));
        const { bannerCount, mainCount, contentinfoCount } = await getLandmarkCounts(page);
        expect(
          bannerCount,
          `Expected at most one banner landmark on ${template} (${viewport}), found ${bannerCount}.`,
        ).toBeLessThanOrEqual(1);
        expect(
          mainCount,
          `Expected at most one main landmark on ${template} (${viewport}), found ${mainCount}.`,
        ).toBeLessThanOrEqual(1);
        expect(
          contentinfoCount,
          `Expected at most one contentinfo landmark on ${template} (${viewport}), found ${contentinfoCount}.`,
        ).toBeLessThanOrEqual(1);
      });
    }
  });

  test('landmark-6 — theme declares html5 navigation-widget support', async ({ page, baseURL }) => {
    const base = baseURL ?? 'http://localhost:8080';
    const response = await page.request.get(`${base}/wp-json/a11y-tests/v1/theme-support`);
    expect(
      response.status(),
      'Expected the theme-support endpoint to respond.',
    ).toBe(200);

    const data = await response.json() as { passed: boolean; reason: string };
    expect(
      data.passed,
      data.reason,
    ).toBe(true);
  });

});
