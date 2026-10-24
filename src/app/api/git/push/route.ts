import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { logger } from "@/lib/logger";
import { store } from "@/lib/store";
import type { PolicyDecisionRecord } from "@/lib/types";
import { recordAudit } from "@/services/audit";
import { triggerCloudDeployment, type CloudDeployConfig } from "@/services/deploy";
import { runSecurityScan } from "@/services/scanner";
import { sendSecurityAlertEmail } from "@/services/email";
import { generateFindingExplanation } from "@/services/ai";

const execFileAsync = promisify(execFile);

interface PushPayload {
  repoUrl?: string;
  localFolderPath?: string;
  branch?: string;
  commitMessage?: string;
  repoFullName?: string;
  cloudConfig?: CloudDeployConfig;
  alertEmail?: string;
  groqApiKey?: string;
  smtpConfig?: {
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    from?: string;
  };
}

function parseOwnerAndRepo(url: string): { owner: string; repo: string } | null {
  const clean = url.trim().replace(/\.git$/, "");
  const match = clean.match(/(?:github\.com\/)?([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export async function GET() {
  return Response.json({
    defaultPath: process.cwd(),
  });
}

export async function POST(req: Request) {
  let body: PushPayload = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional
  }

  const branch = body.branch?.trim() || "main";
  const commitMessage = body.commitMessage?.trim() || `feat: update from SecureShip dashboard [${new Date().toLocaleTimeString()}]`;
  const repoUrl = body.repoUrl?.trim();
  const cloudConfig = body.cloudConfig;

  let cwd = process.cwd();
  if (body.localFolderPath?.trim()) {
    const candidatePath = path.resolve(body.localFolderPath.trim());
    if (!fs.existsSync(candidatePath)) {
      return Response.json(
        { ok: false, error: `Local folder does not exist: "${body.localFolderPath}". Check the folder path in Configuration.` },
        { status: 400 }
      );
    }
    cwd = candidatePath;
  }

  try {
    // 1. Ensure git is initialized in cwd
    try {
      await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], { cwd });
    } catch {
      await execFileAsync("git", ["init"], { cwd });
      await execFileAsync("git", ["branch", "-M", branch], { cwd });
    }

    // 2. Configure remote origin if repoUrl is provided
    let remoteOrigin = "";
    try {
      const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"], { cwd });
      remoteOrigin = stdout.trim();
    } catch {
      // No remote origin yet
    }

    if (repoUrl) {
      const normalizedUrl = repoUrl.startsWith("http") || repoUrl.startsWith("git@")
        ? repoUrl
        : `https://github.com/${repoUrl}.git`;

      if (remoteOrigin) {
        if (remoteOrigin !== normalizedUrl) {
          await execFileAsync("git", ["remote", "set-url", "origin", normalizedUrl], { cwd });
          remoteOrigin = normalizedUrl;
        }
      } else {
        await execFileAsync("git", ["remote", "add", "origin", normalizedUrl], { cwd });
        remoteOrigin = normalizedUrl;
      }
    }

    // 3. Register or retrieve repository in store
    let targetName = body.repoFullName;
    if (!targetName && remoteOrigin) {
      const parsed = parseOwnerAndRepo(remoteOrigin);
      if (parsed) targetName = `${parsed.owner}/${parsed.repo}`;
    }
    if (!targetName) targetName = path.basename(cwd) || "local/project";

    let repo = store.repositories.find((r) => r.fullName.toLowerCase() === targetName?.toLowerCase());
    if (!repo) {
      repo = store.createRepository({
        fullName: targetName,
        defaultBranch: branch,
        ownerEmail: body.alertEmail?.trim() || "developer@local",
      });
    }

    let commitSha = "uncommitted";
    try {
      const { stdout: shaOut } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd });
      commitSha = shaOut.trim();
    } catch {
      // Empty repo or uncommitted
    }

    // 4. MANDATORY PRE-PUSH SECURITY SCAN: Check ALL repository files BEFORE pushing to GitHub!
    const runId = `run_${Date.now()}`;
    const scanFindings = runSecurityScan(cwd, repo.id, runId, repo.fullName);

    // Save findings into store
    for (const f of scanFindings) {
      store.findings.unshift(f);
    }

    const blockingFindings = scanFindings.filter(
      (f) => f.severity === "CRITICAL" || f.severity === "HIGH" || f.kind === "SECRET"
    );
    const isGateBlocked = blockingFindings.length > 0;

    // 5. IF GATE IS BLOCKED: STOP IMMEDIATELY! DO NOT PUSH TO GITHUB! DO NOT DEPLOY TO AWS!
    if (isGateBlocked) {
      const recipientEmail = body.alertEmail?.trim() || repo.owner.email || "developer@local";
      const notifId = `notif_${Date.now()}`;

      // Automatically generate AI explanation using Groq if key is available
      let aiAnalysis: { explanation?: string; suggestion?: string } = {};
      if (blockingFindings[0]) {
        try {
          aiAnalysis = await generateFindingExplanation(blockingFindings[0], body.groqApiKey);
          blockingFindings[0].aiExplanation = aiAnalysis.explanation;
          blockingFindings[0].aiSuggestion = aiAnalysis.suggestion;
        } catch (aiErr) {
          logger.warn("Auto AI explanation skipped during gate blockage", { aiErr });
        }
      }

      // Dispatch real email alert to the user-provided recipient
      const emailResult = await sendSecurityAlertEmail({
        to: recipientEmail,
        subject: `[SecureShip ALERT] Pre-push gate BLOCKED for ${repo.fullName}`,
        repoFullName: repo.fullName,
        commitSha,
        branch,
        findingDetails: blockingFindings.map((f) => ({
          ruleId: f.ruleId,
          title: f.title,
          filePath: f.filePath,
          startLine: f.startLine,
          severity: f.severity,
        })),
        aiExplanation: aiAnalysis.explanation,
        aiSuggestion: aiAnalysis.suggestion,
        smtpConfig: body.smtpConfig,
      });

      const reasons = blockingFindings.map((f) => `${f.title} in ${f.filePath}:${f.startLine}`);

      const run = store.createRun({
        repositoryId: repo.id,
        branch,
        commitSha,
        actor: "ci-cd-pipeline",
        status: "BLOCKED",
        reasons,
      });

      const decision: PolicyDecisionRecord = {
        id: `pol_${Date.now()}`,
        runId: run.id,
        policyVersion: "1.0",
        outcome: "BLOCK",
        reasons,
        createdAt: new Date(),
      };
      store.policyDecisions.unshift(decision);

      store.notifications.unshift({
        id: notifId,
        repositoryId: repo.id,
        runId: run.id,
        findingId: blockingFindings[0]?.id || null,
        channel: "EMAIL",
        recipient: recipientEmail,
        subject: `[SecureShip ALERT] Pre-push gate BLOCKED for ${repo.fullName}`,
        status: emailResult.ok ? "SENT" : "FAILED",
        error: emailResult.error,
        createdAt: new Date(),
        repository: { fullName: repo.fullName, isDemo: false },
      });

      await recordAudit({
        actor: "security-gate",
        action: "pipeline.blocked_pre_push",
        entityType: "PipelineRun",
        entityId: run.id,
        repositoryId: repo.id,
        metadata: {
          commitSha: commitSha.slice(0, 7),
          findingsCount: scanFindings.length,
          reasons,
          alertEmailSent: emailResult.ok,
          previewUrl: emailResult.previewUrl || undefined,
          pushedToRemote: false,
          deployed: false,
        },
      });

      return Response.json({
        ok: false,
        blocked: true,
        pushedToRemote: false,
        deployed: false,
        commitSha: commitSha.slice(0, 7),
        findingsCount: scanFindings.length,
        blockingCount: blockingFindings.length,
        firstFinding: {
          title: blockingFindings[0]?.title,
          filePath: blockingFindings[0]?.filePath,
          startLine: blockingFindings[0]?.startLine,
          ruleId: blockingFindings[0]?.ruleId,
        },
        reasons,
        emailAlert: {
          sent: emailResult.ok,
          recipient: recipientEmail,
          previewUrl: emailResult.previewUrl || undefined,
        },
        aiAnalysis: aiAnalysis.explanation ? aiAnalysis : undefined,
        message: `🛑 PRE-PUSH SECURITY GATE HELD! Push to GitHub aborted. Exposed secret detected in ${blockingFindings[0]?.filePath}:${blockingFindings[0]?.startLine}. Code was NOT pushed to GitHub and NOT deployed to AWS. Alert email ${emailResult.ok ? "sent" : "queued"} to ${recipientEmail}.`,
      });
    }

    // 6. ZERO VULNERABILITIES: Code is completely safe! Now stage and commit pending changes
    const { stdout: statusOut } = await execFileAsync("git", ["status", "--porcelain"], { cwd });
    if (statusOut.trim().length > 0) {
      await execFileAsync("git", ["add", "-A"], { cwd });
      await execFileAsync("git", ["commit", "-m", commitMessage], { cwd });
    }

    try {
      const { stdout: shaOut } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd });
      commitSha = shaOut.trim();
    } catch {
      // ignore
    }

    let latestMessage = commitMessage;
    try {
      const { stdout: logOut } = await execFileAsync("git", ["log", "-1", "--pretty=%s"], { cwd });
      latestMessage = logOut.trim();
    } catch {
      // ignore
    }

    // 7. Push clean code to GitHub using system Git CLI
    let pushedToRemote = false;
    if (remoteOrigin) {
      try {
        await execFileAsync("git", ["push", "-u", "origin", branch], { cwd });
        pushedToRemote = true;
      } catch (pushErr) {
        const errMessage = pushErr instanceof Error ? pushErr.message : String(pushErr);
        logger.warn("git push returned message", { errMessage });
        return Response.json(
          {
            ok: false,
            commitSha: commitSha.slice(0, 7),
            error: `Git push failed: ${errMessage}. Verify that the remote repository exists and your system's Git has push permissions.`,
          },
          { status: 400 }
        );
      }
    }

    // 8. Deterministic Policy Gate Decision: ALLOW
    const reasons = ["All security checks passed. Zero exposed secrets or critical vulnerabilities."];
    const run = store.createRun({
      repositoryId: repo.id,
      branch,
      commitSha,
      actor: "ci-cd-pipeline",
      status: "PASSED",
      reasons,
    });

    const decision: PolicyDecisionRecord = {
      id: `pol_${Date.now()}`,
      runId: run.id,
      policyVersion: "1.0",
      outcome: "ALLOW",
      reasons,
      createdAt: new Date(),
    };
    store.policyDecisions.unshift(decision);

    // 9. Build & Deploy to Cloud!
    const deployResult = await triggerCloudDeployment({
      repoId: repo.id,
      repoFullName: repo.fullName,
      repoUrl: repoUrl || remoteOrigin || `https://github.com/${repo.fullName}.git`,
      runId: run.id,
      commitSha,
      branch,
      config: cloudConfig,
    });

    await recordAudit({
      actor: "ci-cd-pipeline",
      action: "pipeline.passed_and_deployed",
      entityType: "PipelineRun",
      entityId: run.id,
      repositoryId: repo.id,
      metadata: {
        commitSha: commitSha.slice(0, 7),
        pushedToRemote,
        deployed: deployResult.ok,
      },
    });

    return Response.json({
      ok: true,
      blocked: false,
      deployed: deployResult.ok,
      commitSha: commitSha.slice(0, 7),
      latestMessage,
      branch,
      folder: cwd,
      pushedToRemote,
      deployment: deployResult.deployment,
      message: deployResult.ok
        ? (deployResult.message || `Security scan passed! Clean code pushed to GitHub and deployed to Cloud (${deployResult.deployment?.environment || "production"}).`)
        : `Security scan passed & pushed to GitHub, but Cloud Deployment was not completed: ${deployResult.message}`,
    });
  } catch (err) {
    logger.error("Failed to run CI/CD pipeline", { err });
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "CI/CD Pipeline failed.",
      },
      { status: 500 }
    );
  }
}
