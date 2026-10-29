import { Router, type Request, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { ai, safeJsonParse, triageModel } from "../../integrations/ai/openaiClient";
import { logger } from "../../config/logger";
import { Report, type ReportDocument } from "../../models/Report";
import { getAuditWithItems } from "../audits/service";

export const reportsRouter = Router();

interface AIInsightsResult {
  summary?: string;
  riskScore?: number;
  insights?: unknown;
  recommendations?: unknown;
}

reportsRouter.post(
  "/audits/:id/generate-insights",
  requireAuth,
  async (req: Request, res: Response) => {
    const auditId = String(req.params.id);

    try {
      const audit = await getAuditWithItems(auditId);
      if (!audit) {
        return res.status(404).json({ message: "Audit not found" });
      }

      const items = audit.items ?? [];
      const auditContext = `
        Title: ${audit.title}
        Description: ${audit.description}
        Priority: ${audit.priority}
        Items:
        ${items.map(i => `- ${i.label}: ${i.value || "N/A"} (Status: ${i.complianceStatus || "Pending"})`).join("\n")}
      `;

      const response = await ai().chat.completions.create({
        model: triageModel(),
        messages: [
          {
            role: "system",
            content:
              "You are an expert audit compliance assistant. Analyze the following audit data and provide a summary, a risk score (0-100), and detailed insights/recommendations. Output valid JSON ONLY. Do not include any explanation outside the JSON object.",
          },
          { role: "user", content: auditContext },
        ],
      });

      const result = (safeJsonParse(response.choices[0].message.content || "{}") as AIInsightsResult) || {};

      const summary = result.summary || "No summary generated.";
      const riskScore = typeof result.riskScore === "number" ? result.riskScore : 50;
      const generatedContent =
        result.insights || result.recommendations || JSON.stringify(result, null, 2);

      const report = await Report.create({
        auditId,
        summary,
        riskScore,
        generatedContent,
      });

      return res.json(report);
    } catch (error) {
      logger.error({ err: (error as Error).message }, "AI insights generation error");
      return res.status(500).json({ message: "Failed to generate insights" });
    }
  },
);

export async function listReportsForAudit(auditId: string): Promise<ReportDocument[]> {
  return Report.find({ auditId }).lean();
}

export async function createReport(data: Partial<ReportDocument>): Promise<ReportDocument> {
  return Report.create(data);
}
