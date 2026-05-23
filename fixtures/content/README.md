# WordPress Content Fixtures

This directory contains WordPress content fixtures (WXR exports) used to seed the test WordPress instance with consistent content for accessibility testing.

## Expected Files

- `posts.xml` — Sample posts with proper heading structure (H2–H4)
- `pages.xml` — Sample pages for testing page markup and block patterns
- `menus.xml` — Navigation menus for landmark and skip link tests

## Generating Fixtures

These fixtures will be created by exporting content from a properly configured WordPress instance using:

```bash
wp export --dir=/path/to/fixtures/content
```

## Current Status

⚠️ **Fixtures not yet created.** The init scripts will gracefully skip content import if these files are not present.
