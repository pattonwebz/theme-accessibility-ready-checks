# Docker Setup

This directory contains the Docker Compose configuration for running WordPress test instances.

## Quick Start

```bash
# From the docker/ directory
docker compose up -d

# Wait for initialization to complete (watch logs)
docker compose logs -f wp-init

# Access WordPress at http://localhost:8080
# Default credentials: admin / password
```

## Services

### db
- **Image:** mysql:8.0
- **Purpose:** Database backend for WordPress
- **Health check:** `mysqladmin ping` every 5s
- **Data:** Persisted in `db_data` volume

### wordpress
- **Image:** Custom build (wordpress:6.5-apache + WP-CLI)
- **Port:** 8080 → 80
- **Purpose:** WordPress test instance
- **Health check:** HTTP GET to `/wp-login.php` every 10s
- **Volumes:**
  - Theme mounted from `THEME_PATH` (configurable)
  - Plugin mounted from `./plugins/a11y-test-support`
  - Uploads persisted in `wp_uploads` volume

### wp-init
- **Purpose:** One-shot initialization service
- **Runs:** WP-CLI scripts to install WordPress, configure permalinks, activate plugins
- **Restart:** no (runs once and exits)
- **Network:** Shares network namespace with wordpress service

## Configuration

All configuration is via environment variables defined in `.env` (copy from `.env.example`).

### Key Variables

- `WP_ADMIN_USER`, `WP_ADMIN_PASSWORD`, `WP_ADMIN_EMAIL` — Admin credentials
- `A11Y_THEME_SLUG` — Optional theme slug to activate after install (mapped to `THEME_SLUG` inside containers)
- `THEME_PATH` — Path to theme directory to mount (default: `.` - current directory)
- `WP_HOME`, `WP_SITEURL` — WordPress URL (default: `http://localhost:8080`)

## Initialization Scripts

Located in `wordpress/init/`:

- **install-wp.sh** — Core WordPress install, admin user creation, permalink setup
- **install-plugins.sh** — Activate a11y-test-support plugin
- **seed-content.sh** — Import fixture content from `/fixtures/content`
- **run-all.sh** — Orchestrator that runs all scripts in order

## Fixture Content

Place WXR export files in `../fixtures/content/`:
- `posts.xml` — Sample posts
- `pages.xml` — Sample pages
- `menus.xml` — Navigation menus

If fixtures are not present, initialization will skip content import and use WordPress defaults.

## Commands

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Stop and remove volumes (fresh start)
docker compose down -v

# Rebuild WordPress image
docker compose build wordpress

# Run WP-CLI commands
docker compose exec wordpress wp --allow-root <command>
```

## Architecture Notes

- WordPress is configured with `WORDPRESS_DEBUG=1` for development
- Permalinks are set to `/%postname%/` (pretty permalinks)
- Theme and plugin are mounted read-only to prevent accidental modification
- Database and uploads are persisted across container restarts
- Init service waits for WordPress health check before running
