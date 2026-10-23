import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { FindingRecord, FindingKind, Scanner, Severity } from "@/lib/types";

interface SecretRule {
  id: string;
  title: string;
  scanner: Scanner;
  kind: FindingKind;
  severity: Severity;
  pattern: RegExp;
  explanation: string;
  suggestion: string;
}

const SECURITY_RULES: SecretRule[] = [
  {
    id: "aws-access-key-id",
    title: "AWS Access Key ID exposed",
    scanner: "GITLEAKS",
    kind: "SECRET",
    severity: "CRITICAL",
    pattern: /\b(AKIA[0-9A-Z]{16})\b/,
    explanation: "AWS Access Key IDs grant direct programmatic access to your AWS cloud infrastructure.",
    suggestion: "Immediately deactivate and delete this key in AWS IAM. Use IAM Roles or AWS Secrets Manager instead.",
  },
  {
    id: "private-key-file",
    title: "Private cryptographic key exposed in source",
    scanner: "GITLEAKS",
    kind: "SECRET",
    severity: "CRITICAL",
    pattern: /-----BEGIN (?:RSA|EC|DSA|OPENSSH|PGP|PRIVATE) KEY-----/,
    explanation: "Private keys allow attackers to decrypt confidential traffic, forge tokens, or SSH directly into servers.",
    suggestion: "Revoke this key immediately, regenerate server certificates, and remove the file from git history.",
  },
  {
    id: "github-pat",
    title: "GitHub Personal Access Token exposed",
    scanner: "GITLEAKS",
    kind: "SECRET",
    severity: "CRITICAL",
    pattern: /\b(ghp_[A-Za-z0-9_]{36}|github_pat_[A-Za-z0-9_]{82})\b/,
    explanation: "GitHub Personal Access Tokens grant read and write access to your code repositories and CI workflows.",
    suggestion: "Revoke the token in GitHub Settings > Developer settings > Personal access tokens immediately.",
  },
  {
    id: "generic-api-key",
    title: "Hardcoded API Key / Token",
    scanner: "GITLEAKS",
    kind: "SECRET",
    severity: "HIGH",
    pattern: /(?:api[_-]?key|secret[_-]?key|auth[_-]?token)\s*[:=]\s*['"]([a-zA-Z0-9_\-]{20,})['"]/i,
    explanation: "Hardcoded credentials in code can be extracted by anyone with read access to the repository.",
    suggestion: "Store this secret in an environment variable or a secure secret manager. Never commit it to git.",
  },
  {
    id: "stripe-secret-key",
    title: "Stripe Live Secret Key exposed",
    scanner: "GITLEAKS",
    kind: "SECRET",
    severity: "CRITICAL",
    pattern: /\b(sk_live_[0-9a-zA-Z]{24})\b/,
    explanation: "Stripe Secret Keys grant full access to your payment processing, charges, and customer data.",
    suggestion: "Rotate this key in your Stripe Dashboard immediately and verify recent webhook and charge activity.",
  },
  {
    id: "sast-eval-injection",
    title: "Arbitrary code execution via eval()",
    scanner: "SEMGREP",
    kind: "SAST",
    severity: "HIGH",
    pattern: /\beval\s*\([^)]+\)/,
    explanation: "Using eval() can lead to arbitrary code execution if user-controlled input reaches the evaluator.",
    suggestion: "Refactor to use safe alternatives such as JSON.parse() or structured handlers.",
  },
  {
    id: "sast-unsafe-html",
    title: "Cross-Site Scripting (XSS) via dangerouslySetInnerHTML",
    scanner: "SEMGREP",
    kind: "SAST",
    severity: "MEDIUM",
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/,
    explanation: "Unsanitized HTML rendering can allow attackers to inject malicious JavaScript into client sessions.",
    suggestion: "Use DOMPurify to sanitize HTML content before rendering, or use native React JSX formatting.",
  },
];

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  ".gemini",
  "coverage",
]);

const IGNORED_FILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  ".env.example",
  "migration_lock.toml",
]);

function getFilesRecursively(dir: string, maxFiles = 300): string[] {
  const results: string[] = [];
  function walk(current: string) {
    if (results.length >= maxFiles) return;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= maxFiles) break;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          walk(full);
        }
      } else if (entry.isFile()) {
        if (!IGNORED_FILES.has(entry.name)) {
          results.push(full);
        }
      }
    }
  }
  walk(dir);
  return results;
}

export function runSecurityScan(
  targetDir: string,
  repoId: string,
  runId: string,
  repoFullName: string
): FindingRecord[] {
  const findings: FindingRecord[] = [];
  const files = getFilesRecursively(targetDir);

  for (const filePath of files) {
    let content: string;
    try {
      // Skip files larger than 1MB
      const stat = fs.statSync(filePath);
      if (stat.size > 1024 * 1024) continue;
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const relativePath = path.relative(targetDir, filePath).replace(/\\/g, "/");

    // Don't scan our own scanner definitions to prevent false positives
    if (relativePath.includes("scanner.ts")) continue;

    const lines = content.split("\n");

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];

      for (const rule of SECURITY_RULES) {
        const match = line.match(rule.pattern);
        if (match) {
          // Zero-secret invariant: compute one-way SHA-256 fingerprint, never store secret value
          const matchedText = match[1] || match[0];
          const fingerprint = createHash("sha256").update(matchedText).digest("hex").slice(0, 32);

          const finding: FindingRecord = {
            id: `find_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            runId,
            repositoryId: repoId,
            scanner: rule.scanner,
            kind: rule.kind,
            severity: rule.severity,
            ruleId: rule.id,
            title: rule.title,
            filePath: relativePath,
            startLine: lineIdx + 1,
            endLine: lineIdx + 1,
            fingerprint,
            status: "OPEN",
            aiExplanation: rule.explanation,
            aiSuggestion: rule.suggestion,
            createdAt: new Date(),
            repository: { fullName: repoFullName, isDemo: false },
          };

          findings.push(finding);
          break; // Stop after first rule match per line
        }
      }
    }
  }

  return findings;
}
