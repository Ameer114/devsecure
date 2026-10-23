import { Ban, CheckCircle2, Clock, Loader, ShieldAlert, ShieldCheck, ShieldX, XCircle } from "lucide-react";
import type { DeploymentStatus, FindingStatus, NotificationStatus, RunStatus, Severity } from "@/generated/prisma/enums";

type Tone = "ok" | "bad" | "warn" | "info" | "muted";
const TONE: Record<Tone, string> = {
  ok: "bg-ok/12 text-ok",
  bad: "bg-bad/12 text-bad",
  warn: "bg-warn/14 text-warn",
  info: "bg-info/12 text-info",
  muted: "bg-line/60 text-muted",
};

function Pill({ tone, icon: Icon, children }: { tone: Tone; icon?: typeof Clock; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE[tone]}`}>
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </span>
  );
}

const RUN: Record<RunStatus, [Tone, typeof Clock, string]> = {
  PASSED: ["ok", CheckCircle2, "Passed"],
  BLOCKED: ["bad", ShieldX, "Blocked by policy"],
  FAILED: ["bad", XCircle, "Failed"],
  RUNNING: ["info", Loader, "Running"],
  QUEUED: ["muted", Clock, "Queued"],
  CANCELLED: ["muted", Ban, "Cancelled"],
};
export const RunStatusPill = ({ status }: { status: RunStatus }) => {
  const [t, i, l] = RUN[status];
  return <Pill tone={t} icon={i}>{l}</Pill>;
};

const SEV: Record<Severity, Tone> = { CRITICAL: "bad", HIGH: "bad", MEDIUM: "warn", LOW: "info", INFO: "muted" };
export const SeverityPill = ({ severity }: { severity: Severity }) => (
  <Pill tone={SEV[severity]} icon={severity === "CRITICAL" || severity === "HIGH" ? ShieldAlert : undefined}>
    {severity[0] + severity.slice(1).toLowerCase()}
  </Pill>
);

const FS: Record<FindingStatus, [Tone, string]> = {
  OPEN: ["warn", "Open"], ACKNOWLEDGED: ["info", "Acknowledged"], REMEDIATED: ["ok", "Remediated"], FALSE_POSITIVE: ["muted", "False positive"],
};
export const FindingStatusPill = ({ status }: { status: FindingStatus }) => <Pill tone={FS[status][0]}>{FS[status][1]}</Pill>;

const DS: Record<DeploymentStatus, [Tone, string]> = {
  SUCCEEDED: ["ok", "Succeeded"], FAILED: ["bad", "Failed"], ROLLED_BACK: ["warn", "Rolled back"], IN_PROGRESS: ["info", "In progress"], PENDING: ["muted", "Pending"],
};
export const DeploymentPill = ({ status }: { status: DeploymentStatus }) => <Pill tone={DS[status][0]}>{DS[status][1]}</Pill>;

const NS: Record<NotificationStatus, [Tone, string]> = {
  SENT: ["ok", "Sent"], FAILED: ["bad", "Failed"], QUEUED: ["muted", "Queued"], SKIPPED: ["muted", "Skipped"],
};
export const NotificationPill = ({ status }: { status: NotificationStatus }) => <Pill tone={NS[status][0]}>{NS[status][1]}</Pill>;

export const GatePill = ({ state }: { state: "OPEN" | "HELD" | "UNKNOWN" }) =>
  state === "OPEN" ? <Pill tone="ok" icon={ShieldCheck}>Cleared to deploy</Pill>
  : state === "HELD" ? <Pill tone="bad" icon={ShieldX}>Held</Pill>
  : <Pill tone="muted" icon={Clock}>No decision yet</Pill>;

export const DemoTag = () => (
  <span title="Seeded demonstration data, not a real repository" className="rounded border border-warn/50 px-1.5 py-px text-[11px] font-medium text-warn">
    Demo
  </span>
);

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-6 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children && <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>}
    </header>
  );
}

export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-xl border-l-2 border-accent py-1 pl-4">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}

export function DemoBanner() {
  return (
    <p role="note" className="mb-6 max-w-3xl rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
      This dashboard includes seeded demonstration data, marked <strong>Demo</strong>. It is not from a real pipeline.
    </p>
  );
}

export function DataTable({ caption, head, children }: { caption: string; head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, mono, className = "" }: { children: React.ReactNode; mono?: boolean; className?: string }) => (
  <td className={`px-3 py-3 align-top ${mono ? "font-mono text-xs" : ""} ${className}`}>{children}</td>
);

export const Loading = () => (
  <p role="status" className="text-sm text-muted">Loading…</p>
);
