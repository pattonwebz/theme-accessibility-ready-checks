# Kobayashi: sidebar widget strategy

- Detect theme type at runtime with `wp_is_block_theme()`.
- Skip sidebar population for block themes because classic `wp widget` commands do not apply to FSE-managed widget areas.
- For classic themes, enumerate active registered sidebars via `wp sidebar list`.
- Ignore the virtual `wp_inactive_widgets` bucket.
- Keep the seeding idempotent by skipping any sidebar that already contains widgets.
- Populate empty sidebars with Search, Recent Posts, Text, and Categories widgets so landmark and sidebar-dependent theme structures render during accessibility checks.
- Treat individual widget insertion failures as non-fatal so seeding continues across theme and WordPress version differences.
