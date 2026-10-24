import fs from "node:fs";
import path from "node:path";
import { runSecurityScan } from "@/services/scanner";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      targetPath?: string;
    };

    let targetDir = process.cwd();
    if (body.targetPath?.trim()) {
      const candidate = path.resolve(body.targetPath.trim());
      if (fs.existsSync(candidate)) {
        targetDir = candidate;
      }
    }

    const findings = runSecurityScan(targetDir, "ephemeral-scan", `scan_${Date.now()}`, path.basename(targetDir));
    const blocking = findings.filter(
      (f) => f.severity === "CRITICAL" || f.severity === "HIGH" || f.kind === "SECRET"
    );

    return Response.json({
      clean: blocking.length === 0,
      totalFindings: findings.length,
      blockingCount: blocking.length,
      findings: findings.map((f) => ({
        id: f.id,
        ruleId: f.ruleId,
        title: f.title,
        severity: f.severity,
        filePath: f.filePath,
        startLine: f.startLine,
        scanner: f.scanner,
      })),
      targetDir,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return Response.json({ clean: false, error }, { status: 500 });
  }
}
