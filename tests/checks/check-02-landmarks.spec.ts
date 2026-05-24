import type { Page, TestInfo } from '@playwright/test';
import { test, expect, ACTIVE_TEMPLATES } from '../helpers/fixtures';

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

    function toInfo(el: Element): { tag: string; id: string; classes: string; role: string; snippet: string } {
      const clone = el.cloneNode(false) as Element;
      return {
        tag: el.tagName.toLowerCase(),
        id: el.getAttribute('id') ?? '',
        classes: el.getAttribute('class') ?? '',
        role: el.getAttribute('role') ?? '',
        snippet: clone.outerHTML,
      };
    }

    const bannerEls = new Set([
      ...[...document.querySelectorAll('header')].filter(
        (el) => !el.closest(SECTIONING),
      ),
      ...document.querySelectorAll('[role="banner"]'),
    ]);

    const mainEls = new Set([
      ...document.querySelectorAll('main'),
      ...document.querySelectorAll('[role="main"]'),
    ]);

    const contentinfoEls = new Set([
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
      bannerCount:       bannerEls.size,
      bannerElements:    [...bannerEls].map(toInfo),
      mainCount:         mainEls.size,
      mainElements:      [...mainEls].map(toInfo),
      contentinfoCount:  contentinfoEls.size,
      contentinfoElements: [...contentinfoEls].map(toInfo),
      navCount:          navs.length,
      navsWithoutNames,
      navLikeElements,
    };
  });
}

/**
 * Highlight duplicate landmark elements on the page and attach a screenshot.
 * Adds a visual outline and a floating label for each duplicate instance.
 */
async function highlightAndCaptureDuplicates(
  page: Page,
  testInfo: TestInfo,
  duplicateTypes: Array<'banner' | 'main' | 'contentinfo'>,
): Promise<void> {
  await page.evaluate((types) => {
    const SECTIONING = 'article, aside, main, nav, section';
    const colors: Record<string, string> = {
      banner:      '#e53e3e',
      main:        '#3182ce',
      contentinfo: '#dd6b20',
    };
    const labelNames: Record<string, string> = {
      banner:      'banner',
      main:        'main',
      contentinfo: 'contentinfo',
    };

    const getEls = (type: string): Element[] => {
      if (type === 'banner') {
        return [
          ...[...document.querySelectorAll('header')].filter((el) => !el.closest(SECTIONING)),
          ...document.querySelectorAll('[role="banner"]'),
        ];
      }
      if (type === 'main') {
        return [
          ...document.querySelectorAll('main'),
          ...document.querySelectorAll('[role="main"]'),
        ];
      }
      // contentinfo
      return [
        ...[...document.querySelectorAll('footer')].filter((el) => !el.closest(SECTIONING)),
        ...document.querySelectorAll('[role="contentinfo"]'),
      ];
    };

    for (const type of types) {
      const els = getEls(type);
      const color = colors[type];
      els.forEach((el, i) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.outline = `4px solid ${color}`;
        htmlEl.style.outlineOffset = '-4px';
        htmlEl.style.position = 'relative';

        const badge = document.createElement('span');
        badge.setAttribute('data-a11y-duplicate-badge', '');
        badge.style.cssText = [
          'position:absolute',
          'top:4px',
          'left:4px',
          `background:${color}`,
          'color:#fff',
          'font:bold 11px/1 monospace',
          'padding:2px 6px',
          'border-radius:3px',
          'z-index:2147483647',
          'pointer-events:none',
          'white-space:nowrap',
        ].join(';');
        badge.textContent = `duplicate ${labelNames[type]} #${i + 1}`;
        el.prepend(badge);
      });
    }
  }, duplicateTypes);

  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach('duplicate-landmarks.png', {
    body: screenshot,
    contentType: 'image/png',
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

        if (navCount === 0) {
          testInfo.annotations.push({
            type: 'info',
            description: `No nav landmarks found on ${template} (${viewport}) — check passes vacuously.`,
          });
        }

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
        const {
          bannerCount, bannerElements,
          mainCount, mainElements,
          contentinfoCount, contentinfoElements,
        } = await getLandmarkCounts(page);

        const duplicateTypes: Array<'banner' | 'main' | 'contentinfo'> = [];

        if (bannerCount > 1) {
          duplicateTypes.push('banner');
          bannerElements.forEach((el, i) => {
            testInfo.annotations.push({
              type: 'duplicate-banner',
              description: `banner #${i + 1} — <${el.tag}${el.id ? ` id="${el.id}"` : ''}${el.classes ? ` class="${el.classes}"` : ''}${el.role ? ` role="${el.role}"` : ''}>`,
            });
          });
        }

        if (mainCount > 1) {
          duplicateTypes.push('main');
          mainElements.forEach((el, i) => {
            testInfo.annotations.push({
              type: 'duplicate-main',
              description: `main #${i + 1} — <${el.tag}${el.id ? ` id="${el.id}"` : ''}${el.classes ? ` class="${el.classes}"` : ''}${el.role ? ` role="${el.role}"` : ''}>`,
            });
          });
        }

        if (contentinfoCount > 1) {
          duplicateTypes.push('contentinfo');
          contentinfoElements.forEach((el, i) => {
            testInfo.annotations.push({
              type: 'duplicate-contentinfo',
              description: `contentinfo #${i + 1} — <${el.tag}${el.id ? ` id="${el.id}"` : ''}${el.classes ? ` class="${el.classes}"` : ''}${el.role ? ` role="${el.role}"` : ''}>`,
            });
          });
        }

        if (duplicateTypes.length > 0) {
          await highlightAndCaptureDuplicates(page, testInfo, duplicateTypes);
        }

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

  test('landmark-6 — theme declares html5 navigation-widget support', async ({ page, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'REST endpoint check — only needs to run once, skipped on mobile project.');
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
