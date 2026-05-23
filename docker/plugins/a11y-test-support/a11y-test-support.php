<?php
/**
 * Plugin Name: Accessibility Test Support
 * Description: REST endpoints and utilities to support automated accessibility testing.
 * Version: 1.1.0
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
	$html5_features     = get_theme_support( 'html5' );
	$stylesheet_dir     = get_stylesheet_directory();
	$functions_php_path = trailingslashit( $stylesheet_dir ) . 'functions.php';

	return new WP_REST_Response( [
		'html5'             => is_array( $html5_features ) ? $html5_features[0] : false,
		'html5_enabled'     => ! empty( $html5_features ),
		'is_block_theme'    => function_exists( 'wp_is_block_theme' ) ? wp_is_block_theme() : false,
		'has_functions_php' => file_exists( $functions_php_path ),
	] );
}
