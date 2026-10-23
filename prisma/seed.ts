// Seeds DEMONSTRATION data only. Every repository is flagged isDemo=true and the UI labels it.
// No finding contains a secret value; the schema has no column that could hold one.
import { PrismaPg } from "@prisma/adapter-pg";
import { createHash } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const ago = (min: number) => new Date(Date.now() - min * 60_000);
const fp = (s: string) => createHash("sha256").update(`demo:${s}`).digest("hex").slice(0, 32);

async function main() {
  await db.repository.deleteMany({ where: { isDemo: true } });
  const owner = await db.user.upsert({
    where: { email: "demo-owner@example.com" },
    update: {},
    create: { email: "demo-owner@example.com", name: "Demo Owner" },
  });

  const payments = await db.repository.create({
    data: { fullName: "demo-org/payments-api", ownerId: owner.id, isDemo: true },
  });
  const web = await db.repository.create({
    data: { fullName: "demo-org/web-frontend", ownerId: owner.id, isDemo: true },
  });

  // payments-api: a blocked run (secret), then a clean run that deployed.
  const blocked = await db.pipelineRun.create({
    data: { repositoryId: payments.id, githubRunId: "demo-1001", branch: "feature/billing", commitSha: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678", actor: "demo-dev", status: "BLOCKED", startedAt: ago(300), finishedAt: ago(297) },
  });
  await db.finding.create({
    data: { runId: blocked.id, repositoryId: payments.id, scanner: "GITLEAKS", kind: "SECRET", severity: "CRITICAL", ruleId: "generic-api-key", title: "Possible API key committed in source", filePath: "src/billing/client.ts", startLine: 14, endLine: 14, fingerprint: fp("payments-key"), status: "REMEDIATED" },
  });
  await db.policyDecision.create({
    data: { runId: blocked.id, policyVersion: "demo-0", outcome: "BLOCK", reasons: ["Secret detected by Gitleaks (1 finding)"] },
  });
  await db.notification.create({
    data: { repositoryId: payments.id, runId: blocked.id, recipient: owner.email, subject: "[SecureShip] Secret detected in demo-org/payments-api", status: "SENT", sentAt: ago(296), createdAt: ago(296) },
  });

  const clean = await db.pipelineRun.create({
    data: { repositoryId: payments.id, githubRunId: "demo-1002", branch: "main", commitSha: "0f9e8d7c6b5a49382716f5e4d3c2b1a098765432", actor: "demo-dev", status: "PASSED", startedAt: ago(120), finishedAt: ago(115) },
  });
  await db.policyDecision.create({
    data: { runId: clean.id, policyVersion: "demo-0", outcome: "ALLOW", reasons: ["All mandatory checks passed"] },
  });
  await db.deployment.create({
    data: { repositoryId: payments.id, runId: clean.id, environment: "production", imageRef: "ghcr.io/demo-org/payments-api:0f9e8d7", status: "SUCCEEDED", healthCheckOk: true, startedAt: ago(112), finishedAt: ago(110) },
  });

  // web-frontend: held by a high-severity dependency vulnerability.
  const held = await db.pipelineRun.create({
    data: { repositoryId: web.id, githubRunId: "demo-2001", branch: "main", commitSha: "9988776655443322110099887766554433221100", actor: "demo-dev", status: "FAILED", startedAt: ago(45), finishedAt: ago(41) },
  });
  await db.finding.createMany({
    data: [
      { runId: held.id, repositoryId: web.id, scanner: "TRIVY", kind: "VULNERABILITY", severity: "HIGH", ruleId: "CVE-0000-00000", title: "Vulnerable dependency (demo record)", filePath: "package-lock.json", fingerprint: fp("web-dep") },
      { runId: held.id, repositoryId: web.id, scanner: "SEMGREP", kind: "SAST", severity: "MEDIUM", ruleId: "demo.rules.unsafe-html", title: "Unescaped HTML rendering (demo record)", filePath: "src/components/Preview.tsx", startLine: 31, endLine: 33, fingerprint: fp("web-sast") },
    ],
  });
  await db.policyDecision.create({
    data: { runId: held.id, policyVersion: "demo-0", outcome: "BLOCK", reasons: ["High-severity vulnerability found by Trivy (1 finding)"] },
  });

  await db.auditEvent.createMany({
    data: [
      { repositoryId: payments.id, actor: "ci", action: "pipeline.blocked", entityType: "PipelineRun", entityId: blocked.id, metadata: { reason: "secret detected" }, createdAt: ago(297) },
      { repositoryId: payments.id, actor: "ci", action: "deployment.succeeded", entityType: "Deployment", metadata: { environment: "production" }, createdAt: ago(110) },
      { repositoryId: web.id, actor: "ci", action: "pipeline.failed", entityType: "PipelineRun", entityId: held.id, metadata: { reason: "high severity vulnerability" }, createdAt: ago(41) },
    ],
  });
  console.log("Seeded demo data (isDemo=true).");
}

main().finally(() => db.$disconnect());
