import { test, expect, ACTIVE_TEMPLATES } from '../helpers/fixtures';

/**
 * Check 08: Ambiguous Links
 * Check ID: link-ambiguous-1
 * Templates: all 8
 * Viewports: desktop only
 * Tool: Playwright — page.evaluate() to compute accessible names in bulk
 *
 * WCAG SC 2.4.4 (Link Purpose — In Context) and WordPress accessibility-ready guidelines.
 *
 * A link is ambiguous when its computed accessible name (aria-label > aria-labelledby
 * content > innerText) exactly matches one of the AMBIGUOUS_PATTERNS below.
 * "Read more about accessibility" is fine; "read more" alone is not.
 *
 * Explicitly excluded from flagging:
 *   - "Skip to content", "Back to top" — positional / skip navigation
 *   - "Next", "Previous", "Older posts", "Newer posts" — pagination
 *   - Any accessible name that merely *contains* an ambiguous word as part of a
 *     longer descriptive phrase (e.g. "Read more about WCAG 2.4.4")
 */

/** Shape of a violation returned from page.evaluate(). */
interface AmbiguousLink {
  href: string;
  accessibleName: string;
  snippet: string;
}

/** Patterns that are ambiguous when they are the *entire* accessible name. */
const AMBIGUOUS_PATTERNS: string[] = [
  'click here',
  'here',
  'read more',
  'more',
  'learn more',
  'continue',
  'continue reading',
  'details',
  'more details',
  'link',
  'this link',
  'go',
  'visit',
  'info',
  'information',
];

/**
 * Patterns that look superficially like ambiguous text but carry navigational
 * context by their position (pagination, skip links, utility anchors).
 * These are excluded regardless of accessible name match.
 */
const EXCLUDED_PATTERNS: string[] = [
  'skip to content',
  'skip to main content',
  'back to top',
  'next',
  'previous',
  'older posts',
  'newer posts',
  'next page',
  'previous page',
];

test.describe('check-08: ambiguous links', () => {

  for (const templateName of ACTIVE_TEMPLATES) {
    test(
      `link-ambiguous-1 — no ambiguous link text on ${templateName}`,
      async ({ page, templateUrl }, testInfo) => {
        // Desktop-only check — skip on mobile project
        if (testInfo.project.name !== 'desktop') {
          testInfo.skip();
          return;
        }

        await page.goto(templateUrl(templateName));

        const ambiguous: AmbiguousLink[] = await page.evaluate(
          ({
            ambiguousPatterns,
            excludedPatterns,
          }: {
            ambiguousPatterns: string[];
            excludedPatterns: string[];
          }): { href: string; accessibleName: string; snippet: string }[] => {
            const AMBIGUOUS = new Set(ambiguousPatterns);
            const EXCLUDED  = new Set(excludedPatterns);

            /** Compute the accessible name for a link element. */
            function computeAccessibleName(el: HTMLAnchorElement): string {
              // 1. aria-label takes precedence
              const ariaLabel = el.getAttribute('aria-label')?.trim();
              if (ariaLabel) return ariaLabel;

              // 2. aria-labelledby — concatenate text from all referenced IDs
              const labelledBy = el.getAttribute('aria-labelledby')?.trim();
              if (labelledBy) {
                const parts = labelledBy
                  .split(/\s+/)
                  .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
                  .filter(Boolean);
                if (parts.length > 0) return parts.join(' ');
              }

              // 3. Visible text content (normalise whitespace)
              return el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
            }

            const links = [...document.querySelectorAll('a[href]')] as HTMLAnchorElement[];
            const violations: { href: string; accessibleName: string; snippet: string }[] = [];

            for (const link of links) {
              const name = computeAccessibleName(link).toLowerCase();

              // Skip empty names (icon-only links) — those are caught by check-04
              if (!name) continue;

              // Skip explicitly excluded navigational patterns
              if (EXCLUDED.has(name)) continue;

              // Flag if the entire accessible name is an ambiguous pattern
              if (AMBIGUOUS.has(name)) {
                const clone = link.cloneNode(false) as Element;
                violations.push({
                  href: link.getAttribute('href') ?? '',
                  accessibleName: name,
                  snippet: clone.outerHTML,
                });
              }
            }

            return violations;
          },
          {
            ambiguousPatterns: AMBIGUOUS_PATTERNS,
            excludedPatterns:  EXCLUDED_PATTERNS,
          },
        );

        if (ambiguous.length > 0) {
          const details = ambiguous
            .map(
              (l) =>
                `  • accessible name: "${l.accessibleName}" | href: ${l.href || '(empty)'}\n    snippet: ${l.snippet}`,
            )
            .join('\n');

          testInfo.annotations.push({
            type: 'ambiguous-links',
            description: `${ambiguous.length} ambiguous link(s) found on ${templateName}:\n${details}`,
          });
        }

        expect(
          ambiguous,
          `Expected no ambiguous link text on "${templateName}" (desktop).\n` +
          `Found ${ambiguous.length} link(s) whose accessible name matches an ambiguous pattern.\n` +
          ambiguous
            .map(
              (l) =>
                `  href="${l.href}" accessible-name="${l.accessibleName}" → ${l.snippet}`,
            )
            .join('\n'),
        ).toHaveLength(0);
      },
    );
  }

});
