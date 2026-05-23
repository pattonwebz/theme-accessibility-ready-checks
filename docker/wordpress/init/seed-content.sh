#!/bin/bash
set -e

cd /var/www/html

echo "==> Seeding WordPress content..."

# Check if fixtures exist
if [ -d "/fixtures/content" ]; then
  echo "==> Importing fixture content from /fixtures/content..."
  
  # Import posts if posts.xml exists
  if [ -f "/fixtures/content/posts.xml" ]; then
    echo "==> Importing posts..."
    wp import /fixtures/content/posts.xml --authors=create --allow-root || echo "Warning: Could not import posts.xml"
  fi
  
  # Import pages if pages.xml exists
  if [ -f "/fixtures/content/pages.xml" ]; then
    echo "==> Importing pages..."
    wp import /fixtures/content/pages.xml --authors=create --allow-root || echo "Warning: Could not import pages.xml"
  fi
  
  # Import menus if menus.xml exists
  if [ -f "/fixtures/content/menus.xml" ]; then
    echo "==> Importing menus..."
    wp import /fixtures/content/menus.xml --authors=create --allow-root || echo "Warning: Could not import menus.xml"
  fi
else
  echo "Warning: No fixtures directory found at /fixtures/content"
  echo "Skipping content import - will use WordPress defaults"
fi

echo "==> Content seeding complete"
