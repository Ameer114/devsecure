import { Suspense } from "react";
import { DataTable, DemoTag, EmptyState, NotificationPill, PageHeader, Td, Loading } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { listNotifications } from "@/services/dashboard";

export const metadata = { title: "Notifications" };

async function NotificationsContent() {
  const items = await listNotifications();
  return (
    <>
      <PageHeader title="Notifications">Alert emails to repository owners. Emails name the file and rule, and never include the secret.</PageHeader>
      {items.length === 0 ? (
        <EmptyState title="No alerts sent">An email is sent to the repository owner when a secret is detected. Email delivery is configured in a later phase.</EmptyState>
      ) : (
        <DataTable caption="Email notification history" head={["Subject", "Recipient", "Repository", "Status", "Created"]}>
          {items.map((n) => (
            <tr key={n.id}>
              <Td className="font-medium">{n.subject}</Td>
              <Td>{n.recipient}</Td>
              <Td>{n.repository.fullName} {n.repository.isDemo && <DemoTag />}</Td>
              <Td><NotificationPill status={n.status} />{n.error && <div className="mt-1 text-xs text-bad">{n.error}</div>}</Td>
              <Td>{timeAgo(n.createdAt)}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NotificationsContent />
    </Suspense>
  );
}
