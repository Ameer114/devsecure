import { Suspense } from "react";
import { AddRepositoryForm } from "@/components/add-repository-form";
import { DataTable, DemoBanner, DemoTag, EmptyState, PageHeader, Td, Loading } from "@/components/ui";
import { listRepositories } from "@/services/dashboard";

export const metadata = { title: "Repositories" };

async function RepositoriesContent() {
  const repos = await listRepositories();
  return (
    <>
      <PageHeader title="Repositories">Repositories SecureShip tracks. Alerts go to the owner email, and only the protected branch can deploy.</PageHeader>
      {repos.some((r) => r.isDemo) && <DemoBanner />}
      {repos.length === 0 ? (
        <EmptyState title="No repositories yet">Add your first repository below. Pipeline results appear once its GitHub workflow reports in.</EmptyState>
      ) : (
        <DataTable caption="Tracked repositories" head={["Repository", "Protected branch", "Owner", "Runs", "Open findings"]}>
          {repos.map((r) => (
            <tr key={r.id}>
              <Td><span className="font-medium">{r.fullName}</span> {r.isDemo && <DemoTag />}</Td>
              <Td mono>{r.defaultBranch}</Td>
              <Td>{r.owner.email}</Td>
              <Td className="tabular-nums">{r._count.runs}</Td>
              <Td className="tabular-nums">{r._count.findings}</Td>
            </tr>
          ))}
        </DataTable>
      )}
      <section aria-labelledby="add-heading" className="mt-10">
        <h2 id="add-heading" className="mb-3 font-semibold">Add a repository</h2>
        <AddRepositoryForm />
      </section>
    </>
  );
}

export default function RepositoriesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <RepositoriesContent />
    </Suspense>
  );
}
