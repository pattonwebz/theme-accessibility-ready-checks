# Squad Decisions

## Architecture & System Design

### Full System Architecture — theme-accessibility-ready-checks
**Date:** 2026-05-23  
**Author:** Keaton (Tooling & DevOps)  
**Status:** Proposed — pending William's sign-off on open questions

**Major Decisions Made:**

1. **TypeScript throughout, two tsconfigs**
   - `tsconfig.json` compiles `src/` to `dist/` (runner, types, utils, reporters)
   - `tsconfig.test.json` extends base, type-checks `tests/` without emitting — Playwright handles test transpilation natively
   - Rationale: Clean separation between compiled library code and test-only code

2. **Config system: a11y.config.ts + env vars + defaults**
   - `defineConfig()` pattern (same as Vite/Playwright) for IDE autocomplete
   - Zod schema validates config at startup — exits with clear error before Docker/tests run
   - Priority order: env vars > a11y.config.ts > defaults
   - Rationale: Config as TypeScript is type-safe and familiar to theme devs already using TS tooling

3. **Docker: wordpress + mysql + wp-init services**
   - `wp-init` is a one-shot service using WP-CLI to install, seed, and configure
   - Theme dir is volume-mounted read-only via `THEME_PATH` env var
   - `a11y-test-support` plugin is volume-mounted from inside the npm package
   - Rationale: Reproducible, clean separation of concerns, no custom WP image needed beyond adding WP-CLI

4. **npm bin commands for theme repo integration**
   - `a11y-ready-test`, `a11y-ready-setup`, `a11y-ready-teardown` registered in `bin`
   - Theme devs call these without needing package.json scripts
   - Rationale: Theme repos shouldn't need to mirror this package's scripts section

5. **Result collection: per-test NDJSON files, aggregated in globalTeardown**
   - Each spec writes `CheckResult` objects to `.tmp-results/{checkId}.ndjson`
   - `globalTeardown` aggregates into final `A11yReport`
   - Rationale: Avoids shared state between Playwright workers; worker-safe pattern

6. **File scanner: Node.js (not PHP REST endpoint)**
   - `src/utils/file-scanner.ts` scans theme files directly from `THEME_PATH`
   - No dependency on the running WordPress instance for this check
   - Rationale: Simpler, more portable, works even if Docker isn't running

7. **REST plugin: debug-mode only, security gated**
   - Plugin only registers endpoints when `A11Y_TEST_MODE` constant is defined
   - All endpoints require either `WP_DEBUG=true` or `A11Y_TEST_SECRET` header
   - Rationale: Zero risk of production exposure; clearly test-environment-only

8. **Playwright workers: serial (workers: 1)**
   - Rationale: WordPress state (logged-out, specific pages) must be consistent across tests; parallel runs risk race conditions on a single WP instance

9. **axe-core: exact version pinning**
   - Pinned with `=` not `^`
   - Rationale: axe-core version changes can alter which violations are flagged; reproducibility requires exact pinning

10. **Report output: custom A11yReport JSON + custom HTML + Playwright HTML**
    - `report.json` → canonical machine-readable output (A11yReport schema)
    - `report.html` → custom human-readable, aligned to WP reporting format
    - `playwright-html/` → Playwright's own report kept for debugging test failures
    - Rationale: WP reporting format requires our own schema; Playwright's reporter is for dev debugging, not stakeholder output

**Open Questions (Need William's Input):**
1. npm registry — Public npm vs GitHub Packages for distribution
2. axe-core pinning — Confirm exact version pinning is acceptable
3. Multi-violation detail — Full array vs. truncated at 50 with flag
4. File scanner location — Confirm Node.js over REST endpoint approach
5. Manual check output — Checklist section in HTML report vs. just `not-evaluated`
6. Node.js minimum — `>=20` or `>=18`

### Docker Compose Infrastructure
**Date:** 2026-05-23  
**Author:** Keaton (Tooling & DevOps Lead)  
**Status:** Implemented

**Services:**
- **db (MySQL 8.0)** — Database backend with health check (mysqladmin ping every 5s, 10 retries)
- **wordpress (WordPress 6.5-apache + WP-CLI)** — Test WordPress instance (curl health check every 10s)
- **wp-init (one-shot)** — WP-CLI automation for installation and configuration

**Key Choices:**
- Version Pinning: MySQL 8.0, WordPress 6.5-apache (explicit pins prevent test drift)
- Permalink Configuration: Set to `/%postname%/` via WP-CLI in init script
- Init Strategy: One-shot service runs after WordPress health check; scripts are idempotent
- Environment Variables: All via `.env` file with sensible defaults
- Volume Mounts: Theme read-only at `/wp-content/themes/${THEME_SLUG}`, uploads/db as named volumes
- Port Mapping: WordPress on 8080:80 (avoids conflict with local services)

**Alternatives Considered:**
- Docker Compose location: Root vs. docker/ subdirectory → Chosen `docker/docker-compose.yml` (keeps root clean)
- Init approach: Separate wp-init service vs. custom entrypoint → Separate service (cleaner, easier to debug)
- Config: .env vs. hardcoded → .env with defaults (allows CI override, keeps secrets out)

## Architecture Open Questions Resolved
**Date:** 2026-05-23  
**By:** pattonwebz (via Copilot)

**Q1 — npm registry:** Neither for now. Distribution strategy deferred.

**Q2 — axe-core version pinning:** Exact pin (`=x.y.z`). No caret ranges.

**Q3 — Multi-violation reporting:** Report ALL violations. No truncation, no `truncated` flag needed.

**Q4 — File scanner:** Deferred. Still leaning toward PHP REST endpoint for some checks. Do not implement yet.

**Q5 — WordPress fixtures:** Hybrid approach. WP-CLI for structure (pages, menus, settings) + WXR imports for complex block content.

**Q6 — Manual checks (12/17/18):** Emit `not-evaluated` only. No checklist section in HTML report, no interactive mode.

## Specifications & Test Framework

### Adopting Prior WP A11y Test Spec
**Date:** 2026-05-23  
**Agent:** Fenster (Accessibility Specialist)  
**Status:** Ready for Implementation

**Summary:** A comprehensive specification for testing WordPress accessibility-ready theme requirements exists in the prior session's `wp-a11y-test-system/` directory. All 18 WP Accessibility Team guidelines have been fully specified with detailed check specifications, tool delegation decisions, JSON output schema, and edge cases.

**Recommendation:** ADOPT in full. The spec is complete, well-reasoned, and ready for implementation.

**18 Accessibility Requirements (Fully Specified):**
1. Skip to Content Link (Playwright)
2. Meaningful Landmark Roles & Names (Playwright + REST)
3. Keyboard Navigation Support (Playwright)
4. Controls with Accessible Names, Roles, States (Playwright)
5. Labelled Form Fields (Playwright + axe)
6. Headings with Meaningful Structure (Playwright)
7. Underlined Links in Text (Playwright)
8. No Ambiguous Link Text (Playwright)
9. No Links Opening New Tabs Without Warning (Playwright + scan)
10. Sufficient Colour Contrast (axe-core)
11. Alternative Text on Images (axe + custom rule)
12. Reflow, Resize, Text Spacing (Playwright)
13. No Unexpected Context Changes (Playwright)
14. Content on Hover/Focus is Accessible (Playwright)
15. Screen Reader Text Support (Playwright + scan)
16. Audio/Video Accessibility (Manual)
17. Accessibility Statement (Manual)
18. Plugin Review (Manual)

### TypeScript Project Scaffolding
**Date:** 2026-05-23  
**Owner:** Keaton (Tooling & DevOps)  
**Status:** ✅ Complete

**Decision:** Scaffolded complete TypeScript project structure in inner repository with 7 atomic commits.

**Key Configuration Decisions:**
1. axe-core version pinning: `=4.9.1` (exact match, not semver range) — Accessibility rule consistency
2. Node.js minimum version: `>=20.0.0` — Modern LTS, native fetch API
3. Build artifacts: `dist/` directory gitignored; source of truth is `src/`
4. Config loader integration: Playwright config uses env vars until build ready

**Project Structure:**
```
package/theme-accessibility-ready-checks/
├── package.json
├── tsconfig.json              # src/ → dist/
├── tsconfig.test.json         # Type-checks tests only
├── playwright.config.ts       # Serial workers, desktop + mobile
├── a11y.config.ts             # User config template
└── src/
    ├── types/
    │   ├── checks.ts          # 30 CheckIds, 8 templates, CheckResult
    │   ├── report.ts          # A11yReport, EnvironmentInfo
    │   ├── config.ts          # A11yConfig interface
    │   └── index.ts           # Barrel export
    ├── config/
    │   ├── defaults.ts        # Config with env fallbacks
    │   ├── schema.ts          # Zod validation schema
    │   └── loader.ts          # Config loader
    └── utils/
        ├── viewport.ts        # Viewport constants
        ├── axe.ts             # axe-core integration
        ├── wait-for-wp.ts     # WP health check
        └── rest-client.ts     # REST API stub
```

**Commit Strategy:** 7 atomic commits (package.json, TypeScript configs, Playwright, types, config, utilities, example config)

**Next Steps:**
1. McManus: Review type definitions in `src/types/checks.ts`
2. Keaton: Run `npm install` after approval
3. Keaton: Wire config loader into Playwright after build
4. McManus: Begin implementing check specs

### Test Stub Architecture
**Date:** 2026-05-23  
**Agent:** McManus  
**Status:** Implemented

**Test Organization:**
- **File naming:** `check-NN-short-name.spec.ts` (zero-padded, kebab-case)
- **Helper files:** `fixtures.ts`, `axe-helpers.ts`, `result-collector.ts`
- **Manual checks (12, 17, 18):** Use `test()` with `not-evaluated` status (NOT `test.todo()`)
- **Automatable checks (01-11, 13-16):** Use `test.todo()` with descriptive text

**Check ID Coverage (30 total):**
- Skip links: `skip-1`
- Landmarks: `landmark-1` through `landmark-6`
- Keyboard: `keyboard-1`, `keyboard-mobile-1`
- Controls: `controls-1`, `controls-2`, `controls-mobile-1`
- Form labels: `form-3`
- Headings: `heading-1`, `heading-2`
- Link underline: `link-underline-1`
- Ambiguous links: `link-ambiguous-1`
- New tab warnings: `new-tab-1`
- Colour contrast: `contrast-1`
- Alt text: `alt-text-1`
- Reflow: `reflow-1`, `reflow-2`, `reflow-3`
- Context changes: `context-change-1`, `context-change-2`
- Hover/focus: `hover-focus-1`, `hover-focus-2`
- Screen reader text: `screen-reader-text-1`
- Audio/video: `audio-video-1` (manual)
- A11y statement: `a11y-statement-1` (manual)
- Plugin review: `plugin-review-1` (manual)

## User Directives & Governance

### Directive: wp-cli Command Flag
**Date:** 2026-05-23  
**By:** pattonwebz (via Copilot)

Every wp-cli command run in this system must include the `--allow-root` flag.

**Why:** WP-CLI refuses to run as root without this flag; all Docker-based WP-CLI invocations in init scripts and test helpers must include it.

**Implementation:** All WP-CLI invocations in init scripts, test helpers, and CI workflows require `--allow-root`.

### Directive: Build in Small Commits
**Date:** 2026-05-23  
**By:** William Patton (via Copilot)

Build in small commits. Every change should be committed in pieces small enough that each commit is human-readable and meaningful in isolation. Never batch a whole chunk of code into a single commit.

**Why:** User request — captured for team memory.

### Directive: CI is Secondary
**Date:** 2026-05-23  
**By:** pattonwebz (via Copilot)

CI integration is secondary to building the core system. Do not add or work on CI configuration until the core system (TypeScript scaffolding, test specs, utilities, REST plugin, fixtures) is built and working.

**Why:** User request — captured for team memory.

### Directive: Setup Stage Only
**Date:** 2026-05-23  
**By:** pattonwebz (via Copilot)

At this stage, work is setup only. Do not build checks, test specs, or any test logic until setup is complete and William explicitly says to move on.

**Why:** User request — captured for team memory.

### Directive: Theme Slug Input
**Date:** 2026-05-23  
**By:** pattonwebz (via Copilot)

The system must accept a theme slug as input so a specific theme can be targeted at run time. Theme slug should be passable via CLI (e.g. env var or script argument) without requiring edits to the config file.

**Why:** User request — enables testing any installed theme without reconfiguring.

**Implementation notes:**
- `A11Y_THEME_SLUG` env var is already referenced in docker-compose (`THEME_SLUG`)
- Should be respected in this priority: CLI env var > a11y.config.ts > default
- Docker compose already volume-mounts a theme via THEME_PATH; slug tells WP which theme to activate
- Affects: config defaults, wait-for-wp/setup flow, WP-CLI theme activation in init scripts
- Example usage: `A11Y_THEME_SLUG=twentytwentyfour npm test`

### Directive: Standalone Repository Created
**Date:** 2026-05-23  
**By:** Keaton (Tooling & DevOps)  
**Status:** Completed

Created a standalone Git repository for the theme-accessibility-ready-checks project to enable independent distribution and version control.

**Repository:** https://github.com/pattonwebz/theme-accessibility-ready-checks

**Implementation:**
- Location: `/media/williampatton/WIP/theme-accessibility-ready-checks/package/theme-accessibility-ready-checks/`
- Repository Type: Private GitHub repository
- Branch: master (tracking origin/master)
- Contents: README.md, .gitignore (TypeScript/Playwright/Node/Docker configured)

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
