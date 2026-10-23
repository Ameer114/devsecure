import { Suspense } from "react";
import { DataTable, DemoTag, EmptyState, PageHeader, Td, Loading } from "@/components/ui";
import { listAudit } from "@/services/dashboard";

export const metadata = { title: "Audit log" };

async function AuditContent() {
  const events = await listAudit();
  return (
    <>
      <PageHeader title="Audit log">An append-only record of security-relevant events. Metadata is redacted before it is stored.</PageHeader>
      {events.length === 0 ? (
        <EmptyState title="No events recorded">Events such as repository changes, blocked runs, and deployments appear here as they happen.</EmptyState>
      ) : (
        <DataTable caption="Audit events" head={["Time", "Actor", "Action", "Entity", "Repository"]}>
          {events.map((e) => (
            <tr key={e.id}>
              <Td className="whitespace-nowrap tabular-nums">{e.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC</Td>
              <Td>{e.actor}</Td>
              <Td mono>{e.action}</Td>
              <Td>{e.entityType}</Td>
              <Td>{e.repository ? <>{e.repository.fullName} {e.repository.isDemo && <DemoTag />}</> : "—"}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AuditContent />
    </Suspense>
  );
}
