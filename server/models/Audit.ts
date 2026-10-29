import mongoose, { type Document, type Model, type Schema } from "mongoose";

export interface AuditDocument extends Document {
  title: string;
  description?: string;
  status: "draft" | "in_progress" | "completed";
  priority: "low" | "medium" | "high" | "critical";
  auditorId?: string;
  scope?: string;
  branch: string;
  createdAt: Date;
  updatedAt: Date;
}

const auditSchema: Schema<AuditDocument> = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    status: { type: String, default: "draft", enum: ["draft", "in_progress", "completed"] },
    priority: { type: String, default: "medium", enum: ["low", "medium", "high", "critical"] },
    auditorId: { type: String }, // legacy field — superseded by userId in the ownership step
    scope: { type: String },
    branch: { type: String, default: "main" },
}, { timestamps: true });

export const Audit: Model<AuditDocument> =
  (mongoose.models.Audit as Model<AuditDocument>) ||
  mongoose.model<AuditDocument>("Audit", auditSchema);
