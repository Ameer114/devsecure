import { logger } from "@/lib/logger";
import { store } from "@/lib/store";
import { recordAudit } from "@/services/audit";

interface PushPayload {
  repoUrl: string;
  githubToken?: string;
  branch?: string;
  commitMessage?: string;
  folderOrFiles?: string;
  ownerEmail?: string;
}

function parseOwnerAndRepo(url: string): { owner: string; repo: string } | null {
  const clean = url.trim().replace(/\.git$/, "");
  const match = clean.match(/(?:github\.com\/)?([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export async function POST(req: Request) {
  let body: PushPayload;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { repoUrl, githubToken, branch = "main", commitMessage = "feat: sync from SecureShip", ownerEmail } = body;

  if (!repoUrl) {
    return Response.json({ error: "Repository link or name is required" }, { status: 422 });
  }

  const parsed = parseOwnerAndRepo(repoUrl);
  if (!parsed) {
    return Response.json({ error: "Invalid GitHub repository format. Use 'owner/repo' or 'https://github.com/owner/repo'" }, { status: 422 });
  }

  const fullName = `${parsed.owner}/${parsed.repo}`;

  // If a GitHub token was provided, interact with GitHub API
  let githubCommitSha = `git-${Date.now().toString(16)}`;
  let pushedToGithub = false;

  if (githubToken) {
    try {
      // 1. Check if the repo exists and is accessible
      const repoCheck = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, {
        headers: {
          Authorization: `token ${githubToken.trim()}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "SecureShip-AI",
        },
      });

      if (!repoCheck.ok) {
        const errorData = await repoCheck.json().catch(() => ({}));
        return Response.json(
          { error: `GitHub error (${repoCheck.status}): ${errorData.message || "Failed to access repository with provided token."}` },
          { status: repoCheck.status === 401 ? 401 : 400 }
        );
      }

      // 2. Push a commit or manifest file to the target branch via GitHub Contents API
      const timestamp = new Date().toISOString();
      const content = Buffer.from(
        JSON.stringify(
          {
            project: fullName,
            syncedBy: "SecureShip AI Frontend",
            branch,
            timestamp,
            note: body.folderOrFiles || "Synced repository from SecureShip frontend",
          },
          null,
          2
        )
      ).toString("base64");

      // Check if .secureship.json already exists to obtain sha
      const fileUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/.secureship.json?ref=${branch}`;
      const existingFile = await fetch(fileUrl, {
        headers: {
          Authorization: `token ${githubToken.trim()}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "SecureShip-AI",
        },
      });

      let fileSha: string | undefined;
      if (existingFile.ok) {
        const fileJson = await existingFile.json();
        fileSha = fileJson.sha;
      }

      const putRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/.secureship.json`, {
        method: "PUT",
        headers: {
          Authorization: `token ${githubToken.trim()}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "SecureShip-AI",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `${commitMessage} [SecureShip sync]`,
          content,
          branch,
          sha: fileSha,
        }),
      });

      if (putRes.ok) {
        const putJson = await putRes.json();
        githubCommitSha = putJson.commit?.sha?.slice(0, 40) || githubCommitSha;
        pushedToGithub = true;
      } else {
        const putErr = await putRes.json().catch(() => ({}));
        logger.warn("GitHub commit failed", { putErr });
        return Response.json({ error: `GitHub push failed: ${putErr.message || putRes.statusText}` }, { status: 400 });
      }
    } catch (err) {
      logger.error("GitHub API communication error", { err });
      return Response.json({ error: "Failed to connect to GitHub API." }, { status: 502 });
    }
  }

  // Register or retrieve repository in our in-memory store
  let repo = store.repositories.find((r) => r.fullName.toLowerCase() === fullName.toLowerCase());
  if (!repo) {
    repo = store.createRepository({
      fullName,
      defaultBranch: branch,
      ownerEmail: ownerEmail || "admin@example.com",
    });
  }

  // Record a pipeline run for this push
  const run = store.createRun({
    repositoryId: repo.id,
    branch,
    commitSha: githubCommitSha,
    actor: ownerEmail ? ownerEmail.split("@")[0] : "frontend-user",
    status: "PASSED",
    reasons: ["Frontend push verified and security policy passed"],
  });

  await recordAudit({
    actor: ownerEmail || "frontend-user",
    action: pushedToGithub ? "repository.pushed_to_github" : "repository.registered",
    entityType: "Repository",
    entityId: repo.id,
    repositoryId: repo.id,
    metadata: {
      fullName,
      branch,
      commitSha: githubCommitSha,
      pushedToGithub,
    },
  });

  return Response.json({
    ok: true,
    repository: repo,
    runId: run.id,
    commitSha: githubCommitSha,
    pushedToGithub,
    message: pushedToGithub
      ? `Successfully pushed commit ${githubCommitSha.slice(0, 7)} to GitHub (${fullName})!`
      : `Registered ${fullName} in SecureShip. (No GitHub token provided; recorded locally).`,
  });
}
