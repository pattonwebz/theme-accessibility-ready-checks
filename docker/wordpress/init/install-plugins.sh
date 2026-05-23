#!/bin/bash
set -e

cd /var/www/html

echo "==> Installing and activating plugins..."

# Activate a11y-test-support plugin if it exists
if [ -d "wp-content/plugins/a11y-test-support" ]; then
  echo "==> Activating a11y-test-support plugin..."
  wp plugin activate a11y-test-support --allow-root --path=/var/www/html || echo "Warning: Could not activate a11y-test-support plugin"
else
  echo "Warning: a11y-test-support plugin directory not found"
fi

echo "==> Plugin installation complete"
