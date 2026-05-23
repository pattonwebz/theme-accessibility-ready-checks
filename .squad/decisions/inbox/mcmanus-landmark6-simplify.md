# McManus — landmark-6 simplified to endpoint verdict

## What changed
- Replaced the `landmark-6` test body with a direct request to `/wp-json/a11y-tests/v1/theme-support`.
- The test now asserts HTTP 200, reads `{ passed, reason }`, and uses `reason` as the failure message.
- Removed the JSON-tail regex workaround and all WordPress-specific payload branching from the test.

## Why
- Kobayashi's endpoint now owns the applicability and verdict logic for block themes, missing `functions.php`, and `navigation-widgets` support.
- Keeping the Playwright test as a thin consumer avoids duplicating WordPress logic in TypeScript.

## Verification
- Waited for the 8082 dev endpoint to switch to the new `{ passed, reason }` shape before verifying.
- The endpoint now returns the new shape, but the current 8082 response still has PHP warnings before the JSON body, so the Playwright `response.json()` call fails until that environment noise is removed.
