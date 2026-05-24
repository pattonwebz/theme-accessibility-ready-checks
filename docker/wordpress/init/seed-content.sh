#!/bin/bash
set -e

WP="wp --allow-root --path=/var/www/html"

echo "==> Seeding WordPress content..."

# Set permalink structure (required for slug-based URLs)
echo "==> Setting permalink structure to /%postname%/..."
$WP rewrite structure '/%postname%/'
$WP rewrite flush --hard

# Create category "Block" (slug: block)
echo "==> Creating category 'Block'..."
CATEGORY_BLOCK_ID=$($WP term get category block --by=slug --field=term_id 2>/dev/null || echo "")
if [ -n "$CATEGORY_BLOCK_ID" ]; then
  echo "    Category 'Block' already exists (ID: $CATEGORY_BLOCK_ID)"
else
  CATEGORY_BLOCK_ID=$($WP term create category "Block" --slug=block --porcelain)
  echo "    Created category 'Block' (ID: $CATEGORY_BLOCK_ID)"
fi

# Create posts containing the word "block" for search results and blog index
echo "==> Creating posts..."
POST_1_ID=$($WP post create \
  --post_type=post \
  --post_title="Block Patterns in WordPress" \
  --post_content="<p>This post discusses block patterns and the block editor. Block patterns allow you to create pre-designed layouts. The WordPress block editor makes it easy to use blocks in your content.</p>" \
  --post_status=publish \
  --post_category=$CATEGORY_BLOCK_ID \
  --porcelain 2>/dev/null || $WP post list --post_type=post --post_title="Block Patterns in WordPress" --format=ids)
echo "    Created/found post 'Block Patterns in WordPress' (ID: $POST_1_ID)"

POST_2_ID=$($WP post create \
  --post_type=post \
  --post_title="Understanding the Block Editor" \
  --post_content="<p>The block editor revolutionized WordPress content creation. Each piece of content is a block, making layout and design more flexible than ever before.</p>" \
  --post_status=publish \
  --post_category=$CATEGORY_BLOCK_ID \
  --porcelain 2>/dev/null || $WP post list --post_type=post --post_title="Understanding the Block Editor" --format=ids)
echo "    Created/found post 'Understanding the Block Editor' (ID: $POST_2_ID)"

POST_3_ID=$($WP post create \
  --post_type=post \
  --post_title="Accessibility and Blocks" \
  --post_content="<p>WordPress blocks should always be built with accessibility in mind. Block development must follow WCAG guidelines to ensure all users can interact with block-based content.</p>" \
  --post_status=publish \
  --post_category=$CATEGORY_BLOCK_ID \
  --porcelain 2>/dev/null || $WP post list --post_type=post --post_title="Accessibility and Blocks" --format=ids)
echo "    Created/found post 'Accessibility and Blocks' (ID: $POST_3_ID)"

# Create post with slug template-comments (for post-with-comments template)
echo "==> Creating post 'Template Comments'..."
COMMENTS_POST_ID=$($WP post create \
  --post_type=post \
  --post_title="Template Comments" \
  --post_name=template-comments \
  --post_content="<p>This post is used to test comment functionality. Comments should be accessible and properly structured.</p>" \
  --post_status=publish \
  --comment_status=open \
  --porcelain 2>/dev/null || $WP post list --post_type=post --name=template-comments --format=ids)
echo "    Created/found post 'Template Comments' (ID: $COMMENTS_POST_ID)"

# Add a comment to the template-comments post
echo "==> Adding comment to 'Template Comments' post..."
COMMENT_COUNT=$($WP comment list --post_id=$COMMENTS_POST_ID --status=approve --format=count)
if [ "$COMMENT_COUNT" -eq "0" ]; then
  COMMENT_ID=$($WP comment create \
    --comment_post_ID=$COMMENTS_POST_ID \
    --comment_content="This is a test comment for accessibility testing." \
    --comment_author="Test User" \
    --comment_author_email="test@example.com" \
    --comment_approved=1 \
    --porcelain)
  echo "    Created comment (ID: $COMMENT_ID)"
else
  echo "    Comment already exists on post"
fi

# Create parent page: Accessibility Ready Test Pages
echo "==> Creating parent page 'Accessibility Ready Test Pages'..."
PARENT_PAGE_ID=$($WP post create \
  --post_type=page \
  --post_title="Accessibility Ready Test Pages" \
  --post_name=accessibility-ready-test-pages \
  --post_content="<p>This page contains child pages used for accessibility testing.</p>" \
  --post_status=publish \
  --porcelain 2>/dev/null || $WP post list --post_type=page --name=accessibility-ready-test-pages --format=ids)
echo "    Created/found parent page (ID: $PARENT_PAGE_ID)"

# Create child page: Page Markup and Formatting
echo "==> Creating child page 'Page Markup and Formatting'..."
MARKUP_PAGE_ID=$($WP post create \
  --post_type=page \
  --post_title="Page Markup and Formatting" \
  --post_name=page-markup-and-formatting \
  --post_parent=$PARENT_PAGE_ID \
  --post_content="<h2>Introduction</h2>
<p>This page contains a variety of HTML elements for testing accessibility. It includes headings, lists, forms, tables, and more.</p>

<h3>Lists</h3>
<p>Here is an unordered list:</p>
<ul>
  <li>First item</li>
  <li>Second item with <strong>bold text</strong></li>
  <li>Third item with <em>emphasis</em></li>
</ul>

<p>And an ordered list:</p>
<ol>
  <li>Step one</li>
  <li>Step two</li>
  <li>Step three</li>
</ol>

<h3>Blockquote</h3>
<blockquote>
  <p>This is a blockquote with meaningful content. It should be properly marked up for screen readers.</p>
</blockquote>

<h4>Table Example</h4>
<table>
  <caption>Sample Data Table</caption>
  <thead>
    <tr>
      <th>Header 1</th>
      <th>Header 2</th>
      <th>Header 3</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Row 1, Cell 1</td>
      <td>Row 1, Cell 2</td>
      <td>Row 1, Cell 3</td>
    </tr>
    <tr>
      <td>Row 2, Cell 1</td>
      <td>Row 2, Cell 2</td>
      <td>Row 2, Cell 3</td>
    </tr>
  </tbody>
</table>

<h3>Form Elements</h3>
<form action=\"#\" method=\"post\">
  <p>
    <label for=\"test-name\">Name:</label>
    <input type=\"text\" id=\"test-name\" name=\"name\" required />
  </p>
  <p>
    <label for=\"test-email\">Email:</label>
    <input type=\"email\" id=\"test-email\" name=\"email\" required />
  </p>
  <p>
    <label for=\"test-message\">Message:</label>
    <textarea id=\"test-message\" name=\"message\" rows=\"4\"></textarea>
  </p>
  <p>
    <input type=\"submit\" value=\"Submit\" />
  </p>
</form>

<h3>Images and Figures</h3>
<figure>
  <img src=\"https://via.placeholder.com/400x300\" alt=\"Placeholder image with descriptive alt text\" width=\"400\" height=\"300\" />
  <figcaption>This is a figure caption describing the image above.</figcaption>
</figure>

<h4>Inline Elements</h4>
<p>This paragraph contains <strong>strong text</strong>, <em>emphasized text</em>, <code>inline code</code>, and an <abbr title=\"Abbreviation\">abbr</abbr> element.</p>" \
  --post_status=publish \
  --porcelain 2>/dev/null || $WP post list --post_type=page --name=page-markup-and-formatting --format=ids)
echo "    Created/found 'Page Markup and Formatting' (ID: $MARKUP_PAGE_ID)"

# Create child page: Block Patterns
echo "==> Creating child page 'Block Patterns'..."
PATTERNS_PAGE_ID=$($WP post create \
  --post_type=page \
  --post_title="Block Patterns" \
  --post_name=block-patterns \
  --post_parent=$PARENT_PAGE_ID \
  --post_content="<!-- wp:heading -->
<h2>Block Patterns Test Page</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>This page demonstrates various WordPress blocks for accessibility testing.</p>
<!-- /wp:paragraph -->

<!-- wp:image {\"alt\":\"Decorative image for block patterns\"} -->
<figure class=\"wp-block-image\"><img src=\"https://via.placeholder.com/600x400\" alt=\"Decorative image for block patterns\"/></figure>
<!-- /wp:image -->

<!-- wp:buttons -->
<div class=\"wp-block-buttons\">
<!-- wp:button -->
<div class=\"wp-block-button\"><a class=\"wp-block-button__link\">Click Me</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->

<!-- wp:quote -->
<blockquote class=\"wp-block-quote\"><p>This is a block quote demonstrating the quote block pattern.</p></blockquote>
<!-- /wp:quote -->

<!-- wp:separator -->
<hr class=\"wp-block-separator\"/>
<!-- /wp:separator -->

<!-- wp:columns -->
<div class=\"wp-block-columns\">
<!-- wp:column -->
<div class=\"wp-block-column\">
<!-- wp:paragraph -->
<p>Column one content</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:column -->

<!-- wp:column -->
<div class=\"wp-block-column\">
<!-- wp:paragraph -->
<p>Column two content</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:column -->
</div>
<!-- /wp:columns -->

<!-- wp:list -->
<ul><li>List item one</li><li>List item two</li><li>List item three</li></ul>
<!-- /wp:list -->" \
  --post_status=publish \
  --porcelain 2>/dev/null || $WP post list --post_type=page --name=block-patterns --format=ids)
echo "    Created/found 'Block Patterns' (ID: $PATTERNS_PAGE_ID)"

# Create static front page and blog page
echo "==> Creating 'Home' and 'Blog' pages..."
HOME_PAGE_ID=$($WP post create \
  --post_type=page \
  --post_title="Home" \
  --post_name=home \
  --post_content="<h2>Welcome to the Accessibility Testing Site</h2><p>This is the front page of the test WordPress installation.</p>" \
  --post_status=publish \
  --porcelain 2>/dev/null || $WP post list --post_type=page --name=home --format=ids)
echo "    Created/found 'Home' page (ID: $HOME_PAGE_ID)"

BLOG_PAGE_ID=$($WP post create \
  --post_type=page \
  --post_title="Blog" \
  --post_name=blog \
  --post_content="<!-- This page displays the blog posts index -->" \
  --post_status=publish \
  --porcelain 2>/dev/null || $WP post list --post_type=page --name=blog --format=ids)
echo "    Created/found 'Blog' page (ID: $BLOG_PAGE_ID)"

# Configure Reading Settings (static front page + posts page)
echo "==> Configuring Reading Settings..."
$WP option update show_on_front page
$WP option update page_on_front $HOME_PAGE_ID
$WP option update page_for_posts $BLOG_PAGE_ID
echo "    Set Home as front page and Blog as posts page"

# For classic themes: create accessibility test navigation menu
# For block themes: navigation is handled by wp_navigation CPT (see below)
MENU_NAME="Accessibility Test Menu"
echo "==> Creating accessibility test navigation menu..."
LOCATIONS=$($WP nav menu location list --fields=location --format=csv 2>/dev/null | tail -n +2)

if [ -z "$LOCATIONS" ]; then
  echo "    No nav menu locations registered by theme - skipping menu assignment"
else
  if $WP nav menu list --fields=name --format=csv 2>/dev/null | tail -n +2 | grep -Fxq "$MENU_NAME"; then
    echo "    Menu '$MENU_NAME' already exists, skipping creation"
  else
    MENU_ID=$($WP nav menu create "$MENU_NAME" --porcelain)
    echo "    Created menu '$MENU_NAME' (ID: $MENU_ID)"

    HOME_MENU_ID=$($WP nav menu item add-post "$MENU_NAME" "$HOME_PAGE_ID" --title="Home" --porcelain)
    ABOUT_ID=$($WP nav menu item add-post "$MENU_NAME" "$PARENT_PAGE_ID" --title="About" --porcelain)
    OUR_TEAM_ID=$($WP nav menu item add-custom "$MENU_NAME" "Our Team" "#" --parent-id="$ABOUT_ID" --porcelain)
    SERVICES_ID=$($WP nav menu item add-post "$MENU_NAME" "$MARKUP_PAGE_ID" --title="Services" --porcelain)
    ACCESSIBILITY_ID=$($WP nav menu item add-post "$MENU_NAME" "$PATTERNS_PAGE_ID" --title="Accessibility" --parent-id="$SERVICES_ID" --porcelain)
    WCAG_ID=$($WP nav menu item add-custom "$MENU_NAME" "WCAG Compliance" "#" --parent-id="$ACCESSIBILITY_ID" --porcelain)
    BLOG_ID=$($WP nav menu item add-post "$MENU_NAME" "$BLOG_PAGE_ID" --title="Blog" --porcelain)
    echo "    Added nested menu items (Home: $HOME_MENU_ID, About: $ABOUT_ID, Our Team: $OUR_TEAM_ID, Services: $SERVICES_ID, Accessibility: $ACCESSIBILITY_ID, WCAG Compliance: $WCAG_ID, Blog: $BLOG_ID)"
  fi

  while IFS= read -r location; do
    [ -z "$location" ] && continue
    $WP nav menu location assign "$MENU_NAME" "$location"
    echo "    Assigned menu '$MENU_NAME' to location: $location"
  done <<< "$LOCATIONS"
fi

echo ""
echo "=== Widget Areas ==="

if $WP eval "echo (function_exists('wp_is_block_theme') && wp_is_block_theme() ? 'block' : 'classic');" 2>/dev/null | grep -q "^block$"; then
  echo "Block theme active - classic widget population skipped"
else
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

if $WP eval "echo (function_exists('wp_is_block_theme') && wp_is_block_theme() ? 'block' : 'classic');" 2>/dev/null | grep -q "^block$"; then
  echo "Block theme active - setting up accessible navigation..."
  
  # Build page URLs for explicit nested navigation links.
  # Two branches: About > Our Team (2 levels), Services > Accessibility > WCAG Compliance (3 levels).
  HOME_URL=$($WP eval 'echo get_permalink('$HOME_PAGE_ID');' 2>/dev/null || echo "/")
  ABOUT_URL=$($WP eval 'echo get_permalink('$PARENT_PAGE_ID');' 2>/dev/null || echo "#")
  SERVICES_URL=$($WP eval 'echo get_permalink('$MARKUP_PAGE_ID');' 2>/dev/null || echo "#")
  ACCESSIBILITY_URL=$($WP eval 'echo get_permalink('$PATTERNS_PAGE_ID');' 2>/dev/null || echo "#")
  BLOG_URL=$($WP eval 'echo get_permalink('$BLOG_PAGE_ID');' 2>/dev/null || echo "#")

  MAIN_NAV_CONTENT='<!-- wp:navigation-link {"label":"Home","url":"'$HOME_URL'"} /--><!-- wp:navigation-submenu {"label":"About","url":"'$ABOUT_URL'"} --><!-- wp:navigation-link {"label":"Our Team","url":"#"} /--><!-- /wp:navigation-submenu --><!-- wp:navigation-submenu {"label":"Services","url":"'$SERVICES_URL'"} --><!-- wp:navigation-submenu {"label":"Accessibility","url":"'$ACCESSIBILITY_URL'"} --><!-- wp:navigation-link {"label":"WCAG Compliance","url":"#"} /--><!-- /wp:navigation-submenu --><!-- /wp:navigation-submenu --><!-- wp:navigation-link {"label":"Blog","url":"'$BLOG_URL'"} /-->'

  # Create or update wp_navigation post with title "Main"
  EXISTING_NAV_ID=$($WP post list --post_type=wp_navigation --post_title="Main" --format=ids 2>/dev/null || echo "")
  if [ -n "$EXISTING_NAV_ID" ]; then
    NAV_POST_ID=$EXISTING_NAV_ID
    $WP post update $NAV_POST_ID --post_content="$MAIN_NAV_CONTENT" 2>/dev/null || true
    echo "    wp_navigation post 'Main' already exists (ID: $NAV_POST_ID) — updated with nested items"
  else
    NAV_POST_ID=$($WP post create \
      --post_type=wp_navigation \
      --post_title="Main" \
      --post_content="$MAIN_NAV_CONTENT" \
      --post_status=publish \
      --porcelain 2>/dev/null)
    echo "    Created wp_navigation post 'Main' (ID: $NAV_POST_ID) with 2-level (About) and 3-level (Services) submenus"
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
    echo "    Created wp_template_part 'header' (ID: $HEADER_PART_ID) → nav ref=$NAV_POST_ID → aria-label='Main'"
  fi

  # Create wp_navigation posts for the two footer navs (ref approach, same reason as above).
  # TT5's default footer pattern has inline navs with no ariaLabel — we override the footer
  # template part to use named wp_navigation posts instead.
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

  # Create wp_template_part override for footer using ref navs so labels render correctly.
  EXISTING_FOOTER_ID=$($WP post list --post_type=wp_template_part --name=footer --format=ids 2>/dev/null || echo "")
  if [ -n "$EXISTING_FOOTER_ID" ]; then
    echo "    wp_template_part 'footer' already exists (ID: $EXISTING_FOOTER_ID), skipping"
  else
    FOOTER_CONTENT='<!-- wp:group {"style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|50"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--50)">
	<!-- wp:group {"align":"wide","layout":{"type":"default"}} -->
	<div class="wp-block-group alignwide">
		<!-- wp:site-logo /-->
		<!-- wp:group {"align":"full","layout":{"type":"flex","flexWrap":"wrap","justifyContent":"space-between","verticalAlignment":"top"}} -->
		<div class="wp-block-group alignfull">
			<!-- wp:columns -->
			<div class="wp-block-columns">
				<!-- wp:column {"width":"100%"} -->
				<div class="wp-block-column" style="flex-basis:100%"><!-- wp:site-title {"level":2} /-->
				<!-- wp:site-tagline /--></div>
				<!-- /wp:column -->
				<!-- wp:column {"width":""} -->
				<div class="wp-block-column">
					<!-- wp:spacer {"height":"var:preset|spacing|40","width":"0px"} -->
					<div style="height:var(--wp--preset--spacing--40);width:0px" aria-hidden="true" class="wp-block-spacer"></div>
					<!-- /wp:spacer -->
				</div>
				<!-- /wp:column -->
			</div>
			<!-- /wp:columns -->
			<!-- wp:group {"style":{"spacing":{"blockGap":"var:preset|spacing|80"}},"layout":{"type":"flex","flexWrap":"wrap","verticalAlignment":"top","justifyContent":"space-between"}} -->
			<div class="wp-block-group">
				<!-- wp:navigation {"ref":'$EXPLORE_NAV_ID',"overlayMenu":"never","layout":{"type":"flex","orientation":"vertical"}} /-->
				<!-- wp:navigation {"ref":'$RESOURCES_NAV_ID',"overlayMenu":"never","layout":{"type":"flex","orientation":"vertical"}} /-->
			</div>
			<!-- /wp:group -->
		</div>
		<!-- /wp:group -->
		<!-- wp:spacer {"height":"var:preset|spacing|70"} -->
		<div style="height:var(--wp--preset--spacing--70)" aria-hidden="true" class="wp-block-spacer"></div>
		<!-- /wp:spacer -->
		<!-- wp:group {"align":"full","style":{"spacing":{"blockGap":"var:preset|spacing|20"}},"layout":{"type":"flex","flexWrap":"wrap","justifyContent":"space-between"}} -->
		<div class="wp-block-group alignfull">
			<!-- wp:paragraph {"fontSize":"small"} --><p class="has-small-font-size">Twenty Twenty-Five</p><!-- /wp:paragraph -->
			<!-- wp:paragraph {"fontSize":"small"} --><p class="has-small-font-size">Proudly powered by WordPress</p><!-- /wp:paragraph -->
		</div>
		<!-- /wp:group -->
	</div>
	<!-- /wp:group -->
</div>
<!-- /wp:group -->'

    FOOTER_PART_ID=$($WP post create \
      --post_type=wp_template_part \
      --post_name=footer \
      --post_title="footer" \
      --post_content="$FOOTER_CONTENT" \
      --post_status=publish \
      --post_author=1 \
      --porcelain 2>/dev/null)
    $WP post term add $FOOTER_PART_ID wp_theme "$ACTIVE_THEME" 2>/dev/null || true
    $WP post term add $FOOTER_PART_ID wp_template_part_area footer 2>/dev/null || true
    echo "    Created wp_template_part 'footer' (ID: $FOOTER_PART_ID) → Explore ($EXPLORE_NAV_ID) + Resources ($RESOURCES_NAV_ID)"
  fi

else
  echo "Classic theme active - block navigation seeding skipped (classic nav menu handles this)"
fi

echo "==> Content seeding complete"
echo ""
echo "Created content:"
echo "  - Front page: / (Home page, ID: $HOME_PAGE_ID)"
echo "  - Blog index: /blog/ (Blog page, ID: $BLOG_PAGE_ID)"
echo "  - Post with comments: /template-comments/ (ID: $COMMENTS_POST_ID)"
echo "  - Category archive: /category/block/ (Category ID: $CATEGORY_BLOCK_ID)"
echo "  - Page markup: /accessibility-ready-test-pages/page-markup-and-formatting/ (ID: $MARKUP_PAGE_ID)"
echo "  - Block patterns: /accessibility-ready-test-pages/block-patterns/ (ID: $PATTERNS_PAGE_ID)"
echo "  - Search results: /?s=block (3 posts containing 'block')"
echo "  - 404 page: /this-page-does-not-exist-404/ (no content needed)"
echo ""
