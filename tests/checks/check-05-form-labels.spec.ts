import type { Page } from '@playwright/test';
import { test, ACTIVE_TEMPLATES } from '../helpers/fixtures';

const VIEWPORTS = ['desktop', 'mobile'] as const;
type ViewportName = (typeof VIEWPORTS)[number];
type FormKind = 'search' | 'comment' | 'other';

type FormSummary = {
  index: number;
  kind: FormKind;
  id: string;
  className: string;
};

type FormsAnalysis = {
  forms: FormSummary[];
  searchFormIndex: number | null;
  commentFormIndex: number | null;
};

async function analyzeForms(page: Page): Promise<FormsAnalysis> {
  return page.evaluate(() => {
    const normaliseText = (value: string | null | undefined): string => {
      return (value ?? '').replace(/\s+/g, ' ').trim();
    };

    const classifyForm = (form: HTMLFormElement): FormKind => {
      const meta = normaliseText([
        form.id,
        form.className,
        form.getAttribute('role'),
        form.getAttribute('action'),
      ].join(' '));

      if (
        /comment/i.test(meta)
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

    const forms = Array.from(document.querySelectorAll('form')).map((form, index) => {
      return {
        index,
        kind: classifyForm(form),
        id: form.id,
        className: form.className,
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
        test.skip(true, 'Scaffolded: implement visible search label assertions.');
      });

      test(`form-2: search form label persists when text is typed [${viewport}]`, async ({ page }, testInfo) => {
        ensureViewport(testInfo, viewport);
        const analysis = await analyzeForms(page);
        skipIfNoForms(analysis, template, viewport);
        test.skip(true, 'Scaffolded: implement persistence assertion after typing.');
      });

      test(`form-3: all form fields have a programmatically associated label [${viewport}]`, async ({ page }, testInfo) => {
        ensureViewport(testInfo, viewport);
        const analysis = await analyzeForms(page);
        skipIfNoForms(analysis, template, viewport);
        test.skip(true, 'Scaffolded: implement axe-core label checks.');
      });

      test(`form-4: labels are not placeholder-only [${viewport}]`, async ({ page }, testInfo) => {
        ensureViewport(testInfo, viewport);
        const analysis = await analyzeForms(page);
        skipIfNoForms(analysis, template, viewport);
        test.skip(true, 'Scaffolded: implement placeholder-only detection.');
      });

      test(`form-5: comment form fields have visible labels [${viewport}]`, async ({ page }, testInfo) => {
        ensureViewport(testInfo, viewport);
        const analysis = await analyzeForms(page);
        skipIfNoForms(analysis, template, viewport);
        test.skip(true, 'Scaffolded: implement visible comment-form label assertions.');
      });

      test(`form-6: required fields are marked required with visible indication [${viewport}]`, async ({ page }, testInfo) => {
        ensureViewport(testInfo, viewport);
        const analysis = await analyzeForms(page);
        skipIfNoForms(analysis, template, viewport);
        test.skip(true, 'Scaffolded: implement required-field indicator checks.');
      });
    }
  });
}
