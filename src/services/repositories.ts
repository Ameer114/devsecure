import { createRepositorySchema, type CreateRepositoryInput } from "@/lib/schemas";
import { store } from "@/lib/store";
import { recordAudit } from "@/services/audit";

export { createRepositorySchema, type CreateRepositoryInput } from "@/lib/schemas";

export class DuplicateRepositoryError extends Error {
  constructor(fullName: string) {
    super(`${fullName} is already registered`);
  }
}

export async function createRepository(input: CreateRepositoryInput, actor: string) {
  const data = createRepositorySchema.parse(input);
  try {
    const repo = store.createRepository({
      fullName: data.fullName,
      defaultBranch: data.defaultBranch,
      ownerEmail: data.ownerEmail,
    });
    await recordAudit({
      actor,
      action: "repository.created",
      entityType: "Repository",
      entityId: repo.id,
      repositoryId: repo.id,
      metadata: { fullName: repo.fullName, defaultBranch: repo.defaultBranch },
    });
    return repo;
  } catch (err) {
    if (err instanceof Error && err.message.includes("is already registered")) {
      throw new DuplicateRepositoryError(data.fullName);
    }
    throw err;
  }
}
