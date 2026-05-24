# Theme Accessibility Ready Checks

Automated accessibility testing suite for WordPress themes targeting compliance with the WordPress ["accessibility-ready" theme tag](https://make.wordpress.org/themes/handbook/review/accessibility/required/) requirements.

> **🚧 Work in Progress:** This suite is under active development. Check 12 (audio/video/animations) has no automated spec yet, and all checks should be treated as a **non-exhaustive sweep** — they surface common, automatable issues but cannot cover every accessibility requirement. Expect ongoing improvements in coverage, accuracy, and stability.

> **⚠️ Important:** These tests are best-effort checks only. They are **not a replacement for a human reviewer**. Accessibility review requires human judgement — this suite exists to speed up the automatable subset and surface obvious failures early. A passing run does not guarantee a theme meets the accessibility-ready standard.

> **📊 Scale:** The suite runs **1,000+ individual tests** across 8 page templates, on both **desktop (1280×800) and mobile (320×568)** viewports, covering multiple interaction states — each test contains multiple assertions, so the total number of data points per theme run is substantially higher. Test quality varies: the majority are well-refined and reliable, but a small number of checks are still early-stage and may produce occasional false positives or false negatives. Where a check is less stable, treat its result as a signal worth investigating rather than a definitive verdict.

## Overview

This project provides Playwright-based automated tests that validate whether WordPress themes meet the accessibility standards required for the "accessibility-ready" tag in the WordPress theme directory. Tests are run against a containerised WordPress instance spun up via Docker, so results are reproducible and environment-independent.

## Stack

- **TypeScript** — type-safe test development
- **Playwright** — browser automation and testing framework
- **Docker** — containerised WordPress test instances for reproducible results
- **Node.js / tsx** — runtime and script execution

## What It Tests

The suite maps directly to the 18 official WordPress accessibility-ready requirements:

| # | Check | Notes |
|---|-------|-------|
| 01 | Skip links | Presence, visibility on focus, correct targets |
| 02 | ARIA landmarks | Correct use of `main`, `nav`, `header`, `footer`, etc. |
| 03 | Keyboard navigation | Tab order, focus trapping, reverse navigation, focus outline ≥ 2 px |
| 04 | Controls | Buttons and links are keyboard-operable |
| 05 | Form labels | Every input has an associated label |
| 06 | Heading hierarchy | Logical heading order across page templates |
| 07 | Underlined links | In-content links are visually distinct (underlined) |
| 08 | Ambiguous links | Link text is meaningful out of context |
| 09 | New-tab warnings | Links that open new tabs warn the user |
| 10 | Colour contrast | Text meets WCAG AA contrast ratios |
| 11 | Alt text | Images have descriptive alt attributes |
| 12 | Audio/video/animations | *(no automated spec yet — manual review required)* |
| 13 | Reflow | Content is usable at narrow widths without horizontal scrolling |
| 14 | Context changes | User-initiated focus/input does not cause unexpected page changes |
| 15 | Hover & focus | Hover and keyboard-focus states expose the same content |
| 16 | Accessibility statement | `readme.txt` is scanned for accessibility statement language *(manual confirmation needed)* |
| 17 | No inaccessible plugins required | *(always manual — no automated signal)* |
| 18 | Screen reader text | Presence of `.screen-reader-text` utility class *(manual confirmation of meaning needed)* |

All checks that can be automated run against **8 page templates** (front page, blog, post with comments, category archive, formatted page, block patterns, search results, 404) on **both desktop and mobile** viewports.

### Checks requiring manual review

Three checks cannot be fully automated and will always require a human reviewer regardless of the automated result:

- **Check 16 — Accessibility Statement** — Automated scanning of `readme.txt` detects accessibility statement language, but a reviewer must confirm the statement is accurate and meaningful.
- **Check 17 — No inaccessible plugins required** — Whether a required or recommended plugin is accessible cannot be determined automatically; human evaluation is essential.
- **Check 18 — Screen reader text** — Whether screen-reader-only text conveys the correct meaning requires human judgement.

## How It Works

1. **Docker Compose** spins up a containerised WordPress instance with test content and the target theme installed
2. Nav menus and widget sidebars are remapped automatically after theme activation so test pages are consistent across themes
3. **Playwright** runs automated browser tests against the live site, across both desktop and mobile projects
4. **Results** are captured as JSON plus an HTML report with screenshots, ready for CI/CD or local review

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm

### Installation

```bash
npm install
```

Install Playwright browser binaries (one-time per machine):

```bash
npx playwright install
```

### Running Tests Against a Theme

Full clean run — tears down any existing containers, sets up fresh, runs all tests, then tears down again:

```bash
A11Y_THEME_SLUG=your-theme-slug npm run test:theme
```

Leave containers running after tests (useful for debugging or re-running quickly):

```bash
A11Y_THEME_SLUG=your-theme-slug npm run test:theme:keep
```

Run only a specific page template:

```bash
A11Y_TEMPLATES=front-page A11Y_THEME_SLUG=your-theme-slug npm run test:theme:keep
```

`A11Y_THEME_SLUG` must match the theme's slug on WordPress.org — the same value used in the theme directory URL (e.g. `twentytwentyfour`). The theme is downloaded and activated automatically via WP-CLI.

`A11Y_TEMPLATES` accepts a comma-separated list of template names: `front-page`, `blog`, `post-with-comments`, `category-archive`, `page-markup`, `block-patterns`, `search-results`, `404`. Defaults to all templates when unset.

### Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run setup` | Start Docker containers and wait for WordPress to be ready (idempotent) |
| `npm run teardown` | Stop and remove Docker containers and volumes |
| `npm run theme:switch` | Install and activate `A11Y_THEME_SLUG` in the running container, then remap menus/sidebars |
| `npm test` | Build TypeScript and run Playwright tests against already-running containers |
| `npm run test:theme` | Full clean run: teardown → setup → switch theme → test → teardown |
| `npm run test:theme:keep` | Start if needed, switch theme, run tests — leave containers running |
| `npm run test:theme:quick` | Switch theme and run tests assuming containers are already running |
| `npm run test:homepage` | Run tests against the front page only (`A11Y_TEMPLATES=front-page`) |
| `npm run test:headed` | Run tests in headed (visible browser) mode |
| `npm run test:ci` | Run tests with JSON + HTML reporters (for CI pipelines) |
| `npm run report` | Open the last HTML test report |
| `npm run typecheck` | Type-check all TypeScript without emitting |
| `npm run lint` | Lint `src/` and `tests/` with ESLint |

### Test Results

Screenshots and test artifacts are saved to `a11y-results/` (gitignored). Each test captures a screenshot regardless of pass/fail. Run `npm run report` to open the full HTML report.

## Project Structure

```
├── tests/
│   ├── checks/          # One spec file per accessibility-ready check
│   └── helpers/         # Shared fixtures and test utilities
├── src/
│   ├── types/           # Shared TypeScript types (check IDs, templates, results)
│   ├── config/          # Runtime configuration helpers
│   └── utils/           # Shared utilities (wait-for-wp, etc.)
├── fixtures/            # Playwright global setup / fixture definitions
├── docker/              # Docker Compose and WordPress init scripts
└── playwright.config.ts
```

## Contributing

This project follows the [WordPress accessibility-ready requirements](https://make.wordpress.org/themes/handbook/review/accessibility/required/) and targets WCAG 2.1 Level AA.

## License

TBD
