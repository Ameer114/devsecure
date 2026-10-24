import fs from "node:fs";
import path from "node:path";

function generateHookScript(scanUrl: string): string {
  return `#!/bin/sh
# SecureShip Pre-Push Security Release Gate Hook
# Automatically installed by SecureShip AI
# Blocks commits containing exposed secrets from ever leaving this machine.

echo ""
echo "🛡️  [SecureShip] Running pre-push security scan..."

RESPONSE=$(curl -s -X POST "${scanUrl}" -H "Content-Type: application/json" -d "{\\"targetPath\\": \\"$(pwd)\\"}")

CLEAN=$(echo "$RESPONSE" | grep -o '"clean":true')

if [ -n "$CLEAN" ]; then
    echo "✅ [SecureShip] Security scan PASSED: Zero exposed secrets detected."
    echo ""
    exit 0
else
    echo ""
    echo "=================================================================="
    echo " 🛑 SECURESHIP RELEASE GATE: PUSH REJECTED!"
    echo " Exposed secrets or critical vulnerabilities detected in your code."
    echo " Please review findings in SecureShip dashboard (http://localhost:3000)"
    echo "=================================================================="
    echo "$RESPONSE"
    echo ""
    exit 1
fi
`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const host = url.host || "localhost:3000";
  const protocol = url.protocol || "http:";
  const scanUrl = `${protocol}//${host}/api/git/scan`;

  const script = generateHookScript(scanUrl);
  return new Response(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pre-push"',
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      targetFolder?: string;
    };

    let targetDir = process.cwd();
    if (body.targetFolder?.trim()) {
      const candidate = path.resolve(body.targetFolder.trim());
      if (fs.existsSync(candidate)) {
        targetDir = candidate;
      }
    }

    const gitHooksDir = path.join(targetDir, ".git", "hooks");
    if (!fs.existsSync(gitHooksDir)) {
      return Response.json(
        { ok: false, error: `No .git/hooks directory found in "${targetDir}". Is it a git repository?` },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const host = url.host || "localhost:3000";
    const protocol = url.protocol || "http:";
    const scanUrl = `${protocol}//${host}/api/git/scan`;

    const hookPath = path.join(gitHooksDir, "pre-push");
    const script = generateHookScript(scanUrl);

    fs.writeFileSync(hookPath, script, { mode: 0o755 });

    return Response.json({
      ok: true,
      hookPath,
      message: `Pre-push hook successfully installed in ${hookPath}! Any "git push" from terminal will now be scanned automatically.`,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error }, { status: 500 });
  }
}
