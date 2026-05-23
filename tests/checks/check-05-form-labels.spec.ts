import type { Page } from '@playwright/test';
import { test, expect, ACTIVE_TEMPLATES } from '../helpers/fixtures';
import { runAxeRules } from '../helpers/axe-helpers';

const VIEWPORTS = ['desktop', 'mobile'] as const;
type ViewportName = (typeof VIEWPORTS)[number];
type FormKind = 'search' | 'comment' | 'other';
type SearchLabelStatus = 'pass' | 'fail' | 'uncertain';
type FieldKey = 'search' | 'author' | 'email' | 'url' | 'comment' | 'other';

type FieldSummary = {
  key: FieldKey;
  tagName: string;
  type: string;
  name: string;
  id: string;
  placeholder: string;
  required: boolean;
  visibleLabels: string[];
  hiddenLabels: string[];
  ariaLabel: string;
  ariaLabelledbyTexts: string[];
  describedByVisibleTexts: string[];
  hasProgrammaticLabel: boolean;
  hasPlaceholderOnlyLabel: boolean;
  hasFieldLevelRequiredIndicator: boolean;
  hasVisibleRequiredIndicator: boolean;
};

type FormSummary = {
  index: number;
  kind: FormKind;
  id: string;
  className: string;
  hasRequiredHint: boolean;
  fields: FieldSummary[];
  searchLabelStatus: SearchLabelStatus | null;
  searchLabelReason: string | null;
  searchLabelEvidence: string[];
};

type FormsAnalysis = {
  forms: FormSummary[];
  searchFormIndex: number | null;
  commentFormIndex: number | null;
};

async function analyzeForms(page: Page): Promise<FormsAnalysis> {
  return page.evaluate(() => {
    type BrowserFieldKey = 'search' | 'author' | 'email' | 'url' | 'comment' | 'other';
    type BrowserFormKind = 'search' | 'comment' | 'other';
    type BrowserSearchLabelStatus = 'pass' | 'fail' | 'uncertain';

    const formElements = Array.from(document.querySelectorAll('form'));
    const markerPattern = /(^|\b)(required|mandatory)(\b)|\*/i;
    const searchPattern = /\bsearch\b|magnif|lens|zoom|icon-search/i;
    const magnifierPattern = /[🔍⌕⌖]/;

    const normaliseText = (value: string | null | undefined): string => {
      return (value ?? '').replace(/\s+/g, ' ').trim();
    };

    const getElementText = (element: Element | null): string => {
      if (!element) {
        return '';
      }

      if (element instanceof HTMLInputElement) {
        return normaliseText(element.value || element.getAttribute('value'));
      }

      const withInnerText = element as HTMLElement;
      return normaliseText(withInnerText.innerText || element.textContent);
    };

    const isVisible = (element: Element | null): boolean => {
      if (!element) {
        return false;
      }

      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return false;
      }

      // Exclude sr-only patterns — 1px clipped elements produced by .screen-reader-text / .sr-only.
      const clipped = style.clip === 'rect(1px, 1px, 1px, 1px)' || style.clipPath !== 'none';
      const tiny = rect.width <= 1 || rect.height <= 1;
      if ((style.position === 'absolute' || style.position === 'fixed') && clipped && tiny) {
        return false;
      }

      return true;
    };

    const isScreenReaderOnly = (element: Element): boolean => {
      const className = element.getAttribute('class') ?? '';
      if (/\b(screen-reader-text|sr-only|visually-hidden)\b/i.test(className)) {
        return true;
      }

      const style = window.getComputedStyle(element);
      const clipped = style.clip === 'rect(1px, 1px, 1px, 1px)' || style.clipPath !== 'none';
      const tiny = parseFloat(style.width || '0') <= 1 || parseFloat(style.height || '0') <= 1;
      return (style.position === 'absolute' || style.position === 'fixed') && clipped && tiny;
    };

    const getIdRefTexts = (attributeValue: string | null, visibleOnly: boolean): string[] => {
      if (!attributeValue) {
        return [];
      }

      return attributeValue
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter((element): element is HTMLElement => Boolean(element))
        .filter((element) => !visibleOnly || isVisible(element))
        .map((element) => getElementText(element))
        .filter(Boolean);
    };

    const getFieldKey = (
      control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
    ): BrowserFieldKey => {
      const meta = normaliseText([
        control.getAttribute('name'),
        control.id,
        control.getAttribute('type'),
      ].join(' '));

      if (control instanceof HTMLTextAreaElement && /comment/i.test(meta)) {
        return 'comment';
      }

      if (control instanceof HTMLInputElement && control.type === 'search') {
        return 'search';
      }

      if (/\bs\b/.test(meta) || /search/i.test(meta)) {
        return 'search';
      }

      if (/\bauthor\b|\bname\b/i.test(meta)) {
        return 'author';
      }

      if (/email/i.test(meta)) {
        return 'email';
      }

      if (/\burl\b|website|web/i.test(meta)) {
        return 'url';
      }

      if (/comment/i.test(meta)) {
        return 'comment';
      }

      return 'other';
    };

    const classifyForm = (form: HTMLFormElement): BrowserFormKind => {
      const meta = normaliseText([
        form.id,
        form.className,
        form.getAttribute('role'),
        form.getAttribute('action'),
      ].join(' '));

      if (
        /comment/i.test(meta)
        || form.querySelector('#commentform')
        || form.querySelector('textarea[name="comment"], textarea#comment, input[name="author"], input[name="email"]')
      ) {
        return 'comment';
      }

      if (
        /search/i.test(meta)
        || form.querySelector('input[type="search"], input[name="s"], .wp-block-search__input')
      ) {
        return 'search';
      }

      return 'other';
    };

    const forms = formElements.map((form, index) => {
      const controls = Array.from(
        form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea'),
      ).filter((control) => {
        if (control instanceof HTMLInputElement) {
          return !['hidden', 'submit', 'reset', 'button'].includes(control.type);
        }

        return true;
      });

      const formVisibleTexts = Array.from(form.querySelectorAll('legend, p, span, small, strong, em'))
        .filter((element) => isVisible(element))
        .map((element) => getElementText(element))
        .filter(Boolean);
      const hasRequiredHint = formVisibleTexts.some((text) => /required|mandatory/i.test(text));

      const fields = controls.map((control) => {
        const labels = Array.from(control.labels ?? []);
        const visibleLabels = labels
          .filter((label) => isVisible(label) && !isScreenReaderOnly(label))
          .map((label) => getElementText(label))
          .filter(Boolean);
        const hiddenLabels = labels
          .filter((label) => !isVisible(label) || isScreenReaderOnly(label))
          .map((label) => getElementText(label))
          .filter(Boolean);
        const ariaLabel = normaliseText(control.getAttribute('aria-label'));
        const ariaLabelledbyTexts = getIdRefTexts(control.getAttribute('aria-labelledby'), false);
        const describedByVisibleTexts = getIdRefTexts(control.getAttribute('aria-describedby'), true);
        const wrapper = control.closest('label, p, li, div, td');
        const wrapperText = wrapper && wrapper !== form ? getElementText(wrapper) : '';
        const fieldsetLegendTexts = Array.from(control.closest('fieldset')?.querySelectorAll('legend') ?? [])
          .filter((element) => isVisible(element))
          .map((element) => getElementText(element))
          .filter(Boolean);
        const indicatorTexts = [
          ...visibleLabels,
          ...describedByVisibleTexts,
          ...fieldsetLegendTexts,
          wrapperText,
        ].filter(Boolean);
        const hasFieldLevelRequiredIndicator = indicatorTexts.some((text) => markerPattern.test(text));
        const hasProgrammaticLabel = Boolean(
          visibleLabels.length
          || hiddenLabels.length
          || ariaLabel
          || ariaLabelledbyTexts.length,
        );
        const placeholder = normaliseText(control.getAttribute('placeholder'));

        return {
          key: getFieldKey(control),
          tagName: control.tagName.toLowerCase(),
          type: control instanceof HTMLInputElement ? control.type : control.tagName.toLowerCase(),
          name: control.getAttribute('name') ?? '',
          id: control.id,
          placeholder,
          required: control.hasAttribute('required') || control.getAttribute('aria-required') === 'true',
          visibleLabels,
          hiddenLabels,
          ariaLabel,
          ariaLabelledbyTexts,
          describedByVisibleTexts,
          hasProgrammaticLabel,
          hasPlaceholderOnlyLabel: Boolean(placeholder && !hasProgrammaticLabel),
          hasFieldLevelRequiredIndicator,
          hasVisibleRequiredIndicator: hasFieldLevelRequiredIndicator || hasRequiredHint,
        };
      });

      const kind = classifyForm(form);
      const searchInput = controls.find((control) => getFieldKey(control) === 'search');
      const searchField = fields.find((field) => field.key === 'search') ?? null;
      const visibleSearchButtons = Array.from(
        form.querySelectorAll('button, input[type="submit"], input[type="image"], [role="button"]'),
      )
        .filter((element) => isVisible(element))
        .map((element) => {
          const text = normaliseText([
            getElementText(element),
            element.getAttribute('aria-label'),
            element.getAttribute('title'),
            element.getAttribute('alt'),
          ].join(' '));
          return { text, className: element.getAttribute('class') ?? '' };
        })
        .filter((button) => searchPattern.test(button.text) || searchPattern.test(button.className));
      const visibleSearchIcons = Array.from(form.querySelectorAll('svg, img, [title], [aria-label], [class]'))
        .filter((element) => isVisible(element))
        .map((element) => {
          const summary = normaliseText([
            getElementText(element),
            element.getAttribute('aria-label'),
            element.getAttribute('title'),
            element.getAttribute('alt'),
            element.getAttribute('class'),
          ].join(' '));
          return summary;
        })
        .filter((summary) => searchPattern.test(summary) || magnifierPattern.test(summary));

      const searchLabelEvidence = [
        ...(searchField?.visibleLabels ?? []).map((label) => `label:${label}`),
        ...visibleSearchButtons.map((button) => `button:${button.text}`),
        ...visibleSearchIcons.map((icon) => `icon:${icon}`),
      ];

      let searchLabelStatus: BrowserSearchLabelStatus | null = null;
      let searchLabelReason: string | null = null;
      if (kind === 'search' && searchInput && searchField) {
        if (searchLabelEvidence.length > 0) {
          searchLabelStatus = 'pass';
          searchLabelReason = `Visible search label evidence: ${searchLabelEvidence.join(', ')}`;
        } else if (searchField.hiddenLabels.length > 0) {
          searchLabelStatus = 'fail';
          searchLabelReason = `Search input relies on a screen-reader-only label (${searchField.hiddenLabels.join(', ')}) without visible text or icon.`;
        } else if (searchField.placeholder && !searchField.ariaLabel && searchField.ariaLabelledbyTexts.length === 0) {
          searchLabelStatus = 'fail';
          searchLabelReason = `Search input relies on placeholder text only (${searchField.placeholder}).`;
        } else {
          searchLabelStatus = 'uncertain';
          searchLabelReason = 'Could not confidently detect a visible search label or icon.';
        }
      }

      return {
        index,
        kind,
        id: form.id,
        className: form.className,
        hasRequiredHint,
        fields,
        searchLabelStatus,
        searchLabelReason,
        searchLabelEvidence,
      };
    });

    return {
      forms,
      searchFormIndex: forms.find((form) => form.kind === 'search')?.index ?? null,
      commentFormIndex: forms.find((form) => form.kind === 'comment')?.index ?? null,
    };
  });
}

function ensureViewport(testInfo: { project: { name: string } }, viewport: ViewportName): void {
  test.skip(testInfo.project.name !== viewport, `Only runs in the ${viewport} project.`);
}

function skipIfNoForms(analysis: FormsAnalysis, template: string, viewport: ViewportName): void {
  test.skip(
    analysis.forms.length === 0,
    `No forms found on ${template} (${viewport}); check-05 is not applicable for this template.`,
  );
}

function formatField(field: FieldSummary): string {
  const idPart = field.id ? `#${field.id}` : '';
  const namePart = field.name ? `[name="${field.name}"]` : '';
  return `${field.tagName}${idPart}${namePart}`;
}

function getSearchForm(analysis: FormsAnalysis): FormSummary | null {
  if (analysis.searchFormIndex === null) {
    return null;
  }

  return analysis.forms[analysis.searchFormIndex] ?? null;
}

function getCommentForm(analysis: FormsAnalysis): FormSummary | null {
  if (analysis.commentFormIndex === null) {
    return null;
  }

  return analysis.forms[analysis.commentFormIndex] ?? null;
}

for (const template of ACTIVE_TEMPLATES) {
  test.describe(`check-05 / form-labels / ${template}`, () => {
    test.beforeEach(async ({ page, templateUrl }) => {
      await page.goto(templateUrl(template));
    });

    for (const viewport of VIEWPORTS) {
      test(`form-1: search form has visible label [${viewport}]`, async ({ page }, testInfo) => {
        ensureViewport(testInfo, viewport);
        const analysis = await analyzeForms(page);
        skipIfNoForms(analysis, template, viewport);

        const searchForm = getSearchForm(analysis);
        test.skip(!searchForm, `No search form found on ${template} (${viewport}).`);
        test.skip(
          searchForm?.searchLabelStatus === 'uncertain',
          searchForm?.searchLabelReason ?? 'Search form label detection was inconclusive.',
        );

        expect(
          searchForm?.searchLabelStatus,
          searchForm?.searchLabelReason ?? `Expected a visible search label on ${template} (${viewport}).`,
        ).toBe('pass');
      });

      test(`form-2: search form label persists when text is typed [${viewport}]`, async ({ page }, testInfo) => {
        ensureViewport(testInfo, viewport);
        const beforeTyping = await analyzeForms(page);
        skipIfNoForms(beforeTyping, template, viewport);

        const initialSearchForm = getSearchForm(beforeTyping);
        test.skip(!initialSearchForm, `No search form found on ${template} (${viewport}).`);
        test.skip(
          initialSearchForm?.searchLabelStatus === 'uncertain',
          initialSearchForm?.searchLabelReason ?? 'Search form label detection was inconclusive before typing.',
        );

        const searchInput = page
          .locator('form')
          .nth(beforeTyping.searchFormIndex ?? 0)
          .locator('input[type="search"], input[name="s"], .wp-block-search__input')
          .first();
        test.skip(await searchInput.count() === 0, `No searchable input found on ${template} (${viewport}).`);

        await searchInput.fill('test');

        const afterTyping = await analyzeForms(page);
        const updatedSearchForm = getSearchForm(afterTyping);
        expect(
          updatedSearchForm?.searchLabelStatus,
          updatedSearchForm?.searchLabelReason
            ?? `Expected the visible search label to persist after typing on ${template} (${viewport}).`,
        ).toBe('pass');
      });

      test(`form-3: all form fields have a programmatically associated label [${viewport}]`, async ({ page }, testInfo) => {
        ensureViewport(testInfo, viewport);
        const analysis = await analyzeForms(page);
        skipIfNoForms(analysis, template, viewport);

        testInfo.annotations.push({ type: 'source', description: 'axe-core' });
        const violations = await runAxeRules(page, ['label']);
        const violationSummary = violations
          .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)
          .join('\n');

        expect(
          violations,
          violationSummary || `Expected axe-core label rule to pass on ${template} (${viewport}).`,
        ).toHaveLength(0);
      });

      test(`form-4: labels are not placeholder-only [${viewport}]`, async ({ page }, testInfo) => {
        ensureViewport(testInfo, viewport);
        const analysis = await analyzeForms(page);
        skipIfNoForms(analysis, template, viewport);

        const placeholderOnlyFields = analysis.forms.flatMap((form) => {
          return form.fields
            .filter((field) => field.hasPlaceholderOnlyLabel)
            .map((field) => `${formatField(field)} in form ${form.index + 1}`);
        });

        expect(
          placeholderOnlyFields,
          `Fields must not rely on placeholder text alone on ${template} (${viewport}): ${placeholderOnlyFields.join(', ')}`,
        ).toHaveLength(0);
      });

      test(`form-5: comment form fields have visible labels [${viewport}]`, async ({ page }, testInfo) => {
        ensureViewport(testInfo, viewport);
        const analysis = await analyzeForms(page);
        skipIfNoForms(analysis, template, viewport);

        const commentForm = getCommentForm(analysis);
        test.skip(!commentForm, `No comment form found on ${template} (${viewport}).`);

        const requiredFields: FieldKey[] = ['author', 'email', 'comment'];
        for (const fieldKey of requiredFields) {
          const field = commentForm?.fields.find((candidate) => candidate.key === fieldKey);
          expect(field, `Expected a ${fieldKey} field in the comment form on ${template} (${viewport}).`).toBeTruthy();
          expect(
            field?.visibleLabels.length ?? 0,
            `Expected a visible label for the ${fieldKey} field on ${template} (${viewport}). Hidden labels: ${field?.hiddenLabels.join(', ') ?? 'none'}`,
          ).toBeGreaterThan(0);
        }

        const urlField = commentForm?.fields.find((candidate) => candidate.key === 'url');
        if (!urlField) {
          testInfo.annotations.push({
            type: 'note',
            description: `No Website/URL field found in the comment form on ${template} (${viewport}).`,
          });
          return;
        }

        expect(
          urlField.visibleLabels.length,
          `Expected a visible label for the Website/URL field on ${template} (${viewport}). Hidden labels: ${urlField.hiddenLabels.join(', ') || 'none'}`,
        ).toBeGreaterThan(0);
      });

      test(`form-6: required fields are marked required with visible indication [${viewport}]`, async ({ page }, testInfo) => {
        ensureViewport(testInfo, viewport);
        const analysis = await analyzeForms(page);
        skipIfNoForms(analysis, template, viewport);

        const requiredFields = analysis.forms.flatMap((form) => {
          return form.fields
            .filter((field) => field.required)
            .map((field) => ({ form, field }));
        });
        test.skip(
          requiredFields.length === 0,
          `No required form fields found on ${template} (${viewport}).`,
        );

        const missingVisibleIndicators = requiredFields
          .filter(({ field }) => !field.hasVisibleRequiredIndicator)
          .map(({ form, field }) => `${formatField(field)} in form ${form.index + 1}`);
        const visuallyMarkedWithoutRequired = analysis.forms.flatMap((form) => {
          return form.fields
            .filter((field) => field.hasFieldLevelRequiredIndicator && !field.required)
            .map((field) => `${formatField(field)} in form ${form.index + 1}`);
        });

        expect(
          missingVisibleIndicators,
          `Required fields need a visible required indicator on ${template} (${viewport}): ${missingVisibleIndicators.join(', ')}`,
        ).toHaveLength(0);
        expect(
          visuallyMarkedWithoutRequired,
          `Visually required fields must also be programmatically required on ${template} (${viewport}): ${visuallyMarkedWithoutRequired.join(', ')}`,
        ).toHaveLength(0);
      });
    }
  });
}
