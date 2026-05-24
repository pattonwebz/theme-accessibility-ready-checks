import type { CheckResult } from './checks';

export interface EnvironmentInfo {
  nodeVersion: string;
  playwrightVersion: string;
  wpVersion: string;
  themeSlug: string;
  themeVersion: string;
  baseUrl: string;
  ciRun: boolean;
}

export interface A11yReport {
  schemaVersion: '1.0';
  generatedAt: string;   // ISO 8601
  theme: string;
  environment: EnvironmentInfo;
  summary: {
    total: number;
    pass: number;
    fail: number;
    notApplicable: number;
    notEvaluated: number;
  };
  results: CheckResult[];
}
