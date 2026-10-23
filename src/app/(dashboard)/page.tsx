import { Suspense } from "react";
import Link from "next/link";
import { SeverityChart } from "@/components/severity-chart";
import { DemoBanner, DemoTag, EmptyState, GatePill, Loading } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { getOverview } from "@/services/dashboard";

export const metadata = { title: "Release gate" };

async function OverviewContent() {
  const o = await getOverview();
  const cleared = o.gates.filter((g) => g.state === "OPEN").length;
  const held = o.gates.filter((g) => g.state === "HELD").length;
  const openTotal = o.openBySeverity.reduce((n, s) => n + s.count, 0);

  if (o.repositoryCount === 0) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Release gate</h1>
        <div className="mt-6">
          <EmptyState title="No repositories yet">
            Add a repository to start tracking its security pipeline. <Link href="/repositories" className="font-medium text-accent underline">Add a repository</Link>
          </EmptyState>
        </div>
      </>
    );
  }

  return (
    <>
      {o.hasDemo && <DemoBanner />}
      <section aria-labelledby="gate-heading" className="max-w-4xl">
        <h1 id="gate-heading" className="text-4xl leading-tight font-semibold tracking-tight md:text-5xl">
          {cleared} of {o.repositoryCount} {o.repositoryCount === 1 ? "repository is" : "repositories are"} cleared to deploy
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          {held > 0
            ? `${held} held by policy. The gate is deterministic: AI can explain a finding but never reopens a held release.`
            : "Every repository with a decision is passing its mandatory checks."}
        </p>
      </section>

      <section aria-label="Repository gates" className="mt-8 max-w-4xl divide-y divide-line border-y border-line">
        {o.gates.map((g) => (
          <div key={g.id} className="grid gap-x-6 gap-y-1 py-4 md:grid-cols-[13rem_1fr_auto] md:items-start">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{g.fullName}</span>
              {g.isDemo && <DemoTag />}
            </div>
            <div className="text-sm text-muted">
              {g.reasons.length ? g.reasons.join(". ") : g.state === "UNKNOWN" ? `No run on ${g.branch} has a policy decision.` : "All mandatory checks passed."}
              <div className="mt-1 text-xs">
                {g.lastRunAt ? `Last ${g.branch} run ${timeAgo(g.lastRunAt)}` : null}
                {g.lastDeployment ? ` · Last deploy ${g.lastDeployment.status.toLowerCase().replace("_", " ")} ${timeAgo(g.lastDeployment.startedAt)}` : null}
              </div>
            </div>
            <div><GatePill state={g.state} /></div>
          </div>
        ))}
      </section>

      <div className="mt-10 grid max-w-4xl gap-10 md:grid-cols-2">
        <section aria-labelledby="sev-heading">
          <h2 id="sev-heading" className="font-semibold">Open findings</h2>
          <p className="mb-3 text-sm text-muted">{openTotal === 0 ? "None open." : `${openTotal} awaiting remediation.`}</p>
          <SeverityChart data={o.openBySeverity} />
        </section>
        <section aria-labelledby="runs-heading">
          <h2 id="runs-heading" className="font-semibold">Pipeline outcomes</h2>
          <dl className="mt-3 divide-y divide-line border-y border-line text-sm">
            {[
              ["Runs recorded", o.runs.total],
              ["Passed", o.runs.passed],
              ["Blocked by policy", o.runs.blocked],
              ["Failed", o.runs.failed],
              ["Alert emails", o.notifications.total],
              ["Alert emails failed", o.notifications.failed],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2">
                <dt className="text-muted">{k}</dt>
                <dd className="font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<Loading />}>
      <OverviewContent />
    </Suspense>
  );
}
