#!/bin/bash
set -e

echo "==> Running all WordPress initialization scripts..."

if [ ! -f /var/www/html/wp-includes/version.php ]; then
  echo "==> Copying WordPress core files into wp-init container..."
  cp -an /usr/src/wordpress/. /var/www/html/
fi

if [ ! -f /var/www/html/wp-config.php ]; then
  echo "==> Creating wp-config.php for wp-init container..."
  cp /usr/src/wordpress/wp-config-docker.php /var/www/html/wp-config.php
fi

/init/install-wp.sh
/init/install-plugins.sh
/init/seed-content.sh

echo "==> WordPress initialization complete!"
