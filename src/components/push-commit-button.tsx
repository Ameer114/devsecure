"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, UploadCloud } from "lucide-react";

export function PushCommitButton({
  repoFullName,
  branch,
  label = "Push Latest Commit",
  className = "",
}: {
  repoFullName?: string;
  branch?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handlePush() {
    setLoading(true);
    setResult(null);

    try {
      const storedRepo = typeof window !== "undefined" ? localStorage.getItem("secureship_github_repo") || undefined : undefined;
      const storedBranch = typeof window !== "undefined" ? localStorage.getItem("secureship_github_branch") || undefined : undefined;

      const res = await fetch("/api/git/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName,
          repoUrl: storedRepo,
          branch: branch || storedBranch || "main",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to push commits.");
      }

      setResult({
        ok: true,
        message: data.commitSha ? `Pushed ${data.commitSha}` : "Pushed to GitHub",
      });
      router.refresh();

      setTimeout(() => setResult(null), 4000);
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : "Push failed",
      });
      setTimeout(() => setResult(null), 5000);
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
        title="Push latest commits from this repo to GitHub using your system Git CLI"
        className={`inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-50 cursor-pointer ${className}`}
      >
        {loading ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Pushing…
          </>
        ) : result?.ok ? (
          <>
            <Check className="size-3.5 text-ok" />
            {result.message}
          </>
        ) : (
          <>
            <UploadCloud className="size-3.5" />
            {label}
          </>
        )}
      </button>
      {result && !result.ok && (
        <span className="text-xs text-bad max-w-xs truncate" title={result.message}>
          {result.message}
        </span>
      )}
    </div>
  );
}
