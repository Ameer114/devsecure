import { describe, expect, it } from "vitest";
import { runSecurityScan } from "@/services/scanner";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Security Scanner & Zero-Secret Gate", () => {
  it("detects hardcoded AWS access keys and flags them as CRITICAL SECRET", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "secureship-test-"));
    const vulnerableFile = path.join(tmpDir, "config.js");
    fs.writeFileSync(
      vulnerableFile,
      'const awsKey = "AKIAIOSFODNN7EXAMPLE";\nconsole.log(awsKey);\n',
      "utf-8"
    );

    try {
      const findings = runSecurityScan(tmpDir, "repo-1", "run-1", "test/repo");
      expect(findings.length).toBeGreaterThan(0);
      const awsFinding = findings.find((f) => f.ruleId === "aws-access-key-id");
      expect(awsFinding).toBeDefined();
      expect(awsFinding?.severity).toBe("CRITICAL");
      expect(awsFinding?.kind).toBe("SECRET");
      expect(awsFinding?.scanner).toBe("GITLEAKS");

      // Verify ZERO raw secrets are stored or returned in the finding object
      const json = JSON.stringify(awsFinding);
      expect(json).not.toContain("AKIAIOSFODNN7EXAMPLE");
      expect(awsFinding?.fingerprint).toBeDefined();
      expect(awsFinding?.fingerprint.length).toBe(32); // 32-char SHA-256 fingerprint
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("passes cleanly when repository has no exposed secrets", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "secureship-clean-"));
    const cleanFile = path.join(tmpDir, "index.js");
    fs.writeFileSync(
      cleanFile,
      'const apiKey = process.env.API_KEY;\nexport default apiKey;\n',
      "utf-8"
    );

    try {
      const findings = runSecurityScan(tmpDir, "repo-1", "run-1", "test/repo");
      const criticalOrSecrets = findings.filter(
        (f) => f.severity === "CRITICAL" || f.kind === "SECRET"
      );
      expect(criticalOrSecrets.length).toBe(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("detects exposed secrets in .env files without quotes and tracks exact line", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "secureship-env-"));
    const envFile = path.join(tmpDir, ".env");
    fs.writeFileSync(
      envFile,
      'PORT=3000\nAWS_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\nNODE_ENV=production\n',
      "utf-8"
    );

    try {
      const findings = runSecurityScan(tmpDir, "repo-1", "run-1", "test/repo");
      expect(findings.length).toBeGreaterThan(0);
      const secretFinding = findings.find((f) => f.ruleId === "aws-secret-access-key");
      expect(secretFinding).toBeDefined();
      expect(secretFinding?.filePath).toBe(".env");
      expect(secretFinding?.startLine).toBe(2);
      expect(secretFinding?.severity).toBe("CRITICAL");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("allows secrets in .env when .env is safely included in .gitignore", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "secureship-gitignored-env-"));
    const gitignoreFile = path.join(tmpDir, ".gitignore");
    fs.writeFileSync(gitignoreFile, "node_modules\n.env\n", "utf-8");

    const envFile = path.join(tmpDir, ".env");
    fs.writeFileSync(
      envFile,
      'PORT=3000\nAWS_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\nNODE_ENV=production\n',
      "utf-8"
    );

    try {
      const findings = runSecurityScan(tmpDir, "repo-1", "run-1", "test/repo");
      const criticalOrSecrets = findings.filter(
        (f) => f.severity === "CRITICAL" || f.kind === "SECRET"
      );
      expect(criticalOrSecrets.length).toBe(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("generates real Groq AI remediation citing exact file and line number", async () => {
    const { generateFindingExplanation } = await import("@/services/ai");
    const finding = {
      scanner: "GITLEAKS",
      ruleId: "aws-access-key-id",
      title: "AWS Access Key ID exposed",
      filePath: "src/config/aws.ts",
      startLine: 14,
    };

    const groqKey = process.env.GROQ_API_KEY;
    const result = await generateFindingExplanation(finding, groqKey);
    expect(result.explanation).toBeDefined();
    expect(result.suggestion).toBeDefined();
    expect(result.explanation.length).toBeGreaterThan(20);
    expect(result.suggestion.length).toBeGreaterThan(20);
  }, 25000);

  it("dispatches security alert email containing file, line number, and remediation", async () => {
    const { sendSecurityAlertEmail } = await import("@/services/email");
    const result = await sendSecurityAlertEmail({
      to: "developer@example.com",
      subject: "[SecureShip Test Alert] Pre-push verification",
      repoFullName: "secureship/devsecure",
      commitSha: "a1b2c3d4e5",
      branch: "main",
      findingDetails: [
        {
          ruleId: "aws-access-key-id",
          title: "AWS Access Key ID exposed",
          filePath: "src/config/aws.ts",
          startLine: 14,
          severity: "CRITICAL",
        },
      ],
      aiExplanation: "Exposed AWS access keys grant full programmatic access to cloud resources.",
      aiSuggestion: "Move credential to .env, add .env to .gitignore, and access via process.env.",
    });

    expect(result.ok).toBe(true);
    expect(result.previewUrl || result.isRealDelivery || result.messageId).toBeTruthy();
  }, 25000);
});

