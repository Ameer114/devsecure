import { z } from "zod";

export const createRepositorySchema = z.object({
  fullName: z.string().trim().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "Use the form owner/repository"),
  defaultBranch: z.string().trim().min(1, "Branch is required").max(100).regex(/^[A-Za-z0-9._/-]+$/, "Branch contains invalid characters"),
  ownerEmail: z.string().trim().toLowerCase().email("Enter a valid email address"),
});
export type CreateRepositoryInput = z.infer<typeof createRepositorySchema>;
