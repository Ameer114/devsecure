import { createHash } from "node:crypto";
import type {
  AuditEventRecord,
  DeploymentRecord,
  FindingRecord,
  FindingStatus,
  NotificationRecord,
  PipelineRunRecord,
  PolicyDecisionRecord,
  RepositoryRecord,
  Severity,
} from "./types";

const ago = (min: number) => new Date(Date.now() - min * 60_000);
const fp = (s: string) => createHash("sha256").update(`store:${s}`).digest("hex").slice(0, 32);

// In-memory data store. Persists during application runtime without needing PostgreSQL.
class SecureShipStore {
  repositories: RepositoryRecord[] = [];
  pipelineRuns: PipelineRunRecord[] = [];
  findings: FindingRecord[] = [];
  policyDecisions: PolicyDecisionRecord[] = [];
  deployments: DeploymentRecord[] = [];
  notifications: NotificationRecord[] = [];
  auditEvents: AuditEventRecord[] = [];

  constructor() {
    this.seedDemo();
  }

  seedDemo() {
    const ownerId = "user_demo";
    const ownerEmail = "demo-owner@example.com";

    const payments: RepositoryRecord = {
      id: "repo_payments",
      fullName: "demo-org/payments-api",
      defaultBranch: "main",
      ownerId,
      isDemo: true,
      createdAt: ago(500),
      owner: { email: ownerEmail },
    };

    const web: RepositoryRecord = {
      id: "repo_web",
      fullName: "demo-org/web-frontend",
      defaultBranch: "main",
      ownerId,
      isDemo: true,
      createdAt: ago(400),
      owner: { email: ownerEmail },
    };

    this.repositories = [payments, web];

    // Payments run 1 (Blocked)
    const runBlocked: PipelineRunRecord = {
      id: "run_1001",
      repositoryId: payments.id,
      githubRunId: "demo-1001",
      branch: "feature/billing",
      commitSha: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
      actor: "demo-dev",
      status: "BLOCKED",
      startedAt: ago(300),
      finishedAt: ago(297),
      repository: { fullName: payments.fullName, isDemo: true },
    };

    const decBlocked: PolicyDecisionRecord = {
      id: "pol_1001",
      runId: runBlocked.id,
      policyVersion: "demo-0",
      outcome: "BLOCK",
      reasons: ["Secret detected by Gitleaks (1 finding)"],
      createdAt: ago(297),
    };

    const finding1: FindingRecord = {
      id: "find_1",
      runId: runBlocked.id,
      repositoryId: payments.id,
      scanner: "GITLEAKS",
      kind: "SECRET",
      severity: "CRITICAL",
      ruleId: "generic-api-key",
      title: "Possible API key committed in source",
      filePath: "src/billing/client.ts",
      startLine: 14,
      endLine: 14,
      fingerprint: fp("payments-key"),
      status: "REMEDIATED",
      aiExplanation: "Exposed private API credentials allow unauthorized callers to impersonate the service and make unauthorized billing requests.",
      aiSuggestion: "Immediately revoke and rotate the API token in your provider dashboard. Store the new key securely in an encrypted secret manager or environment variable.",
      createdAt: ago(300),
      repository: { fullName: payments.fullName, isDemo: true },
    };

    // Payments run 2 (Passed and Deployed)
    const runClean: PipelineRunRecord = {
      id: "run_1002",
      repositoryId: payments.id,
      githubRunId: "demo-1002",
      branch: "main",
      commitSha: "0f9e8d7c6b5a49382716f5e4d3c2b1a098765432",
      actor: "demo-dev",
      status: "PASSED",
      startedAt: ago(120),
      finishedAt: ago(115),
      repository: { fullName: payments.fullName, isDemo: true },
    };

    const decClean: PolicyDecisionRecord = {
      id: "pol_1002",
      runId: runClean.id,
      policyVersion: "demo-0",
      outcome: "ALLOW",
      reasons: ["All mandatory checks passed"],
      createdAt: ago(115),
    };

    const depClean: DeploymentRecord = {
      id: "dep_1",
      repositoryId: payments.id,
      runId: runClean.id,
      environment: "production",
      imageRef: "ghcr.io/demo-org/payments-api:0f9e8d7",
      imageDigest: "sha256:7a92c3...",
      status: "SUCCEEDED",
      healthCheckOk: true,
      startedAt: ago(112),
      finishedAt: ago(110),
      repository: { fullName: payments.fullName, isDemo: true },
    };

    // Web run (Held)
    const runHeld: PipelineRunRecord = {
      id: "run_2001",
      repositoryId: web.id,
      githubRunId: "demo-2001",
      branch: "main",
      commitSha: "9988776655443322110099887766554433221100",
      actor: "demo-dev",
      status: "FAILED",
      startedAt: ago(45),
      finishedAt: ago(41),
      repository: { fullName: web.fullName, isDemo: true },
    };

    const decHeld: PolicyDecisionRecord = {
      id: "pol_2001",
      runId: runHeld.id,
      policyVersion: "demo-0",
      outcome: "BLOCK",
      reasons: ["High-severity vulnerability found by Trivy (1 finding)"],
      createdAt: ago(41),
    };

    const finding2: FindingRecord = {
      id: "find_2",
      runId: runHeld.id,
      repositoryId: web.id,
      scanner: "TRIVY",
      kind: "VULNERABILITY",
      severity: "HIGH",
      ruleId: "CVE-2024-21490",
      title: "Vulnerable dependency prototype pollution",
      filePath: "package-lock.json",
      startLine: 82,
      endLine: 85,
      fingerprint: fp("web-dep"),
      status: "OPEN",
      aiExplanation: null,
      aiSuggestion: null,
      createdAt: ago(45),
      repository: { fullName: web.fullName, isDemo: true },
    };

    const finding3: FindingRecord = {
      id: "find_3",
      runId: runHeld.id,
      repositoryId: web.id,
      scanner: "SEMGREP",
      kind: "SAST",
      severity: "MEDIUM",
      ruleId: "security.react.unsafe-html",
      title: "Unescaped HTML rendering (dangerouslySetInnerHTML)",
      filePath: "src/components/Preview.tsx",
      startLine: 31,
      endLine: 33,
      fingerprint: fp("web-sast"),
      status: "OPEN",
      aiExplanation: null,
      aiSuggestion: null,
      createdAt: ago(45),
      repository: { fullName: web.fullName, isDemo: true },
    };

    this.pipelineRuns = [runHeld, runClean, runBlocked];
    this.policyDecisions = [decHeld, decClean, decBlocked];
    this.findings = [finding2, finding3, finding1];
    this.deployments = [depClean];

    this.notifications = [
      {
        id: "notif_1",
        repositoryId: payments.id,
        runId: runBlocked.id,
        findingId: finding1.id,
        channel: "EMAIL",
        recipient: ownerEmail,
        subject: "[SecureShip] Secret detected in demo-org/payments-api",
        status: "SENT",
        sentAt: ago(296),
        createdAt: ago(296),
        repository: { fullName: payments.fullName, isDemo: true },
      },
    ];

    this.auditEvents = [
      {
        id: "aud_1",
        repositoryId: payments.id,
        actor: "ci",
        action: "pipeline.blocked",
        entityType: "PipelineRun",
        entityId: runBlocked.id,
        metadata: { reason: "secret detected" },
        createdAt: ago(297),
        repository: { fullName: payments.fullName, isDemo: true },
      },
      {
        id: "aud_2",
        repositoryId: payments.id,
        actor: "ci",
        action: "deployment.succeeded",
        entityType: "Deployment",
        entityId: depClean.id,
        metadata: { environment: "production" },
        createdAt: ago(110),
        repository: { fullName: payments.fullName, isDemo: true },
      },
      {
        id: "aud_3",
        repositoryId: web.id,
        actor: "ci",
        action: "pipeline.failed",
        entityType: "PipelineRun",
        entityId: runHeld.id,
        metadata: { reason: "high severity vulnerability" },
        createdAt: ago(41),
        repository: { fullName: web.fullName, isDemo: true },
      },
    ];
  }

  getOverview() {
    const repos = this.repositories.map((r) => {
      const runs = this.pipelineRuns
        .filter((x) => x.repositoryId === r.id)
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
      const run = runs.find((x) => x.branch === r.defaultBranch);
      const decision = run ? this.policyDecisions.find((d) => d.runId === run.id) : null;
      const state = !decision ? "UNKNOWN" : decision.outcome === "ALLOW" ? "OPEN" : "HELD";
      const deps = this.deployments
        .filter((d) => d.repositoryId === r.id)
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

      return {
        id: r.id,
        fullName: r.fullName,
        isDemo: r.isDemo,
        branch: r.defaultBranch,
        state: state as "OPEN" | "HELD" | "UNKNOWN",
        reasons: decision?.reasons ?? [],
        lastRunAt: run?.startedAt ?? null,
        lastDeployment: deps[0] ?? null,
      };
    });

    const openFindings = this.findings.filter((f) => f.status === "OPEN");
    const countSev = (s: Severity) => openFindings.filter((f) => f.severity === s).length;

    const runsTotal = this.pipelineRuns.length;
    const passed = this.pipelineRuns.filter((r) => r.status === "PASSED").length;
    const blocked = this.pipelineRuns.filter((r) => r.status === "BLOCKED").length;
    const failed = this.pipelineRuns.filter((r) => r.status === "FAILED").length;

    return {
      gates: repos,
      hasDemo: this.repositories.some((r) => r.isDemo),
      repositoryCount: this.repositories.length,
      openBySeverity: (["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as Severity[]).map((s) => ({
        severity: s,
        count: countSev(s),
      })),
      runs: { total: runsTotal, passed, blocked, failed },
      notifications: {
        total: this.notifications.length,
        failed: this.notifications.filter((n) => n.status === "FAILED").length,
      },
    };
  }

  listRepositories() {
    return this.repositories.map((r) => {
      const runs = this.pipelineRuns.filter((p) => p.repositoryId === r.id);
      const findings = this.findings.filter((f) => f.repositoryId === r.id && f.status === "OPEN");
      return {
        ...r,
        _count: {
          runs: runs.length,
          findings: findings.length,
        },
      };
    });
  }

  createRepository(data: { fullName: string; defaultBranch: string; ownerEmail: string }) {
    const existing = this.repositories.find((r) => r.fullName.toLowerCase() === data.fullName.toLowerCase());
    if (existing) {
      throw new Error(`${data.fullName} is already registered`);
    }
    const repo: RepositoryRecord = {
      id: `repo_${Date.now()}`,
      fullName: data.fullName,
      defaultBranch: data.defaultBranch || "main",
      ownerId: `user_${Date.now()}`,
      isDemo: false,
      createdAt: new Date(),
      owner: { email: data.ownerEmail },
    };
    this.repositories.unshift(repo);
    return repo;
  }

  listRuns() {
    return this.pipelineRuns.map((r) => {
      const decision = this.policyDecisions.find((d) => d.runId === r.id);
      const findings = this.findings.filter((f) => f.runId === r.id);
      return {
        ...r,
        policyDecision: decision ?? null,
        _count: { findings: findings.length },
      };
    });
  }

  createRun(data: {
    repositoryId: string;
    branch: string;
    commitSha: string;
    actor: string;
    status: "PASSED" | "BLOCKED" | "FAILED";
    reasons?: string[];
  }) {
    const repo = this.repositories.find((r) => r.id === data.repositoryId);
    if (!repo) throw new Error("Repository not found");

    const run: PipelineRunRecord = {
      id: `run_${Date.now()}`,
      repositoryId: repo.id,
      branch: data.branch,
      commitSha: data.commitSha,
      actor: data.actor,
      status: data.status,
      startedAt: new Date(),
      finishedAt: new Date(),
      repository: { fullName: repo.fullName, isDemo: repo.isDemo },
      _count: { findings: 0 },
    };
    this.pipelineRuns.unshift(run);

    if (data.reasons && data.reasons.length > 0) {
      const decision: PolicyDecisionRecord = {
        id: `pol_${Date.now()}`,
        runId: run.id,
        policyVersion: "1.0",
        outcome: data.status === "PASSED" ? "ALLOW" : "BLOCK",
        reasons: data.reasons,
        createdAt: new Date(),
      };
      this.policyDecisions.unshift(decision);
    }

    return run;
  }

  listFindings(filter?: { severity?: Severity; status?: FindingStatus }) {
    let list = this.findings;
    if (filter?.severity) {
      list = list.filter((f) => f.severity === filter.severity);
    }
    if (filter?.status) {
      list = list.filter((f) => f.status === filter.status);
    }
    return list;
  }

  findFinding(id: string) {
    return this.findings.find((f) => f.id === id);
  }

  updateFinding(id: string, updates: Partial<FindingRecord>) {
    const finding = this.findings.find((f) => f.id === id);
    if (finding) {
      Object.assign(finding, updates);
    }
    return finding;
  }

  listDeployments() {
    return this.deployments;
  }

  listNotifications() {
    return this.notifications;
  }

  listAudit() {
    return this.auditEvents;
  }

  recordAudit(data: {
    actor: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    repositoryId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const repo = data.repositoryId ? this.repositories.find((r) => r.id === data.repositoryId) : null;
    const event: AuditEventRecord = {
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      actor: data.actor,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId ?? null,
      repositoryId: data.repositoryId ?? null,
      metadata: data.metadata ?? {},
      createdAt: new Date(),
      repository: repo ? { fullName: repo.fullName, isDemo: repo.isDemo } : null,
    };
    this.auditEvents.unshift(event);
    return event;
  }
}

// Preserve store across hot-reloads in Next.js development
const globalStore = globalThis as unknown as { __secureship_store?: SecureShipStore };
export const store = globalStore.__secureship_store ?? (globalStore.__secureship_store = new SecureShipStore());
