import { test, expect } from '../helpers/fixtures';
import { recordResult } from '../helpers/result-collector';
import type { CheckResult, ViolationDetail } from '../../src/types/checks';

type ScreenReaderTextSnapshot = {
  domCount: number;
  stylesheetMatchCount: number;
  stylesheetErrors: string[];
  inspectedSource: 'dom' | 'injected';
  textSnippet: string;
  styles: {
    display: string;
    visibility: string;
    position: string;
    width: string;
    height: string;
    overflowX: string;
    overflowY: string;
    clip: string;
    clipPath: string;
    webkitClipPath: string;
    whiteSpace: string;
    left: string;
    top: string;
  };
};

function isAtMostOnePixel(value: string): boolean {
  const numericValue = Number.parseFloat(value);
  return Number.isFinite(numericValue) && numericValue <= 1;
}

function isNegativeOffscreen(value: string): boolean {
  const numericValue = Number.parseFloat(value);
  return Number.isFinite(numericValue) && numericValue <= -999;
}

function hasClipping(styles: ScreenReaderTextSnapshot['styles']): boolean {
  return /rect\(/.test(styles.clip) || /inset\(/.test(styles.clipPath) || /inset\(/.test(styles.webkitClipPath);
}

test.describe('check-16: screen reader text', () => {
  test(
    'screen-reader-text-1 — .screen-reader-text class exists and is visually hidden but accessible',
    async ({ page, templateUrl }, testInfo) => {
      testInfo.skip(testInfo.project.name !== 'desktop', 'Screen reader text check is desktop-only');

      await page.goto(templateUrl('front-page'));

      const snapshot = await page.evaluate<ScreenReaderTextSnapshot>(() => {
        const stylesheetErrors: string[] = [];

        const ruleContainsScreenReaderText = (selectorText: string): boolean => /(?:^|[\s,>+~])\.screen-reader-text(?:[^a-zA-Z0-9_-]|$)/.test(selectorText);

        const countMatchingRules = (rules: CSSRuleList): number => {
          let matches = 0;

          for (const rule of Array.from(rules)) {
            if (rule instanceof CSSStyleRule && ruleContainsScreenReaderText(rule.selectorText)) {
              matches += 1;
              continue;
            }

            if ('cssRules' in rule) {
              matches += countMatchingRules(rule.cssRules);
            }
          }

          return matches;
        };

        let stylesheetMatchCount = 0;

        for (const sheet of Array.from(document.styleSheets)) {
          try {
            stylesheetMatchCount += countMatchingRules(sheet.cssRules);
          } catch (error) {
            stylesheetErrors.push(error instanceof Error ? error.message : String(error));
          }
        }

        const existingElements = Array.from(document.querySelectorAll<HTMLElement>('.screen-reader-text'));
        const inspectedElement = existingElements[0] ?? (() => {
          const injectedElement = document.createElement('span');
          injectedElement.className = 'screen-reader-text';
          injectedElement.textContent = 'screen reader text test';
          document.body.appendChild(injectedElement);
          return injectedElement;
        })();

        const computedStyles = window.getComputedStyle(inspectedElement);
        const snapshot: ScreenReaderTextSnapshot = {
          domCount: existingElements.length,
          stylesheetMatchCount,
          stylesheetErrors,
          inspectedSource: existingElements.length > 0 ? 'dom' : 'injected',
          textSnippet: inspectedElement.textContent?.trim().slice(0, 80) ?? '',
          styles: {
            display: computedStyles.display,
            visibility: computedStyles.visibility,
            position: computedStyles.position,
            width: computedStyles.width,
            height: computedStyles.height,
            overflowX: computedStyles.overflowX,
            overflowY: computedStyles.overflowY,
            clip: computedStyles.clip,
            clipPath: computedStyles.clipPath,
            webkitClipPath: computedStyles.getPropertyValue('-webkit-clip-path'),
            whiteSpace: computedStyles.whiteSpace,
            left: computedStyles.left,
            top: computedStyles.top,
          },
        };

        if (existingElements.length === 0) {
          inspectedElement.remove();
        }

        return snapshot;
      });

      const violations: ViolationDetail[] = [];
      const { styles } = snapshot;
      const hasStylesheetDefinition = snapshot.stylesheetMatchCount > 0;
      const hasDomElement = snapshot.domCount > 0;
      const hasMinimalBox = (styles.position === 'absolute' || styles.position === 'fixed')
        && isAtMostOnePixel(styles.width)
        && isAtMostOnePixel(styles.height)
        && styles.overflowX === 'hidden'
        && styles.overflowY === 'hidden';
      const hasSecondaryHidingTechnique = hasClipping(styles)
        || styles.whiteSpace === 'nowrap'
        || isNegativeOffscreen(styles.left)
        || isNegativeOffscreen(styles.top);
      const isVisuallyHidden = hasMinimalBox && hasSecondaryHidingTechnique;

      if (!hasDomElement) {
        violations.push({
          selector: '.screen-reader-text',
          message: 'No .screen-reader-text element was found on the page.',
          wcag: '1.3.1',
        });
      } else {
        if (!hasStylesheetDefinition) {
          violations.push({
            selector: '.screen-reader-text',
            message: 'The .screen-reader-text class was not found in any accessible stylesheet on the page.',
            wcag: '1.3.1',
          });
        }

        if (styles.display === 'none') {
          violations.push({
            selector: '.screen-reader-text',
            snippet: snapshot.textSnippet,
            message: '.screen-reader-text uses display:none, which hides content from screen readers.',
            wcag: '1.3.1',
          });
        }

        if (styles.visibility === 'hidden') {
          violations.push({
            selector: '.screen-reader-text',
            snippet: snapshot.textSnippet,
            message: '.screen-reader-text uses visibility:hidden, which hides content from screen readers.',
            wcag: '1.3.1',
          });
        }

        if (!isVisuallyHidden) {
          violations.push({
            selector: '.screen-reader-text',
            snippet: snapshot.textSnippet,
            message: `Computed styles did not match a supported visually-hidden pattern. Received position=${styles.position}, width=${styles.width}, height=${styles.height}, overflowX=${styles.overflowX}, overflowY=${styles.overflowY}, clip=${styles.clip}, clipPath=${styles.clipPath}, whiteSpace=${styles.whiteSpace}, left=${styles.left}, top=${styles.top}.`,
            wcag: '1.3.1',
          });
        }

        if (snapshot.stylesheetErrors.length > 0 && !hasStylesheetDefinition) {
          violations.push({
            selector: '.screen-reader-text',
            message: `Unable to inspect one or more stylesheets while looking for .screen-reader-text: ${snapshot.stylesheetErrors.join('; ')}`,
            wcag: '1.3.1',
          });
        }
      }

      const result: CheckResult = {
        checkId: 'screen-reader-text-1',
        template: 'front-page',
        viewport: 'desktop',
        status: violations.length === 0 ? 'pass' : 'fail',
        ...(violations.length > 0 ? { detail: violations } : {}),
      };

      recordResult(result);
      expect(result.status).toBe('pass');
    },
  );
});
