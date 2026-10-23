// Structured JSON logging with key-based redaction so credentials cannot leak into logs.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;
const SENSITIVE_KEY = /secret|token|password|passwd|authorization|api[-_]?key|private[-_]?key|credential|cookie/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE_KEY.test(k) ? "[REDACTED]" : redact(v, depth + 1),
      ]),
    );
  }
  return value;
}

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  const min = LEVELS[(process.env.LOG_LEVEL as Level) in LEVELS ? (process.env.LOG_LEVEL as Level) : "info"];
  if (LEVELS[level] < min) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...(redact(fields) as object) });
  (level === "error" ? console.error : console.log)(line);
}

export const logger = {
  debug: (m: string, f?: Record<string, unknown>) => emit("debug", m, f),
  info: (m: string, f?: Record<string, unknown>) => emit("info", m, f),
  warn: (m: string, f?: Record<string, unknown>) => emit("warn", m, f),
  error: (m: string, f?: Record<string, unknown>) => emit("error", m, f),
};
