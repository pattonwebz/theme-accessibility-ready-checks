import type { Page, TestInfo } from '@playwright/test';
import { test, expect, ACTIVE_TEMPLATES } from '../helpers/fixtures';
import type { TemplateName } from '../../src/types/checks';

const ALL_TEMPLATES: TemplateName[] = ACTIVE_TEMPLATES;
const INTERACTIVE_CONTROL_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="combobox"]',
].join(', ');

type ViewportName = 'desktop' | 'mobile';

type ControlAudit = {
  selector: string;
  snippet: string;
  accessibleName: string;
  visibleText: string;
  ariaName: string;
  nameSource: string;
};

type SemanticsFinding = {
  selector: string;
  snippet: string;
  reason: string;
  severity: 'definite' | 'heuristic';
};

type StatefulCandidate = {
  selector: string;
  snippet: string;
  kind: 'aria' | 'details';
  attributes: string[];
};

type TabAuditResult = {
  tablistCount: number;
  issues: string[];
  activationTarget: string | null;
};

type InteractionSnapshot = {
  clickCount: number;
  controlledVisible: boolean | null;
  open: boolean | null;
  attributes: Record<string, string | null>;
};

function getCheckId(viewport: string, checkNumber: number): string {
  return viewport === 'mobile'
    ? `controls-mobile-${checkNumber}`
    : `controls-${checkNumber}`;
}

async function gotoTemplate(page: Page, templateUrl: (name: TemplateName) => string, template: TemplateName): Promise<void> {
  await page.goto(templateUrl(template));
}

async function collectInteractiveControls(page: Page): Promise<ControlAudit[]> {
  return page.evaluate((selector) => {
    const dedupe = <T,>(values: T[]) => [...new Set(values)];

    const snippetFor = (element: Element): string => element.outerHTML.replace(/\s+/g, ' ').trim().slice(0, 200);

    const selectorFor = (element: Element): string => {
      if (element.id) {
        return `#${CSS.escape(element.id)}`;
      }

      const segments: string[] = [];
      let current: Element | null = element;

      while (current && segments.length < 6) {
        let segment = current.localName;
        const usableClasses = [...current.classList].slice(0, 2);
        if (usableClasses.length > 0) {
          segment += usableClasses.map((className) => `.${CSS.escape(className)}`).join('');
        }

        const parent: Element | null = current.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter((child) => child.localName === current?.localName);
          if (siblings.length > 1) {
            segment += `:nth-of-type(${siblings.indexOf(current) + 1})`;
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

    const isHidden = (element: Element | null): boolean => {
      if (!element) return true;
      if (element.hasAttribute('hidden')) return true;
      if (element.getAttribute('aria-hidden') === 'true') return true;

      const htmlElement = element as HTMLElement;
      const style = window.getComputedStyle(htmlElement);
      if (style.display === 'none' || style.visibility === 'hidden') return true;
      if (Number(style.opacity) === 0) return true;

      const rect = htmlElement.getBoundingClientRect();
      return rect.width === 0 && rect.height === 0;
    };

    const textFromTree = (element: Element, includeScreenReaderText: boolean): string => {
      const chunks: string[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);

      while (walker.nextNode()) {
        const textNode = walker.currentNode as Text;
        const parent = textNode.parentElement;
        if (!parent || isHidden(parent)) continue;
        if (!includeScreenReaderText && parent.closest('.screen-reader-text, .sr-only, .visually-hidden')) continue;

        const text = textNode.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        if (text) chunks.push(text);
      }

      return chunks.join(' ').replace(/\s+/g, ' ').trim();
    };

    const accessibleText = (element: Element): string => textFromTree(element, true);
    const visibleText = (element: Element): string => textFromTree(element, false);

    const referencedText = (idRefs: string | null): string => {
      if (!idRefs) return '';
      return idRefs
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter((node): node is HTMLElement => node instanceof HTMLElement)
        .map((node) => accessibleText(node) || node.textContent?.replace(/\s+/g, ' ').trim() || '')
        .filter(Boolean)
        .join(' ')
        .trim();
    };

    const labelText = (element: Element): string => {
      const labels = new Set<string>();
      const labelable = element as HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement;

      if ('labels' in labelable && labelable.labels) {
        for (const label of [...labelable.labels]) {
          const text = accessibleText(label) || label.textContent?.replace(/\s+/g, ' ').trim() || '';
          if (text) labels.add(text);
        }
      }

      const id = (element as HTMLElement).id;
      if (id) {
        for (const label of [...document.querySelectorAll(`label[for="${CSS.escape(id)}"]`)]) {
          const text = accessibleText(label) || label.textContent?.replace(/\s+/g, ' ').trim() || '';
          if (text) labels.add(text);
        }
      }

      const wrappingLabel = element.closest('label');
      if (wrappingLabel) {
        const text = accessibleText(wrappingLabel) || wrappingLabel.textContent?.replace(/\s+/g, ' ').trim() || '';
        if (text) labels.add(text);
      }

      return [...labels].join(' ').trim();
    };

    const imageAlt = (element: Element): string => {
      if (element instanceof HTMLInputElement && element.type === 'image') {
        return element.alt.trim();
      }

      const image = element.querySelector('img[alt]');
      return image?.getAttribute('alt')?.trim() ?? '';
    };

    const controls = dedupe([
      ...document.querySelectorAll(selector),
    ]);

    return controls
      .filter((element): element is HTMLElement => element instanceof HTMLElement)
      .filter((element) => !isHidden(element))
      .map((element) => {
        const labelledBy = referencedText(element.getAttribute('aria-labelledby'));
        const ariaLabel = element.getAttribute('aria-label')?.trim() ?? '';
        const ariaName = labelledBy || ariaLabel;
        const label = labelText(element);
        const text = accessibleText(element);
        const visible = visibleText(element);
        const title = element.getAttribute('title')?.trim() ?? '';
        const alt = imageAlt(element);
        const inputValue =
          element instanceof HTMLInputElement && ['submit', 'button', 'reset'].includes(element.type)
            ? element.value.trim()
            : '';

        let manualName = '';
        let nameSource = 'none';
        for (const [source, value] of [
          ['aria-labelledby', labelledBy],
          ['aria-label', ariaLabel],
          ['label', label],
          ['visible-text', text],
          ['input-value', inputValue],
          ['title', title],
          ['alt', alt],
        ] as const) {
          if (value) {
            manualName = value;
            nameSource = source;
            break;
          }
        }

        let accessibleName = manualName;
        const accessibleApi = element as Element & { computedAccessibleName?: () => string };
        if (typeof accessibleApi.computedAccessibleName === 'function') {
          try {
            const computedName = accessibleApi.computedAccessibleName()?.trim() ?? '';
            if (computedName) {
              accessibleName = computedName;
              nameSource = 'computed-accessible-name';
            }
          } catch {
            // Fall back to manual name sources when the browser API is unavailable.
          }
        }

        return {
          selector: selectorFor(element),
          snippet: snippetFor(element),
          accessibleName,
          visibleText: visible,
          ariaName,
          nameSource,
        };
      });
  }, INTERACTIVE_CONTROL_SELECTOR);
}

async function collectSemanticsFindings(page: Page): Promise<SemanticsFinding[]> {
  return page.evaluate(() => {
    const snippetFor = (element: Element): string => element.outerHTML.replace(/\s+/g, ' ').trim().slice(0, 200);

    const selectorFor = (element: Element): string => {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const segments: string[] = [];
      let current: Element | null = element;

      while (current && segments.length < 6) {
        let segment = current.localName;
        const usableClasses = [...current.classList].slice(0, 2);
        if (usableClasses.length > 0) {
          segment += usableClasses.map((className) => `.${CSS.escape(className)}`).join('');
        }

        const parent: Element | null = current.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter((child) => child.localName === current?.localName);
          if (siblings.length > 1) {
            segment += `:nth-of-type(${siblings.indexOf(current) + 1})`;
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

    const isVisible = (element: HTMLElement): boolean => {
      if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    };

    const findings: SemanticsFinding[] = [];
    const semanticHint = /button|link|menu|tab|toggle|trigger|control|search/i;

    for (const element of [...document.querySelectorAll<HTMLElement>('div, span, p')]) {
      if (!isVisible(element)) continue;
      if (element.closest('a[href], button, input:not([type="hidden"]), select, textarea, [role]')) continue;

      const style = window.getComputedStyle(element);
      const hasPointerCursor = style.cursor === 'pointer';
      const hasInteractiveHint =
        element.tabIndex >= 0
        || element.hasAttribute('onclick')
        || element.hasAttribute('aria-expanded')
        || element.hasAttribute('aria-pressed')
        || semanticHint.test(`${element.className} ${element.id}`);

      if (!hasPointerCursor || !hasInteractiveHint) continue;

      findings.push({
        selector: selectorFor(element),
        snippet: snippetFor(element),
        reason: 'Non-semantic element appears interactive but has no explicit button/link role.',
        severity: element.tabIndex >= 0 || element.hasAttribute('onclick') ? 'definite' : 'heuristic',
      });
    }

    for (const element of [...document.querySelectorAll<HTMLAnchorElement>('a:not([href])')]) {
      if (!isVisible(element)) continue;
      const role = element.getAttribute('role');
      if (role === 'button' || role === 'link') continue;

      const style = window.getComputedStyle(element);
      const hasActivationHint =
        element.tabIndex >= 0
        || element.hasAttribute('onclick')
        || style.cursor === 'pointer'
        || semanticHint.test(`${element.className} ${element.id}`);

      if (!hasActivationHint) continue;

      findings.push({
        selector: selectorFor(element),
        snippet: snippetFor(element),
        reason: 'Anchor without href looks interactive but is missing button/link semantics.',
        severity: 'definite',
      });
    }

    return findings;
  });
}

async function collectRoleButtonCandidates(page: Page): Promise<Array<{ selector: string; snippet: string }>> {
  return page.evaluate(() => {
    const selectorFor = (element: Element): string => {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const segments: string[] = [];
      let current: Element | null = element;

      while (current && segments.length < 6) {
        let segment = current.localName;
        const usableClasses = [...current.classList].slice(0, 2);
        if (usableClasses.length > 0) {
          segment += usableClasses.map((className) => `.${CSS.escape(className)}`).join('');
        }

        const parent: Element | null = current.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter((child) => child.localName === current?.localName);
          if (siblings.length > 1) {
            segment += `:nth-of-type(${siblings.indexOf(current) + 1})`;
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

    const isVisible = (element: HTMLElement): boolean => {
      if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    };

    return [...document.querySelectorAll<HTMLElement>('[role="button"]')]
      .filter((element) => element.tagName.toLowerCase() !== 'button')
      .filter((element) => isVisible(element))
      .map((element) => ({
        selector: selectorFor(element),
        snippet: element.outerHTML.replace(/\s+/g, ' ').trim().slice(0, 200),
      }));
  });
}

async function collectStatefulCandidates(page: Page): Promise<StatefulCandidate[]> {
  return page.evaluate(() => {
    const selectorFor = (element: Element): string => {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const segments: string[] = [];
      let current: Element | null = element;

      while (current && segments.length < 6) {
        let segment = current.localName;
        const usableClasses = [...current.classList].slice(0, 2);
        if (usableClasses.length > 0) {
          segment += usableClasses.map((className) => `.${CSS.escape(className)}`).join('');
        }

        const parent: Element | null = current.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter((child) => child.localName === current?.localName);
          if (siblings.length > 1) {
            segment += `:nth-of-type(${siblings.indexOf(current) + 1})`;
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

    const isVisible = (element: HTMLElement): boolean => {
      if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    };

    const candidates: StatefulCandidate[] = [];
    const elements = [...document.querySelectorAll<HTMLElement>('[aria-expanded], [aria-selected], [aria-pressed], [aria-checked]')];

    for (const element of elements) {
      if (!isVisible(element)) continue;
      if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') continue;

      const role = element.getAttribute('role');
      const type = element instanceof HTMLInputElement ? element.type : '';
      const attributes = ['aria-expanded', 'aria-selected', 'aria-pressed', 'aria-checked']
        .filter((attribute) => element.hasAttribute(attribute));

      if (attributes.includes('aria-selected') && role !== 'tab') continue;
      if (attributes.includes('aria-checked') && !['checkbox', 'radio', 'switch'].includes(role ?? '') && !['checkbox', 'radio'].includes(type)) {
        continue;
      }

      candidates.push({
        selector: selectorFor(element),
        snippet: element.outerHTML.replace(/\s+/g, ' ').trim().slice(0, 200),
        kind: 'aria',
        attributes,
      });
    }

    for (const summary of [...document.querySelectorAll<HTMLElement>('details > summary:first-child')]) {
      if (!isVisible(summary)) continue;
      candidates.push({
        selector: selectorFor(summary),
        snippet: summary.outerHTML.replace(/\s+/g, ' ').trim().slice(0, 200),
        kind: 'details',
        attributes: ['open'],
      });
    }

    return candidates;
  });
}

async function readInteractionSnapshot(page: Page, selector: string, kind: 'aria' | 'details' | 'tab' = 'aria'): Promise<InteractionSnapshot | null> {
  return page.evaluate(({ elementSelector, elementKind }) => {
    const isVisible = (element: Element | null): boolean => {
      if (!(element instanceof HTMLElement)) return false;
      if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    };

    const element = document.querySelector<HTMLElement>(elementSelector);
    if (!element) return null;

    const controlledId = element.getAttribute('aria-controls');
    const controlledElement = controlledId ? document.getElementById(controlledId) : null;
    const detailsParent = elementKind === 'details' ? element.closest('details') : null;

    return {
      clickCount: Number(element.getAttribute('data-a11y-click-count') ?? '0'),
      controlledVisible: controlledElement ? isVisible(controlledElement) : null,
      open: detailsParent instanceof HTMLDetailsElement ? detailsParent.open : null,
      attributes: {
        'aria-expanded': element.getAttribute('aria-expanded'),
        'aria-selected': element.getAttribute('aria-selected'),
        'aria-pressed': element.getAttribute('aria-pressed'),
        'aria-checked': element.getAttribute('aria-checked'),
      },
    };
  }, { elementSelector: selector, elementKind: kind });
}

async function armClickWatcher(page: Page, selector: string): Promise<void> {
  await page.evaluate((elementSelector) => {
    const element = document.querySelector<HTMLElement>(elementSelector);
    if (!element) return;

    element.setAttribute('data-a11y-click-count', '0');
    const watchedElement = element as HTMLElement & { __a11yClickWatcherInstalled?: boolean };
    if (watchedElement.__a11yClickWatcherInstalled) return;

    element.addEventListener('click', () => {
      const current = Number(element.getAttribute('data-a11y-click-count') ?? '0');
      element.setAttribute('data-a11y-click-count', String(current + 1));
    });

    watchedElement.__a11yClickWatcherInstalled = true;
  }, selector);
}

async function activateWithKeys(page: Page, selector: string, keys: string[]): Promise<void> {
  const locator = page.locator(selector).first();
  await locator.focus();
  for (const key of keys) {
    await page.keyboard.press(key);
    await page.waitForTimeout(150);
  }
}

async function activateUntilChanged(
  page: Page,
  selector: string,
  kind: 'aria' | 'details',
  keys: string[],
): Promise<InteractionSnapshot | null> {
  const locator = page.locator(selector).first();
  await locator.focus();

  let previous = await readInteractionSnapshot(page, selector, kind);
  for (const key of keys) {
    await page.keyboard.press(key);
    await page.waitForTimeout(150);
    const current = await readInteractionSnapshot(page, selector, kind);
    if (!previous || !current) return current;

    const changedAttribute = Object.keys(current.attributes).some(
      (attribute) => previous?.attributes[attribute] !== current.attributes[attribute],
    );
    if (
      changedAttribute
      || previous.controlledVisible !== current.controlledVisible
      || previous.open !== current.open
    ) {
      return current;
    }

    previous = current;
  }

  return previous;
}

async function collectDisabledButtons(page: Page): Promise<Array<{ selector: string; snippet: string; ariaDisabled: boolean; nativeDisabled: boolean }>> {
  return page.evaluate(() => {
    const selectorFor = (element: Element): string => {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const segments: string[] = [];
      let current: Element | null = element;

      while (current && segments.length < 6) {
        let segment = current.localName;
        const usableClasses = [...current.classList].slice(0, 2);
        if (usableClasses.length > 0) {
          segment += usableClasses.map((className) => `.${CSS.escape(className)}`).join('');
        }

        const parent: Element | null = current.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter((child) => child.localName === current?.localName);
          if (siblings.length > 1) {
            segment += `:nth-of-type(${siblings.indexOf(current) + 1})`;
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

    return [...document.querySelectorAll<HTMLButtonElement>('button')]
      .filter((button) => {
        const style = window.getComputedStyle(button);
        const className = typeof button.className === 'string' ? button.className : '';
        return Number(style.opacity) < 0.5 || style.cursor === 'not-allowed' || /disabled/i.test(className);
      })
      .map((button) => ({
        selector: selectorFor(button),
        snippet: button.outerHTML.replace(/\s+/g, ' ').trim().slice(0, 200),
        ariaDisabled: button.getAttribute('aria-disabled') === 'true',
        nativeDisabled: button.hasAttribute('disabled'),
      }));
  });
}

async function auditTabs(page: Page): Promise<TabAuditResult> {
  return page.evaluate(() => {
    const selectorFor = (element: Element): string => {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const segments: string[] = [];
      let current: Element | null = element;

      while (current && segments.length < 6) {
        let segment = current.localName;
        const usableClasses = [...current.classList].slice(0, 2);
        if (usableClasses.length > 0) {
          segment += usableClasses.map((className) => `.${CSS.escape(className)}`).join('');
        }

        const parent: Element | null = current.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter((child) => child.localName === current?.localName);
          if (siblings.length > 1) {
            segment += `:nth-of-type(${siblings.indexOf(current) + 1})`;
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

    const issues: string[] = [];
    let activationTarget: string | null = null;
    const tablists = [...document.querySelectorAll<HTMLElement>('[role="tablist"]')];

    for (const tablist of tablists) {
      const tablistSelector = selectorFor(tablist);
      const tabs = [...tablist.querySelectorAll<HTMLElement>('[role="tab"]')];
      if (tabs.length === 0) {
        issues.push(`${tablistSelector} has no descendant tabs.`);
        continue;
      }

      const selectedTabs = tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true');
      if (selectedTabs.length !== 1) {
        issues.push(`${tablistSelector} should have exactly one selected tab, found ${selectedTabs.length}.`);
      }

      for (const tab of tabs) {
        const tabSelector = selectorFor(tab);
        if (!tab.hasAttribute('aria-selected')) {
          issues.push(`${tabSelector} is missing aria-selected.`);
        }

        const panelId = tab.getAttribute('aria-controls');
        let panel: Element | null = null;
        if (panelId) {
          panel = document.getElementById(panelId);
        } else if (tab.id) {
          panel = document.querySelector(`[role="tabpanel"][aria-labelledby="${CSS.escape(tab.id)}"]`);
        }

        if (!panel || panel.getAttribute('role') !== 'tabpanel') {
          issues.push(`${tabSelector} is not associated with a role="tabpanel" element.`);
        }

        if (!activationTarget && tab.getAttribute('aria-selected') !== 'true') {
          activationTarget = tabSelector;
        }
      }
    }

    return {
      tablistCount: tablists.length,
      issues,
      activationTarget,
    };
  });
}

async function readTabActivation(page: Page, selector: string): Promise<{ selected: string | null; selectedCount: number; panelVisible: boolean | null } | null> {
  return page.evaluate((elementSelector) => {
    const isVisible = (element: Element | null): boolean => {
      if (!(element instanceof HTMLElement)) return false;
      if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    };

    const tab = document.querySelector<HTMLElement>(elementSelector);
    if (!tab) return null;

    const tablist = tab.closest('[role="tablist"]');
    const tabs = tablist ? [...tablist.querySelectorAll<HTMLElement>('[role="tab"]')] : [];
    const panelId = tab.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : (tab.id ? document.querySelector(`[role="tabpanel"][aria-labelledby="${CSS.escape(tab.id)}"]`) : null);

    return {
      selected: tab.getAttribute('aria-selected'),
      selectedCount: tabs.filter((item) => item.getAttribute('aria-selected') === 'true').length,
      panelVisible: panel ? isVisible(panel) : null,
    };
  }, selector);
}

async function attachFindings(testInfo: TestInfo, name: string, payload: unknown): Promise<void> {
  await testInfo.attach(name, {
    body: Buffer.from(JSON.stringify(payload, null, 2)),
    contentType: 'application/json',
  });
}

async function highlightAndCaptureUnnamedControls(
  page: Page,
  testInfo: TestInfo,
  unnamedControls: ControlAudit[],
): Promise<void> {
  await page.evaluate((controls) => {
    const color = '#e53e3e';

    controls.forEach((control, index) => {
      const element = document.querySelector(control.selector);
      if (!(element instanceof HTMLElement)) return;

      element.style.outline = `4px solid ${color}`;
      element.style.outlineOffset = '-4px';
      element.style.position = 'relative';

      const badge = document.createElement('span');
      badge.setAttribute('data-a11y-control-badge', '');
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
      badge.textContent = `no name (#${index + 1})`;
      element.prepend(badge);
    });
  }, unnamedControls);

  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach('controls-1-unnamed-controls.png', {
    body: screenshot,
    contentType: 'image/png',
  });
}

async function highlightAndCaptureSemanticViolations(
  page: Page,
  testInfo: TestInfo,
  findings: SemanticsFinding[],
): Promise<void> {
  await page.evaluate((items) => {
    const color = '#805ad5';

    items.forEach((finding) => {
      const element = document.querySelector(finding.selector);
      if (!(element instanceof HTMLElement)) return;

      let label = finding.reason;
      if (label.length > 50) {
        label = `${label.slice(0, 47)}...`;
      }

      element.style.outline = `4px solid ${color}`;
      element.style.outlineOffset = '-4px';
      element.style.position = 'relative';

      const badge = document.createElement('span');
      badge.setAttribute('data-a11y-control-badge', '');
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
      badge.textContent = label;
      element.prepend(badge);
    });
  }, findings);

  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach('controls-2-semantic-violations.png', {
    body: screenshot,
    contentType: 'image/png',
  });
}

async function highlightAndCaptureMismatches(
  page: Page,
  testInfo: TestInfo,
  mismatches: ControlAudit[],
): Promise<void> {
  await page.evaluate((controls) => {
    const color = '#dd6b20';

    controls.forEach((control, index) => {
      const element = document.querySelector(control.selector);
      if (!(element instanceof HTMLElement)) return;

      element.style.outline = `4px solid ${color}`;
      element.style.outlineOffset = '-4px';
      element.style.position = 'relative';

      const badge = document.createElement('span');
      badge.setAttribute('data-a11y-control-badge', '');
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
      badge.textContent = `mismatch (#${index + 1})`;
      element.prepend(badge);
    });
  }, mismatches);

  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach('controls-3-aria-mismatches.png', {
    body: screenshot,
    contentType: 'image/png',
  });
}

async function highlightAndCaptureFailedButtons(
  page: Page,
  testInfo: TestInfo,
  failedSelectors: string[],
): Promise<void> {
  await page.evaluate((selectors) => {
    const color = '#3182ce';

    selectors.forEach((selector, index) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return;

      element.style.outline = `4px solid ${color}`;
      element.style.outlineOffset = '-4px';
      element.style.position = 'relative';

      const badge = document.createElement('span');
      badge.setAttribute('data-a11y-control-badge', '');
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
      badge.textContent = `Space failed (#${index + 1})`;
      element.prepend(badge);
    });
  }, failedSelectors);

  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach('controls-4-role-button-space.png', {
    body: screenshot,
    contentType: 'image/png',
  });
}

async function highlightAndCaptureStatefulFailures(
  page: Page,
  testInfo: TestInfo,
  failedSelectors: string[],
): Promise<void> {
  await page.evaluate((selectors) => {
    const color = '#2f855a';

    selectors.forEach((selector, index) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return;

      element.style.outline = `4px solid ${color}`;
      element.style.outlineOffset = '-4px';
      element.style.position = 'relative';

      const badge = document.createElement('span');
      badge.setAttribute('data-a11y-control-badge', '');
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
      badge.textContent = `state not updated (#${index + 1})`;
      element.prepend(badge);
    });
  }, failedSelectors);

  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach('controls-5-stateful-failures.png', {
    body: screenshot,
    contentType: 'image/png',
  });
}

async function highlightAndCaptureDisabledButtons(
  page: Page,
  testInfo: TestInfo,
  selectors: string[],
): Promise<void> {
  await page.evaluate((failedSelectors) => {
    const color = '#b7791f';

    failedSelectors.forEach((selector, index) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return;

      element.style.outline = `4px solid ${color}`;
      element.style.outlineOffset = '-4px';
      element.style.position = 'relative';

      const badge = document.createElement('span');
      badge.setAttribute('data-a11y-control-badge', '');
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
      badge.textContent = `missing disabled (#${index + 1})`;
      element.prepend(badge);
    });
  }, selectors);

  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach('controls-6-disabled-buttons.png', {
    body: screenshot,
    contentType: 'image/png',
  });
}

/**
 * Check 04: Controls
 * Check IDs: controls-1..7, controls-mobile-1..7
 * Templates: all 8
 * Viewports: desktop + mobile
 * Tool: Playwright DOM evaluation + keyboard interaction checks
 */
test.describe('check-04: controls', () => {
  test.describe('controls-1 / controls-mobile-1 — all interactive controls have a non-empty accessible name', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name as ViewportName;
        const checkId = getCheckId(viewport, 1);
        await gotoTemplate(page, templateUrl, template);

        const controls = await collectInteractiveControls(page);
        const unnamedControls = controls.filter((control) => !control.accessibleName.trim());

        if (unnamedControls.length > 0) {
          await highlightAndCaptureUnnamedControls(page, testInfo, unnamedControls);
        }

        expect(
          unnamedControls,
          `${checkId} expected every interactive control on ${template} (${viewport}) to expose a non-empty accessible name. Missing names: ${unnamedControls.map((control) => `${control.selector} [${control.snippet}]`).join(', ')}`,
        ).toHaveLength(0);
      });
    }
  });

  test.describe('controls-2 / controls-mobile-2 — controls have appropriate semantic roles', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name as ViewportName;
        const checkId = getCheckId(viewport, 2);
        await gotoTemplate(page, templateUrl, template);

        const findings = await collectSemanticsFindings(page);
        const definiteViolations = findings.filter((finding) => finding.severity === 'definite');
        const heuristicFindings = findings.filter((finding) => finding.severity === 'heuristic');

        if (heuristicFindings.length > 0) {
          await attachFindings(testInfo, `${checkId}-${template}-heuristics.json`, heuristicFindings);
        }

        if (definiteViolations.length > 0) {
          await highlightAndCaptureSemanticViolations(page, testInfo, definiteViolations);
        }

        expect(
          definiteViolations,
          `${checkId} found controls with missing semantics on ${template} (${viewport}). ${definiteViolations.map((finding) => `${finding.selector}: ${finding.reason}`).join(', ')}`,
        ).toHaveLength(0);
      });
    }
  });

  test.describe('controls-3 / controls-mobile-3 — ARIA label begins with visible text where both exist', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name as ViewportName;
        const checkId = getCheckId(viewport, 3);
        await gotoTemplate(page, templateUrl, template);

        const controls = await collectInteractiveControls(page);
        const normalize = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();
        const mismatches = controls.filter((control) => {
          const visibleText = normalize(control.visibleText);
          const ariaName = normalize(control.ariaName);
          return visibleText && ariaName && !ariaName.startsWith(visibleText);
        });

        if (mismatches.length > 0) {
          await highlightAndCaptureMismatches(page, testInfo, mismatches);
        }

        expect(
          mismatches,
          `${checkId} expected ARIA names to begin with visible text on ${template} (${viewport}). Mismatches: ${mismatches.map((control) => `${control.selector} [visible="${control.visibleText}" aria="${control.ariaName}"]`).join(', ')}`,
        ).toHaveLength(0);
      });
    }
  });

  test.describe('controls-4 / controls-mobile-4 — elements with role="button" are operable with Spacebar', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name as ViewportName;
        const checkId = getCheckId(viewport, 4);
        await gotoTemplate(page, templateUrl, template);

        const candidates = await collectRoleButtonCandidates(page);
        test.skip(candidates.length === 0, `${checkId} not applicable: no non-native role="button" elements found on ${template} (${viewport}).`);

        const failures: string[] = [];
        const failedCandidates: Array<{ selector: string }> = [];

        for (const candidate of candidates) {
          await armClickWatcher(page, candidate.selector);
          const before = await readInteractionSnapshot(page, candidate.selector);

          try {
            await activateWithKeys(page, candidate.selector, ['Space']);
          } catch (error) {
            failures.push(`${candidate.selector} could not be focused and activated with Space (${String(error)}).`);
            failedCandidates.push({ selector: candidate.selector });
            continue;
          }

          const after = await readInteractionSnapshot(page, candidate.selector);
          if (!before || !after) {
            failures.push(`${candidate.selector} disappeared before activation could be verified.`);
            failedCandidates.push({ selector: candidate.selector });
            continue;
          }

          const changedAttribute = Object.keys(after.attributes).some(
            (attribute) => before.attributes[attribute] !== after.attributes[attribute],
          );
          const activated =
            after.clickCount > before.clickCount
            || changedAttribute
            || before.controlledVisible !== after.controlledVisible
            || before.open !== after.open;

          if (!activated) {
            failures.push(`${candidate.selector} did not expose any click/state change after Space. Snippet: ${candidate.snippet}`);
            failedCandidates.push({ selector: candidate.selector });
          }
        }

        if (failures.length > 0) {
          await highlightAndCaptureFailedButtons(page, testInfo, failedCandidates.map((candidate) => candidate.selector));
        }

        expect(
          failures,
          `${checkId} expected every non-native role="button" on ${template} (${viewport}) to respond to Space. ${failures.join(' ')}`,
        ).toHaveLength(0);
      });
    }
  });

  test.describe('controls-5 / controls-mobile-5 — state changes are reflected in ARIA attributes', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name as ViewportName;
        const checkId = getCheckId(viewport, 5);
        await gotoTemplate(page, templateUrl, template);

        const candidates = await collectStatefulCandidates(page);
        test.skip(candidates.length === 0, `${checkId} not applicable: no stateful controls found on ${template} (${viewport}).`);

        const failures: string[] = [];
        const failedCandidates: Array<{ selector: string }> = [];

        for (const candidate of candidates) {
          await armClickWatcher(page, candidate.selector);
          const before = await readInteractionSnapshot(page, candidate.selector, candidate.kind);

          let after: InteractionSnapshot | null = null;
          try {
            after = await activateUntilChanged(page, candidate.selector, candidate.kind, ['Space', 'Enter']);
          } catch (error) {
            failures.push(`${candidate.selector} could not be activated (${String(error)}).`);
            failedCandidates.push({ selector: candidate.selector });
            continue;
          }

          if (!before || !after) {
            failures.push(`${candidate.selector} disappeared before state could be re-read.`);
            failedCandidates.push({ selector: candidate.selector });
            continue;
          }

          const attributeChanged = candidate.attributes.some((attribute) => before.attributes[attribute] !== after.attributes[attribute]);
          const stateChanged =
            attributeChanged
            || before.controlledVisible !== after.controlledVisible
            || before.open !== after.open;

          if (!stateChanged) {
            failures.push(`${candidate.selector} did not expose a state change after activation. Snippet: ${candidate.snippet}`);
            failedCandidates.push({ selector: candidate.selector });
          }
        }

        if (failures.length > 0) {
          await highlightAndCaptureStatefulFailures(page, testInfo, failedCandidates.map((candidate) => candidate.selector));
        }

        expect(
          failures,
          `${checkId} expected stateful controls on ${template} (${viewport}) to update their state. ${failures.join(' ')}`,
        ).toHaveLength(0);
      });
    }
  });

  test.describe('controls-6 / controls-mobile-6 — visually disabled buttons use the disabled attribute', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name as ViewportName;
        const checkId = getCheckId(viewport, 6);
        await gotoTemplate(page, templateUrl, template);

        const buttons = await collectDisabledButtons(page);
        test.skip(buttons.length === 0, `${checkId} not applicable: no visually disabled buttons found on ${template} (${viewport}).`);

        const ariaDisabledOnly = buttons.filter((button) => button.ariaDisabled && !button.nativeDisabled);
        if (ariaDisabledOnly.length > 0) {
          await attachFindings(testInfo, `${checkId}-${template}-aria-disabled-only.json`, ariaDisabledOnly);
        }

        const missingDisabledAttribute = await page.evaluate((selectors) => {
          return selectors.filter((selector) => {
            const button = document.querySelector<HTMLButtonElement>(selector);
            return button ? !button.hasAttribute('disabled') : true;
          });
        }, buttons.map((button) => button.selector));

        if (missingDisabledAttribute.length > 0) {
          await highlightAndCaptureDisabledButtons(page, testInfo, missingDisabledAttribute);
        }

        expect(
          missingDisabledAttribute,
          `${checkId} expected visually disabled buttons on ${template} (${viewport}) to carry the disabled attribute. Missing: ${missingDisabledAttribute.join(', ')}`,
        ).toHaveLength(0);
      });
    }
  });

  test.describe('controls-7 / controls-mobile-7 — tab components are correctly structured', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name as ViewportName;
        const checkId = getCheckId(viewport, 7);
        await gotoTemplate(page, templateUrl, template);

        const tabAudit = await auditTabs(page);
        test.skip(tabAudit.tablistCount === 0, `${checkId} not applicable: no tab components found on ${template} (${viewport}).`);

        if (tabAudit.issues.length > 0) {
          await attachFindings(testInfo, `${checkId}-${template}-tab-issues.json`, tabAudit.issues);
        }

        expect(
          tabAudit.issues,
          `${checkId} found tab structure issues on ${template} (${viewport}). ${tabAudit.issues.join(' ')}`,
        ).toHaveLength(0);

        if (!tabAudit.activationTarget) {
          return;
        }

        const before = await readTabActivation(page, tabAudit.activationTarget);
        await page.locator(tabAudit.activationTarget).first().click();
        await page.waitForTimeout(150);
        const after = await readTabActivation(page, tabAudit.activationTarget);

        expect(before, `${checkId} expected to resolve a tab activation target before interaction.`).not.toBeNull();
        expect(after, `${checkId} expected the activated tab to remain in the DOM after interaction.`).not.toBeNull();
        expect(after?.selected, `${checkId} expected the activated tab to become selected on ${template} (${viewport}).`).toBe('true');
        expect(after?.selectedCount, `${checkId} expected exactly one selected tab after activating ${tabAudit.activationTarget} on ${template} (${viewport}).`).toBe(1);
        expect(after?.panelVisible ?? true, `${checkId} expected the activated tab panel to be visible for ${tabAudit.activationTarget} on ${template} (${viewport}).`).toBe(true);
      });
    }
  });
});
