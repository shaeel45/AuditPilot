import mongoose, { type Document, type Model, type Schema } from "mongoose";

export interface ReportDocument extends Document {
  auditId: mongoose.Types.ObjectId | string;
  summary?: unknown; // string or structured AI output
  riskScore?: number;
  generatedContent?: unknown;
  createdAt: Date;
}

const reportSchema: Schema<ReportDocument> = new mongoose.Schema({
    auditId: { type: mongoose.Schema.Types.ObjectId, ref: "Audit", required: true },
    summary: { type: mongoose.Schema.Types.Mixed },
    riskScore: { type: Number },
    generatedContent: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

export const Report: Model<ReportDocument> =
  (mongoose.models.Report as Model<ReportDocument>) ||
  mongoose.model<ReportDocument>("Report", reportSchema);
