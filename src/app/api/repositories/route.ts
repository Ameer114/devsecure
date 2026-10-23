import { ZodError } from "zod";
import { logger } from "@/lib/logger";
import { createRepository, createRepositorySchema, DuplicateRepositoryError } from "@/services/repositories";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request body must be JSON" }, { status: 400 });
  }
  try {
    const input = createRepositorySchema.parse(body);
    // TODO(auth phase): replace with the authenticated user once login exists.
    const repo = await createRepository(input, "dashboard");
    return Response.json({ id: repo.id, fullName: repo.fullName }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return Response.json(
        { error: "Validation failed", fields: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        { status: 422 },
      );
    }
    if (err instanceof DuplicateRepositoryError) {
      return Response.json({ error: err.message }, { status: 409 });
    }
    logger.error("create repository failed", { err });
    return Response.json({ error: "Could not create repository" }, { status: 500 });
  }
}
