import { Suspense } from "react";
import { DataTable, DemoTag, DeploymentPill, EmptyState, PageHeader, Td, Loading } from "@/components/ui";
import { duration, timeAgo } from "@/lib/format";
import { listDeployments } from "@/services/dashboard";

export const metadata = { title: "Deployments" };

async function DeploymentsContent() {
  const items = await listDeployments();
  return (
    <>
      <PageHeader title="Deployments">Approved images deployed to AWS, with health-check results and rollbacks.</PageHeader>
      {items.length === 0 ? (
        <EmptyState title="Nothing deployed yet">A deployment is recorded only after a run passes every mandatory check.</EmptyState>
      ) : (
        <DataTable caption="Deployment history" head={["Repository", "Environment", "Image", "Status", "Health check", "Started", "Duration"]}>
          {items.map((d) => (
            <tr key={d.id}>
              <Td>{d.repository.fullName} {d.repository.isDemo && <DemoTag />}</Td>
              <Td>{d.environment}</Td>
              <Td mono className="break-all">{d.imageRef}</Td>
              <Td><DeploymentPill status={d.status} />{d.rolledBackToRef && <div className="mt-1 font-mono text-xs text-muted">to {d.rolledBackToRef}</div>}</Td>
              <Td>{d.healthCheckOk === null ? "—" : d.healthCheckOk ? "Healthy" : "Failed"}</Td>
              <Td>{timeAgo(d.startedAt)}</Td>
              <Td className="tabular-nums">{duration(d.startedAt, d.finishedAt)}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}

export default function DeploymentsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DeploymentsContent />
    </Suspense>
  );
}
