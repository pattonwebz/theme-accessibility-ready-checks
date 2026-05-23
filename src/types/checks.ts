export const CHECK_IDS = [
  'skip-1',
  'landmark-1', 'landmark-2', 'landmark-3', 'landmark-4', 'landmark-5', 'landmark-6',
  'keyboard-1', 'keyboard-mobile-1',
  'controls-1', 'controls-2', 'controls-mobile-1',
  'form-1', 'form-2', 'form-3', 'form-4', 'form-5', 'form-6',
  'heading-1', 'heading-2',
  'link-underline-1',
  'link-ambiguous-1',
  'new-tab-1',
  'contrast-1',
  'alt-text-1',
  'reflow-1', 'reflow-2', 'reflow-3',
  'context-change-1', 'context-change-2',
  'hover-focus-1', 'hover-focus-2',
  'screen-reader-text-1',
  'audio-video-1',     // manual
  'a11y-statement-1',  // manual
  'plugin-review-1',   // manual
] as const;

export type CheckId = typeof CHECK_IDS[number];

export type CheckStatus = 'pass' | 'fail' | 'not-applicable' | 'not-evaluated';

export type TemplateName =
  | 'front-page'
  | 'blog'
  | 'post-with-comments'
  | 'category-archive'
  | 'page-markup'
  | 'block-patterns'
  | 'search-results'
  | '404';

export type Viewport = 'desktop' | 'mobile';

export const TEMPLATE_PATHS: Record<TemplateName, string> = {
  'front-page':          '/',
  'blog':                '/blog/',
  'post-with-comments':  '/template-comments/',
  'category-archive':    '/category/block/',
  'page-markup':         '/accessibility-ready-test-pages/page-markup-and-formatting/',
  'block-patterns':      '/accessibility-ready-test-pages/block-patterns/',
  'search-results':      '/?s=block',
  '404':                 '/this-page-does-not-exist-404/',
};

export interface ViolationDetail {
  selector: string;
  snippet?: string;
  message: string;
  wcag?: string;
}

export interface MediaReference {
  type: 'screenshot' | 'video' | 'trace';
  path: string;
  description?: string;
}

export interface CheckResult {
  checkId: CheckId;
  template: TemplateName;
  viewport: Viewport;
  status: CheckStatus;
  detail?: string | ViolationDetail[];
  reason?: string;          // populated when status = 'not-applicable'
  media?: MediaReference[];
  durationMs?: number;
}
