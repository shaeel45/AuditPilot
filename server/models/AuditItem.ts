import mongoose from "mongoose";

const auditItemSchema = new mongoose.Schema({
    auditId: { type: mongoose.Schema.Types.ObjectId, ref: "Audit", required: true },
    label: { type: String, required: true },
    type: { type: String, required: true }, // security, performance, accessibility
    value: { type: String }, // file path
    severity: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
    old_code: { type: String },
    new_code: { type: String },
    complianceStatus: { type: String, enum: ["compliant", "non_compliant", "needs_review", "pending"], default: "pending" },
    auditorNotes: { type: String },
    createdAt: { type: Date, default: Date.now },
});


export const AuditItem = mongoose.model("AuditItem", auditItemSchema);
