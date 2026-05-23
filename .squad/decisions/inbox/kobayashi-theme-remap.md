# Theme Content Remapping Strategy

## Context
When switching WordPress themes during test runs, nav menus and sidebars were not being reconfigured for the new theme's registered locations.

## Decision
Created an idempotent `remap-theme-content.sh` script that runs after theme activation to:
- Re-assign existing nav menu to new theme locations
- Populate empty sidebars (classic themes only)
- Set up wp_navigation posts (block themes only)

## Rationale
1. **Separation of concerns:** Seed content creates pages/posts/menus once; remap script only reassigns existing content to new theme locations
2. **Idempotency:** Safe to run multiple times - checks before creating/assigning
3. **Block vs Classic awareness:** Different themes need different navigation patterns
4. **Integration method:** Using `docker compose cp` avoids modifying docker-compose.yml while keeping the script in version control

## Implementation
- Script: `docker/wordpress/init/remap-theme-content.sh`
- Trigger: `package.json` `theme:switch` script
- Execution: Copy into container → execute with bash

## Team Impact
- **McManus (Playwright):** Theme switches now properly set up nav/widgets for test consistency
- **Keaton (Toolchain):** No docker-compose changes needed; standard cp + exec pattern
- **Fenster (WCAG):** Nav menu structure now consistent across theme switches during test runs
