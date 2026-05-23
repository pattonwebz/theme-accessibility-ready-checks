import type { CheckResult } from '../../src/types/checks';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = process.env.A11Y_OUTPUT_DIR ?? 'a11y-results';
const RESULTS_FILE = path.join(OUTPUT_DIR, 'check-results.json');

const _results: CheckResult[] = [];

export function recordResult(result: CheckResult): void {
  _results.push(result);
}

export function writeResults(): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(_results, null, 2), 'utf-8');
}

export function getResults(): CheckResult[] {
  return [..._results];
}
