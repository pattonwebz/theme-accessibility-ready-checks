#!/bin/bash
set -e

echo "==> Running all WordPress initialization scripts..."

/init/install-wp.sh
/init/install-plugins.sh
/init/seed-content.sh

echo "==> WordPress initialization complete!"
