/**
 * Shared types between client and server.
 *
 * NOTE: This file was previously a Drizzle/PostgreSQL schema (`shared/schema.ts`)
 * inherited from an earlier stack. The runtime database is MongoDB/Mongoose
 * (see `server/models/*`), so this file is now plain TypeScript types only.
 */

export type Severity = "low" | "medium" | "high" | "critical";
export type AuditStatus = "draft" | "in_progress" | "completed";
export type AuditPriority = Severity;
export type ComplianceStatus = "compliant" | "non_compliant" | "needs_review" | "pending";
export type PlanId = "starter" | "pro" | "agency";

/** Minimal MongoDB ObjectId string representation (24 hex chars). */
export type MongoId = string;

export interface Audit {
  _id: MongoId;
  title: string;
  description?: string;
  status: AuditStatus;
  priority: AuditPriority;
  scope?: string;
  branch: string;
  createdAt: string;
  updatedAt: string;
  items?: AuditItem[];
}

export interface AuditItem {
  _id: MongoId;
  auditId: MongoId;
  label: string;
  type: string; // security | performance | accessibility | ...
  value?: string; // file path
  severity: Severity;
  old_code?: string;
  new_code?: string;
  complianceStatus: ComplianceStatus;
  auditorNotes?: string;
  createdAt: string;
}

export interface Report {
  _id: MongoId;
  auditId: MongoId;
  summary?: unknown; // string or structured object (AI-generated)
  riskScore?: number;
  generatedContent?: unknown;
  createdAt: string;
}

// --- Insert payloads -------------------------------------------------------

export interface InsertAudit {
  title: string;
  description?: string;
  status?: AuditStatus;
  priority?: AuditPriority;
  scope?: string;
  branch?: string;
}

export interface InsertAuditItem {
  auditId?: MongoId; // sometimes passed via URL params instead of the body
  label: string;
  type?: string;
  value?: string;
  severity?: Severity;
  old_code?: string;
  new_code?: string;
  complianceStatus?: ComplianceStatus;
  auditorNotes?: string;
}

export interface InsertReport {
  auditId: MongoId;
  summary?: unknown;
  riskScore?: number;
  generatedContent?: unknown;
}

// --- GitHub shapes used by the client --------------------------------------

export interface GitHubRepoSummary {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  default_branch: string;
  updated_at: string;
  html_url: string;
  visibility?: string;
  private?: boolean;
}

export interface GitHubPullSummary {
  id: number;
  number: number;
  title: string;
  state: string;
  repo: { owner: string; name: string; full_name: string };
  user: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  html_url: string;
}

/** User payload returned by `/api/auth/user` — NEVER contains tokens/secrets. */
export interface AuthUser {
  _id: MongoId;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
  plan: PlanId;
  auditsUsed?: number;
  pullRequestsUsed?: number;
}
