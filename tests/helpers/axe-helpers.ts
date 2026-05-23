import type { Page } from '@playwright/test';
import type { Result } from 'axe-core';

export interface AxeViolation {
  id: string;
  impact: string | null;
  description: string;
  nodes: Array<{
    target: string[];
    html: string;
    failureSummary?: string;
  }>;
}

export function mapAxeViolations(violations: Result[]): AxeViolation[] {
  return violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? null,
    description: v.description,
    nodes: v.nodes.map((n) => ({
      target: n.target.map(String),
      html: n.html,
      failureSummary: n.failureSummary,
    })),
  }));
}

export async function runAxeRules(page: Page, rules: string[]): Promise<AxeViolation[]> {
  await page.addScriptTag({ path: require.resolve('axe-core') });
  const violations = await page.evaluate((ruleIds: string[]) => {
    return (window as unknown as { axe: { run: (ctx: Document, opts: unknown) => Promise<{ violations: Result[] }> } })
      .axe.run(document, { runOnly: { type: 'rule', values: ruleIds } })
      .then((r) => r.violations);
  }, rules);
  return mapAxeViolations(violations as Result[]);
}
