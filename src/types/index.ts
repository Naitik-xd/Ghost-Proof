export type Verdict = 'supported' | 'contradicted' | 'mixed' | 'unverified';

export interface SourceLink {
  title: string;
  url: string;
  domain: string;
}

export interface ClaimFinding {
  id: string;
  claim: string;
  verdict: Verdict;
  confidence: number;
  explanation: string;
  evidenceSnippet: string;
  sources: SourceLink[];
}

export interface FactCheckReport {
  id: string;
  modelUsed: string;
  inputText: string;
  claims: ClaimFinding[];
  summary: {
    total: number;
    supported: number;
    contradicted: number;
    mixed: number;
    unverified: number;
  };
  timestamp: string;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type IssueCategory = 'secret' | 'security' | 'bug' | 'maintainability';

export interface CodeFinding {
  id: string;
  category: IssueCategory;
  severity: Severity;
  title: string;
  file: string;
  line: number | null;
  description: string;
  codeSnippet: string;
  remediation: string;
}

export interface CodeReviewReport {
  id: string;
  target: string;
  filesScanned: number;
  modelUsed: string;
  stats: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  findings: CodeFinding[];
  timestamp: string;
}

export interface CodeFile {
  path: string;
  content: string;
  size?: number;
  selected?: boolean;
}
