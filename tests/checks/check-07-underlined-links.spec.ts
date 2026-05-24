import type { Page } from '@playwright/test';
import { test, expect, ACTIVE_TEMPLATES } from '../helpers/fixtures';
import type { TemplateName } from '../../src/types/checks';

/**
 * Check 07: Underlined Links
 * Check ID: link-underline-1
 * Templates: post-with-comments, page-markup, block-patterns
 * Viewports: desktop only (visual styling check — computed styles are viewport-independent
 *            for text-decoration, but desktop is the canonical rendering target)
 * WCAG: 1.4.1 Use of Color
 *
 * Links within body/content text must be underlined so users who cannot rely
 * on colour alone can identify links. The check enforces `text-decoration-line: underline`
 * via computed styles; alternative non-colour indicators are not currently detected.
 */

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const CHECK_TEMPLATES: TemplateName[] = ['post-with-comments', 'page-markup', 'block-patterns'];

/**
 * Intersect with ACTIVE_TEMPLATES so that env-var filtering still works, while
 * also ensuring we only run on templates that have body-text content.
 */
const TEMPLATES = ACTIVE_TEMPLATES.filter((t) => CHECK_TEMPLATES.includes(t));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContentLinkInfo = {
  href: string;
  text: string;
  textDecorationLine: string;
  selector: string;
  html: string;
};

type LinkUnderlineResult = {
  violations: ContentLinkInfo[];
  checkedCount: number;
  skippedCount: number;
  contentRootSelector: string | null;
};

// ---------------------------------------------------------------------------
// DOM helper — runs inside page.evaluate()
// ---------------------------------------------------------------------------

/**
 * Walk the content area of the page and check every visible, text-bearing link
 * for `text-decoration-line: underline`.
 *
 * Exclusions:
 *  - Links inside <nav>, <header>, or <footer> (navigation/chrome links)
 *  - Links with no visible text content
 *  - Links hidden via display:none or visibility:hidden
 */
async function getContentLinkStyles(page: Page): Promise<LinkUnderlineResult> {
  return page.evaluate((): LinkUnderlineResult => {
    // Ordered list of content-area selectors — first match wins.
    const CONTENT_SELECTORS = [
      'main .entry-content',
      '.entry-content',
      'main .wp-block-post-content',
      '.wp-block-post-content',
      '.post-content',
      '.page-content',
      'main article',
      'main',
    ];

    let contentRoot: Element | null = null;
    let contentRootSelector: string | null = null;

    for (const selector of CONTENT_SELECTORS) {
      const el = document.querySelector(selector);
      if (el) {
        contentRoot = el;
        contentRootSelector = selector;
        break;
      }
    }

    if (!contentRoot) {
      return { violations: [], checkedCount: 0, skippedCount: 0, contentRootSelector: null };
    }

    const links = [...contentRoot.querySelectorAll('a[href]')] as HTMLAnchorElement[];

    const violations: ContentLinkInfo[] = [];
    let checkedCount = 0;
    let skippedCount = 0;

    for (const link of links) {
      // Skip navigation / chrome links
      if (link.closest('nav') || link.closest('header') || link.closest('footer')) {
        skippedCount++;
        continue;
      }

      // Skip links with no visible text (e.g. icon-only links)
      const text = (link.textContent ?? '').trim();
      if (!text) {
        skippedCount++;
        continue;
      }

      // Skip visually hidden links — checkVisibility() checks the element AND all
      // ancestors for display:none, visibility:hidden, opacity:0, content-visibility:hidden,
      // zero-sized/clipped sr-only patterns, and the HTML `hidden` attribute.
      if (!link.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
        skippedCount++;
        continue;
      }

      const computed = window.getComputedStyle(link);

      checkedCount++;

      const textDecorationLine = computed.textDecorationLine;

      if (!textDecorationLine.includes('underline')) {
        const id = link.id ? `#${link.id}` : '';
        const classes = [...link.classList].slice(0, 3).map((c) => `.${c}`).join('');
        const selector = `a${id}${classes}`;

        // Shallow clone — no children, avoids serialising large subtrees
        const clone = link.cloneNode(false) as Element;

        violations.push({
          href: link.getAttribute('href') ?? '',
          text: text.slice(0, 80),
          textDecorationLine,
          selector,
          html: clone.outerHTML.slice(0, 200),
        });
      }
    }

    return { violations, checkedCount, skippedCount, contentRootSelector };
  });
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function isDesktop(testInfo: { project: { name: string } }): boolean {
  return testInfo.project.name === 'desktop';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('check-07: underlined links', () => {
  for (const template of TEMPLATES) {
    test(`link-underline-1 — body text links are underlined on ${template} [desktop]`, async (
      { page, templateUrl },
      testInfo,
    ) => {
      // Visual styling check — only meaningful on desktop rendering
      if (!isDesktop(testInfo)) test.skip();

      await page.goto(templateUrl(template));

      const result = await getContentLinkStyles(page);

      // Annotate which content root was matched for debugging
      if (result.contentRootSelector) {
        testInfo.annotations.push({
          type: 'info',
          description: `Content root matched: ${result.contentRootSelector}`,
        });
      }

      // If no body-text links exist on this template, there is nothing to fail.
      if (result.checkedCount === 0) {
        testInfo.annotations.push({
          type: 'not-applicable',
          description:
            `No visible, text-bearing content links found on ${template} — ` +
            `check passes vacuously. ` +
            (result.contentRootSelector
              ? `Content root: ${result.contentRootSelector}. `
              : 'No content root matched. ') +
            `${result.skippedCount} link(s) excluded (nav/header/footer or empty).`,
        });
        return;
      }

      const violationSummary = result.violations
        .map((v) => `"${v.text}" [${v.selector}] textDecorationLine="${v.textDecorationLine}"`)
        .join(' | ');

      expect(
        result.violations,
        `Expected all body text links on ${template} (desktop) to have text-decoration-line: underline` +
        ` (WCAG 1.4.1 Use of Color). ` +
        `${result.violations.length} of ${result.checkedCount} link(s) lack underline: ${violationSummary}`,
      ).toHaveLength(0);
    });
  }
});
