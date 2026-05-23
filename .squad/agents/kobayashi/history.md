# Kobayashi — Project History

## Core Context

Project: theme-accessibility-ready-checks — Building Playwright tests in TypeScript to verify WordPress theme accessibility-ready requirements. Docker is used to spin up WordPress instances for testing. Requested by: William Patton.

## Learnings

### 2026-05-23: Generic HTML5 theme-support checks are redundant for block themes and overbroad for classic themes

- In WP core, `_add_default_theme_supports()` is hooked on `after_setup_theme` and automatically adds `html5` support for block themes (`comment-form`, `comment-list`, `search-form`, `gallery`, `caption`, `style`, `script`).
- Running container evidence: Twenty Twenty-Five has no explicit `add_theme_support( 'html5' )` call, yet `get_theme_support( 'html5' )` is populated; `navigation-widgets` is still `false`.
- Classic themes still get markup branching from explicit HTML5 support checks in core (`search-form`, `comment-form`, `comment-list`, `gallery`, `caption`, and `navigation-widgets`), so HTML5 support is not implicit there.
- The only clearly landmark-relevant subfeature is `navigation-widgets`, which makes core navigation-ish widgets output `<nav aria-label="…">` wrappers; generic `html5_enabled` is therefore a bad landmark proxy.
- On the separate 8082 dev site, `/wp-json/a11y-tests/v1/theme-support` currently returns `rest_no_route` 404, so that environment cannot presently support this check via REST.

### 2026-05-23: TT5 nav labels come from our DB overrides, not stock theme output

- Twenty Twenty-Five ships header/footer navigation blocks without `ariaLabel` and without `ref` in `patterns/header.php` and `patterns/footer.php`.
- Current core navigation rendering only adds `aria-label` when the block has a non-empty `ariaLabel` or a `ref` to a published `wp_navigation` post title; there is no fallback naming guarantee.
- Our `seed-content.sh` currently creates `wp_template_part` overrides for TT5 header/footer plus `wp_navigation` posts (`Main`, `Explore`, `Resources`), so the current homepage nav labels are fixture-generated rather than stock TT5 output.
- For theme-fidelity testing, the canonical/default profile should avoid these overrides and let `landmark-2` expose the real TT5/default-state failure; any override-based accessible baseline should be documented as a separate non-canonical fixture profile.

### 2026-05-23: theme-support REST endpoint now returns pass/fail verdicts

- Updated `a11y_tests_theme_support()` so the endpoint returns only `{ passed, reason }` and owns the WordPress-specific verdict.
- Block themes now pass automatically, themes without `functions.php` pass as not applicable, classic themes pass only when `get_theme_support( 'html5' )` includes `navigation-widgets`, and otherwise fail.
- Bumped the plugin header version from `1.1.0` to `1.2.0`.
- Verified on the 8082 dev WordPress instance that the endpoint returns HTTP 200 with `{"passed":true,"reason":"Block theme — HTML5 support registered automatically by WordPress core."}`.

## Learnings

### Theme Content Remapping on Theme Switch (2024)

**Problem:** When switching themes via `npm run theme:switch`, nav menus weren't being reassigned to new theme locations, and sidebars remained empty.

**Decision:** Created `docker/wordpress/init/remap-theme-content.sh` - an idempotent script that:
- Re-assigns "Accessibility Test Menu" to all current theme nav menu locations
- Populates empty sidebars with widgets (search, recent-posts, text, categories) for classic themes only
- Creates wp_navigation posts and template parts for block themes
- Mirrors seed-content.sh logic (lines 265-430) but WITHOUT recreating content

**Implementation:**
- Script uses `set -e` for fail-fast behavior
- Detects block vs classic theme: `wp eval "echo (function_exists('wp_is_block_theme') && wp_is_block_theme() ? 'block' : 'classic');"`
- Skips `wp_inactive_widgets` sidebar
- Only populates sidebars with 0 widgets (idempotent)
- Uses graceful fallbacks with `|| true` for non-critical operations

**Integration:**
- Updated `package.json` `theme:switch` script to:
  1. Install and activate theme (existing)
  2. Copy remap script into container via `docker compose cp`
  3. Execute script via `docker compose exec -T wordpress bash /var/www/remap-theme-content.sh`
- Script placed in `docker/wordpress/init/` directory alongside other init scripts

**Key Files:**
- Created: `package/theme-accessibility-ready-checks/docker/wordpress/init/remap-theme-content.sh`
- Modified: `package/theme-accessibility-ready-checks/package.json` (line 24: theme:switch)
- Reference: `package/theme-accessibility-ready-checks/docker/wordpress/init/seed-content.sh` (lines 265-430)

**Why This Pattern:**
- The wordpress service container doesn't have the init scripts mounted (only wp-init does)
- Using `docker compose cp` + `exec` avoids needing to modify docker-compose.yml
- Keeps the script in version control alongside other init scripts for maintainability
