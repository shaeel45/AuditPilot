import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
    auditId: { type: mongoose.Schema.Types.ObjectId, ref: "Audit", required: true },
    summary: { type: mongoose.Schema.Types.Mixed }, // Can be string or object
    riskScore: { type: Number },
    generatedContent: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
});

export const Report = mongoose.model("Report", reportSchema);
