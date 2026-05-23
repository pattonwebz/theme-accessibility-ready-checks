# Keaton — Project History

## Core Context

Project: theme-accessibility-ready-checks — Building Playwright tests in TypeScript to verify WordPress theme accessibility-ready requirements. Docker is used to spin up WordPress instances for testing. Requested by: William Patton.

## Learnings

### Full System Architecture Planned (2026-05-23)
- Produced comprehensive architecture document at `package/theme-accessibility-ready-checks/ARCHITECTURE.md`
- Two-tsconfig approach: `tsconfig.json` compiles `src/` only; `tsconfig.test.json` type-checks tests without emit (Playwright handles test transpilation natively)
- Config system: `defineConfig()` pattern + Zod validation + env var override priority
- Docker: `wordpress` + `mysql` + one-shot `wp-init` service using WP-CLI; theme volume-mounted via `THEME_PATH`
- npm bin commands (`a11y-ready-test`, `a11y-ready-setup`, `a11y-ready-teardown`) for theme repo integration without requiring package.json script copying
- Result collection: per-test NDJSON files in `.tmp-results/`, aggregated in `globalTeardown` — worker-safe pattern
- File scanner: Node.js in `src/utils/file-scanner.ts`, NOT a PHP REST endpoint — more portable
- REST plugin (`a11y-test-support`): security-gated to `A11Y_TEST_MODE` constant + `WP_DEBUG` or secret header
- Playwright workers: serial (`workers: 1`) to preserve WordPress state consistency
- axe-core: exact version pinning with `=` for reproducibility
- Report output: custom `A11yReport` JSON + custom HTML aligned to WP format + Playwright HTML for debugging
- Implementation order defined: Keaton scaffolds → McManus writes specs → Keaton wires utilities → McManus wires checks → Keaton reporters + CI

### Open Questions (need William's input)
- npm registry (public npm vs GitHub Packages)
- axe-core pinning confirmation
- Multi-violation detail truncation strategy
- Manual check output format (HTML checklist vs. just `not-evaluated`)
- Node.js minimum version (`>=18` or `>=20`)

### Standalone Package Repository Created
- Created private GitHub repository: https://github.com/pattonwebz/theme-accessibility-ready-checks
- Initialized at `/media/williampatton/WIP/theme-accessibility-ready-checks/package/theme-accessibility-ready-checks/`
- Set up as standalone git repo (separate from outer .squad/ directory)
- Added comprehensive README.md covering project purpose, stack, accessibility requirements, and getting started guide
- Added .gitignore for TypeScript/Playwright/Node/Docker project
- Pushed initial commit to GitHub (master branch)

### Docker Compose Infrastructure Implemented (2026-05-23)
- Created complete Docker Compose setup in `package/theme-accessibility-ready-checks/docker/`
- MySQL 8.0 with health checks for startup coordination
- WordPress 6.5-apache extended with WP-CLI via custom Dockerfile
- One-shot `wp-init` service using WP-CLI for automated WordPress setup
- Permalink structure configured to `/%postname%/` with rewrite flush
- Environment variable configuration via `.env` (template in `.env.example`)
- All credentials and configuration externalized to env vars with safe defaults
- Health checks: MySQL via `mysqladmin ping`, WordPress via `/wp-login.php` HTTP check
- Volume mounts: theme (configurable path), plugin (a11y-test-support), uploads persistence
- Init scripts are idempotent and handle missing fixtures gracefully
- Placeholder `a11y-test-support` plugin created for volume mounting
- Fixtures directory structure created with documentation (content to be added later)
- Comprehensive Docker README with quick start, architecture, and common commands
- **Version pins:** MySQL 8.0, WordPress 6.5-apache (explicit, not `latest`)
- **Port:** WordPress accessible at `http://localhost:8080` (configurable via `WP_HOME`)
- **Small commits:** 7 commits following logical units (env → compose → init scripts → wiring → docs)

### Theme Slug Wiring & Docker Smoke Test (2026-05-23)
- Added `themeSlug?: string` to `A11yConfig`, defaulted it from `A11Y_THEME_SLUG`, and documented that Playwright inherits the env var without extra passthrough.
- Mapped external `A11Y_THEME_SLUG` to internal container `THEME_SLUG` in Docker Compose; activation is now conditional so WordPress keeps its default theme unless a slug is provided.
- Verified every WP-CLI invocation in `docker/wordpress/init/*.sh` now includes `--allow-root`; also added `--path=/var/www/html` everywhere for reliability.
- Smoke test initially failed because the one-shot `wp-init` container did not get core files or `wp-config.php` from the long-running `wordpress` container.
- Fixed that by bootstrapping `/var/www/html` from `/usr/src/wordpress` and copying `wp-config-docker.php` before running WP-CLI.
- End-to-end smoke test passed for `/`, `/sample-page/`, and `/wp-json/`; `/wp-json/a11y-test/v1/` returned `404 rest_no_route`, which is acceptable for the current placeholder plugin.
