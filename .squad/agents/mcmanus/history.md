# Mcmanus — Project History

## Core Context

Project: theme-accessibility-ready-checks — Building Playwright tests in TypeScript to verify WordPress theme accessibility-ready requirements. Docker is used to spin up WordPress instances for testing. Requested by: William Patton.

## Learnings

- For skip link checks, lead with real keyboard behavior: press `Tab` from the top of the page, inspect `document.activeElement`, then assert the focused anchor becomes visible and activates its fragment target.
- Reuse Playwright's configured `desktop` and `mobile` projects for viewport coverage instead of overriding viewport size inside each test.
- For `landmark-6`, keep Playwright as a thin consumer of the theme-support endpoint: assert HTTP 200, parse `{ passed, reason }`, and let the endpoint own all WordPress applicability logic.

## 2026-05-23 — landmark-6 simplified

- Replaced the `landmark-6` test body with a direct `{ passed, reason }` verdict assertion from `/wp-json/a11y-tests/v1/theme-support`.
- Removed the regex JSON-tail hack and the test-side block theme / `functions.php` / `html5` branching.
- Verified the endpoint eventually switched to the new payload on port 8082, but the targeted Playwright run still fails in the current dev environment because PHP warnings are emitted before the JSON response.
