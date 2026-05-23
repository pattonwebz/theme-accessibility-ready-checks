import type { Page } from '@playwright/test';
import { test, expect, ACTIVE_TEMPLATES } from '../helpers/fixtures';
import { TEMPLATE_PATHS } from '../../src/types/checks';
import type { TemplateName } from '../../src/types/checks';

type HeadingSummary = {
  level: number | null;
  text: string;
  selector: string;
  html: string;
};

type EmptyHeadingIssue = HeadingSummary;

type SkippedLevelIssue = {
  previous: HeadingSummary;
  current: HeadingSummary;
};

type SectionIssue = {
  selector: string;
  html: string;
};

type StylingWarning = {
  selector: string;
  text: string;
  reason: string;
  html: string;
};

type HeadingsAnalysis = {
  h1s: HeadingSummary[];
  emptyHeadings: EmptyHeadingIssue[];
  skippedLevelIssues: SkippedLevelIssue[];
  sectionIssues: SectionIssue[];
  applicableSectionCount: number;
  ignoredEmptySectionCount: number;
  stylingWarnings: StylingWarning[];
};

async function analyzeHeadings(page: Page): Promise<HeadingsAnalysis> {
  return page.evaluate(() => {
    const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
    const H1_SELECTOR = 'h1, [role="heading"][aria-level="1"]';
    const SECTION_SELECTOR = 'aside, footer, [role="complementary"], .widget-area, .sidebar, .footer-widgets';

    const normalizeWhitespace = (value: string | null | undefined): string =>
      (value ?? '').replace(/\s+/g, ' ').trim();

    const snippet = (element: Element): string => normalizeWhitespace(element.outerHTML).slice(0, 200);

    const selectorFor = (element: Element): string => {
      const tag = element.tagName.toLowerCase();
      const id = element.id ? `#${element.id}` : '';
      const classes = [...element.classList].slice(0, 3).map((className) => `.${className}`).join('');
      return `${tag}${id}${classes}`;
    };

    const getIdRefText = (refs: string | null): string => normalizeWhitespace(
      (refs ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' '),
    );

    const getElementLabel = (element: Element): string => {
      const ariaLabel = normalizeWhitespace(element.getAttribute('aria-label'));
      if (ariaLabel) return ariaLabel;

      const labelledBy = getIdRefText(element.getAttribute('aria-labelledby'));
      if (labelledBy) return labelledBy;

      return '';
    };

    const getNodeText = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent ?? '';
      }

      if (!(node instanceof Element)) {
        return '';
      }

      if (node.getAttribute('aria-hidden') === 'true' || node.hasAttribute('hidden')) {
        return '';
      }

      const label = getElementLabel(node);
      if (label) {
        return label;
      }

      if (node instanceof HTMLImageElement) {
        return node.alt ?? '';
      }

      if (node instanceof SVGElement) {
        const title = node.querySelector(':scope > title');
        if (title?.textContent) {
          return title.textContent;
        }
      }

      return [...node.childNodes].map((child) => getNodeText(child)).join(' ');
    };

    const textFor = (element: Element): string => {
      const label = getElementLabel(element);
      if (label) {
        return label;
      }

      return normalizeWhitespace(getNodeText(element));
    };

    const levelFor = (element: Element): number | null => {
      const tag = element.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        return Number(tag.slice(1));
      }

      const ariaLevel = Number(element.getAttribute('aria-level'));
      return Number.isInteger(ariaLevel) && ariaLevel >= 1 && ariaLevel <= 6 ? ariaLevel : null;
    };

    const summarize = (element: Element): HeadingSummary => ({
      level: levelFor(element),
      text: textFor(element),
      selector: selectorFor(element),
      html: snippet(element),
    });

    const hasMeaningfulContent = (element: Element): boolean => {
      if (textFor(element)) {
        return true;
      }

      return Boolean(
        element.querySelector(
          'img[alt]:not([alt=""]), svg[aria-label], svg[aria-labelledby], svg title, a[href], button, input, select, textarea, iframe, video, audio',
        ),
      );
    };

    const headings = [...document.querySelectorAll(HEADING_SELECTOR)];
    const h1s = [...document.querySelectorAll(H1_SELECTOR)].map((element) => summarize(element));

    const emptyHeadings = headings
      .filter((element) => !textFor(element))
      .map((element) => summarize(element));

    const validHeadings = headings
      .map((element) => ({ element, summary: summarize(element) }))
      .filter(({ summary }) => summary.level !== null) as Array<{ element: Element; summary: HeadingSummary & { level: number } }>;

    const skippedLevelIssues: SkippedLevelIssue[] = [];
    for (let index = 1; index < validHeadings.length; index += 1) {
      const previous = validHeadings[index - 1].summary;
      const current = validHeadings[index].summary;

      if (current.level > previous.level + 1) {
        skippedLevelIssues.push({ previous, current });
      }
    }

    const sections = [...new Set([...document.querySelectorAll(SECTION_SELECTOR)])];
    const applicableSections = sections.filter((section) => hasMeaningfulContent(section));
    const sectionIssues = applicableSections
      .filter((section) => {
        const hasHeading = [...section.querySelectorAll(HEADING_SELECTOR)].some((heading) => Boolean(textFor(heading)));
        return !hasHeading && !getElementLabel(section);
      })
      .map((section) => ({
        selector: selectorFor(section),
        html: snippet(section),
      }));

    const hasMeaningfulPreviousSibling = (element: Element): boolean => {
      let sibling = element.previousElementSibling;
      while (sibling) {
        if (hasMeaningfulContent(sibling)) {
          return true;
        }
        sibling = sibling.previousElementSibling;
      }
      return false;
    };

    const stylingWarnings: StylingWarning[] = [];

    for (const heading of headings) {
      const summary = summarize(heading);

      if (heading.closest('blockquote')) {
        stylingWarnings.push({
          selector: summary.selector,
          text: summary.text,
          reason: 'Heading appears inside a <blockquote>.',
          html: summary.html,
        });
      }

      const wordCount = summary.text.split(/\s+/).filter(Boolean).length;
      if (summary.text && wordCount > 0 && wordCount < 3 && hasMeaningfulPreviousSibling(heading)) {
        stylingWarnings.push({
          selector: summary.selector,
          text: summary.text,
          reason: 'Short heading appears mid-content and may be present only for styling.',
          html: summary.html,
        });
      }
    }

    for (let index = 1; index < validHeadings.length; index += 1) {
      const previous = validHeadings[index - 1];
      const current = validHeadings[index];

      if (previous.summary.level !== current.summary.level) {
        continue;
      }

      if (previous.element.parentElement !== current.element.parentElement) {
        continue;
      }

      let node = previous.element.nextSibling;
      let hasContentBetween = false;
      while (node && node !== current.element) {
        if (node.nodeType === Node.TEXT_NODE && normalizeWhitespace(node.textContent)) {
          hasContentBetween = true;
          break;
        }

        if (node instanceof Element && hasMeaningfulContent(node)) {
          hasContentBetween = true;
          break;
        }

        node = node.nextSibling;
      }

      if (!hasContentBetween && node === current.element) {
        stylingWarnings.push({
          selector: current.summary.selector,
          text: current.summary.text,
          reason: 'Consecutive same-level headings appear without intervening body content.',
          html: current.summary.html,
        });
      }
    }

    return {
      h1s,
      emptyHeadings,
      skippedLevelIssues,
      sectionIssues,
      applicableSectionCount: applicableSections.length,
      ignoredEmptySectionCount: sections.length - applicableSections.length,
      stylingWarnings,
    };
  });
}

async function getNormalizedH1Texts(page: Page): Promise<string[]> {
  const analysis = await analyzeHeadings(page);
  return analysis.h1s.map((heading) => heading.text).filter(Boolean);
}

function isViewport(testInfo: { project: { name: string } }, viewport: 'desktop' | 'mobile'): boolean {
  return testInfo.project.name === viewport;
}

for (const template of ACTIVE_TEMPLATES) {
  test.describe(`check-06 / headings / ${template}`, () => {
    test.beforeEach(async ({ page, templateUrl }) => {
      await page.goto(templateUrl(template));
    });

    test('headings-1: page contains at least one H1 [desktop]', async ({ page }, testInfo) => {
      if (!isViewport(testInfo, 'desktop')) test.skip();

      const analysis = await analyzeHeadings(page);
      expect(
        analysis.h1s.length,
        `Expected at least one H1 or role="heading" aria-level="1" on ${template} (desktop).`,
      ).toBeGreaterThanOrEqual(1);
    });

    test('headings-1: page contains at least one H1 [mobile]', async ({ page }, testInfo) => {
      if (!isViewport(testInfo, 'mobile')) test.skip();

      const analysis = await analyzeHeadings(page);
      expect(
        analysis.h1s.length,
        `Expected at least one H1 or role="heading" aria-level="1" on ${template} (mobile).`,
      ).toBeGreaterThanOrEqual(1);
    });

    test('headings-2: page contains exactly one H1 [desktop]', async ({ page }, testInfo) => {
      if (!isViewport(testInfo, 'desktop')) test.skip();

      const analysis = await analyzeHeadings(page);
      expect(
        analysis.h1s.length,
        `Expected exactly one H1 on ${template} (desktop). Found ${analysis.h1s.length}: ${analysis.h1s.map((heading) => heading.text || heading.selector).join(', ')}`,
      ).toBe(1);
    });

    test('headings-2: page contains exactly one H1 [mobile]', async ({ page }, testInfo) => {
      if (!isViewport(testInfo, 'mobile')) test.skip();

      const analysis = await analyzeHeadings(page);
      expect(
        analysis.h1s.length,
        `Expected exactly one H1 on ${template} (mobile). Found ${analysis.h1s.length}: ${analysis.h1s.map((heading) => heading.text || heading.selector).join(', ')}`,
      ).toBe(1);
    });

    test('headings-3: no empty heading elements [desktop]', async ({ page }, testInfo) => {
      if (!isViewport(testInfo, 'desktop')) test.skip();

      const analysis = await analyzeHeadings(page);
      expect(
        analysis.emptyHeadings,
        `Expected all headings on ${template} (desktop) to have an accessible name. Empty headings: ${analysis.emptyHeadings.map((heading) => `${heading.selector} => ${heading.html}`).join(' | ')}`,
      ).toHaveLength(0);
    });

    test('headings-3: no empty heading elements [mobile]', async ({ page }, testInfo) => {
      if (!isViewport(testInfo, 'mobile')) test.skip();

      const analysis = await analyzeHeadings(page);
      expect(
        analysis.emptyHeadings,
        `Expected all headings on ${template} (mobile) to have an accessible name. Empty headings: ${analysis.emptyHeadings.map((heading) => `${heading.selector} => ${heading.html}`).join(' | ')}`,
      ).toHaveLength(0);
    });

    test('headings-4: heading levels do not skip when descending [desktop]', async ({ page }, testInfo) => {
      if (!isViewport(testInfo, 'desktop')) test.skip();

      const analysis = await analyzeHeadings(page);
      expect(
        analysis.skippedLevelIssues,
        `Expected descending heading levels on ${template} (desktop) to increase by one only. Violations: ${analysis.skippedLevelIssues.map(({ previous, current }) => `${previous.text || previous.selector} (h${previous.level}) -> ${current.text || current.selector} (h${current.level})`).join(' | ')}`,
      ).toHaveLength(0);
    });

    test('headings-4: heading levels do not skip when descending [mobile]', async ({ page }, testInfo) => {
      if (!isViewport(testInfo, 'mobile')) test.skip();

      const analysis = await analyzeHeadings(page);
      expect(
        analysis.skippedLevelIssues,
        `Expected descending heading levels on ${template} (mobile) to increase by one only. Violations: ${analysis.skippedLevelIssues.map(({ previous, current }) => `${previous.text || previous.selector} (h${previous.level}) -> ${current.text || current.selector} (h${current.level})`).join(' | ')}`,
      ).toHaveLength(0);
    });

    test('headings-6: major theme sections have headings or named landmarks [desktop]', async ({ page }, testInfo) => {
      if (!isViewport(testInfo, 'desktop')) test.skip();

      testInfo.annotations.push({
        type: 'note',
        description: 'Automated heuristic detection — verify any failures manually, as false positives are possible with these selectors.',
      });

      const analysis = await analyzeHeadings(page);
      if (analysis.applicableSectionCount === 0) {
        testInfo.annotations.push({
          type: 'not-applicable',
          description: 'No non-empty major sections matched the heuristic selectors on this template.',
        });
        return;
      }

      expect(
        analysis.sectionIssues,
        `Expected major sections on ${template} (desktop) to contain a heading or have an accessible name. Empty sections ignored: ${analysis.ignoredEmptySectionCount}. Issues: ${analysis.sectionIssues.map((section) => `${section.selector} => ${section.html}`).join(' | ')}`,
      ).toHaveLength(0);
    });

    test('headings-6: major theme sections have headings or named landmarks [mobile]', async ({ page }, testInfo) => {
      if (!isViewport(testInfo, 'mobile')) test.skip();

      testInfo.annotations.push({
        type: 'note',
        description: 'Automated heuristic detection — verify any failures manually, as false positives are possible with these selectors.',
      });

      const analysis = await analyzeHeadings(page);
      if (analysis.applicableSectionCount === 0) {
        testInfo.annotations.push({
          type: 'not-applicable',
          description: 'No non-empty major sections matched the heuristic selectors on this template.',
        });
        return;
      }

      expect(
        analysis.sectionIssues,
        `Expected major sections on ${template} (mobile) to contain a heading or have an accessible name. Empty sections ignored: ${analysis.ignoredEmptySectionCount}. Issues: ${analysis.sectionIssues.map((section) => `${section.selector} => ${section.html}`).join(' | ')}`,
      ).toHaveLength(0);
    });

    test('headings-7: headings not used purely for visual styling [desktop]', async ({ page }, testInfo) => {
      if (!isViewport(testInfo, 'desktop')) test.skip();

      testInfo.annotations.push({
        type: 'note',
        description: 'Manual review recommended — this check only raises heuristic warnings.',
      });

      const analysis = await analyzeHeadings(page);
      if (analysis.stylingWarnings.length > 0) {
        testInfo.annotations.push({
          type: 'warning',
          description: analysis.stylingWarnings.map((warning) => `${warning.reason} ${warning.selector}${warning.text ? ` ("${warning.text}")` : ''}`).join(' | '),
        });
      }
    });

    test.skip('headings-8: heading content relates to following content [desktop]', async ({}, testInfo) => {
      if (!isViewport(testInfo, 'desktop')) test.skip();
      test.skip(true, 'Requires manual content review — cannot be determined programmatically');
    });

    test.skip('headings-8: heading content relates to following content [mobile]', async ({}, testInfo) => {
      if (!isViewport(testInfo, 'mobile')) test.skip();
      test.skip(true, 'Requires manual content review — cannot be determined programmatically');
    });
  });
}

test.describe('check-06 / headings / cross-template checks', () => {
  test('headings-5: H1 is not identical across all non-home templates [desktop]', async ({ browser, baseURL }, testInfo) => {
    if (!isViewport(testInfo, 'desktop')) test.skip();

    const templates = ACTIVE_TEMPLATES.filter((template): template is Exclude<TemplateName, 'front-page'> => template !== 'front-page');
    if (templates.length < 2) {
      test.skip(true, 'Need at least two non-home templates to compare H1 text across templates.');
    }

    const base = baseURL ?? 'http://localhost:8080';
    const h1ByTemplate = new Map<TemplateName, string>();

    for (const template of templates) {
      const page = await browser.newPage({ baseURL: base });
      await page.goto(`${base}${TEMPLATE_PATHS[template]}`);
      const texts = await getNormalizedH1Texts(page);
      h1ByTemplate.set(template, texts.join(' | '));
      await page.close();
    }

    const uniqueH1s = new Set([...h1ByTemplate.values()].filter(Boolean));
    expect(
      uniqueH1s.size,
      `Expected non-home templates to not all share the same H1. Collected H1s: ${[...h1ByTemplate.entries()].map(([template, text]) => `${template}: ${text || '(missing)'}`).join(' | ')}`,
    ).toBeGreaterThan(1);
  });
});
