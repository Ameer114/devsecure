import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  GROQ_API_KEY: z.string().optional(),
  GROK_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = schema.safeParse(raw);
  if (!result.success) {
    // Report variable names and problems only, never values.
    const problems = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n- ${problems.join("\n- ")}`);
  }
  return result.data;
}

let cached: Env | undefined;
export function getEnv(): Env {
  return (cached ??= parseEnv(process.env));
}
