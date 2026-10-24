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
  const apiKey =
    apiKeyOverride?.trim() ||
    env.GROQ_API_KEY ||
    (typeof process !== "undefined" ? process.env.GROQ_API_KEY : undefined);

  if (!apiKey) {
    return {
      explanation: `⚠️ No Groq API Key provided. To get live AI security analysis from Llama 3.3, enter your Groq API Key (gsk_...) in the Configuration page.`,
      suggestion: `Security finding "${finding.title}" is located in ${finding.filePath ?? "your code"}${finding.startLine ? ` at line ${finding.startLine}` : ""}. Remove the hardcoded secret, store it in .env, and ensure .env is listed in .gitignore.`,
    };
  }

  const prompt = `You are an expert application security engineer reviewing code for a security release gate violation.
The automated scanner intercepted this security finding BEFORE pushing to GitHub:
- Scanner: ${finding.scanner}
- Rule: ${finding.ruleId}
- Title: ${finding.title}
- Location: ${finding.filePath ?? "Unknown file"}${finding.startLine ? ` at line ${finding.startLine}` : ""}

Provide a detailed, professional AI security review:
1. "explanation": Specifically cite the exact file (${finding.filePath ?? "code"}) and line (${finding.startLine ?? "N/A"}). Explain what attackers could do with this specific credential or vulnerability if it was pushed to GitHub.
2. "suggestion": Concrete, step-by-step instructions for the developer on how to fix this exact file. Explain how to move this secret into .env, ensure .env is in .gitignore, access it via process.env, and rotate the token in the provider console.

Respond ONLY with valid JSON in this exact structure:
{
  "explanation": "...",
  "suggestion": "..."
}`;

  // Dynamic model discovery with robust fallback list
  let candidateModels = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "qwen/qwen3.8-27b",
  ];

  try {
    const modelsRes = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (modelsRes.ok) {
      const modelsData = (await modelsRes.json()) as {
        data?: Array<{ id: string; active?: boolean }>;
      };
      const activeIds = new Set(
        modelsData.data?.filter((m) => m.active !== false).map((m) => m.id) || []
      );
      const matched = candidateModels.filter((id) => activeIds.has(id));
      const otherChatModels = Array.from(activeIds).filter(
        (id) => !id.includes("whisper") && !id.includes("guard")
      );
      if (matched.length > 0 || otherChatModels.length > 0) {
        candidateModels = [...matched, ...otherChatModels];
      }
    }
  } catch (discoveryErr) {
    logger.warn("Model discovery skipped, using default model list", { discoveryErr });
  }

  for (const model of candidateModels) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "You are an expert cybersecurity and DevSecOps engineer. Always respond strictly in valid JSON.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        logger.warn(`Groq request with ${model} returned status ${res.status}`, { errText });
        continue; // Try next available model
      }

      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const rawContent = json.choices?.[0]?.message?.content ?? "";
      const cleanJson = rawContent.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleanJson) as { explanation?: string; suggestion?: string };

      if (parsed.explanation && parsed.suggestion) {
        return {
          explanation: parsed.explanation,
          suggestion: parsed.suggestion,
        };
      }
    } catch (err) {
      logger.warn(`Failed Groq call on model ${model}`, { err });
      continue;
    }
  }

  return {
    explanation: `Groq AI model execution error. Intercepted security violation in ${finding.filePath ?? "code"}:${finding.startLine ?? 1}.`,
    suggestion: `Move the credential to .env, verify .gitignore has .env, and check your Groq API console permissions at console.groq.com.`,
  };
}
