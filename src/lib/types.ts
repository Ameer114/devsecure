export const Severity = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  INFO: "INFO",
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

export const FindingStatus = {
  OPEN: "OPEN",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  REMEDIATED: "REMEDIATED",
  FALSE_POSITIVE: "FALSE_POSITIVE",
} as const;
export type FindingStatus = (typeof FindingStatus)[keyof typeof FindingStatus];

export const Scanner = {
  GITLEAKS: "GITLEAKS",
  TRIVY: "TRIVY",
  SEMGREP: "SEMGREP",
} as const;
export type Scanner = (typeof Scanner)[keyof typeof Scanner];

export const FindingKind = {
  SECRET: "SECRET",
  VULNERABILITY: "VULNERABILITY",
  SAST: "SAST",
  MISCONFIG: "MISCONFIG",
} as const;
export type FindingKind = (typeof FindingKind)[keyof typeof FindingKind];

export const RunStatus = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  PASSED: "PASSED",
  FAILED: "FAILED",
  BLOCKED: "BLOCKED",
  CANCELLED: "CANCELLED",
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export const PolicyOutcome = {
  ALLOW: "ALLOW",
  BLOCK: "BLOCK",
} as const;
export type PolicyOutcome = (typeof PolicyOutcome)[keyof typeof PolicyOutcome];

export const DeploymentStatus = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  ROLLED_BACK: "ROLLED_BACK",
} as const;
export type DeploymentStatus = (typeof DeploymentStatus)[keyof typeof DeploymentStatus];

export const NotificationStatus = {
  QUEUED: "QUEUED",
  SENT: "SENT",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

export interface RepositoryRecord {
  id: string;
  fullName: string;
  defaultBranch: string;
  ownerId: string;
  isDemo: boolean;
  createdAt: Date;
  owner: { email: string };
  runs?: PipelineRunRecord[];
  deployments?: DeploymentRecord[];
  _count?: { runs: number; findings: number };
}

export interface PipelineRunRecord {
  id: string;
  repositoryId: string;
  githubRunId?: string | null;
  branch: string;
  commitSha: string;
  actor: string;
  status: RunStatus;
  startedAt: Date;
  finishedAt: Date | null;
  repository: { fullName: string; isDemo: boolean };
  policyDecision?: PolicyDecisionRecord | null;
  _count?: { findings: number };
}

export interface FindingRecord {
  id: string;
  runId: string;
  repositoryId: string;
  scanner: Scanner;
  kind: FindingKind;
  severity: Severity;
  ruleId: string;
  title: string;
  filePath?: string | null;
  startLine?: number | null;
  endLine?: number | null;
  fingerprint: string;
  status: FindingStatus;
  aiExplanation?: string | null;
  aiSuggestion?: string | null;
  createdAt: Date;
  repository: { fullName: string; isDemo: boolean };
}

export interface PolicyDecisionRecord {
  id: string;
  runId: string;
  policyVersion: string;
  outcome: PolicyOutcome;
  reasons: string[];
  createdAt: Date;
}

export interface DeploymentRecord {
  id: string;
  repositoryId: string;
  runId?: string | null;
  environment: string;
  imageRef: string;
  imageDigest?: string | null;
  status: DeploymentStatus;
  healthCheckOk?: boolean | null;
  rolledBackToRef?: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  repository: { fullName: string; isDemo: boolean };
}

export interface NotificationRecord {
  id: string;
  repositoryId: string;
  runId?: string | null;
  findingId?: string | null;
  channel: string;
  recipient: string;
  subject: string;
  status: NotificationStatus;
  providerMessageId?: string | null;
  error?: string | null;
  createdAt: Date;
  sentAt?: Date | null;
  repository: { fullName: string; isDemo: boolean };
}

export interface AuditEventRecord {
  id: string;
  repositoryId?: string | null;
  actor: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  repository?: { fullName: string; isDemo: boolean } | null;
}
