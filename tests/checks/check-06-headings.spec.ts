import { test, expect, ACTIVE_TEMPLATES } from '../helpers/fixtures';

for (const template of ACTIVE_TEMPLATES) {
  test.describe(`check-06 / headings / ${template}`, () => {
    test.beforeEach(async ({ page, templateUrl }) => {
      await page.goto(templateUrl(template));
    });

    test('headings-1: page contains at least one H1 [desktop]', async ({ page }, testInfo) => {
      if (testInfo.project.name !== 'desktop') test.skip();
      await expect(page.locator('h1, [role="heading"][aria-level="1"]')).toHaveCount(1);
    });

    test('headings-1: page contains at least one H1 [mobile]', async ({ page }, testInfo) => {
      if (testInfo.project.name !== 'mobile') test.skip();
      await expect(page.locator('h1, [role="heading"][aria-level="1"]')).toHaveCount(1);
    });

    test.skip('headings-8: heading content relates to following content [desktop]', async ({ page }, testInfo) => {
      if (testInfo.project.name !== 'desktop') test.skip();
      void page;
    }, 'Requires manual content review — cannot be determined programmatically');

    test.skip('headings-8: heading content relates to following content [mobile]', async ({ page }, testInfo) => {
      if (testInfo.project.name !== 'mobile') test.skip();
      void page;
    }, 'Requires manual content review — cannot be determined programmatically');
  });
}

test.describe('check-06 / headings / cross-template checks', () => {
  test.skip('headings-5: H1 is not identical across all non-home templates [desktop]', async () => {}, 'Implemented in the next commit.');
});
