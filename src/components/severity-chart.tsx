"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLOR: Record<string, string> = {
  CRITICAL: "var(--bad)", HIGH: "var(--bad)", MEDIUM: "var(--warn)", LOW: "var(--info)", INFO: "var(--muted)",
};

export function SeverityChart({ data }: { data: { severity: string; count: number }[] }) {
  const rows = data.map((d) => ({ name: d.severity[0] + d.severity.slice(1).toLowerCase(), key: d.severity, count: d.count }));
  return (
    <div className="h-44 w-full" role="img" aria-label={`Open findings by severity: ${rows.map((r) => `${r.name} ${r.count}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -24 }}>
          <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: "var(--line)" }} tick={{ fill: "var(--muted)", fontSize: 12 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
          <Tooltip cursor={{ fill: "var(--line)", opacity: 0.4 }} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--ink)" }} />
          <Bar dataKey="count" name="Open findings" radius={[3, 3, 0, 0]} maxBarSize={44}>
            {rows.map((r) => <Cell key={r.key} fill={COLOR[r.key]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
