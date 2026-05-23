# Theme Accessibility Ready Checks

Automated accessibility testing suite for WordPress themes to verify compliance with WordPress "accessibility-ready" theme tag requirements.

> **⚠️ Important:** The tests in this repository are best-effort checks only. They are **not a replacement for a human reviewer**. Accessibility review requires human judgement — these tests exist solely to speed up the subset of checks that are automatable and to surface obvious failures early. A passing test suite does not guarantee a theme meets the accessibility-ready standard.

## Overview

This project provides Playwright-based automated tests that validate whether WordPress themes meet the accessibility standards required for the "accessibility-ready" tag in the WordPress theme directory.

## Stack

- **TypeScript** — Type-safe test development
- **Playwright** — Browser automation and testing framework
- **Docker** — Containerized WordPress test instances for reproducible testing
- **Node.js** — Runtime environment

## What It Tests

This suite verifies WordPress accessibility-ready theme tag requirements, including:

- **Keyboard Navigation** — All interactive elements accessible via keyboard
- **Skip Links** — Proper skip-to-content link implementation
- **Form Labels** — All form inputs have associated labels
- **Focus Styles** — Visible focus indicators for interactive elements
- **ARIA Landmarks** — Proper semantic HTML and ARIA roles
- **Color Contrast** — Sufficient contrast ratios for text and UI elements
- **Screen Reader Compatibility** — Proper heading hierarchy and accessible content

## How It Works

1. **Docker Compose** spins up a containerized WordPress instance with the target theme installed
2. **Playwright** runs automated browser tests against the WordPress site
3. **Tests verify** specific accessibility requirements defined by WordPress theme guidelines
4. **Results** are captured and reported for CI/CD integration

## Getting Started

### Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- npm or yarn

### Installation

```bash
npm install
```

On a new machine you also need to install the Playwright browser binaries (this is a one-time step per machine):

```bash
npx playwright install
```

### Running Tests Against a Theme

Set the theme slug and run the full suite (spins up Docker, runs tests, tears down):

```bash
A11Y_THEME_SLUG=your-theme-slug npm run test:theme
```

To keep the Docker containers running after tests (useful for debugging):

```bash
A11Y_THEME_SLUG=your-theme-slug npm run test:theme:keep
```

The theme is downloaded from WordPress.org automatically using WP-CLI at container start time. `A11Y_THEME_SLUG` must match the theme's slug on WordPress.org (the same slug used in the theme's directory URL, e.g. `twentytwentyfour`).

### Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run setup` | Start Docker containers and wait for WordPress to be ready |
| `npm test` | Build TypeScript and run Playwright tests |
| `npm run teardown` | Stop and remove Docker containers |
| `npm run test:theme` | Full run: setup → test → teardown |
| `npm run test:theme:keep` | Setup and test, but leave containers running |

### Test Results

Screenshots and test artifacts are saved to `a11y-results/` (gitignored). Each run captures a screenshot after every test regardless of pass/fail.

## Project Structure

```
├── tests/           # Playwright test files
├── docker/          # Docker configuration for WordPress
├── src/             # Test utilities and helpers
└── playwright.config.ts
```

## Contributing

This project follows WordPress accessibility guidelines and WCAG 2.1 Level AA standards.

## License

TBD
