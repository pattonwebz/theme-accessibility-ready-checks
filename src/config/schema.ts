import { z } from 'zod';
import { CHECK_IDS } from '../types/checks';

const checkIdSchema = z.enum(CHECK_IDS);
const viewportSchema = z.enum(['desktop', 'mobile']);
const templateNameSchema = z.enum([
  'front-page', 'blog', 'post-with-comments', 'category-archive',
  'page-markup', 'block-patterns', 'search-results', '404',
]);

export const a11yConfigSchema = z.object({
  theme: z.object({
    name: z.string(),
    path: z.string(),
  }),
  checks: z.object({
    enabled: z.union([z.literal('all'), z.array(checkIdSchema)]),
    skip: z.array(checkIdSchema).optional(),
  }),
  viewports: z.array(viewportSchema),
  templates: z.object({
    paths: z.record(templateNameSchema, z.string()).optional(),
  }),
  wordpress: z.object({
    baseUrl: z.string().url(),
  }),
  output: z.object({
    dir: z.string(),
    json: z.boolean(),
    html: z.boolean(),
  }),
});

export type ValidatedConfig = z.infer<typeof a11yConfigSchema>;
