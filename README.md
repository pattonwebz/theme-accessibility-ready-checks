# Theme Accessibility Ready Checks

Automated accessibility testing suite for WordPress themes to verify compliance with WordPress "accessibility-ready" theme tag requirements.

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

### Running Tests

```bash
# Start WordPress test environment
docker-compose up -d

# Run accessibility tests
npm test

# Stop WordPress environment
docker-compose down
```

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
