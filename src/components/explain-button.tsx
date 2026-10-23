"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";

export function ExplainButton({
  findingId,
  hasExplanation,
}: {
  findingId: string;
  hasExplanation: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExplain() {
    setLoading(true);
    setError(null);
    try {
      const groqApiKey =
        typeof window !== "undefined"
          ? localStorage.getItem("secureship_groq_key") ||
            localStorage.getItem("secureship_grok_key") ||
            undefined
          : undefined;

      const res = await fetch("/api/findings/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findingId, groqApiKey }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to generate explanation");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generating explanation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleExplain}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded border border-accent/30 bg-accent/10 px-2 py-1 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-50 cursor-pointer"
      >
        {loading ? (
          <>
            <Loader2 className="size-3 animate-spin" />
            Analyzing with Groq…
          </>
        ) : (
          <>
            <Sparkles className="size-3" />
            {hasExplanation ? "Regenerate with Groq" : "Explain with Groq"}
          </>
        )}
      </button>
      {error && <span className="text-xs text-bad">{error}</span>}
    </div>
  );
}
