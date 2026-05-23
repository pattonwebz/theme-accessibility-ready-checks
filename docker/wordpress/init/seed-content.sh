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

# Create Primary Navigation menu
echo "==> Creating Primary Navigation menu..."
MENU_EXISTS=$($WP menu list --format=count 2>/dev/null)
if [ "$MENU_EXISTS" -eq "0" ] || ! $WP menu list | grep -q "Primary Navigation"; then
  MENU_ID=$($WP menu create "Primary Navigation" --porcelain)
  echo "    Created menu 'Primary Navigation' (ID: $MENU_ID)"
  
  # Add menu items
  $WP menu item add-post $MENU_ID $HOME_PAGE_ID --title="Home"
  $WP menu item add-post $MENU_ID $BLOG_PAGE_ID --title="Blog"
  $WP menu item add-post $MENU_ID $POST_1_ID --title="Block Patterns Post"
  $WP menu item add-custom $MENU_ID "External Link" "https://wordpress.org/accessibility/" --porcelain
  echo "    Added 4 items to Primary Navigation"
  
  # Assign to primary location (best-effort, theme-dependent)
  LOCATIONS=$($WP menu location list --format=csv --fields=location 2>/dev/null | tail -n +2)
  if echo "$LOCATIONS" | grep -q "primary"; then
    $WP menu location assign $MENU_ID primary
    echo "    Assigned menu to 'primary' location"
  elif echo "$LOCATIONS" | grep -q "primary-menu"; then
    $WP menu location assign $MENU_ID primary-menu
    echo "    Assigned menu to 'primary-menu' location"
  else
    echo "    Warning: No 'primary' or 'primary-menu' location found; menu created but not assigned"
  fi
else
  echo "    Primary Navigation menu already exists"
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
