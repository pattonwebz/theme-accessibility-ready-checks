# Mcmanus — Project History

## Core Context

Project: theme-accessibility-ready-checks — Building Playwright tests in TypeScript to verify WordPress theme accessibility-ready requirements. Docker is used to spin up WordPress instances for testing. Requested by: William Patton.

## Learnings

- For skip link checks, lead with real keyboard behavior: press `Tab` from the top of the page, inspect `document.activeElement`, then assert the focused anchor becomes visible and activates its fragment target.
- Reuse Playwright's configured `desktop` and `mobile` projects for viewport coverage instead of overriding viewport size inside each test.
- For WordPress landmark handbook parity, treat the HTML5 support check as a classic-theme-only `navigation-widgets` requirement and mark block themes / themes without `functions.php` as not applicable.
