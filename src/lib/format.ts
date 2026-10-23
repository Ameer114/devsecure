const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

export function timeAgo(date: Date, now = new Date()): string {
  const diff = date.getTime() - now.getTime();
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

export function duration(start: Date, end: Date | null): string {
  if (!end) return "in progress";
  const s = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

export const shortSha = (sha: string) => sha.slice(0, 7);
