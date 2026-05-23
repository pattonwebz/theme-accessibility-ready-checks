import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/fixtures';
import type { TemplateName } from '../../src/types/checks';
import { TEMPLATE_PATHS } from '../../src/types/checks';

const ALL_TEMPLATES = Object.keys(TEMPLATE_PATHS) as TemplateName[];

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

    return {
      bannerCount:     banners.size,
      mainCount:       mains.size,
      contentinfoCount: contentinfos.size,
      navCount:        navs.length,
      navsWithoutNames,
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

  test('landmark-6 — classic theme declares html5 navigation-widget support', async ({ page, baseURL }) => {
    const base = baseURL ?? 'http://localhost:8080';
    const response = await page.request.get(`${base}/wp-json/a11y-tests/v1/theme-support`);
    expect(
      response.status(),
      'Expected theme support data for landmark-6.',
    ).toBe(200);

    const body = await response.text();
    const payload = body.match(/\{[\s\S]*\}$/)?.[0];

    expect(
      payload,
      'Expected theme support data to include a JSON object payload.',
    ).toBeTruthy();

    const data = JSON.parse(payload ?? '{}') as {
      html5: unknown;
      is_block_theme?: boolean;
      has_functions_php?: boolean;
    };

    if (data.is_block_theme === true) {
      test.info().skip(
        'Not applicable for block themes: WordPress core auto-registers default HTML5 support and this handbook check applies to classic themes.',
      );
    }

    if (data.has_functions_php === false) {
      test.info().skip('Not applicable when the active theme has no functions.php file.');
    }

    const html5Support = Array.isArray(data.html5) ? data.html5 : [];
    expect(
      html5Support,
      'Expected the active classic theme to include navigation-widgets in add_theme_support("html5", [...]).',
    ).toContain('navigation-widgets');
  });

});
