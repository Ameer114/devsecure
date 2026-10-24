import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export interface FindingExplanation {
  explanation: string;
  suggestion: string;
}

export async function generateFindingExplanation(
  finding: {
    scanner: string;
    ruleId: string;
    title: string;
    filePath?: string | null;
    startLine?: number | null;
  },
  apiKeyOverride?: string
): Promise<FindingExplanation> {
  const env = getEnv();
  const apiKey = apiKeyOverride?.trim() || env.GROQ_API_KEY;

  if (!apiKey) {
    return {
      explanation: `Security finding "${finding.title}" detected at ${finding.filePath ?? "source code"}${finding.startLine ? `:${finding.startLine}` : ""}. Hardcoded credentials in source code allow anyone with repository access to compromise infrastructure.`,
      suggestion: `Remove the exposed key from ${finding.filePath ?? "your file"}. Move the secret to .env (ensure .env is in .gitignore) or use environment variables. If this key has been active, rotate it immediately in the provider console.`,
    };
  }

  const prompt = `You are a cybersecurity expert analyzing a software security finding.
Scanner: ${finding.scanner}
Rule ID: ${finding.ruleId}
Title: ${finding.title}
File location: ${finding.filePath ?? "N/A"}${finding.startLine ? `:${finding.startLine}` : ""}

Provide a concise, practical analysis.
Respond ONLY with valid JSON in this exact structure:
{
  "explanation": "1-2 sentences explaining why this finding is a security risk",
  "suggestion": "1-2 sentences with concrete remediation steps or commands"
}`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are an expert application security engineer. Respond strictly in valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      logger.error("Groq API call failed", { status: res.status, errBody });
      return {
        explanation: `Groq API error (${res.status}): ${res.statusText}`,
        suggestion: "Verify your GROQ_API_KEY in the Configuration page or .env.local.",
      };
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const rawContent = json.choices?.[0]?.message?.content ?? "";
    const cleanJson = rawContent.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleanJson) as { explanation?: string; suggestion?: string };

    return {
      explanation: parsed.explanation ?? "No explanation returned by Groq.",
      suggestion: parsed.suggestion ?? "No remediation suggestion returned by Groq.",
    };
  } catch (err) {
    logger.error("Failed to generate finding explanation with Groq", { err });
    return {
      explanation: "Failed to generate AI explanation.",
      suggestion: "Check server logs for error details.",
    };
  }
}
