import { Audit } from "./models/Audit";
import { AuditItem } from "./models/AuditItem";
import { Report } from "./models/Report";

export interface IStorage {
  // Audits
  createAudit(audit: any): Promise<any>;
  getAudit(id: string): Promise<any>;
  getAudits(): Promise<any[]>;
  updateAudit(id: string, audit: any): Promise<any>;
  deleteAudit(id: string): Promise<void>;

  // Audit Items
  createAuditItem(item: any): Promise<any>;
  updateAuditItem(id: string, item: any): Promise<any>;
  deleteAuditItem(id: string): Promise<void>;

  // Reports
  createReport(report: any): Promise<any>;
  getReportsByAuditId(auditId: string): Promise<any[]>;
}

export class MongoStorage implements IStorage {
  async createAudit(audit: any) {
    const newAudit = new Audit(audit);
    return await newAudit.save();
  }

  async getAudit(id: string) {
    const audit = await Audit.findById(id).lean();
    if (!audit) return undefined;
    const items = await AuditItem.find({ auditId: id }).lean();
    return { ...audit, items };
  }

  async getAudits() {
    return await Audit.find({}).sort({ createdAt: -1 }).lean();
  }

  async updateAudit(id: string, audit: any) {
    return await Audit.findByIdAndUpdate(
      id,
      { ...audit, updatedAt: new Date() },
      { new: true }
    ).lean();
  }

  async deleteAudit(id: string) {
    await AuditItem.deleteMany({ auditId: id });
    await Report.deleteMany({ auditId: id });
    await Audit.findByIdAndDelete(id);
  }

  async createAuditItem(item: any) {
    const newItem = new AuditItem(item);
    return await newItem.save();
  }

  async updateAuditItem(id: string, item: any) {
    return await AuditItem.findByIdAndUpdate(id, item, { new: true }).lean();
  }

  async deleteAuditItem(id: string) {
    await AuditItem.findByIdAndDelete(id);
  }

  async createReport(report: any) {
    const newReport = new Report(report);
    return await newReport.save();
  }

  async getReportsByAuditId(auditId: string) {
    return await Report.find({ auditId }).lean();
  }
}

export const storage = new MongoStorage();
