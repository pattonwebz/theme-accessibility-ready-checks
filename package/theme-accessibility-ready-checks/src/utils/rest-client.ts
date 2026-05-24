// REST client for /wp-json/a11y-test/v1/* endpoints
// Implementation deferred pending REST plugin build-out
// Placeholder types and stub exported to unblock type-checking

export interface ThemeSupportResponse {
  has_functions_php: boolean;
  html5_support_declared: boolean;
  navigation_widgets_included: boolean;
  status: 'pass' | 'fail' | 'not-applicable';
}

export async function getThemeSupport(baseUrl: string): Promise<ThemeSupportResponse> {
  const url = `${baseUrl}/wp-json/a11y-test/v1/theme-support`;
  const res = await fetch(url, {
    headers: {
      'X-A11y-Test-Secret': process.env.A11Y_TEST_SECRET ?? '',
    },
  });
  if (!res.ok) {
    throw new Error(`[rest-client] theme-support endpoint returned ${res.status}`);
  }
  return res.json() as Promise<ThemeSupportResponse>;
}
