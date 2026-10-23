"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, Rocket } from "lucide-react";

export function PushCommitButton({
  repoFullName,
  branch,
  label = "Run Security & Cloud Deploy Pipeline",
  className = "",
}: {
  repoFullName?: string;
  branch?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; blocked?: boolean; message: string } | null>(null);

  async function handlePush() {
    setLoading(true);
    setResult(null);

    try {
      const storedRepo = typeof window !== "undefined" ? localStorage.getItem("secureship_github_repo") || undefined : undefined;
      const storedBranch = typeof window !== "undefined" ? localStorage.getItem("secureship_github_branch") || undefined : undefined;
      const storedFolder = typeof window !== "undefined" ? localStorage.getItem("secureship_local_folder") || undefined : undefined;

      const storedProvider = typeof window !== "undefined" ? (localStorage.getItem("secureship_cloud_provider") as "vercel" | "railway" | "aws" | "custom") || undefined : undefined;
      const storedWebhook = typeof window !== "undefined" ? localStorage.getItem("secureship_cloud_webhook") || undefined : undefined;
      const storedToken = typeof window !== "undefined" ? localStorage.getItem("secureship_cloud_token") || undefined : undefined;
      const storedEnv = typeof window !== "undefined" ? localStorage.getItem("secureship_cloud_env") || undefined : undefined;

      const storedEc2Host = typeof window !== "undefined" ? localStorage.getItem("secureship_ec2_host") || undefined : undefined;
      const storedEc2User = typeof window !== "undefined" ? localStorage.getItem("secureship_ec2_user") || undefined : undefined;
      const storedEc2KeyPath = typeof window !== "undefined" ? localStorage.getItem("secureship_ec2_keypath") || undefined : undefined;
      const storedEc2AppDir = typeof window !== "undefined" ? localStorage.getItem("secureship_ec2_appdir") || undefined : undefined;
      const storedEc2Command = typeof window !== "undefined" ? localStorage.getItem("secureship_ec2_command") || undefined : undefined;

      const res = await fetch("/api/git/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName,
          repoUrl: storedRepo,
          branch: branch || storedBranch || "main",
          localFolderPath: storedFolder,
          cloudConfig: {
            provider: storedProvider,
            webhookUrl: storedWebhook,
            authToken: storedToken,
            environment: storedEnv,
            ec2Host: storedEc2Host,
            ec2User: storedEc2User,
            ec2KeyPath: storedEc2KeyPath,
            ec2AppDir: storedEc2AppDir,
            ec2Command: storedEc2Command,
            autoDeploy: true,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (data.blocked) {
        setResult({
          ok: false,
          blocked: true,
          message: data.message || `Gate Blocked: ${data.findingsCount || 1} vulnerability detected!`,
        });
      } else if (!res.ok || !data.ok) {
        throw new Error(data.error || "Pipeline execution failed.");
      } else {
        setResult({
          ok: true,
          message: data.deployed
            ? `Deployed to Cloud (${data.commitSha})`
            : `Pushed & Verified (${data.commitSha})`,
        });
      }

      router.refresh();
      setTimeout(() => setResult(null), 6000);
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : "Pipeline failed",
      });
      setTimeout(() => setResult(null), 6000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handlePush}
        disabled={loading}
        title="Push to GitHub, run security scan for exposed secrets, and deploy to cloud if cleared"
        className={`inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-50 cursor-pointer ${className}`}
      >
        {loading ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Scanning & Deploying…
          </>
        ) : result?.blocked ? (
          <>
            <AlertTriangle className="size-3.5 text-bad" />
            <span className="text-bad font-semibold">Gate Held (Security Blocked)</span>
          </>
        ) : result?.ok ? (
          <>
            <Check className="size-3.5 text-ok" />
            <span className="text-ok font-semibold">{result.message}</span>
          </>
        ) : (
          <>
            <Rocket className="size-3.5" />
            {label}
          </>
        )}
      </button>
      {result && !result.ok && !result.blocked && (
        <span className="text-xs text-bad max-w-xs truncate" title={result.message}>
          {result.message}
        </span>
      )}
    </div>
  );
}
