import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Audit Schemas
export const insertAuditSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["draft", "in_progress", "completed"]).default("draft"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  scope: z.string().optional(),
});

export const insertAuditItemSchema = z.object({
  auditId: z.string().optional(), // Passed in URL sometimes
  label: z.string().min(1, "Label is required"),
  type: z.string().default("checkbox"),
  value: z.string().optional(),
  complianceStatus: z.enum(["compliant", "non_compliant", "needs_review", "pending"]).default("pending"),
  auditorNotes: z.string().optional(),
});

export const insertReportSchema = z.object({
  auditId: z.string(),
  summary: z.any().optional(),
  riskScore: z.number().optional(),
  generatedContent: z.any().optional(),
});

export type InsertAudit = z.infer<typeof insertAuditSchema>;
export type InsertAuditItem = z.infer<typeof insertAuditItemSchema>;
export type InsertReport = z.infer<typeof insertReportSchema>;
