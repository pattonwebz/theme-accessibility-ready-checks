# Team Decisions

## Theme Slug Configuration & Docker Integration

**Decision Date:** 2026-05-23  
**Decided By:** Keaton (Tooling & DevOps)  
**Status:** Implemented & Validated

### Theme Slug Wiring

1. External callers set `A11Y_THEME_SLUG`; Docker maps it to `THEME_SLUG` inside containers.
2. Theme activation in `wp-init` is conditional. If no slug is provided, WordPress keeps its default active theme.
3. The `wp-init` container must bootstrap its own `/var/www/html` and `wp-config.php` before running WP-CLI, because it does not share the initialized filesystem state from the long-running `wordpress` container.
4. All WP-CLI commands in the init scripts should include both `--allow-root` and `--path=/var/www/html`.

### Rationale

- `A11Y_THEME_SLUG` gives callers a stable, tool-specific input name without leaking Docker-specific env naming into the wider config surface.
- Conditional activation avoids clobbering the stock WordPress theme during smoke tests when no theme slug is supplied.
- Bootstrapping the one-shot init container fixes a real startup failure (`This does not seem to be a WordPress installation` / missing `wp-config.php`) and keeps the separate `wp-init` service architecture viable.
- Explicit `--path` makes WP-CLI behavior deterministic inside the init container instead of relying on shell cwd assumptions.

### Validation

- `wp-init` exits with code `0` after install.
- `http://localhost:8080/` returned `200`.
- `http://localhost:8080/sample-page/` returned `200`.
- `http://localhost:8080/wp-json/` returned JSON with `200`.
- `http://localhost:8080/wp-json/a11y-test/v1/` returned `404 rest_no_route`, acceptable while the plugin endpoint remains a placeholder.
