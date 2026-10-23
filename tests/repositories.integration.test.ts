import { describe, expect, it } from "vitest";
import { store } from "@/lib/store";
import { recordAudit } from "@/services/audit";
import { createRepository, DuplicateRepositoryError } from "@/services/repositories";

const name = `it-test/repo-${Date.now()}`;
const email = `it-${Date.now()}@example.com`;

describe("repository service (in-memory store)", () => {
  it("creates the repository, owner, and an audit event", async () => {
    const repo = await createRepository({ fullName: name, defaultBranch: "main", ownerEmail: email }, "vitest");
    expect(repo.fullName).toBe(name);
    const audit = store.auditEvents.find((e) => e.entityId === repo.id && e.action === "repository.created");
    expect(audit?.actor).toBe("vitest");
  });

  it("rejects a duplicate", async () => {
    await expect(createRepository({ fullName: name, defaultBranch: "main", ownerEmail: email }, "vitest")).rejects.toBeInstanceOf(DuplicateRepositoryError);
  });

  it("redacts sensitive metadata before it reaches the audit log", async () => {
    const ev = await recordAudit({ actor: "vitest", action: "test.redaction", entityType: "Test", metadata: { apiToken: "should-not-persist", note: "kept" } });
    const stored = store.auditEvents.find((e) => e.id === ev.id);
    expect(stored).toBeDefined();
    expect(JSON.stringify(stored?.metadata)).not.toContain("should-not-persist");
    expect((stored?.metadata as { note?: string }).note).toBe("kept");
  });
});
