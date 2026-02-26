import mongoose from "mongoose";

const auditSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    status: { type: String, default: "draft", enum: ["draft", "in_progress", "completed"] },
    priority: { type: String, default: "medium", enum: ["low", "medium", "high", "critical"] },
    auditorId: { type: String }, // Can be linked to a user later
    scope: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

export const Audit = mongoose.model("Audit", auditSchema);
