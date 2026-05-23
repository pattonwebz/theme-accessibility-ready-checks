# Fenster — Project History

## Core Context

Project: theme-accessibility-ready-checks — Building Playwright tests in TypeScript to verify WordPress theme accessibility-ready requirements. Docker is used to spin up WordPress instances for testing. Requested by: William Patton.

## Learnings

### Prior WP A11y Test System Spec Review

**Source:** `/wp-a11y-test-system/` directory — comprehensive spec from earlier session (May 2026).

#### 18 WordPress Accessibility-Ready Requirements Identified

All 18 requirements mapped to WP Accessibility Team guidelines (overhaul from May 2026, first update since 2012):

1. **Skip to Content Link** — WCAG 2.4.1. Requires: visible skip link that becomes visible on first Tab, targets main content, navigates focus correctly.
2. **Meaningful Landmark Roles & Names** — Custom. Requires: `<main>`, `<nav>`, `<header>`, `<footer>`, `<aside>` with proper names. Includes theme function check via REST endpoint.
3. **Keyboard Navigation Support** — WCAG 2.1.1. Tested at both 1280px (desktop) and 320px (mobile) viewports separately.
4. **Controls with Accessible Names, Roles, States** — WCAG 4.1.2. All interactive elements must have accessible names.
5. **Labelled Form Fields** — WCAG 1.3.1, 2.4.6. Search form needs visible label (or magnifying glass icon). All form inputs need programmatic labels. Comment form fields visible.
6. **Headings with Meaningful Structure** — WCAG 1.3.1. H1–H6 used correctly, no skipped levels, hierarchy reflects content.
7. **Underlined Links in Text** — WCAG 1.4.1. Links within body text must have underline or other visual distinction beyond colour.
8. **No Ambiguous Link Text** — WCAG 2.4.4. Links must have descriptive text; "click here", "read more" not allowed alone.
9. **No Links Opening New Tabs Without Warning** — WCAG 3.2.2. Target="_blank" requires warning. Can be static warning text on page or in documentation.
10. **Sufficient Colour Contrast** — WCAG 1.4.3/1.4.11. Text 4.5:1, large text 3:1, UI controls 3:1 minimum.
11. **Alternative Text on Images** — WCAG 1.1.1. Decorative images use empty alt + role="presentation". Content images need meaningful alt.
12. **Support for Reflow, Resize, Text Spacing** — WCAG 1.4.4, 1.4.12. No horizontal scrolling at 320px. Text can be enlarged/spaced without loss.
13. **No Unexpected Changes of Context** — WCAG 3.2.2. Changing input focus must not unexpectedly submit form or navigate away.
14. **Content on Hover/Focus is Accessible** — WCAG 1.4.13. Hover/focus-triggered content must be dismissible, remain visible, and not obscure input.
15. **Screen Reader Text Support** — WCAG 2.1.2, 3.3.2. Theme supports `.screen-reader-text` class; it must not be display:none or visibility:hidden.
16. **Accessible Audio, Video, Animations** — WCAG 1.2.1, 1.2.2, 2.3.3. **MANUAL ONLY** — Cannot test caption/transcript quality or pause mechanisms programmatically.
17. **Accessibility Statement** — Custom. Theme must link to accessibility statement. **MANUAL** (link presence automated; statement content requires human review).
18. **Must Not Recommend Inaccessible Plugins** — Custom. **MANUAL** — Requires code review of plugin recommendations in documentation/functions.php.

#### Architecture & Tooling Decisions

**Playwright + axe-core hybrid approach:**
- Playwright: 13 of 18 requirements (keyboard, DOM structure, focus, reflow, hover/focus content, etc.)
- axe-core: Colour contrast, alt text presence, suspicious alt patterns (custom rule ported from Accessibility Checker)
- Manual: Audio/video, accessibility statement content, plugin accessibility
- REST endpoint required for landmark-6 (theme function check at `/wp-json/a11y-test/v1/theme-support`)
- File scanning: Links with target="_blank" and `.screen-reader-text` class usage

**Template Coverage:** Fixed 8 templates per official WP reporting spec:
- front-page (`/`)
- blog (`/blog/`)
- post-with-comments (`/template-comments/`)
- category-archive (`/category/block/`)
- page-markup-formatting (`/accessibility-ready-test-pages/page-markup-and-formatting/`)
- block-patterns (`/accessibility-ready-test-pages/block-patterns/`)
- search-results (`/?s=block`)
- 404 (`/404/`)

**Viewport Strategy:** Separate test runs for desktop (1280px) and mobile (320px) where nav/controls differ. Check IDs prefixed with viewport (`keyboard-mobile-*`, `controls-mobile-*`).

**Result Format:** Single JSON per run mirroring Google Sheets template structure. Statuses: `pass`, `fail`, `not-applicable`, `not-evaluated` (manual only).

**Media:** Videos with 200ms tab delays, screenshots before/after interaction, no video required for form/contrast checks.

#### What Was Completed in Prior Spec

✅ **All 18 check specification documents written** — Each includes:
- WCAG criteria mapping
- Specific testable checks (4–6 per requirement)
- JSON output schema examples
- Edge cases and failure reporting notes
- Tool delegation (Playwright vs. axe)

#### What Needs Carried Forward

1. **All 18 requirement specs are valid and complete** — No rewrites needed. Architecture, tools, and coverage are sound.
2. **REST endpoint stub** — Template at `/wp-json/a11y-test/v1/theme-support` must be implemented in test environment setup (landmark-6 check depends on it).
3. **Content fixtures** — Test site content must be seeded with headings, multiple posts, widgets, etc. for testability.
4. **Check ID stability** — All check IDs (skip-1, form-3, keyboard-mobile-1, etc.) are defined in specs — maintain these in implementation.
5. **Manual checks handling** — Requirements 12, 17, 18 are intentionally not automated; JSON output should still include them with status `not-evaluated`.
6. **Suspicious alt text custom rule** — Needs porting to axe context (ported from Accessibility Checker, pattern matching included in check-11 spec).

#### Docker Infrastructure Ready (2026-05-23)

- Keaton completed Docker Compose stack setup with MySQL, WordPress, and WP-CLI-enabled initialization service.
- A11Y_THEME_SLUG environment variable wired through Docker Compose configuration.
- wp-init bootstrap ordering fixed — one-shot init container properly bootstraps `/var/www/html` and `wp-config.php`.
- End-to-end smoke test passed: WordPress at `http://localhost:8080/` returning `200`, REST API at `/wp-json/` operational.
- Docker stack is ready for test implementation.

#### Gaps & Revisits Needed

1. **Screen reader testing** — Specs mention accessibility names, roles, and computed properties but don't include live region testing, announcements, or actual screen reader verification. May be necessary later.
2. **Visual regression** — Specs capture before/after screenshots but no comparison/regression tracking system is described. Useful for CI/CD pipelines.
3. **Partial failure handling** — When a check applies to multiple instances (e.g., 10 images), current JSON schema allows one `detail` field — may need array-of-violations for scale.
4. **Plugin recommendations coverage** — Requirement 18 is marked manual but could have a semi-automated scan of `functions.php` for common inaccessible plugins (known blocklist approach).
5. **Reflow testing gaps** — Spec mentions testing at 320px but doesn't detail how to test text spacing (requires setting font-size and letter-spacing in browser DevTools or via CSS injection).
