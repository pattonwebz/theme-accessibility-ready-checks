#!/bin/bash
set -e

WP="wp --allow-root --path=/var/www/html"

echo ""
echo "=== Remapping Theme Content ==="
echo ""

# ============================================================================
# 1. Re-assign nav menu to all current theme locations
# ============================================================================

MENU_NAME="Accessibility Test Menu"
echo "==> Re-assigning navigation menu to current theme locations..."

# Create the menu if it was never seeded (e.g. initial theme was a block theme with no nav locations)
if ! $WP nav menu list --fields=name --format=csv 2>/dev/null | tail -n +2 | grep -Fxq "$MENU_NAME"; then
  echo "    Menu '$MENU_NAME' not found - creating it now..."
  $WP nav menu create "$MENU_NAME" >/dev/null
  # Populate with whatever published pages exist
  $WP post list --post_type=page --post_status=publish --fields=ID,post_title --format=csv 2>/dev/null | \
    tail -n +2 | while IFS=',' read -r pid ptitle; do
      [ -z "$pid" ] && continue
      $WP nav menu item add-post "$MENU_NAME" "$pid" --title="$ptitle" 2>/dev/null || true
    done
  echo "    Created menu '$MENU_NAME' with available pages"
else
  echo "    Menu '$MENU_NAME' already exists"
fi

# Assign menu to all nav locations registered by the current theme
LOCATIONS=$($WP nav menu location list --fields=location --format=csv 2>/dev/null | tail -n +2 || true)

if [ -z "$LOCATIONS" ]; then
  echo "    No nav menu locations registered by theme - skipping location assignment"
else
  while IFS= read -r location; do
    [ -z "$location" ] && continue
    $WP nav menu location assign "$MENU_NAME" "$location" 2>/dev/null || true
    echo "    Assigned menu '$MENU_NAME' to location: $location"
  done <<< "$LOCATIONS"
fi

echo ""
echo "=== Widget Areas ==="

# ============================================================================
# 2. Determine if theme is block or classic
# ============================================================================

THEME_TYPE=$($WP eval "echo (function_exists('wp_is_block_theme') && wp_is_block_theme() ? 'block' : 'classic');" 2>/dev/null || echo "classic")

if [ "$THEME_TYPE" = "block" ]; then
  echo "Block theme active - classic widget population skipped"
else
  # ============================================================================
  # 3. Populate empty sidebars with widgets (classic themes only)
  # ============================================================================
  
  SIDEBARS=$($WP sidebar list --fields=id,status --format=csv 2>/dev/null | \
    awk -F',' 'NR>1 && $2=="active" {print $1}' || true)
  
  if [ -z "$SIDEBARS" ]; then
    echo "No active sidebars found"
  else
    while IFS= read -r SIDEBAR_ID; do
      [ -z "$SIDEBAR_ID" ] && continue
      [ "$SIDEBAR_ID" = "wp_inactive_widgets" ] && continue
      
      WIDGET_COUNT=$($WP widget list "$SIDEBAR_ID" --format=count 2>/dev/null || echo 0)
      if [ "${WIDGET_COUNT:-0}" -gt 0 ]; then
        echo "Sidebar '$SIDEBAR_ID' already has $WIDGET_COUNT widget(s), skipping"
        continue
      fi
      
      echo "Populating sidebar: $SIDEBAR_ID"
      $WP widget add search "$SIDEBAR_ID" 1 2>/dev/null && echo "  + search" || true
      $WP widget add recent-posts "$SIDEBAR_ID" 2 --title="Recent Posts" 2>/dev/null && echo "  + recent-posts" || true
      $WP widget add text "$SIDEBAR_ID" 3 --title="About This Site" \
        --text="Test WordPress installation for accessibility checking." \
        2>/dev/null && echo "  + text" || true
      $WP widget add categories "$SIDEBAR_ID" 4 --title="Categories" 2>/dev/null && echo "  + categories" || true
    done <<< "$SIDEBARS"
  fi
fi

echo ""
echo "=== Block Theme Navigation ==="

# ============================================================================
# 4. Handle block themes - ensure wp_navigation post exists
# ============================================================================

if [ "$THEME_TYPE" = "block" ]; then
  echo "Block theme active - checking navigation setup..."
  
  # Create or verify wp_navigation post with title "Main" exists
  EXISTING_NAV_ID=$($WP post list --post_type=wp_navigation --post_title="Main" --format=ids 2>/dev/null || echo "")
  if [ -n "$EXISTING_NAV_ID" ]; then
    NAV_POST_ID=$EXISTING_NAV_ID
    echo "    wp_navigation post 'Main' already exists (ID: $NAV_POST_ID)"
  else
    NAV_POST_ID=$($WP post create \
      --post_type=wp_navigation \
      --post_title="Main" \
      --post_content="<!-- wp:page-list /-->" \
      --post_status=publish \
      --porcelain 2>/dev/null)
    echo "    Created wp_navigation post 'Main' (ID: $NAV_POST_ID)"
  fi
  
  # Get active block theme name
  ACTIVE_THEME=$($WP theme list --status=active --field=name 2>/dev/null)
  echo "    Active theme: $ACTIVE_THEME"
  
  # Create wp_template_part override for header with nav block using ref to 'Main' post.
  # Using ref (not ariaLabel inline) avoids the WP 6.8 ariaLabel supports double-render bug
  # where supports.ariaLabel:true + explicit extra_attributes both add aria-label.
  EXISTING_HEADER_ID=$($WP post list --post_type=wp_template_part --name=header --format=ids 2>/dev/null || echo "")
  if [ -n "$EXISTING_HEADER_ID" ]; then
    echo "    wp_template_part 'header' already exists (ID: $EXISTING_HEADER_ID), skipping"
  else
    HEADER_CONTENT='<!-- wp:group {"align":"full","layout":{"type":"default"}} -->
<div class="wp-block-group alignfull">
	<!-- wp:group {"layout":{"type":"constrained"}} -->
	<div class="wp-block-group">
		<!-- wp:group {"align":"wide","style":{"spacing":{"padding":{"top":"var:preset|spacing|30","bottom":"var:preset|spacing|30"}}},"layout":{"type":"flex","flexWrap":"nowrap","justifyContent":"space-between"}} -->
		<div class="wp-block-group alignwide" style="padding-top:var(--wp--preset--spacing--30);padding-bottom:var(--wp--preset--spacing--30)">
			<!-- wp:site-title {"level":0} /-->
			<!-- wp:group {"style":{"spacing":{"blockGap":"var:preset|spacing|10"}},"layout":{"type":"flex","flexWrap":"nowrap","justifyContent":"right"}} -->
			<div class="wp-block-group">
				<!-- wp:navigation {"ref":'$NAV_POST_ID',"overlayBackgroundColor":"base","overlayTextColor":"contrast","layout":{"type":"flex","justifyContent":"right","flexWrap":"wrap"}} /-->
			</div>
			<!-- /wp:group -->
		</div>
		<!-- /wp:group -->
	</div>
	<!-- /wp:group -->
</div>
<!-- /wp:group -->'

    HEADER_PART_ID=$($WP post create \
      --post_type=wp_template_part \
      --post_name=header \
      --post_title="header" \
      --post_content="$HEADER_CONTENT" \
      --post_status=publish \
      --post_author=1 \
      --porcelain 2>/dev/null)
    $WP post term add $HEADER_PART_ID wp_theme "$ACTIVE_THEME" 2>/dev/null || true
    $WP post term add $HEADER_PART_ID wp_template_part_area header 2>/dev/null || true
    echo "    Created wp_template_part 'header' (ID: $HEADER_PART_ID) → nav ref=$NAV_POST_ID"
  fi
  
  # Create wp_navigation posts for the two footer navs (ref approach, same reason as above).
  EXPLORE_NAV_ID=$($WP post list --post_type=wp_navigation --post_title="Explore" --format=ids 2>/dev/null | head -1)
  if [ -n "$EXPLORE_NAV_ID" ]; then
    echo "    wp_navigation 'Explore' already exists (ID: $EXPLORE_NAV_ID)"
  else
    EXPLORE_NAV_ID=$($WP post create \
      --post_type=wp_navigation \
      --post_title="Explore" \
      --post_content='<!-- wp:navigation-link {"label":"Blog","url":"#"} /--><!-- wp:navigation-link {"label":"About","url":"#"} /--><!-- wp:navigation-link {"label":"FAQs","url":"#"} /--><!-- wp:navigation-link {"label":"Authors","url":"#"} /-->' \
      --post_status=publish \
      --porcelain 2>/dev/null)
    echo "    Created wp_navigation 'Explore' (ID: $EXPLORE_NAV_ID)"
  fi
  
  RESOURCES_NAV_ID=$($WP post list --post_type=wp_navigation --post_title="Resources" --format=ids 2>/dev/null | head -1)
  if [ -n "$RESOURCES_NAV_ID" ]; then
    echo "    wp_navigation 'Resources' already exists (ID: $RESOURCES_NAV_ID)"
  else
    RESOURCES_NAV_ID=$($WP post create \
      --post_type=wp_navigation \
      --post_title="Resources" \
      --post_content='<!-- wp:navigation-link {"label":"Events","url":"#"} /--><!-- wp:navigation-link {"label":"Shop","url":"#"} /--><!-- wp:navigation-link {"label":"Patterns","url":"#"} /--><!-- wp:navigation-link {"label":"Themes","url":"#"} /-->' \
      --post_status=publish \
      --porcelain 2>/dev/null)
    echo "    Created wp_navigation 'Resources' (ID: $RESOURCES_NAV_ID)"
  fi
  
  EXISTING_FOOTER_ID=$($WP post list --post_type=wp_template_part --name=footer --format=ids 2>/dev/null || echo "")
  if [ -n "$EXISTING_FOOTER_ID" ]; then
    echo "    wp_template_part 'footer' already exists (ID: $EXISTING_FOOTER_ID), skipping"
  fi
else
  echo "Classic theme active - block navigation setup skipped"
fi

echo ""
echo "==> Theme content remapping complete!"
echo ""
