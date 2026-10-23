import { logger } from "@/lib/logger";
import { store } from "@/lib/store";
import { generateFindingExplanation } from "@/services/ai";
import { recordAudit } from "@/services/audit";

export async function POST(req: Request) {
  let body: { findingId?: string; groqApiKey?: string; grokApiKey?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  if (!body.findingId || typeof body.findingId !== "string") {
    return Response.json({ error: "findingId is required" }, { status: 422 });
  }

  try {
    const finding = store.findFinding(body.findingId);

    if (!finding) {
      return Response.json({ error: "Finding not found" }, { status: 404 });
    }

    const { explanation, suggestion } = await generateFindingExplanation(
      {
        scanner: finding.scanner,
        ruleId: finding.ruleId,
        title: finding.title,
        filePath: finding.filePath,
        startLine: finding.startLine,
      },
      body.groqApiKey || body.grokApiKey
    );

    const updated = store.updateFinding(finding.id, {
      aiExplanation: explanation,
      aiSuggestion: suggestion,
    });

    await recordAudit({
      actor: "groq-ai",
      action: "finding.explained",
      entityType: "Finding",
      entityId: finding.id,
      repositoryId: finding.repositoryId,
      metadata: { ruleId: finding.ruleId, scanner: finding.scanner },
    });

    return Response.json({
      id: updated?.id ?? finding.id,
      aiExplanation: updated?.aiExplanation ?? explanation,
      aiSuggestion: updated?.aiSuggestion ?? suggestion,
    });
  } catch (err) {
    logger.error("Failed to explain finding", { err });
    return Response.json({ error: "Could not generate explanation" }, { status: 500 });
  }
}
