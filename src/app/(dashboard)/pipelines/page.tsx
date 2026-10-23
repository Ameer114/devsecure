import { Suspense } from "react";
import { DataTable, DemoTag, EmptyState, PageHeader, RunStatusPill, Td, Loading } from "@/components/ui";
import { duration, shortSha, timeAgo } from "@/lib/format";
import { listRuns } from "@/services/dashboard";

export const metadata = { title: "Pipelines" };

async function PipelinesContent() {
  const runs = await listRuns();
  return (
    <>
      <PageHeader title="Pipelines">Every CI run with its policy decision. A blocked run cannot reach deployment.</PageHeader>
      {runs.length === 0 ? (
        <EmptyState title="No pipeline runs recorded">Runs appear here after the GitHub Actions workflow reports its results to SecureShip.</EmptyState>
      ) : (
        <DataTable caption="Pipeline runs" head={["Repository", "Branch", "Commit", "Status", "Policy", "Findings", "Started", "Duration"]}>
          {runs.map((r) => (
            <tr key={r.id}>
              <Td><span className="font-medium">{r.repository.fullName}</span> {r.repository.isDemo && <DemoTag />}</Td>
              <Td mono>{r.branch}</Td>
              <Td mono>{shortSha(r.commitSha)}</Td>
              <Td><RunStatusPill status={r.status} /></Td>
              <Td>{r.policyDecision ? (r.policyDecision.outcome === "ALLOW" ? "Allow" : "Block") : "—"}</Td>
              <Td className="tabular-nums">{r._count?.findings ?? 0}</Td>
              <Td>{timeAgo(r.startedAt)}</Td>
              <Td className="tabular-nums">{duration(r.startedAt, r.finishedAt)}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}

export default function PipelinesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PipelinesContent />
    </Suspense>
  );
}
