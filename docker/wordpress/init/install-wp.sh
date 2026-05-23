#!/bin/bash
set -e

echo "==> Waiting for WordPress to be ready..."
sleep 5

cd /var/www/html

# Check if WordPress is already installed
if wp core is-installed --allow-root --path=/var/www/html 2>/dev/null; then
  echo "==> WordPress already installed, skipping core install"
else
  echo "==> Installing WordPress core..."
  wp core install \
    --url="${WP_SITEURL:-http://localhost:8080}" \
    --title="Accessibility Test Site" \
    --admin_user="${WP_ADMIN_USER:-admin}" \
    --admin_password="${WP_ADMIN_PASS:-password}" \
    --admin_email="${WP_ADMIN_EMAIL:-admin@example.com}" \
    --skip-email \
    --allow-root \
    --path=/var/www/html

  echo "==> WordPress core installed successfully"
fi

if [ -n "${THEME_SLUG}" ]; then
  echo "==> Activating theme: ${THEME_SLUG}"
  wp theme activate "${THEME_SLUG}" --allow-root --path=/var/www/html
fi

# Set permalink structure to /%postname%/
echo "==> Configuring permalink structure..."
wp rewrite structure '/%postname%/' --allow-root --path=/var/www/html

# Flush rewrite rules
echo "==> Flushing rewrite rules..."
wp rewrite flush --allow-root --path=/var/www/html

echo "==> WordPress installation and configuration complete"
