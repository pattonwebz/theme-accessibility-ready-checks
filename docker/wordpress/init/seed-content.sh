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
if $WP term get category block --by=slug --format=ids 2>/dev/null; then
  CATEGORY_BLOCK_ID=$($WP term get category block --by=slug --field=term_id)
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

# Create accessibility test navigation menu
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
