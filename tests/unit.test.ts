import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";
import { redact } from "@/lib/logger";
import { createRepositorySchema } from "@/lib/schemas";
import { duration, timeAgo } from "@/lib/format";

describe("env validation", () => {
  it("applies defaults without requiring DATABASE_URL", () => {
    expect(parseEnv({}).LOG_LEVEL).toBe("info");
  });
  it("accepts a postgres URL if provided", () => {
    expect(parseEnv({ DATABASE_URL: "postgresql://u:p@h:5432/d" }).DATABASE_URL).toBe("postgresql://u:p@h:5432/d");
  });
});

describe("log redaction", () => {
  it("redacts sensitive keys at any depth, keeps the rest", () => {
    const out = redact({ user: "ana", apiToken: "x", nested: { password: "y", list: [{ authorization: "Bearer z", ok: 1 }] } }) as { user: string; apiToken: string; nested: { password: string; list: { authorization: string; ok: number }[] } };
    expect(out.user).toBe("ana");
    expect(out.apiToken).toBe("[REDACTED]");
    expect(out.nested.password).toBe("[REDACTED]");
    expect(out.nested.list[0].authorization).toBe("[REDACTED]");
    expect(out.nested.list[0].ok).toBe(1);
  });
  it("serialises errors without stack traces", () => {
    expect(redact(new Error("boom"))).toEqual({ name: "Error", message: "boom" });
  });
});

describe("createRepositorySchema", () => {
  const ok = { fullName: "acme/api", defaultBranch: "main", ownerEmail: "A@B.io" };
  it("normalises email and trims", () => {
    expect(createRepositorySchema.parse({ ...ok, fullName: " acme/api " }).ownerEmail).toBe("a@b.io");
  });
  it.each(["noslash", "a/b/c", "a/b; DROP TABLE x", "../etc/passwd", ""])("rejects fullName %j", (fullName) => {
    expect(createRepositorySchema.safeParse({ ...ok, fullName }).success).toBe(false);
  });
  it("rejects bad branch and email", () => {
    expect(createRepositorySchema.safeParse({ ...ok, defaultBranch: "ma in" }).success).toBe(false);
    expect(createRepositorySchema.safeParse({ ...ok, ownerEmail: "nope" }).success).toBe(false);
  });
});

describe("formatting", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  it("formats relative time", () => {
    expect(timeAgo(new Date("2026-10-23T10:00:00Z"), now)).toBe("2 hours ago");
    expect(timeAgo(new Date("2026-10-23T11:59:30Z"), now)).toBe("just now");
  });
  it("formats duration", () => {
    expect(duration(new Date(0), new Date(185_000))).toBe("3m 5s");
    expect(duration(new Date(0), null)).toBe("in progress");
  });
});

describe("data model invariant: no column can hold a secret value", () => {
  // Only fields declared inside `model` blocks, one per line (enum members are not columns).
  function riskyFields(schema: string): string[] {
    const bodies = [...schema.matchAll(/^model\s+\w+\s*\{([\s\S]*?)^\}/gm)].map((m) => m[1]);
    const fields = bodies.flatMap((b) => [...b.matchAll(/^[ \t]+(\w+)[ \t]+\w+/gm)].map((m) => m[1]));
    return fields.filter((f) => /^(secret|match|rawMatch|matchedText|value|token|password|content|snippet|line|code)$/i.test(f));
  }

  it("the real schema has no value-bearing field", () => {
    expect(riskyFields(readFileSync("prisma/schema.prisma", "utf8"))).toEqual([]);
  });
  it("the guard itself catches a violating column (negative control)", () => {
    const bad = "model Finding {\n  id String @id\n  value String\n}\nenum K {\n  SECRET\n  OTHER\n}";
    expect(riskyFields(bad)).toEqual(["value"]);
  });
});
