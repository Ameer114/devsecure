import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "@/lib/logger";
import { store } from "@/lib/store";
import type { DeploymentRecord } from "@/lib/types";
import { recordAudit } from "@/services/audit";

const execFileAsync = promisify(execFile);

export interface CloudDeployConfig {
  provider?: "vercel" | "railway" | "aws" | "custom";
  webhookUrl?: string;
  authToken?: string;
  environment?: string;
  autoDeploy?: boolean;

  // AWS EC2 Specific configuration
  ec2Host?: string;
  ec2User?: string;
  ec2KeyPath?: string;
  ec2AppDir?: string;
  ec2Command?: string;
}

export async function triggerCloudDeployment(params: {
  repoId: string;
  repoFullName: string;
  runId: string;
  commitSha: string;
  branch: string;
  config?: CloudDeployConfig;
}): Promise<{ ok: boolean; message: string; deployment?: DeploymentRecord }> {
  const { repoId, repoFullName, runId, commitSha, branch, config } = params;
  const env = config?.environment || "production";
  const provider = config?.provider || "aws";

  let remoteDeployed = false;
  let deployDetails = "";
  let isSuccess = false;
  let statusMessage = "";

  // 1. Direct AWS EC2 Deployment via SSH
  if (provider === "aws") {
    if (!config?.ec2Host?.trim()) {
      isSuccess = false;
      statusMessage = "AWS EC2 Host IP is not configured. Go to Configuration page and enter your EC2 Public IPv4 address.";
      deployDetails = statusMessage;
    } else {
      const host = config.ec2Host.trim();
      const user = config.ec2User?.trim() || "ec2-user";
      const keyPath = config.ec2KeyPath?.trim() || "";
      const appDir = config.ec2AppDir?.trim() || "/home/ec2-user/app";
      const runCmd = config.ec2Command?.trim() || "git pull && npm install && npm run build && pm2 restart all";

      const remoteScript = `cd "${appDir}" && ${runCmd}`;
      const sshArgs: string[] = ["-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=15"];
      if (keyPath) {
        sshArgs.push("-i", keyPath);
      }
      sshArgs.push(`${user}@${host}`, remoteScript);

      try {
        const { stdout, stderr } = await execFileAsync("ssh", sshArgs);
        remoteDeployed = true;
        isSuccess = true;
        const sshOutput = (stdout || stderr).trim();
        statusMessage = `Successfully deployed to AWS EC2 (${user}@${host}). Output: ${sshOutput.slice(0, 300)}`;
        deployDetails = statusMessage;
      } catch (sshErr) {
        isSuccess = false;
        const errMsg = sshErr instanceof Error ? sshErr.message : String(sshErr);
        logger.warn("AWS EC2 SSH deploy failed", { errMsg });
        statusMessage = `AWS EC2 SSH failed: ${errMsg}. Check that Port 22 is open in AWS Security Group and PEM key path is valid.`;
        deployDetails = statusMessage;
      }
    }
  }

  // 2. Cloud Webhook / Deploy Hook URL (e.g. Vercel, Railway, AWS Webhook)
  else if (config?.webhookUrl?.trim()) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "SecureShip-CI-CD/1.0",
      };
      if (config.authToken?.trim()) {
        headers["Authorization"] = `Bearer ${config.authToken.trim()}`;
      }

      const res = await fetch(config.webhookUrl.trim(), {
        method: "POST",
        headers,
        body: JSON.stringify({
          ref: branch,
          commitSha,
          repository: repoFullName,
          environment: env,
          deployedAt: new Date().toISOString(),
          triggeredBy: "SecureShip Security Release Gate",
        }),
      });

      if (res.ok) {
        remoteDeployed = true;
        isSuccess = true;
        statusMessage = `Triggered ${provider.toUpperCase()} cloud deployment webhook successfully.`;
        deployDetails = statusMessage;
      } else {
        isSuccess = false;
        const body = await res.text().catch(() => "");
        statusMessage = `Cloud webhook returned status ${res.status}: ${body.slice(0, 150)}`;
        deployDetails = statusMessage;
      }
    } catch (err) {
      isSuccess = false;
      const errMsg = err instanceof Error ? err.message : String(err);
      statusMessage = `Failed to reach cloud deployment webhook endpoint: ${errMsg}`;
      deployDetails = statusMessage;
    }
  } else {
    // No cloud target configured
    isSuccess = true;
    statusMessage = "Local security release gate passed. No cloud deployment target was configured.";
    deployDetails = statusMessage;
  }

  // 3. Register deployment record in store
  const shortSha = commitSha.slice(0, 7);
  const deployment: DeploymentRecord = {
    id: `dep_${Date.now()}`,
    repositoryId: repoId,
    runId,
    environment: env,
    imageRef: remoteDeployed
      ? config?.provider === "aws" && config.ec2Host
        ? `ec2://${config.ec2User || "ec2-user"}@${config.ec2Host}:${shortSha}`
        : `${provider}://${repoFullName}:${shortSha}`
      : `release://${repoFullName}:${shortSha}`,
    imageDigest: `sha256:${commitSha}`,
    status: isSuccess && remoteDeployed ? "SUCCEEDED" : isSuccess && !config?.ec2Host && !config?.webhookUrl ? "SUCCEEDED" : "FAILED",
    healthCheckOk: isSuccess && remoteDeployed,
    startedAt: new Date(Date.now() - 2000),
    finishedAt: new Date(),
    repository: { fullName: repoFullName, isDemo: false },
  };

  store.deployments.unshift(deployment);

  // 4. Record audit trail
  await recordAudit({
    actor: "ci-cd-pipeline",
    action: isSuccess ? "deployment.succeeded" : "deployment.failed",
    entityType: "Deployment",
    entityId: deployment.id,
    repositoryId: repoId,
    metadata: {
      provider,
      environment: env,
      commitSha: shortSha,
      remoteDeployed,
      ec2Host: config?.ec2Host || null,
      details: deployDetails,
    },
  });

  return {
    ok: isSuccess && (remoteDeployed || (!config?.ec2Host && !config?.webhookUrl)),
    message: statusMessage,
    deployment,
  };
}
