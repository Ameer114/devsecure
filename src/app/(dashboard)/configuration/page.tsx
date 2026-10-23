"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Cloud, Eye, EyeOff, Folder, FolderGit2, KeyRound, Mail, Rocket, Server, ShieldCheck, Terminal, Trash2, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/ui";

export default function ConfigurationPage() {
  const [groqKey, setGroqKey] = useState("");
  const [localFolder, setLocalFolder] = useState("");
  const [mailId, setMailId] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [branch, setBranch] = useState("main");

  // Cloud deployment state
  const [cloudProvider, setCloudProvider] = useState<"vercel" | "railway" | "aws" | "custom">("aws");
  const [cloudWebhook, setCloudWebhook] = useState("");
  const [cloudToken, setCloudToken] = useState("");
  const [cloudEnv, setCloudEnv] = useState("production");

  // AWS EC2 specific state
  const [ec2Host, setEc2Host] = useState("");
  const [ec2User, setEc2User] = useState("ubuntu");
  const [ec2KeyPath, setEc2KeyPath] = useState("");
  const [ec2AppDir, setEc2AppDir] = useState("/home/ubuntu/app");
  const [ec2Command, setEc2Command] = useState("git pull && npm install && npm run build && pm2 restart all");

  // Push / Pipeline tool state
  const [commitMessage, setCommitMessage] = useState("feat: sync and deploy from SecureShip CI/CD");
  const [isPushing, setIsPushing] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<{
    ok: boolean;
    blocked?: boolean;
    deployed?: boolean;
    message: string;
    reasons?: string[];
  } | null>(null);

  // UI state
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showCloudToken, setShowCloudToken] = useState(false);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  // Load saved credentials from localStorage after mount to prevent hydration mismatch
  useEffect(() => {
    const timer = setTimeout(() => {
      const storedGroq = localStorage.getItem("secureship_groq_key");
      if (storedGroq) setGroqKey(storedGroq);

      const storedFolder = localStorage.getItem("secureship_local_folder");
      if (storedFolder) {
        setLocalFolder(storedFolder);
      } else {
        fetch("/api/git/push")
          .then((r) => r.json())
          .then((d) => {
            if (d.defaultPath) {
              setLocalFolder(d.defaultPath);
              localStorage.setItem("secureship_local_folder", d.defaultPath);
            }
          })
          .catch(() => {});
      }

      const storedMail = localStorage.getItem("secureship_mail_id");
      if (storedMail) setMailId(storedMail);

      const storedRepo = localStorage.getItem("secureship_github_repo");
      if (storedRepo) setGithubRepo(storedRepo);

      const storedBranch = localStorage.getItem("secureship_github_branch");
      if (storedBranch) setBranch(storedBranch);

      const storedProvider = localStorage.getItem("secureship_cloud_provider") as
        | "vercel"
        | "railway"
        | "aws"
        | "custom"
        | null;
      if (storedProvider) setCloudProvider(storedProvider);

      const storedWebhook = localStorage.getItem("secureship_cloud_webhook");
      if (storedWebhook) setCloudWebhook(storedWebhook);

      const storedToken = localStorage.getItem("secureship_cloud_token");
      if (storedToken) setCloudToken(storedToken);

      const storedEnv = localStorage.getItem("secureship_cloud_env");
      if (storedEnv) setCloudEnv(storedEnv);

      const storedHost = localStorage.getItem("secureship_ec2_host");
      if (storedHost) setEc2Host(storedHost);

      const storedUser = localStorage.getItem("secureship_ec2_user");
      if (storedUser) setEc2User(storedUser);

      const storedKeyPath = localStorage.getItem("secureship_ec2_keypath");
      if (storedKeyPath) setEc2KeyPath(storedKeyPath);

      const storedAppDir = localStorage.getItem("secureship_ec2_appdir");
      if (storedAppDir) setEc2AppDir(storedAppDir);

      const storedCommand = localStorage.getItem("secureship_ec2_command");
      if (storedCommand) setEc2Command(storedCommand);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (typeof window === "undefined") return;

    localStorage.setItem("secureship_groq_key", groqKey.trim());
    localStorage.setItem("secureship_local_folder", localFolder.trim());
    localStorage.setItem("secureship_github_repo", githubRepo.trim());
    localStorage.setItem("secureship_mail_id", mailId.trim());
    localStorage.setItem("secureship_github_branch", branch.trim() || "main");

    localStorage.setItem("secureship_cloud_provider", cloudProvider);
    localStorage.setItem("secureship_cloud_webhook", cloudWebhook.trim());
    localStorage.setItem("secureship_cloud_token", cloudToken.trim());
    localStorage.setItem("secureship_cloud_env", cloudEnv.trim());

    localStorage.setItem("secureship_ec2_host", ec2Host.trim());
    localStorage.setItem("secureship_ec2_user", ec2User.trim());
    localStorage.setItem("secureship_ec2_keypath", ec2KeyPath.trim());
    localStorage.setItem("secureship_ec2_appdir", ec2AppDir.trim());
    localStorage.setItem("secureship_ec2_command", ec2Command.trim());

    setSavedStatus("Configuration and EC2 credentials saved in frontend storage!");
    setTimeout(() => setSavedStatus(null), 3500);
  }

  function handleClear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem("secureship_groq_key");
    localStorage.removeItem("secureship_local_folder");
    localStorage.removeItem("secureship_github_repo");
    localStorage.removeItem("secureship_mail_id");
    localStorage.removeItem("secureship_github_branch");
    localStorage.removeItem("secureship_cloud_provider");
    localStorage.removeItem("secureship_cloud_webhook");
    localStorage.removeItem("secureship_cloud_token");
    localStorage.removeItem("secureship_cloud_env");

    localStorage.removeItem("secureship_ec2_host");
    localStorage.removeItem("secureship_ec2_user");
    localStorage.removeItem("secureship_ec2_keypath");
    localStorage.removeItem("secureship_ec2_appdir");
    localStorage.removeItem("secureship_ec2_command");

    setGroqKey("");
    setLocalFolder("");
    setGithubRepo("");
    setMailId("");
    setBranch("main");
    setCloudProvider("aws");
    setCloudWebhook("");
    setCloudToken("");
    setCloudEnv("production");
    setEc2Host("");
    setEc2User("ubuntu");
    setEc2KeyPath("");
    setEc2AppDir("/home/ubuntu/app");
    setEc2Command("git pull && npm install && npm run build && pm2 restart all");
    setSavedStatus("Cleared all frontend configuration.");
    setTimeout(() => setSavedStatus(null), 3500);
  }

  async function handleRunPipeline(e: React.FormEvent) {
    e.preventDefault();
    setPipelineResult(null);
    setIsPushing(true);

    try {
      const res = await fetch("/api/git/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: githubRepo.trim() || undefined,
          localFolderPath: localFolder.trim() || undefined,
          branch: branch.trim() || "main",
          commitMessage: commitMessage.trim(),
          cloudConfig: {
            provider: cloudProvider,
            webhookUrl: cloudWebhook.trim() || undefined,
            authToken: cloudToken.trim() || undefined,
            environment: cloudEnv,
            ec2Host: ec2Host.trim() || undefined,
            ec2User: ec2User.trim() || undefined,
            ec2KeyPath: ec2KeyPath.trim() || undefined,
            ec2AppDir: ec2AppDir.trim() || undefined,
            ec2Command: ec2Command.trim() || undefined,
            autoDeploy: true,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (data.blocked) {
        setPipelineResult({
          ok: false,
          blocked: true,
          message: data.message,
          reasons: data.reasons,
        });
      } else if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to complete CI/CD pipeline.");
      } else {
        setPipelineResult({
          ok: true,
          deployed: data.deployed,
          message: data.message,
        });
      }

      handleSave();
    } catch (err) {
      setPipelineResult({
        ok: false,
        message: err instanceof Error ? err.message : "Error executing CI/CD pipeline.",
      });
    } finally {
      setIsPushing(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader title="Configuration & Cloud Setup">
        Connect your local repository, configure Groq AI, and set your AWS EC2 or Cloud Deployment target. SecureShip evaluates security release gates and deploys automatically when checks pass.
      </PageHeader>

      {savedStatus && (
        <div className="flex items-center gap-2 rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{savedStatus}</span>
        </div>
      )}

      {/* Main Configuration Form */}
      <form onSubmit={handleSave} className="space-y-6 rounded-xl border border-line bg-surface/50 p-6">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <KeyRound className="size-4 text-accent" />
            Workspace & Security Credentials
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-bad hover:border-bad/30 cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              Clear
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-1.5 text-xs font-semibold text-bg hover:opacity-90 cursor-pointer"
            >
              Save in Frontend
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 1. Local Folder Connection */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium flex items-center gap-1.5">
              <Folder className="size-4 text-accent" />
              Local Folder / Repository Path
            </label>
            <input
              type="text"
              value={localFolder}
              onChange={(e) => setLocalFolder(e.target.value)}
              placeholder="e.g. C:\secureship-ai-phase1\secureship-ai or C:\projects\my-app"
              className="mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2 text-sm font-mono placeholder:text-muted/60"
            />
            <p className="mt-1 text-xs text-muted">
              The project folder on your machine that SecureShip scans for vulnerabilities and pushes to GitHub.
            </p>
          </div>

          {/* 2. Linked GitHub Repo */}
          <div>
            <label className="block text-sm font-medium flex items-center gap-1.5">
              <FolderGit2 className="size-4 text-accent" />
              Linked GitHub Remote URL
            </label>
            <input
              type="text"
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              placeholder="https://github.com/username/repo or owner/repo"
              className="mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2 text-sm font-mono placeholder:text-muted/60"
            />
            <p className="mt-1 text-xs text-muted">Destination GitHub repository (authenticates with your local Git CLI).</p>
          </div>

          {/* 3. Target Branch */}
          <div>
            <label className="block text-sm font-medium">Target Branch</label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2 text-sm font-mono placeholder:text-muted/60"
            />
            <p className="mt-1 text-xs text-muted">Branch tested by security gates (default: main).</p>
          </div>

          {/* 4. Groq API Key */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium">Groq LLM API Key</label>
            <div className="relative mt-1">
              <input
                type={showGroqKey ? "text" : "password"}
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                placeholder="gsk_..."
                className="block w-full rounded-md border border-line bg-bg px-3 py-2 pr-10 text-sm font-mono placeholder:text-muted/60"
              />
              <button
                type="button"
                onClick={() => setShowGroqKey(!showGroqKey)}
                className="absolute right-2.5 top-2.5 text-muted hover:text-ink cursor-pointer"
              >
                {showGroqKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted">
              Get your key from <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-accent underline">console.groq.com</a>. Used directly by the dashboard to analyze findings with high-speed Llama 3.3.
            </p>
          </div>

          {/* 5. Notification Email */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium flex items-center gap-1.5">
              <Mail className="size-4 text-accent" />
              Notification Mail ID
            </label>
            <input
              type="email"
              value={mailId}
              onChange={(e) => setMailId(e.target.value)}
              placeholder="you@company.com"
              className="mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2 text-sm placeholder:text-muted/60"
            />
            <p className="mt-1 text-xs text-muted">Alerts sent here if release gate blocks due to exposed secrets.</p>
          </div>
        </div>
      </form>

      {/* Cloud & AWS EC2 Deployment Configuration Section */}
      <section className="rounded-xl border border-line bg-surface/50 p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Cloud className="size-5 text-accent" />
            <div>
              <h2 className="text-base font-semibold">Cloud Deployment Target & Credentials</h2>
              <p className="text-xs text-muted">Choose your deployment target (AWS EC2, Vercel, Railway, etc.).</p>
            </div>
          </div>
          <span className="rounded bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent uppercase">
            {cloudProvider}
          </span>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Provider selector */}
          <div>
            <label className="block text-sm font-medium">Cloud Target</label>
            <select
              value={cloudProvider}
              onChange={(e) => setCloudProvider(e.target.value as "vercel" | "railway" | "aws" | "custom")}
              className="mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2 text-sm font-medium"
            >
              <option value="aws">AWS EC2 (Direct SSH & Run)</option>
              <option value="vercel">Vercel (Deploy Hook)</option>
              <option value="railway">Railway (Deploy Webhook)</option>
              <option value="custom">Custom Webhook / CI</option>
            </select>
          </div>

          {/* Target environment */}
          <div>
            <label className="block text-sm font-medium">Environment Tag</label>
            <select
              value={cloudEnv}
              onChange={(e) => setCloudEnv(e.target.value)}
              className="mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2 text-sm font-medium"
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
            </select>
          </div>

          {/* AWS EC2 Specific Connection Fields */}
          {cloudProvider === "aws" ? (
            <>
              <div>
                <label className="block text-sm font-medium flex items-center gap-1.5">
                  <Server className="size-4 text-accent" />
                  EC2 Public IP / Host DNS
                </label>
                <input
                  type="text"
                  value={ec2Host}
                  onChange={(e) => setEc2Host(e.target.value)}
                  placeholder="e.g. 54.210.123.45 or ec2-54-210-123-45.compute-1.amazonaws.com"
                  className="mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2 text-sm font-mono placeholder:text-muted/60"
                />
                <p className="mt-1 text-xs text-muted">Found in your AWS EC2 Console under *Public IPv4 address*.</p>
              </div>

              <div>
                <label className="block text-sm font-medium">EC2 SSH Username</label>
                <input
                  type="text"
                  value={ec2User}
                  onChange={(e) => setEc2User(e.target.value)}
                  placeholder="ubuntu (for Ubuntu) or ec2-user (Amazon Linux)"
                  className="mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2 text-sm font-mono placeholder:text-muted/60"
                />
                <p className="mt-1 text-xs text-muted">Default user: `ubuntu` for Ubuntu AMIs, `ec2-user` for Amazon Linux.</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium flex items-center gap-1.5">
                  <KeyRound className="size-4 text-accent" />
                  EC2 SSH Private Key (.pem file path on your computer)
                </label>
                <input
                  type="text"
                  value={ec2KeyPath}
                  onChange={(e) => setEc2KeyPath(e.target.value)}
                  placeholder="e.g. C:\Users\dhruv\.ssh\my-aws-key.pem"
                  className="mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2 text-sm font-mono placeholder:text-muted/60"
                />
                <p className="mt-1 text-xs text-muted">The path to your downloaded AWS Key Pair `.pem` file on this machine.</p>
              </div>

              <div>
                <label className="block text-sm font-medium">App Folder on EC2</label>
                <input
                  type="text"
                  value={ec2AppDir}
                  onChange={(e) => setEc2AppDir(e.target.value)}
                  placeholder="/home/ubuntu/app or /var/www/my-app"
                  className="mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2 text-sm font-mono placeholder:text-muted/60"
                />
                <p className="mt-1 text-xs text-muted">Directory on the EC2 instance where the code lives.</p>
              </div>

              <div>
                <label className="block text-sm font-medium flex items-center gap-1.5">
                  <Terminal className="size-4 text-accent" />
                  Deploy Command on EC2
                </label>
                <input
                  type="text"
                  value={ec2Command}
                  onChange={(e) => setEc2Command(e.target.value)}
                  placeholder="git pull && npm install && npm run build && pm2 restart all"
                  className="mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2 text-sm font-mono placeholder:text-muted/60"
                />
                <p className="mt-1 text-xs text-muted">Executed via SSH inside the remote folder to run the updated app.</p>
              </div>
            </>
          ) : (
            <>
              {/* Webhook provider inputs */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium">Deploy Webhook URL</label>
                <input
                  type="url"
                  value={cloudWebhook}
                  onChange={(e) => setCloudWebhook(e.target.value)}
                  placeholder="https://api.vercel.com/v1/integrations/deploy/... or webhook URL"
                  className="mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2 text-sm font-mono placeholder:text-muted/60"
                />
                <p className="mt-1 text-xs text-muted">Triggered automatically when the security release gate passes.</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium">Authorization Token (Optional)</label>
                <div className="relative mt-1">
                  <input
                    type={showCloudToken ? "text" : "password"}
                    value={cloudToken}
                    onChange={(e) => setCloudToken(e.target.value)}
                    placeholder="Bearer token or API key"
                    className="block w-full rounded-md border border-line bg-bg px-3 py-2 pr-10 text-sm font-mono placeholder:text-muted/60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCloudToken(!showCloudToken)}
                    className="absolute right-2.5 top-2.5 text-muted hover:text-ink cursor-pointer"
                  >
                    {showCloudToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* CI/CD Pipeline Execution Section */}
      <section className="rounded-xl border border-line bg-surface/50 p-6 space-y-5">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <UploadCloud className="size-5 text-accent" />
          <div>
            <h2 className="text-base font-semibold">Run Security Scan & Cloud Deploy Pipeline</h2>
            <p className="text-xs text-muted">
              Pushes to GitHub $\rightarrow$ Scans for exposed secrets $\rightarrow$ Evaluates release gate $\rightarrow$ Connects to {cloudProvider === "aws" ? "AWS EC2" : cloudProvider} and runs the code!
            </p>
          </div>
        </div>

        <form onSubmit={handleRunPipeline} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Commit Message</label>
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="feat: sync and deploy"
              className="mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2 text-sm placeholder:text-muted/60"
            />
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted">
              Source: <span className="font-mono text-ink">{localFolder || "(current directory)"}</span>
              <br />
              Deploy target: <span className="font-mono text-accent uppercase font-semibold">
                {cloudProvider === "aws" && ec2Host ? `AWS EC2 (${ec2Host})` : cloudProvider}
              </span> [{cloudEnv}]
            </div>
            <button
              type="submit"
              disabled={isPushing}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
            >
              {isPushing ? (
                <>Running CI/CD Pipeline…</>
              ) : (
                <>
                  <Rocket className="size-4" />
                  Run Security & Deploy Pipeline
                </>
              )}
            </button>
          </div>

          {pipelineResult && (
            <div
              className={`rounded-lg border p-4 text-sm ${
                pipelineResult.ok
                  ? "border-ok/30 bg-ok/10 text-ok"
                  : pipelineResult.blocked
                  ? "border-bad/40 bg-bad/10 text-bad"
                  : "border-bad/30 bg-bad/10 text-bad"
              }`}
            >
              <div className="font-semibold flex items-center gap-2">
                {pipelineResult.ok ? (
                  <span>✅ Pipeline Passed & Deployed</span>
                ) : (
                  <span>🛑 Release Gate Held / Pipeline Blocked</span>
                )}
              </div>
              <p className="mt-1">{pipelineResult.message}</p>
              {pipelineResult.reasons && pipelineResult.reasons.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs space-y-1">
                  {pipelineResult.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </form>
      </section>

      {/* Security note */}
      <div className="flex items-start gap-3 rounded-xl border border-line/60 bg-surface/30 p-4 text-xs text-muted">
        <ShieldCheck className="size-4 text-accent shrink-0 mt-0.5" />
        <p>
          <strong>Security Release Gate Guarantee:</strong> Cloud deployment will <strong>never</strong> trigger if the security scanner detects an unmitigated secret or critical vulnerability. Fix findings or review them in the Findings tab before deployment can proceed.
        </p>
      </div>
    </div>
  );
}
