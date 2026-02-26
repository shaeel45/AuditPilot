import { storage } from "./storage";
import { connectDB } from "./db";
import mongoose from "mongoose";

async function seed() {
    await connectDB();

    const existingAudits = await storage.getAudits();
    if (existingAudits.length > 0) {
        console.log("Database already seeded");
        process.exit(0);
    }

    console.log("Seeding database...");

    const audit1 = await storage.createAudit({
        title: "Security Infrastructure Audit",
        description: "Cloud infrastructure security assessment.",
        status: "in_progress",
        priority: "high",
        scope: "Global AWS",
    });

    await storage.createAuditItem({
        auditId: audit1._id,
        label: "Firewall Configuration",
        type: "checkbox",
        complianceStatus: "compliant",
        auditorNotes: "Passed security check.",
    });

    await storage.createAuditItem({
        auditId: audit1._id,
        label: "Encryption at Rest",
        type: "checkbox",
        complianceStatus: "needs_review",
        auditorNotes: "Waiting for verification.",
    });

    console.log("Seeding complete");
    process.exit(0);
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
