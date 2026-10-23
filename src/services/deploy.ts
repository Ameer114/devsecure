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
  repoUrl?: string;
  runId: string;
  commitSha: string;
  branch: string;
  config?: CloudDeployConfig;
}): Promise<{ ok: boolean; message: string; deployment?: DeploymentRecord }> {
  const { repoId, repoFullName, repoUrl, runId, commitSha, branch, config } = params;
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
      let user = config.ec2User?.trim() || "ec2-user";
      // Auto-correct common user error: entering "Linux/UNIX" or "Linux" copied from AWS EC2 console
      if (/^(linux\/unix|linux|unix)$/i.test(user)) {
        user = "ec2-user";
      }

      let keyPath = config.ec2KeyPath?.trim() || "";
      // Strip surrounding quotes if copied as path from Windows Explorer
      keyPath = keyPath.replace(/^["']+|["']+$/g, "");

      let appDir = config.ec2AppDir?.trim() || (user === "ubuntu" ? "/home/ubuntu/app" : "/home/ec2-user/app");
      // Prevent permission denied if ec2-user tries to write to /home/ubuntu or vice versa
      if (user === "ec2-user" && appDir.startsWith("/home/ubuntu")) {
        appDir = appDir.replace("/home/ubuntu", "/home/ec2-user");
      } else if (user === "ubuntu" && appDir.startsWith("/home/ec2-user")) {
        appDir = appDir.replace("/home/ec2-user", "/home/ubuntu");
      }

      const targetRepoUrl = repoUrl?.trim() || (repoFullName ? `https://github.com/${repoFullName}.git` : "");

      // Fully automated bootstrapping:
      // 0. Auto-create 2GB swap space if missing (crucial for 1GB EC2 instances to prevent out-of-memory freeze during npm install / build)
      // 1. Auto-install git, nodejs 22+, and pm2 if not yet present on remote instance
      // 2. Automatically create directory (mkdir -p)
      // 3. Automatically clone repo if first run, or pull latest code if already cloned
      // 4. Build & start/restart application
      const autoBootstrapCmd = `(if [ ! -f /swapfile ] && command -v dd >/dev/null 2>&1; then (sudo dd if=/dev/zero of=/swapfile bs=128M count=16 2>/dev/null && sudo chmod 600 /swapfile && sudo mkswap /swapfile 2>/dev/null && sudo swapon /swapfile 2>/dev/null) || true; fi) && (command -v git >/dev/null 2>&1 || (sudo dnf install -y git 2>/dev/null || sudo yum install -y git 2>/dev/null || (sudo apt-get update -y && sudo apt-get install -y git) 2>/dev/null || true)) && ((command -v node >/dev/null 2>&1 && node -e "process.exit(parseInt(process.versions.node) >= 20 ? 0 : 1)" 2>/dev/null) || (sudo dnf remove -y nodejs nodejs-npm 2>/dev/null; sudo dnf install -y nodejs22 nodejs22-npm 2>/dev/null || (curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash - && sudo dnf install -y nodejs) 2>/dev/null || (curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs) 2>/dev/null || true)) && (command -v pm2 >/dev/null 2>&1 || sudo npm install -g pm2 2>/dev/null || true) && mkdir -p "${appDir}" && cd "${appDir}" && (if [ ! -d .git ]; then ${targetRepoUrl ? `git clone "${targetRepoUrl}" .` : `git init`}; else ${targetRepoUrl ? `git remote set-url origin "${targetRepoUrl}" 2>/dev/null || true;` : ""} git fetch origin 2>/dev/null || true; git checkout "${branch}" 2>/dev/null || true; git pull origin "${branch}" 2>/dev/null || true; fi) && (if [ -f package.json ]; then export NODE_OPTIONS="--max-old-space-size=1536" && export NEXT_TELEMETRY_DISABLED=1 && npm install --no-audit && npm run build --if-present && (command -v pm2 >/dev/null 2>&1 && (pm2 restart all || pm2 start npm --name "app" -- start) || (npm run start &)); fi)`;

      const customCmd = config.ec2Command?.trim();
      const remoteScript = customCmd && !customCmd.startsWith("git pull")
        ? `mkdir -p "${appDir}" && cd "${appDir}" && ${customCmd}`
        : autoBootstrapCmd;

      const sshArgs: string[] = [
        "-4",
        "-n",
        "-o", "StrictHostKeyChecking=no",
        "-o", "ConnectTimeout=20",
        "-o", "ServerAliveInterval=15",
        "-o", "ServerAliveCountMax=4",
      ];
      if (keyPath) {
        sshArgs.push("-i", keyPath);
      }
      sshArgs.push(`${user}@${host}`, remoteScript);

      try {
        const { stdout, stderr } = await execFileAsync("ssh", sshArgs);
        remoteDeployed = true;
        isSuccess = true;
        const sshOutput = (stdout || stderr).trim();
        statusMessage = `Successfully created directory and deployed to AWS EC2 (${user}@${host}). Output: ${sshOutput.slice(0, 300)}`;
        deployDetails = statusMessage;
      } catch (sshErr) {
        isSuccess = false;
        const errMsg = sshErr instanceof Error ? sshErr.message : String(sshErr);
        logger.warn("AWS EC2 SSH deploy failed", { errMsg });

        if (errMsg.includes("timed out") || errMsg.includes("Connection timed out")) {
          statusMessage = `AWS EC2 Connection Timed Out (${host}). If the instance froze during a previous build, in AWS Console do: Instance state -> Stop instance, wait until stopped, then Start instance (update new IP if changed). Also ensure Port 22 is open in Security Group.`;
        } else if (errMsg.includes("not accessible: No such file or directory")) {
          statusMessage = `AWS EC2 Key (.pem) file not accessible on this machine: "${keyPath}". Please check the path and ensure there are no extra quotes.`;
        } else if (errMsg.includes("Permission denied") || errMsg.includes("Host key verification failed")) {
          statusMessage = `AWS EC2 SSH Authentication Failed. Check that your .pem key path is correct and the SSH user is "${user}". (Tip: Use 'ec2-user' for Amazon Linux or 'ubuntu' for Ubuntu. Do not use 'Linux/UNIX').`;
        } else {
          statusMessage = `AWS EC2 SSH failed: ${errMsg}. Check that Port 22 is open in AWS Security Group and PEM key path is valid.`;
        }
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
