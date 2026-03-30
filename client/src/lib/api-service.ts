/**
 * API Service Layer
 * Centralizes all data fetching logic to separate it from UI components.
 */

const getAuthHeader = () => ({
  "Authorization": `Bearer ${localStorage.getItem("audit_token") || ""}`
});

export const api = {
  // Auth & User
  async getAuthStatus() {
    const res = await fetch("/api/auth/user", { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Auth verify failed");
    return res.json();
  },

  // Billing
  async createCheckoutSession(plan: string) {
    const res = await fetch("/api/billing/create-checkout-session", {
      method: "POST",
      headers: { ...getAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ plan })
    });
    if (!res.ok) throw new Error("Failed to create checkout session");
    return res.json();
  },

  async verifyBillingSession(sessionId: string) {
    const res = await fetch(`/api/billing/verify-session?session_id=${sessionId}`, {
      headers: getAuthHeader()
    });
    return res.json();
  },

  // Repositories
  async getRepos() {
    const res = await fetch("/api/repos", { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to fetch repos");
    return res.json();
  },

  // Audits
  async getAudits() {
    const res = await fetch("/api/audits", { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to fetch audits");
    return res.json();
  },

  async getAuditDetails(auditId: string) {
    const res = await fetch(`/api/audits/${auditId}`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to fetch audit details");
    return res.json();
  },

  async updateAudit(auditId: string, data: any) {
    const res = await fetch(`/api/audits/${auditId}`, {
      method: "PATCH",
      headers: { ...getAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to update audit");
    return res.json();
  },

  async getBranches(owner: string, repo: string) {
    const res = await fetch(`/api/repos/${owner}/${repo}/branches`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to fetch branches");
    return res.json();
  },

  async startAudit(owner: string, repo: string, branch: string) {
    const res = await fetch(`/api/repos/${owner}/${repo}/audit`, {
      method: "POST",
      headers: { ...getAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ branch })
    });
    if (!res.ok) throw new Error("Failed to start audit");
    return res.json();
  },

  // Pull Requests
  async getPulls() {
    const res = await fetch("/api/pulls", { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to fetch pulls");
    return res.json();
  },

  async getPullFiles(owner: string, repo: string, number: string) {
    const res = await fetch(`/api/repos/${owner}/${repo}/pulls/${number}/files`, {
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error("Failed to fetch pull files");
    return res.json();
  },

  async applyFixes(owner: string, repo: string, auditId: string, branch: string) {
    const res = await fetch(`/api/repos/${owner}/${repo}/apply-fix`, {
      method: "POST",
      headers: { ...getAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ auditId, branch })
    });
    if (!res.ok) throw new Error("Failed to apply fixes");
    return res.json();
  },

  async auditPull(owner: string, repo: string, number: string | number) {
    const res = await fetch(`/api/repos/${owner}/${repo}/pulls/${number}/audit`, {
      method: "POST",
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error("Failed to audit pull request");
    return res.json();
  },

  async fixPull(owner: string, repo: string, number: string | number, issues: any[]) {
    const res = await fetch(`/api/repos/${owner}/${repo}/pulls/${number}/fix`, {
      method: "POST",
      headers: { ...getAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ issues })
    });
    if (!res.ok) throw new Error("Failed to fix pull request");
    return res.json();
  },

  async mergePull(owner: string, repo: string, number: string | number) {
    const res = await fetch(`/api/repos/${owner}/${repo}/pulls/${number}/merge`, {
      method: "PUT",
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error("Failed to merge pull request");
    return res.json();
  },

  async updatePull(owner: string, repo: string, number: string | number, data: any) {
    const res = await fetch(`/api/repos/${owner}/${repo}/pulls/${number}`, {
      method: "PATCH",
      headers: { ...getAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to update pull request");
    return res.json();
  }
};
