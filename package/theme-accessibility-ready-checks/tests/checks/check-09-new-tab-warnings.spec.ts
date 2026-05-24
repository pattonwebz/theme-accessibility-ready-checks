import { test, expect, ACTIVE_TEMPLATES } from '../helpers/fixtures';
import { recordResult } from '../helpers/result-collector';
import type { CheckResult, ViolationDetail } from '../../src/types/checks';

type LinkWarningAnalysis = {
  selector: string;
  snippet: string;
  accessibleText: string;
  adjacentText: string;
  hasWarning: boolean;
};

const WARNING_PATTERN = /\b(?:new tab|new window|opens? in(?: a)? new (?:tab|window))\b/i;

async function findTargetBlankLinksWithoutWarnings(page: import('@playwright/test').Page): Promise<ViolationDetail[]> {
  const findings = await page.evaluate<LinkWarningAnalysis[]>(({ warningPatternSource, warningPatternFlags }) => {
    const warningPattern = new RegExp(warningPatternSource, warningPatternFlags);

    const normalizeWhitespace = (value: string | null | undefined): string =>
      (value ?? '').replace(/\s+/g, ' ').trim();

    const shortHtml = (value: string): string => normalizeWhitespace(value).slice(0, 200);

    const snippetFor = (element: Element): string => shortHtml(element.outerHTML);

    const selectorFor = (element: Element): string => {
      if (element instanceof HTMLElement && element.id) {
        return `${element.tagName.toLowerCase()}#${CSS.escape(element.id)}`;
      }

      const segments: string[] = [];
      let current: Element | null = element;

      while (current && segments.length < 6) {
        let segment = current.tagName.toLowerCase();
        const classes = Array.from(current.classList).slice(0, 2);
        if (classes.length > 0) {
          segment += classes.map((className) => `.${CSS.escape(className)}`).join('');
        }

        const parent = current.parentElement;
        if (parent) {
          const sameTagSiblings = Array.from(parent.children).filter((child) => child.tagName === current?.tagName);
          if (sameTagSiblings.length > 1) {
            segment += `:nth-of-type(${sameTagSiblings.indexOf(current) + 1})`;
          }
        }

        segments.unshift(segment);
        if (parent?.id) {
          segments.unshift(`#${CSS.escape(parent.id)}`);
          break;
        }

        current = parent;
      }

      return segments.join(' > ');
    };

    const getIdRefText = (refs: string | null): string => normalizeWhitespace(
      (refs ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' '),
    );

    const isIgnoredNode = (node: Element): boolean =>
      node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true';

    const getNodeText = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent ?? '';
      }

      if (!(node instanceof Element) || isIgnoredNode(node)) {
        return '';
      }

      const ariaLabel = normalizeWhitespace(node.getAttribute('aria-label'));
      if (ariaLabel) {
        return ariaLabel;
      }

      const labelledBy = getIdRefText(node.getAttribute('aria-labelledby'));
      if (labelledBy) {
        return labelledBy;
      }

      const title = normalizeWhitespace(node.getAttribute('title'));
      if (title) {
        return title;
      }

      if (node instanceof HTMLImageElement) {
        return normalizeWhitespace(node.alt);
      }

      if (node instanceof SVGElement) {
        const titleEl = node.querySelector(':scope > title');
        if (titleEl?.textContent) {
          return normalizeWhitespace(titleEl.textContent);
        }
      }

      return Array.from(node.childNodes).map((child) => getNodeText(child)).join(' ');
    };

    const textFor = (element: Element): string => {
      const explicitLabel = normalizeWhitespace(element.getAttribute('aria-label'));
      if (explicitLabel) {
        return explicitLabel;
      }

      const labelledBy = getIdRefText(element.getAttribute('aria-labelledby'));
      if (labelledBy) {
        return labelledBy;
      }

      const describedBy = getIdRefText(element.getAttribute('aria-describedby'));
      const title = normalizeWhitespace(element.getAttribute('title'));
      const visible = normalizeWhitespace(getNodeText(element));

      return normalizeWhitespace([visible, title, describedBy].filter(Boolean).join(' '));
    };

    const adjacentTextFor = (link: HTMLAnchorElement): string => {
      const adjacentTexts: string[] = [];
      const parent = link.parentElement;

      const pushText = (element: Element | null) => {
        if (!element || element === link || isIgnoredNode(element)) {
          return;
        }

        const text = textFor(element);
        if (text) {
          adjacentTexts.push(text);
        }
      };

      pushText(link.previousElementSibling);
      pushText(link.nextElementSibling);

      if (parent) {
        for (const sibling of Array.from(parent.children)) {
          if (sibling === link) {
            continue;
          }

          const className = sibling.getAttribute('class') ?? '';
          const looksLikeAuxiliaryWarning = /screen-reader|screenreader|sr-only|visually-hidden|assistive|icon/i.test(className)
            || sibling.hasAttribute('aria-label')
            || sibling.hasAttribute('title')
            || sibling.getAttribute('role') === 'img';

          if (looksLikeAuxiliaryWarning) {
            pushText(sibling);
          }
        }
      }

      return normalizeWhitespace(adjacentTexts.join(' '));
    };

    return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[target="_blank" i]')).map((link) => {
      const accessibleText = textFor(link);
      const adjacentText = adjacentTextFor(link);
      return {
        selector: selectorFor(link),
        snippet: snippetFor(link),
        accessibleText,
        adjacentText,
        hasWarning: warningPattern.test(accessibleText) || warningPattern.test(adjacentText),
      };
    });
  }, {
    warningPatternSource: WARNING_PATTERN.source,
    warningPatternFlags: WARNING_PATTERN.flags,
  });

  return findings
    .filter((finding) => !finding.hasWarning)
    .map<ViolationDetail>((finding) => ({
      selector: finding.selector,
      snippet: finding.snippet,
      message: `Link opens in a new tab without warning. Accessible text: "${finding.accessibleText || 'none'}". Adjacent warning text: "${finding.adjacentText || 'none'}".`,
    }));
}

test.describe('check-09: new tab warnings', () => {
  for (const templateName of ACTIVE_TEMPLATES) {
    test(
      `new-tab-1 — no target="_blank" links without warnings on ${templateName}`,
      async ({ page, templateUrl }, testInfo) => {
        testInfo.skip(
          testInfo.project.name !== 'desktop',
          'New tab warning check is a desktop-only check',
        );

        await page.goto(templateUrl(templateName));

        const violations = await findTargetBlankLinksWithoutWarnings(page);

        const result: CheckResult = violations.length === 0
          ? {
              checkId: 'new-tab-1',
              template: templateName,
              viewport: 'desktop',
              status: 'pass',
            }
          : {
              checkId: 'new-tab-1',
              template: templateName,
              viewport: 'desktop',
              status: 'fail',
              violations,
              message: `Found ${violations.length} link(s) opening in new tab without warning`,
            };

        recordResult(result);
        expect(violations, `All target="_blank" links should include a new-tab warning on ${templateName}.`).toHaveLength(0);
      },
    );
  }
});
