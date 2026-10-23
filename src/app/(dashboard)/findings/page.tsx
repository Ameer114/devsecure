import { Suspense } from "react";
import Link from "next/link";
import { FindingStatus, Severity } from "@/generated/prisma/enums";
import { DataTable, DemoTag, EmptyState, FindingStatusPill, PageHeader, SeverityPill, Td, Loading } from "@/components/ui";
import { ExplainButton } from "@/components/explain-button";
import { listFindings } from "@/services/dashboard";

export const metadata = { title: "Findings" };

async function FindingsContent({ searchParams }: { searchParams: Promise<{ severity?: string; status?: string }> }) {
  const sp = await searchParams;
  const severity = Object.values(Severity).find((s) => s === sp.severity);
  const status = Object.values(FindingStatus).find((s) => s === sp.status);
  const findings = await listFindings({ severity, status });
  const chip = (href: string, label: string, on: boolean) => (
    <Link key={label} href={href} aria-current={on ? "true" : undefined} className={`rounded-full border px-3 py-1 text-xs ${on ? "border-accent bg-accent/10 font-semibold text-accent" : "border-line text-muted hover:text-ink"}`}>
      {label}
    </Link>
  );
  const q = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
    return u ? `/findings?${u}` : "/findings";
  };

  return (
    <>
      <PageHeader title="Findings">
        Secret findings show where the problem is, never the value. AI explanations are advisory and cannot change a policy decision.
      </PageHeader>
      <div className="mb-5 flex flex-wrap gap-2" aria-label="Filter findings">
        {chip(q({ status }), "All severities", !severity)}
        {Object.values(Severity).map((s) => chip(q({ severity: s, status }), s[0] + s.slice(1).toLowerCase(), severity === s))}
        <span className="mx-1 w-px bg-line" aria-hidden />
        {chip(q({ severity }), "Any status", !status)}
        {chip(q({ severity, status: "OPEN" }), "Open", status === "OPEN")}
      </div>
      {findings.length === 0 ? (
        <EmptyState title="No findings match">{severity || status ? "Try clearing a filter." : "No scanner has reported a finding yet. That is the result you want."}</EmptyState>
      ) : (
        <DataTable caption="Security findings" head={["Severity", "Finding", "Location", "Scanner", "Status", "Repository"]}>
          {findings.map((f) => (
            <tr key={f.id}>
              <Td><SeverityPill severity={f.severity} /></Td>
              <Td className="max-w-sm">
                <div className="font-medium">{f.title}</div>
                <div className="font-mono text-xs text-muted">{f.ruleId}</div>
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-accent">Explanation and suggested fix</summary>
                  <p className="mt-1.5 leading-relaxed text-muted">
                    {f.aiExplanation ?? "No AI explanation generated yet."}
                    {f.aiSuggestion ? <><br />{f.aiSuggestion}</> : null}
                  </p>
                  <ExplainButton findingId={f.id} hasExplanation={!!f.aiExplanation} />
                </details>
              </Td>
              <Td mono>{f.filePath ? `${f.filePath}${f.startLine ? `:${f.startLine}` : ""}` : "—"}</Td>
              <Td>{f.scanner[0] + f.scanner.slice(1).toLowerCase()}</Td>
              <Td><FindingStatusPill status={f.status} /></Td>
              <Td>{f.repository.fullName} {f.repository.isDemo && <DemoTag />}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}

export default function FindingsPage({ searchParams }: { searchParams: Promise<{ severity?: string; status?: string }> }) {
  return (
    <Suspense fallback={<Loading />}>
      <FindingsContent searchParams={searchParams} />
    </Suspense>
  );
}
