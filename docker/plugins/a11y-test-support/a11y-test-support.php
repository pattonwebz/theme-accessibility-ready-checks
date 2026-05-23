<?php
/**
 * Plugin Name: Accessibility Test Support
 * Description: REST endpoints and utilities to support automated accessibility testing.
 * Version: 1.2.0
 * Author: Accessibility Testing Team
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

add_action( 'rest_api_init', function () {
	register_rest_route( 'a11y-tests/v1', '/theme-support', [
		'methods'             => 'GET',
		'callback'            => 'a11y_tests_theme_support',
		'permission_callback' => '__return_true',
	] );
} );

/**
 * Returns theme support data relevant to accessibility checks.
 * Public endpoint — no authentication required.
 */
function a11y_tests_theme_support(): WP_REST_Response {
	$stylesheet_dir     = get_stylesheet_directory();
	$functions_php_path = trailingslashit( $stylesheet_dir ) . 'functions.php';
	$is_block_theme     = function_exists( 'wp_is_block_theme' ) && wp_is_block_theme();
	$html5_support      = get_theme_support( 'html5' );
	$html5_features     = is_array( $html5_support ) && isset( $html5_support[0] ) && is_array( $html5_support[0] )
		? $html5_support[0]
		: [];

	if ( $is_block_theme ) {
		return new WP_REST_Response( [
			'passed' => true,
			'reason' => 'Block theme — HTML5 support registered automatically by WordPress core.',
		] );
	}

	if ( ! file_exists( $functions_php_path ) ) {
		return new WP_REST_Response( [
			'passed' => true,
			'reason' => 'Theme has no functions.php — html5 theme support not applicable.',
		] );
	}

	if ( in_array( 'navigation-widgets', $html5_features, true ) ) {
		return new WP_REST_Response( [
			'passed' => true,
			'reason' => 'Classic theme declares html5 navigation-widgets support.',
		] );
	}

	return new WP_REST_Response( [
		'passed' => false,
		'reason' => "Classic theme does not declare add_theme_support( 'html5', [...] ) with 'navigation-widgets'.",
	] );
}
