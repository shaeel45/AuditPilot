import mongoose, { type Document, type Model, type Schema } from "mongoose";

export interface AuditItemDocument extends Document {
  auditId: mongoose.Types.ObjectId;
  label: string;
  type: string; // security | performance | accessibility | ...
  value?: string; // file path
  severity: "low" | "medium" | "high" | "critical";
  old_code?: string;
  new_code?: string;
  complianceStatus: "compliant" | "non_compliant" | "needs_review" | "pending";
  auditorNotes?: string;
  createdAt: Date;
}

const auditItemSchema: Schema<AuditItemDocument> = new mongoose.Schema({
    auditId: { type: mongoose.Schema.Types.ObjectId, ref: "Audit", required: true },
    label: { type: String, required: true },
    type: { type: String, required: true },
    value: { type: String },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
    old_code: { type: String },
    new_code: { type: String },
    complianceStatus: { type: String, enum: ["compliant", "non_compliant", "needs_review", "pending"], default: "pending" },
    auditorNotes: { type: String },
}, { timestamps: true });

export const AuditItem: Model<AuditItemDocument> =
  (mongoose.models.AuditItem as Model<AuditItemDocument>) ||
  mongoose.model<AuditItemDocument>("AuditItem", auditItemSchema);
