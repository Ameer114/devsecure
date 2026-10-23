import { redact } from "@/lib/logger";
import { store } from "@/lib/store";

export async function recordAudit(e: {
  actor: string;
  action: string;
  entityType: string;
  entityId?: string;
  repositoryId?: string;
  metadata?: Record<string, unknown>;
}) {
  return store.recordAudit({
    actor: e.actor,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    repositoryId: e.repositoryId,
    metadata: redact(e.metadata ?? {}) as Record<string, unknown>,
  });
}
