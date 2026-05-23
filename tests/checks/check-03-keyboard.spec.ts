import type { Page, TestInfo } from '@playwright/test';
import { test, expect, ACTIVE_TEMPLATES } from '../helpers/fixtures';
import type { TemplateName } from '../../src/types/checks';

const ALL_TEMPLATES = ACTIVE_TEMPLATES;
const MAX_TAB_STEPS = 200;
const TAB_DELAY_MS = 200;
const SAME_ROW_THRESHOLD = 20;
const OBVIOUS_VISUAL_REGRESSION_PX = 100;
const KEY_ATTR = 'data-a11y-keyboard-id';
const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="combobox"]',
  '[role="textbox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
].join(', ');

type Rect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type InteractiveCandidate = {
  key: string;
  selector: string;
  snippet: string;
  tagName: string;
  role: string | null;
  type: string | null;
  text: string;
  groupKey: string | null;
  hiddenReasons: string[];
  rect: Rect;
  href: string | null;
};

type FocusIndicator = {
  hasVisibleIndicator: boolean;
  outlineWidth: number;
  outlineStyle: string;
  outlineColor: string;
  boxShadow: string;
  borderWidths: [number, number, number, number];
  borderStyles: [string, string, string, string];
  borderColors: [string, string, string, string];
};

type FocusSnapshot = {
  key: string | null;
  selector: string;
  snippet: string;
  tagName: string;
  role: string | null;
  text: string;
  hiddenReasons: string[];
  zeroSized: boolean;
  rect: Rect | null;
  indicator: FocusIndicator | null;
  fullyObscured: boolean;
  partiallyObscured: boolean;
  obscuredBy: string | null;
};

type TabSweep = {
  expected: InteractiveCandidate[];
  hidden: InteractiveCandidate[];
  steps: FocusSnapshot[];
  uniqueOrder: string[];
  uniqueSteps: FocusSnapshot[];
  trapSnapshots: FocusSnapshot[];
  wrapped: boolean;
};

type DisclosureTrigger = {
  key: string;
  selector: string;
  panelSelector: string;
};

type ModalTarget = {
  triggerKey: string | null;
  triggerSelector: string | null;
  dialogSelector: string;
};

function getCheckId(viewport: string, checkNumber: number): string {
  return viewport === 'mobile'
    ? `keyboard-mobile-${checkNumber}`
    : `keyboard-${checkNumber}`;
}

function describeFocusable(element: Pick<InteractiveCandidate, 'selector' | 'snippet' | 'text'>): string {
  return `${element.selector}${element.text ? ` (${element.text})` : ''}${element.snippet ? ` :: ${element.snippet}` : ''}`;
}

function dedupeExpectedCandidates(candidates: InteractiveCandidate[]): InteractiveCandidate[] {
  const seen = new Set<string>();
  const deduped: InteractiveCandidate[] = [];

  for (const candidate of candidates) {
    const groupOrKey = candidate.groupKey ?? candidate.key;
    if (seen.has(groupOrKey)) {
      continue;
    }

    seen.add(groupOrKey);
    deduped.push(candidate);
  }

  return deduped;
}

async function prepareForKeyboardTraversal(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
  });
}

async function getInteractiveCandidates(page: Page): Promise<{
  expected: InteractiveCandidate[];
  hidden: InteractiveCandidate[];
}> {
  const candidates = await page.evaluate<InteractiveCandidate[]>(({ interactiveSelector, keyAttr }) => {
    const win = window as Window & { __a11yKeyboardCounter?: number };
    win.__a11yKeyboardCounter ??= 0;

    const ensureKey = (element: Element): string => {
      let key = element.getAttribute(keyAttr);
      if (!key) {
        win.__a11yKeyboardCounter += 1;
        key = `a11y-keyboard-${win.__a11yKeyboardCounter}`;
        element.setAttribute(keyAttr, key);
      }
      return key;
    };

    const shortText = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const shortHtml = (value: string): string => value.replace(/\s+/g, ' ').trim().slice(0, 200);

    const selectorFor = (element: Element): string => {
      const id = element.getAttribute('id');
      if (id) {
        return `${element.tagName.toLowerCase()}#${id}`;
      }
      return `${element.tagName.toLowerCase()}[${keyAttr}="${ensureKey(element)}"]`;
    };

    const rectFor = (element: Element): Rect => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };

    const getClosedDetailsAncestor = (element: Element): Element | null => {
      let current = element.parentElement;
      while (current) {
        if (current instanceof HTMLDetailsElement && !current.open) {
          const summary = current.querySelector('summary');
          if (!summary || !summary.contains(element)) {
            return current;
          }
        }
        current = current.parentElement;
      }
      return null;
    };

    const getCollapsedAncestor = (element: Element): Element | null => {
      let current = element.parentElement;
      while (current) {
        if (current.getAttribute('aria-expanded') === 'false') {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    };

    const hiddenReasonsFor = (element: Element): string[] => {
      const reasons: string[] = [];
      let current: Element | null = element;

      while (current) {
        if (current.getAttribute('aria-hidden') === 'true') {
          reasons.push(`aria-hidden ancestor: ${selectorFor(current)}`);
          break;
        }

        const style = window.getComputedStyle(current);
        if (style.display === 'none') {
          reasons.push(`display:none ancestor: ${selectorFor(current)}`);
          break;
        }
        if (style.visibility === 'hidden') {
          reasons.push(`visibility:hidden ancestor: ${selectorFor(current)}`);
          break;
        }

        current = current.parentElement;
      }

      const closedDetails = getClosedDetailsAncestor(element);
      if (closedDetails) {
        reasons.push(`inside closed details: ${selectorFor(closedDetails)}`);
      }

      const collapsedAncestor = getCollapsedAncestor(element);
      if (collapsedAncestor) {
        reasons.push(`inside collapsed disclosure: ${selectorFor(collapsedAncestor)}`);
      }

      return reasons;
    };

    const groupKeyFor = (element: Element): string | null => {
      const role = element.getAttribute('role');
      const tagName = element.tagName.toLowerCase();

      if (element instanceof HTMLInputElement && element.type === 'radio') {
        const name = element.name.trim();
        if (name) {
          return `radio:${name}`;
        }
      }

      if (role === 'radio') {
        const group = element.closest('[role="radiogroup"]');
        if (group) {
          return `radio-group:${ensureKey(group)}`;
        }
      }

      if (role === 'tab' || tagName === 'summary') {
        const tablist = element.closest('[role="tablist"], details');
        if (tablist) {
          return `tab-group:${ensureKey(tablist)}`;
        }
      }

      return null;
    };

    const interactiveRoles = new Set([
      'button',
      'link',
      'checkbox',
      'radio',
      'switch',
      'tab',
      'menuitem',
      'option',
      'combobox',
      'textbox',
      'slider',
      'spinbutton',
    ]);

    const isTabbable = (element: Element): boolean => {
      const tabindexAttr = element.getAttribute('tabindex');
      const tabindex = tabindexAttr === null ? null : Number.parseInt(tabindexAttr, 10);
      if (tabindex !== null && tabindex < 0) {
        return false;
      }

      if (element instanceof HTMLInputElement && element.type === 'hidden') {
        return false;
      }

      if (
        element.matches('a[href], button:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary')
        || (element instanceof HTMLInputElement && !element.disabled)
      ) {
        return true;
      }

      const role = element.getAttribute('role');
      if (role && interactiveRoles.has(role)) {
        return tabindex !== null && tabindex >= 0;
      }

      return tabindex !== null && tabindex >= 0;
    };

    const elements = [...document.querySelectorAll(interactiveSelector)]
      .filter((element, index, all) => all.indexOf(element) === index)
      .filter((element) => {
        const role = element.getAttribute('role');
        return (role === null || interactiveRoles.has(role)) && isTabbable(element);
      });

    return elements.map((element) => ({
      key: ensureKey(element),
      selector: selectorFor(element),
      snippet: shortHtml((element.cloneNode(false) as Element).outerHTML),
      tagName: element.tagName.toLowerCase(),
      role: element.getAttribute('role'),
      type: element instanceof HTMLInputElement ? element.type : null,
      text: shortText((element as HTMLElement).innerText || element.textContent || element.getAttribute('aria-label')),
      groupKey: groupKeyFor(element),
      hiddenReasons: hiddenReasonsFor(element),
      rect: rectFor(element),
      href: element instanceof HTMLAnchorElement ? element.getAttribute('href') : null,
    }));
  }, { interactiveSelector: INTERACTIVE_SELECTOR, keyAttr: KEY_ATTR });

  return {
    expected: dedupeExpectedCandidates(candidates.filter((candidate) => candidate.hiddenReasons.length === 0)),
    hidden: candidates.filter((candidate) => candidate.hiddenReasons.length > 0),
  };
}

async function getFocusSnapshot(page: Page): Promise<FocusSnapshot> {
  return page.evaluate<FocusSnapshot, { keyAttr: string }>(({ keyAttr }) => {
    const win = window as Window & { __a11yKeyboardCounter?: number };
    win.__a11yKeyboardCounter ??= 0;

    const ensureKey = (element: Element): string => {
      let key = element.getAttribute(keyAttr);
      if (!key) {
        win.__a11yKeyboardCounter += 1;
        key = `a11y-keyboard-${win.__a11yKeyboardCounter}`;
        element.setAttribute(keyAttr, key);
      }
      return key;
    };

    const selectorFor = (element: Element): string => {
      const id = element.getAttribute('id');
      if (id) {
        return `${element.tagName.toLowerCase()}#${id}`;
      }
      return `${element.tagName.toLowerCase()}[${keyAttr}="${ensureKey(element)}"]`;
    };

    const hiddenReasonsFor = (element: Element): string[] => {
      const reasons: string[] = [];
      let current: Element | null = element;

      while (current) {
        if (current.getAttribute('aria-hidden') === 'true') {
          reasons.push(`aria-hidden ancestor: ${selectorFor(current)}`);
          break;
        }

        const style = window.getComputedStyle(current);
        if (style.display === 'none') {
          reasons.push(`display:none ancestor: ${selectorFor(current)}`);
          break;
        }
        if (style.visibility === 'hidden') {
          reasons.push(`visibility:hidden ancestor: ${selectorFor(current)}`);
          break;
        }

        current = current.parentElement;
      }

      let detailsParent = element.parentElement;
      while (detailsParent) {
        if (detailsParent instanceof HTMLDetailsElement && !detailsParent.open) {
          const summary = detailsParent.querySelector('summary');
          if (!summary || !summary.contains(element)) {
            reasons.push(`inside closed details: ${selectorFor(detailsParent)}`);
            break;
          }
        }
        detailsParent = detailsParent.parentElement;
      }

      let disclosureParent = element.parentElement;
      while (disclosureParent) {
        if (disclosureParent.getAttribute('aria-expanded') === 'false') {
          reasons.push(`inside collapsed disclosure: ${selectorFor(disclosureParent)}`);
          break;
        }
        disclosureParent = disclosureParent.parentElement;
      }

      return reasons;
    };

    const shortHtml = (value: string): string => value.replace(/\s+/g, ' ').trim().slice(0, 200);
    const shortText = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const active = document.activeElement;

    if (!(active instanceof HTMLElement) || active === document.body) {
      return {
        key: null,
        selector: active ? active.tagName.toLowerCase() : 'none',
        snippet: active ? shortHtml(active.outerHTML) : '',
        tagName: active ? active.tagName.toLowerCase() : 'none',
        role: active?.getAttribute?.('role') ?? null,
        text: active ? shortText(active.innerText || active.textContent) : '',
        hiddenReasons: [],
        zeroSized: false,
        rect: null,
        indicator: null,
        fullyObscured: false,
        partiallyObscured: false,
        obscuredBy: null,
      };
    }

    const style = window.getComputedStyle(active);
    const rect = active.getBoundingClientRect();
    const points = [
      [rect.left + rect.width / 2, rect.top + rect.height / 2],
      [rect.left + 1, rect.top + 1],
      [rect.right - 1, rect.top + 1],
      [rect.left + 1, rect.bottom - 1],
      [rect.right - 1, rect.bottom - 1],
    ].filter(([x, y]) => Number.isFinite(x)
      && Number.isFinite(y)
      && x >= 0
      && y >= 0
      && x < window.innerWidth
      && y < window.innerHeight);

    let visiblePointCount = 0;
    let obscuredBy: string | null = null;
    for (const [x, y] of points) {
      const top = document.elementFromPoint(x, y);
      if (top && (top === active || active.contains(top))) {
        visiblePointCount += 1;
      } else if (!obscuredBy && top instanceof Element) {
        obscuredBy = selectorFor(top);
      }
    }

    const borderWidths: [number, number, number, number] = [
      parseFloat(style.borderTopWidth) || 0,
      parseFloat(style.borderRightWidth) || 0,
      parseFloat(style.borderBottomWidth) || 0,
      parseFloat(style.borderLeftWidth) || 0,
    ];
    const borderStyles: [string, string, string, string] = [
      style.borderTopStyle,
      style.borderRightStyle,
      style.borderBottomStyle,
      style.borderLeftStyle,
    ];
    const borderColors: [string, string, string, string] = [
      style.borderTopColor,
      style.borderRightColor,
      style.borderBottomColor,
      style.borderLeftColor,
    ];

    const indicator: FocusIndicator = {
      hasVisibleIndicator: (
        (parseFloat(style.outlineWidth) || 0) > 0
          && style.outlineStyle !== 'none'
          && style.outlineColor !== 'transparent'
      ) || (
        style.boxShadow !== 'none'
          && style.boxShadow.trim() !== ''
      ) || borderWidths.some((width, index) => width > 0
        && borderStyles[index] !== 'none'
        && borderColors[index] !== 'transparent'),
      outlineWidth: parseFloat(style.outlineWidth) || 0,
      outlineStyle: style.outlineStyle,
      outlineColor: style.outlineColor,
      boxShadow: style.boxShadow,
      borderWidths,
      borderStyles,
      borderColors,
    };

    return {
      key: ensureKey(active),
      selector: selectorFor(active),
      snippet: shortHtml(active.outerHTML),
      tagName: active.tagName.toLowerCase(),
      role: active.getAttribute('role'),
      text: shortText(active.innerText || active.textContent || active.getAttribute('aria-label')),
      hiddenReasons: hiddenReasonsFor(active),
      zeroSized: rect.width <= 0 || rect.height <= 0,
      rect: {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      indicator,
      fullyObscured: points.length > 0 && visiblePointCount === 0,
      partiallyObscured: visiblePointCount > 0 && visiblePointCount < points.length,
      obscuredBy,
    };
  }, { keyAttr: KEY_ATTR });
}

async function runTabSweep(page: Page): Promise<TabSweep> {
  await prepareForKeyboardTraversal(page);
  const { expected, hidden } = await getInteractiveCandidates(page);
  const steps: FocusSnapshot[] = [];
  const uniqueOrder: string[] = [];
  const uniqueStepMap = new Map<string, FocusSnapshot>();
  const trapSnapshots: FocusSnapshot[] = [];

  let wrapped = false;
  let firstKey: string | null = null;
  let consecutiveSame = 0;
  let previousKey: string | null = null;

  for (let step = 0; step < MAX_TAB_STEPS; step += 1) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(TAB_DELAY_MS);

    const snapshot = await getFocusSnapshot(page);
    steps.push(snapshot);

    if (!snapshot.key) {
      consecutiveSame = previousKey === null ? consecutiveSame + 1 : 0;
      previousKey = null;
      continue;
    }

    if (!firstKey) {
      firstKey = snapshot.key;
    } else if (snapshot.key === firstKey && uniqueOrder.length > 1) {
      wrapped = true;
      break;
    }

    if (!uniqueStepMap.has(snapshot.key)) {
      uniqueOrder.push(snapshot.key);
      uniqueStepMap.set(snapshot.key, snapshot);
    }

    consecutiveSame = snapshot.key === previousKey ? consecutiveSame + 1 : 1;
    if (consecutiveSame >= 3) {
      trapSnapshots.push(snapshot);
      break;
    }
    previousKey = snapshot.key;
  }

  return {
    expected,
    hidden,
    steps,
    uniqueOrder,
    uniqueSteps: uniqueOrder
      .map((key) => uniqueStepMap.get(key))
      .filter((step): step is FocusSnapshot => Boolean(step)),
    trapSnapshots,
    wrapped,
  };
}

async function focusByTab(page: Page, key: string): Promise<FocusSnapshot | null> {
  await prepareForKeyboardTraversal(page);
  let firstSeen: string | null = null;

  for (let step = 0; step < MAX_TAB_STEPS; step += 1) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(TAB_DELAY_MS);
    const snapshot = await getFocusSnapshot(page);

    if (!snapshot.key) {
      continue;
    }

    if (!firstSeen) {
      firstSeen = snapshot.key;
    } else if (snapshot.key === firstSeen && step > 0) {
      return null;
    }

    if (snapshot.key === key) {
      return snapshot;
    }
  }

  return null;
}

async function getRepresentativeSamples(page: Page): Promise<{
  button: InteractiveCandidate | null;
  link: InteractiveCandidate | null;
}> {
  const { expected } = await getInteractiveCandidates(page);

  const button = expected.find((candidate) => candidate.tagName === 'button' || candidate.role === 'button')
    ?? expected.find((candidate) => candidate.tagName === 'input' && ['button', 'reset'].includes(candidate.type ?? ''))
    ?? null;

  const link = expected.find((candidate) => candidate.tagName === 'a' && candidate.href && !candidate.href.startsWith('#'))
    ?? expected.find((candidate) => candidate.tagName === 'a' && Boolean(candidate.href))
    ?? null;

  return { button, link };
}

async function instrumentActivation(page: Page, key: string, preventDefault: boolean): Promise<void> {
  await page.evaluate(({ keyAttr, targetKey, shouldPreventDefault }) => {
    const target = document.querySelector(`[${keyAttr}="${targetKey}"]`);
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const win = window as Window & { __a11yActivationCounts?: Record<string, number> };
    win.__a11yActivationCounts ??= {};
    win.__a11yActivationCounts[targetKey] = 0;

    if (target.getAttribute('data-a11y-activation-instrumented') === 'true') {
      return;
    }

    target.setAttribute('data-a11y-activation-instrumented', 'true');
    target.addEventListener('click', (event) => {
      win.__a11yActivationCounts ??= {};
      win.__a11yActivationCounts[targetKey] = (win.__a11yActivationCounts[targetKey] ?? 0) + 1;
      if (shouldPreventDefault) {
        event.preventDefault();
      }
    });
  }, { keyAttr: KEY_ATTR, targetKey: key, shouldPreventDefault: preventDefault });
}

async function getActivationCount(page: Page, key: string): Promise<number> {
  return page.evaluate((targetKey) => {
    const win = window as Window & { __a11yActivationCounts?: Record<string, number> };
    return win.__a11yActivationCounts?.[targetKey] ?? 0;
  }, key);
}

async function getDisclosureTriggers(page: Page): Promise<DisclosureTrigger[]> {
  return page.evaluate<DisclosureTrigger[], { keyAttr: string }>(({ keyAttr }) => {
    const win = window as Window & { __a11yKeyboardCounter?: number };
    win.__a11yKeyboardCounter ??= 0;

    const ensureKey = (element: Element): string => {
      let key = element.getAttribute(keyAttr);
      if (!key) {
        win.__a11yKeyboardCounter += 1;
        key = `a11y-keyboard-${win.__a11yKeyboardCounter}`;
        element.setAttribute(keyAttr, key);
      }
      return key;
    };

    const selectorFor = (element: Element): string => {
      const id = element.getAttribute('id');
      if (id) {
        return `${element.tagName.toLowerCase()}#${id}`;
      }
      return `${element.tagName.toLowerCase()}[${keyAttr}="${ensureKey(element)}"]`;
    };

    const isVisible = (element: Element): boolean => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };

    const elements = [...document.querySelectorAll('summary, button[aria-expanded], [role="button"][aria-expanded], [aria-haspopup][aria-controls]')]
      .filter((element, index, all) => all.indexOf(element) === index)
      .filter(isVisible);

    const results: DisclosureTrigger[] = [];
    for (const element of elements) {
      if (!(element instanceof HTMLElement)) {
        continue;
      }

      let panel: Element | null = null;
      if (element instanceof HTMLElement && element.tagName.toLowerCase() === 'summary') {
        panel = element.closest('details');
      }

      if (!panel) {
        const controls = element.getAttribute('aria-controls');
        if (controls) {
          panel = document.getElementById(controls);
        }
      }

      if (!panel) {
        const next = element.nextElementSibling;
        if (next instanceof HTMLElement) {
          panel = next;
        }
      }

      if (!panel) {
        continue;
      }

      results.push({
        key: ensureKey(element),
        selector: selectorFor(element),
        panelSelector: selectorFor(panel),
      });
    }

    return results;
  }, { keyAttr: KEY_ATTR });
}

async function activateDisclosure(page: Page, trigger: DisclosureTrigger): Promise<FocusSnapshot | null> {
  const focusedTrigger = await focusByTab(page, trigger.key);
  if (!focusedTrigger) {
    return null;
  }

  await page.keyboard.press('Enter');
  await page.waitForTimeout(TAB_DELAY_MS);

  if (!(await isDisclosureExpanded(page, trigger))) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(TAB_DELAY_MS);
  }

  await page.keyboard.press('Tab');
  await page.waitForTimeout(TAB_DELAY_MS);
  return getFocusSnapshot(page);
}

async function isDisclosureExpanded(page: Page, trigger: DisclosureTrigger): Promise<boolean> {
  return page.evaluate(({ keyAttr, triggerKey, panelSelector }) => {
    const triggerElement = document.querySelector(`[${keyAttr}="${triggerKey}"]`);
    const panelElement = document.querySelector(panelSelector);

    if (triggerElement?.tagName.toLowerCase() === 'summary') {
      const details = triggerElement.closest('details');
      return Boolean(details?.open);
    }

    if (triggerElement?.getAttribute('aria-expanded') === 'true') {
      return true;
    }

    if (!panelElement) {
      return false;
    }

    if (panelElement instanceof HTMLDetailsElement) {
      return panelElement.open;
    }

    const style = window.getComputedStyle(panelElement);
    const rect = panelElement.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }, { keyAttr: KEY_ATTR, triggerKey: trigger.key, panelSelector: trigger.panelSelector });
}

async function getFirstModalTarget(page: Page): Promise<ModalTarget | null> {
  return page.evaluate<ModalTarget | null, { keyAttr: string }>(({ keyAttr }) => {
    const win = window as Window & { __a11yKeyboardCounter?: number };
    win.__a11yKeyboardCounter ??= 0;

    const ensureKey = (element: Element): string => {
      let key = element.getAttribute(keyAttr);
      if (!key) {
        win.__a11yKeyboardCounter += 1;
        key = `a11y-keyboard-${win.__a11yKeyboardCounter}`;
        element.setAttribute(keyAttr, key);
      }
      return key;
    };

    const selectorFor = (element: Element): string => {
      const id = element.getAttribute('id');
      if (id) {
        return `${element.tagName.toLowerCase()}#${id}`;
      }
      return `${element.tagName.toLowerCase()}[${keyAttr}="${ensureKey(element)}"]`;
    };

    const isVisible = (element: Element): boolean => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };

    const dialogs = [...document.querySelectorAll('dialog, [role="dialog"], [aria-modal="true"]')]
      .filter((element, index, all) => all.indexOf(element) === index);

    const visibleDialog = dialogs.find(isVisible);
    if (visibleDialog) {
      return {
        triggerKey: null,
        triggerSelector: null,
        dialogSelector: selectorFor(visibleDialog),
      };
    }

    const triggers = [...document.querySelectorAll('[aria-haspopup="dialog"], [data-bs-toggle="modal"], [data-toggle="modal"], [aria-controls], a[href^="#"]')];

    for (const trigger of triggers) {
      if (!(trigger instanceof HTMLElement) || !isVisible(trigger)) {
        continue;
      }

      const candidates = [
        trigger.getAttribute('aria-controls'),
        trigger.getAttribute('data-bs-target')?.replace(/^#/, ''),
        trigger.getAttribute('data-target')?.replace(/^#/, ''),
        trigger.getAttribute('href')?.replace(/^#/, ''),
      ].filter((value): value is string => Boolean(value));

      for (const candidateId of candidates) {
        const candidate = document.getElementById(candidateId);
        if (!candidate) {
          continue;
        }

        const isDialog = candidate.matches('dialog, [role="dialog"], [aria-modal="true"]');
        if (!isDialog) {
          continue;
        }

        return {
          triggerKey: ensureKey(trigger),
          triggerSelector: selectorFor(trigger),
          dialogSelector: selectorFor(candidate),
        };
      }
    }

    return null;
  }, { keyAttr: KEY_ATTR });
}

async function openModal(page: Page, target: ModalTarget): Promise<void> {
  if (!target.triggerKey) {
    return;
  }

  const focusedTrigger = await focusByTab(page, target.triggerKey);
  if (!focusedTrigger) {
    return;
  }

  await page.keyboard.press('Enter');
  await page.waitForTimeout(TAB_DELAY_MS);
}

async function getFocusableKeysWithin(page: Page, containerSelector: string): Promise<string[]> {
  return page.evaluate(({ container, interactiveSelector, keyAttr }) => {
    const root = document.querySelector(container);
    if (!root) {
      return [];
    }

    const win = window as Window & { __a11yKeyboardCounter?: number };
    win.__a11yKeyboardCounter ??= 0;

    const ensureKey = (element: Element): string => {
      let key = element.getAttribute(keyAttr);
      if (!key) {
        win.__a11yKeyboardCounter += 1;
        key = `a11y-keyboard-${win.__a11yKeyboardCounter}`;
        element.setAttribute(keyAttr, key);
      }
      return key;
    };

    return [...root.querySelectorAll(interactiveSelector)]
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      })
      .map((element) => ensureKey(element));
  }, { container: containerSelector, interactiveSelector: INTERACTIVE_SELECTOR, keyAttr: KEY_ATTR });
}

async function isFocusInside(page: Page, containerSelector: string): Promise<boolean> {
  return page.evaluate((container) => {
    const root = document.querySelector(container);
    const active = document.activeElement;
    return Boolean(root && active instanceof HTMLElement && root.contains(active));
  }, containerSelector);
}

async function isVisible(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!element) {
      return false;
    }
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const open = element instanceof HTMLDialogElement ? element.open : true;
    return open && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }, selector);
}

async function getCloseButtonSelector(page: Page, dialogSelector: string): Promise<string | null> {
  return page.evaluate(({ container, keyAttr }) => {
    const root = document.querySelector(container);
    if (!root) {
      return null;
    }

    const win = window as Window & { __a11yKeyboardCounter?: number };
    win.__a11yKeyboardCounter ??= 0;

    const ensureKey = (element: Element): string => {
      let key = element.getAttribute(keyAttr);
      if (!key) {
        win.__a11yKeyboardCounter += 1;
        key = `a11y-keyboard-${win.__a11yKeyboardCounter}`;
        element.setAttribute(keyAttr, key);
      }
      return key;
    };

    const selectorFor = (element: Element): string => {
      const id = element.getAttribute('id');
      if (id) {
        return `${element.tagName.toLowerCase()}#${id}`;
      }
      return `${element.tagName.toLowerCase()}[${keyAttr}="${ensureKey(element)}"]`;
    };

    const button = root.querySelector(
      'button[aria-label*="close" i], button[class*="close" i], button[data-dismiss], [role="button"][aria-label*="close" i], [aria-label*="close" i]'
    );

    return button ? selectorFor(button) : null;
  }, { container: dialogSelector, keyAttr: KEY_ATTR });
}

function annotateWarnings(testInfo: TestInfo, title: string, items: string[]): void {
  if (items.length === 0) {
    return;
  }

  testInfo.annotations.push({
    type: 'warning',
    description: `${title}: ${items.join(' | ')}`,
  });
}

function buildTemplateMessage(checkId: string, template: TemplateName, viewport: string, message: string): string {
  return `[${checkId}] ${message} on ${template} (${viewport}).`;
}

test.describe('check-03: keyboard navigation', () => {
  test.describe('keyboard-1 — all interactive elements are reachable by Tab', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name;
        const checkId = getCheckId(viewport, 1);
        await page.goto(templateUrl(template));

        const sweep = await runTabSweep(page);
        const focusedKeys = new Set(sweep.uniqueOrder);
        const missing = sweep.expected.filter((candidate) => !focusedKeys.has(candidate.key));

        expect(
          missing,
          buildTemplateMessage(
            checkId,
            template,
            viewport,
            `Expected all visible interactive elements to receive focus. Missing: ${missing.map(describeFocusable).join(' | ')}`,
          ),
        ).toHaveLength(0);
      });
    }
  });

  test.describe('keyboard-2 — no keyboard trap exists', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name;
        const checkId = getCheckId(viewport, 2);
        await page.goto(templateUrl(template));

        const sweep = await runTabSweep(page);

        expect(
          sweep.trapSnapshots,
          buildTemplateMessage(
            checkId,
            template,
            viewport,
            `Expected focus to keep moving during tabbing. Potential trap elements: ${sweep.trapSnapshots.map((step) => step.selector).join(' | ')}`,
          ),
        ).toHaveLength(0);
      });
    }
  });

  test.describe('keyboard-3 — interactive elements have a visible focus indicator', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name;
        const checkId = getCheckId(viewport, 3);
        await page.goto(templateUrl(template));

        const sweep = await runTabSweep(page);
        const withoutIndicator = sweep.uniqueSteps.filter((step) => step.key && !step.indicator?.hasVisibleIndicator);

        expect(
          withoutIndicator,
          buildTemplateMessage(
            checkId,
            template,
            viewport,
            `Expected each focused element to expose an outline, box-shadow, or border indicator. Missing: ${withoutIndicator.map((step) => `${step.selector} :: ${step.snippet}`).join(' | ')}`,
          ),
        ).toHaveLength(0);
      });
    }
  });

  test.describe('keyboard-4 — focused elements are not fully obscured', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name;
        const checkId = getCheckId(viewport, 4);
        await page.goto(templateUrl(template));

        const sweep = await runTabSweep(page);
        const fullyObscured = sweep.uniqueSteps.filter((step) => step.fullyObscured);
        const partiallyObscured = sweep.uniqueSteps
          .filter((step) => step.partiallyObscured)
          .map((step) => `${step.selector} obscured by ${step.obscuredBy ?? 'unknown element'}`);

        annotateWarnings(testInfo, `${checkId} partial obscuration`, partiallyObscured);

        expect(
          fullyObscured,
          buildTemplateMessage(
            checkId,
            template,
            viewport,
            `Expected focused elements to remain visible. Fully obscured: ${fullyObscured.map((step) => `${step.selector} by ${step.obscuredBy ?? 'unknown element'}`).join(' | ')}`,
          ),
        ).toHaveLength(0);
      });
    }
  });

  test.describe('keyboard-5 — intentionally hidden items do not receive focus', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name;
        const checkId = getCheckId(viewport, 5);
        await page.goto(templateUrl(template));

        const sweep = await runTabSweep(page);
        const hiddenKeys = new Set(sweep.hidden.map((candidate) => candidate.key));
        const focusedHidden = sweep.uniqueSteps.filter((step) => step.key && hiddenKeys.has(step.key));
        const zeroSized = sweep.uniqueSteps.filter((step) => step.zeroSized);
        const offenders = [
          ...focusedHidden.map((step) => `${step.selector} :: ${step.hiddenReasons.join(', ')}`),
          ...zeroSized.map((step) => `${step.selector} :: zero-sized focused element`),
        ];

        expect(
          offenders,
          buildTemplateMessage(
            checkId,
            template,
            viewport,
            `Expected hidden or zero-sized items to stay out of the tab order. Offenders: ${offenders.join(' | ')}`,
          ),
        ).toHaveLength(0);
      });
    }
  });

  test.describe('keyboard-6 — tab order broadly matches visual reading order', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name;
        const checkId = getCheckId(viewport, 6);
        await page.goto(templateUrl(template));

        const sweep = await runTabSweep(page);
        const violations: string[] = [];
        let previous: FocusSnapshot | null = null;

        for (const step of sweep.uniqueSteps) {
          if (!step.rect || !previous?.rect) {
            previous = step;
            continue;
          }

          const movedUp = step.rect.top < previous.rect.top - OBVIOUS_VISUAL_REGRESSION_PX;
          const sameRow = Math.abs(step.rect.top - previous.rect.top) <= SAME_ROW_THRESHOLD;
          const movedLeft = sameRow && step.rect.left < previous.rect.left - OBVIOUS_VISUAL_REGRESSION_PX;

          if (movedUp || movedLeft) {
            violations.push(`${previous.selector} -> ${step.selector}`);
          }

          previous = step;
        }

        annotateWarnings(testInfo, `${checkId} tab-order review`, violations);

        expect(
          violations.length,
          buildTemplateMessage(
            checkId,
            template,
            viewport,
            `Expected no more than one obvious tab-order regression. Regressions: ${violations.join(' | ')}`,
          ),
        ).toBeLessThanOrEqual(1);
      });
    }
  });

  test.describe('keyboard-7 — Shift+Tab reverses through the same order', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name;
        const checkId = getCheckId(viewport, 7);
        await page.goto(templateUrl(template));

        const forwardSweep = await runTabSweep(page);
        const reverseExpected = [...forwardSweep.uniqueOrder].reverse();
        const reverseSeen: string[] = [];

        for (let index = 0; index < reverseExpected.length; index += 1) {
          await page.keyboard.press('Shift+Tab');
          await page.waitForTimeout(TAB_DELAY_MS);
          const snapshot = await getFocusSnapshot(page);
          if (snapshot.key) {
            reverseSeen.push(snapshot.key);
          }
        }

        expect(
          reverseSeen,
          buildTemplateMessage(
            checkId,
            template,
            viewport,
            `Expected reverse tab order to mirror forward order. Expected: ${reverseExpected.join(' -> ')}. Received: ${reverseSeen.join(' -> ')}`,
          ),
        ).toEqual(reverseExpected);
      });
    }
  });

  test.describe('keyboard-8 — buttons and links activate with the expected keys', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name;
        const checkId = getCheckId(viewport, 8);
        const url = templateUrl(template);

        await page.goto(url);
        const samples = await getRepresentativeSamples(page);
        expect(
          samples.button,
          buildTemplateMessage(checkId, template, viewport, 'Expected at least one button sample to exist'),
        ).not.toBeNull();
        expect(
          samples.link,
          buildTemplateMessage(checkId, template, viewport, 'Expected at least one link sample to exist'),
        ).not.toBeNull();

        const buttonSample = samples.button as InteractiveCandidate;
        const linkSample = samples.link as InteractiveCandidate;

        await page.goto(url);
        await getInteractiveCandidates(page);
        await instrumentActivation(page, buttonSample.key, true);
        const focusedButtonForSpace = await focusByTab(page, buttonSample.key);
        expect(
          focusedButtonForSpace?.key,
          buildTemplateMessage(checkId, template, viewport, `Expected to tab to button sample ${buttonSample.selector}`),
        ).toBe(buttonSample.key);
        await page.keyboard.press('Space');
        await page.waitForTimeout(TAB_DELAY_MS);
        expect(
          await getActivationCount(page, buttonSample.key),
          buildTemplateMessage(checkId, template, viewport, `Expected Space to activate ${buttonSample.selector}`),
        ).toBeGreaterThan(0);

        await page.goto(url);
        await getInteractiveCandidates(page);
        await instrumentActivation(page, buttonSample.key, true);
        const focusedButtonForEnter = await focusByTab(page, buttonSample.key);
        expect(
          focusedButtonForEnter?.key,
          buildTemplateMessage(checkId, template, viewport, `Expected to tab to button sample ${buttonSample.selector}`),
        ).toBe(buttonSample.key);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(TAB_DELAY_MS);
        expect(
          await getActivationCount(page, buttonSample.key),
          buildTemplateMessage(checkId, template, viewport, `Expected Enter to activate ${buttonSample.selector}`),
        ).toBeGreaterThan(0);

        await page.goto(url);
        await getInteractiveCandidates(page);
        await instrumentActivation(page, linkSample.key, true);
        const focusedLinkForSpace = await focusByTab(page, linkSample.key);
        expect(
          focusedLinkForSpace?.key,
          buildTemplateMessage(checkId, template, viewport, `Expected to tab to link sample ${linkSample.selector}`),
        ).toBe(linkSample.key);
        await page.keyboard.press('Space');
        await page.waitForTimeout(TAB_DELAY_MS);
        expect(
          await getActivationCount(page, linkSample.key),
          buildTemplateMessage(checkId, template, viewport, `Expected Space not to activate ${linkSample.selector}`),
        ).toBe(0);

        await page.goto(url);
        await getInteractiveCandidates(page);
        await instrumentActivation(page, linkSample.key, true);
        const focusedLinkForEnter = await focusByTab(page, linkSample.key);
        expect(
          focusedLinkForEnter?.key,
          buildTemplateMessage(checkId, template, viewport, `Expected to tab to link sample ${linkSample.selector}`),
        ).toBe(linkSample.key);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(TAB_DELAY_MS);
        expect(
          await getActivationCount(page, linkSample.key),
          buildTemplateMessage(checkId, template, viewport, `Expected Enter to activate ${linkSample.selector}`),
        ).toBeGreaterThan(0);
      });
    }
  });

  test.describe('keyboard-9 — opening a panel keeps focus inside it', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name;
        const checkId = getCheckId(viewport, 9);
        await page.goto(templateUrl(template));

        const triggers = await getDisclosureTriggers(page);
        test.skip(triggers.length === 0, buildTemplateMessage(checkId, template, viewport, 'No disclosure panels found'));

        const failures: string[] = [];

        for (const trigger of triggers) {
          await page.goto(templateUrl(template));
          await getInteractiveCandidates(page);
          const focusedInside = await activateDisclosure(page, trigger);

          if (!focusedInside) {
            failures.push(`Could not focus disclosure trigger ${trigger.selector}`);
            continue;
          }

          const expanded = await isDisclosureExpanded(page, trigger);
          if (!expanded) {
            failures.push(`${trigger.selector} did not report an expanded state after keyboard activation`);
            continue;
          }

          const insidePanel = await isFocusInside(page, trigger.panelSelector);
          if (!insidePanel) {
            failures.push(`${trigger.selector} moved focus to ${focusedInside.selector} instead of inside ${trigger.panelSelector}`);
          }
        }

        expect(
          failures,
          buildTemplateMessage(checkId, template, viewport, `Expected disclosure panels to keep the next tab stop inside the opened panel. Failures: ${failures.join(' | ')}`),
        ).toHaveLength(0);
      });
    }
  });

  test.describe('keyboard-10 — modal dialogs trap focus internally', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name;
        const checkId = getCheckId(viewport, 10);
        await page.goto(templateUrl(template));

        const modalTarget = await getFirstModalTarget(page);
        test.skip(!modalTarget, buildTemplateMessage(checkId, template, viewport, 'No modal dialogs found'));

        await getInteractiveCandidates(page);
        await openModal(page, modalTarget as ModalTarget);

        await expect
          .poll(async () => isVisible(page, (modalTarget as ModalTarget).dialogSelector), {
            message: buildTemplateMessage(checkId, template, viewport, `Expected ${(modalTarget as ModalTarget).dialogSelector} to become visible`),
          })
          .toBe(true);

        const focusableKeys = await getFocusableKeysWithin(page, (modalTarget as ModalTarget).dialogSelector);
        expect(
          focusableKeys.length,
          buildTemplateMessage(checkId, template, viewport, `Expected ${(modalTarget as ModalTarget).dialogSelector} to contain focusable elements`),
        ).toBeGreaterThan(0);

        for (let index = 0; index < focusableKeys.length; index += 1) {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(TAB_DELAY_MS);
        }

        const wrappedSnapshot = await getFocusSnapshot(page);
        expect(
          wrappedSnapshot.key,
          buildTemplateMessage(
            checkId,
            template,
            viewport,
            `Expected focus to remain inside ${(modalTarget as ModalTarget).dialogSelector} after tabbing through its contents`,
          ),
        ).toBe(focusableKeys[0]);
        expect(
          await isFocusInside(page, (modalTarget as ModalTarget).dialogSelector),
          buildTemplateMessage(checkId, template, viewport, 'Expected wrapped focus to stay inside the modal'),
        ).toBe(true);
      });
    }
  });

  test.describe('keyboard-11 — modals close with Escape or a close button', () => {
    for (const template of ALL_TEMPLATES) {
      test(template, async ({ page, templateUrl }, testInfo) => {
        const viewport = testInfo.project.name;
        const checkId = getCheckId(viewport, 11);
        await page.goto(templateUrl(template));

        const modalTarget = await getFirstModalTarget(page);
        test.skip(!modalTarget, buildTemplateMessage(checkId, template, viewport, 'No modal dialogs found'));

        await getInteractiveCandidates(page);
        await openModal(page, modalTarget as ModalTarget);

        await expect
          .poll(async () => isVisible(page, (modalTarget as ModalTarget).dialogSelector), {
            message: buildTemplateMessage(checkId, template, viewport, `Expected ${(modalTarget as ModalTarget).dialogSelector} to become visible`),
          })
          .toBe(true);

        await page.keyboard.press('Escape');
        await page.waitForTimeout(TAB_DELAY_MS);

        const closedByEscape = !(await isVisible(page, (modalTarget as ModalTarget).dialogSelector));

        if (!closedByEscape) {
          const closeSelector = await getCloseButtonSelector(page, (modalTarget as ModalTarget).dialogSelector);
          expect(
            closeSelector,
            buildTemplateMessage(checkId, template, viewport, `Expected ${(modalTarget as ModalTarget).dialogSelector} to expose a close button when Escape does not close it`),
          ).not.toBeNull();

          await page.locator(closeSelector as string).press('Enter');
          await page.waitForTimeout(TAB_DELAY_MS);
        }

        await expect
          .poll(async () => isVisible(page, (modalTarget as ModalTarget).dialogSelector), {
            message: buildTemplateMessage(checkId, template, viewport, `Expected ${(modalTarget as ModalTarget).dialogSelector} to be closed`),
          })
          .toBe(false);

        if ((modalTarget as ModalTarget).triggerKey) {
          const snapshot = await getFocusSnapshot(page);
          expect(
            snapshot.key,
            buildTemplateMessage(checkId, template, viewport, 'Expected focus to return to the modal trigger'),
          ).toBe((modalTarget as ModalTarget).triggerKey);
        }
      });
    }
  });
});
