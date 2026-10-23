"use client";

import { useState } from "react";
import { CheckCircle2, Eye, EyeOff, FolderGit2, KeyRound, Mail, Rocket, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/ui";

export default function ConfigurationPage() {
  const [groqKey, setGroqKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("secureship_groq_key") || "";
  });
  const [mailId, setMailId] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("secureship_mail_id") || "" : ""));
  const [githubRepo, setGithubRepo] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("secureship_github_repo") || "" : ""));
  const [branch, setBranch] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("secureship_github_branch") || "main" : "main"));

  // Push tool state
  const [commitMessage, setCommitMessage] = useState("feat: sync project from SecureShip frontend");
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ ok: boolean; message: string } | null>(null);

  // UI state
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (typeof window === "undefined") return;

    localStorage.setItem("secureship_groq_key", groqKey.trim());
    localStorage.setItem("secureship_mail_id", mailId.trim());
    localStorage.setItem("secureship_github_repo", githubRepo.trim());
    localStorage.setItem("secureship_github_branch", branch.trim() || "main");

    setSavedStatus("Configuration saved in frontend storage!");
    setTimeout(() => setSavedStatus(null), 3500);
  }

  function handleClear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem("secureship_groq_key");
    localStorage.removeItem("secureship_mail_id");
    localStorage.removeItem("secureship_github_repo");
    localStorage.removeItem("secureship_github_branch");

    setGroqKey("");
    setMailId("");
    setGithubRepo("");
    setBranch("main");
    setSavedStatus("Cleared all frontend configuration.");
    setTimeout(() => setSavedStatus(null), 3500);
  }

  async function handlePushToGithub(e: React.FormEvent) {
    e.preventDefault();
    setPushResult(null);
    setIsPushing(true);

    try {
      const res = await fetch("/api/git/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: githubRepo.trim() || undefined,
          branch: branch.trim() || "main",
          commitMessage: commitMessage.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to push to GitHub.");
      }

      setPushResult({ ok: true, message: data.message });
      handleSave();
    } catch (err) {
      setPushResult({ ok: false, message: err instanceof Error ? err.message : "Error pushing to GitHub." });
    } finally {
      setIsPushing(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader title="Configuration">
        Manage your preferences directly in the frontend. Git pushes use your system&apos;s native Git CLI and credentials automatically—no Personal Access Tokens needed.
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
            Frontend Credentials & Preferences
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
          {/* 1. Groq API Key */}
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
              Get your key from <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-accent underline">console.groq.com</a>. Used directly by the dashboard to analyze findings and suggest fixes with high-speed Llama 3.3.
            </p>
          </div>

          {/* 2. Linked GitHub Repo */}
          <div>
            <label className="block text-sm font-medium flex items-center gap-1.5">
              <FolderGit2 className="size-3.5 text-accent" />
              Linked GitHub Repository URL
            </label>
            <input
              type="text"
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              placeholder="https://github.com/owner/repo or owner/repo"
              className="mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2 text-sm font-mono placeholder:text-muted/60"
            />
            <p className="mt-1 text-xs text-muted">The remote GitHub destination URL. Pushes authenticate automatically with your Windows Git credentials.</p>
          </div>

          {/* 3. Notification Email */}
          <div>
            <label className="block text-sm font-medium flex items-center gap-1.5">
              <Mail className="size-3.5 text-accent" />
              Notification Mail ID
            </label>
            <input
              type="email"
              value={mailId}
              onChange={(e) => setMailId(e.target.value)}
              placeholder="you@company.com"
              className="mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2 text-sm placeholder:text-muted/60"
            />
            <p className="mt-1 text-xs text-muted">Receives security alerts when critical vulnerabilities are detected.</p>
          </div>

          {/* 4. Target Branch */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium">Target Branch</label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="mt-1 block max-w-sm rounded-md border border-line bg-bg px-3 py-2 text-sm font-mono placeholder:text-muted/60"
            />
            <p className="mt-1 text-xs text-muted">The branch checked by security release gates (default: main).</p>
          </div>
        </div>
      </form>

      {/* Push to GitHub Section */}
      <section className="rounded-xl border border-line bg-surface/50 p-6 space-y-5">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <UploadCloud className="size-5 text-accent" />
          <div>
            <h2 className="text-base font-semibold">Push to GitHub via System Git CLI</h2>
            <p className="text-xs text-muted">Pushes your latest local commits to the configured remote using your machine&apos;s existing Git credentials.</p>
          </div>
        </div>

        <form onSubmit={handlePushToGithub} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Commit Message (if changes exist)</label>
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="feat: push latest from SecureShip"
              className="mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2 text-sm placeholder:text-muted/60"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted">
              Target Remote: <span className="font-mono text-ink">{githubRepo || "(configure remote URL above)"}</span>
            </div>
            <button
              type="submit"
              disabled={isPushing}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {isPushing ? (
                <>Pushing to GitHub…</>
              ) : (
                <>
                  <Rocket className="size-4" />
                  Push to GitHub
                </>
              )}
            </button>
          </div>

          {pushResult && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                pushResult.ok ? "border-ok/30 bg-ok/10 text-ok" : "border-bad/30 bg-bad/10 text-bad"
              }`}
            >
              {pushResult.message}
            </div>
          )}
        </form>
      </section>

      {/* Security note */}
      <div className="flex items-start gap-3 rounded-xl border border-line/60 bg-surface/30 p-4 text-xs text-muted">
        <ShieldCheck className="size-4 text-accent shrink-0 mt-0.5" />
        <p>
          <strong>Native Git CLI authentication active:</strong> No Personal Access Tokens are stored or transmitted. Git operations use your system&apos;s existing credentials directly.
        </p>
      </div>
    </div>
  );
}
