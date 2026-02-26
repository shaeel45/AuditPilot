import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // === Auth Routes ===

  app.get("/api/auth/github", (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/github/callback`;
    const scope = "repo read:user";
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
    res.redirect(githubAuthUrl);
  });

  app.get("/api/auth/github/callback", async (req, res) => {
    const { code } = req.query;
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    try {
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });

      const tokenData: any = await tokenResponse.json();
      if (tokenData.access_token) {
        (req.session as any).githubAccessToken = tokenData.access_token;
        res.redirect("/app");
      } else {
        res.status(401).json({ message: "Failed to obtain access token" });
      }
    } catch (error) {
      console.error("GitHub Auth Error:", error);
      res.status(500).json({ message: "Internal server error during auth" });
    }
  });

  app.get("/api/auth/user", (req, res) => {
    if ((req.session as any).githubAccessToken) {
      res.json({ authenticated: true });
    } else {
      res.json({ authenticated: false });
    }
  });

  // === Repo Routes ===

  app.get("/api/repos", async (req, res) => {
    const token = (req.session as any).githubAccessToken;
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const reposResponse = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!reposResponse.ok) {
        throw new Error("Failed to fetch repositories from GitHub");
      }

      const repos = await reposResponse.json();
      res.json(repos);
    } catch (error) {
      console.error("GitHub Repo Error:", error);
      res.status(500).json({ message: "Failed to fetch repositories" });
    }
  });

  app.post("/api/repos/:owner/:repo/audit", async (req, res) => {
    const token = (req.session as any).githubAccessToken;
    if (!token) {
      return res.status(401).json({ message: "No GitHub session found. Please log in again." });
    }

    const { owner, repo } = req.params;

    try {
      // 1. Get the latest commit SHA to use the Trees API
      const repoInfoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!repoInfoResponse.ok) {
        return res.status(repoInfoResponse.status).json({ message: `Failed to fetch repo info: ${repoInfoResponse.statusText}` });
      }

      const repoInfo = await repoInfoResponse.json();
      const defaultBranch = repoInfo.default_branch || 'main';

      // 2. Use Trees API to find all files (recursive)
      const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!treeResponse.ok) {
        return res.status(treeResponse.status).json({ message: `Failed to fetch file tree: ${treeResponse.statusText}` });
      }

      const treeData = await treeResponse.json();
      const files = treeData.tree.filter((item: any) => item.type === "blob");

      // 3. Filter for interesting files
      const sourceExtensions = ['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.go', '.rb', '.php', '.cs', '.rs', '.cpp', '.c'];
      const configFiles = ['package.json', 'tsconfig.json', 'README.md', 'requirements.txt', 'Gemfile', 'go.mod', 'composer.json', 'docker-compose.yml', 'Dockerfile'];

      const prioritizedFiles = files.filter((f: any) => {
        const path = f.path.toLowerCase();
        const isConfig = configFiles.some(cfg => path.endsWith(cfg));
        const isSource = sourceExtensions.some(ext => path.endsWith(ext)) && !path.includes('node_modules') && !path.includes('dist') && !path.includes('build') && !path.includes('.git');
        return isConfig || isSource;
      }).slice(0, 15);

      // If no prioritized files found, fallback to any text files
      let finalFiles = prioritizedFiles;
      if (finalFiles.length === 0) {
        console.log(`No prioritized files found for ${owner}/${repo}, falling back to any files.`);
        finalFiles = files.filter((f: any) => {
          const path = f.path.toLowerCase();
          return !path.includes('node_modules') && !path.includes('dist') && !path.includes('build') && !path.includes('.git') &&
            !path.endsWith('.png') && !path.endsWith('.jpg') && !path.endsWith('.jpeg') && !path.endsWith('.gif') && !path.endsWith('.pdf');
        }).slice(0, 5); // Take a smaller sample in fallback mode
      }

      if (finalFiles.length === 0) {
        return res.status(400).json({ message: "No suitable files found for analysis in this repository." });
      }

      // 4. Fetch content for found files
      let repoContent = "";
      for (const file of finalFiles) {
        const fileResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`, {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3.raw",
          },
        });

        if (fileResponse.ok) {
          const content = await fileResponse.text();
          const truncatedContent = content.length > 5000 ? content.substring(0, 5000) + "\n... [truncated]" : content;
          repoContent += `\n--- File: ${file.path} ---\n${truncatedContent}\n`;
        }
      }

      // 5. AI Analysis
      let aiResponse;
      try {
        aiResponse = await openai.chat.completions.create({
          model: "google/gemini-3.1-pro-preview",
          messages: [
            {
              role: "system",
              content: "You are an expert security and performance auditor. Analyze the provided repository files and identify real issues. For each issue, provide: type (security, performance, accessibility), severity (critical, medium, low), file path, description, and if a fix is available, provide the old code and the new fixed code. Output valid JSON only with an 'issues' array."
            },
            {
              role: "user",
              content: `Analyze this repository: ${owner}/${repo}\n\nFiles content:\n${repoContent}`
            }
          ],
          response_format: { type: "json_object" }
        });
      } catch (aiError: any) {
        if (aiError.code === 'insufficient_quota') {
          return res.status(429).json({
            message: "OpenAI Quota Exceeded. Please check your billing/credits at platform.openai.com.",
            details: "Your API key has run out of funds or hit its limit."
          });
        }
        throw aiError;
      }

      const aiResult = JSON.parse(aiResponse.choices[0].message.content || '{"issues": []}');
      const issues = Array.isArray(aiResult.issues) ? aiResult.issues : [];

      // 6. Create Audit Record
      const audit = await storage.createAudit({
        title: `Audit: ${repo}`,
        description: `Deep AI audit for ${owner}/${repo} using dynamic file discovery.`,
        status: "completed",
        priority: issues.some((i: any) => i.severity === "critical") ? "critical" : "medium",
        scope: "Global Repository Scan",
      });

      // 7. Save Audit Items
      const savedItems = [];
      for (const issue of issues) {
        const item = await storage.createAuditItem({
          auditId: audit._id,
          label: issue.description || "Point of interest detected",
          type: issue.type || "security",
          value: issue.file || "Root",
          complianceStatus: "non_compliant",
          auditorNotes: `Severity: ${issue.severity}. Recommendation: ${issue.newCode ? 'Apply suggested fix' : 'Manual review required'}`
        });
        savedItems.push({ ...issue, dbId: item._id });
      }

      res.json({ audit, issues: savedItems });
    } catch (error: any) {
      console.error("Robust AI Audit Error:", error);
      res.status(500).json({ message: error.message || "An unexpected error occurred during the audit process." });
    }
  });

  // === Audit Routes ===

  app.get("/api/audits", async (_req, res) => {
    const audits = await storage.getAudits();
    res.json(audits);
  });

  app.get("/api/audits/:id", async (req, res) => {
    const audit = await storage.getAudit(req.params.id);
    if (!audit) {
      return res.status(404).json({ message: "Audit not found" });
    }
    res.json(audit);
  });

  app.post("/api/audits", async (req, res) => {
    try {
      const audit = await storage.createAudit(req.body);
      res.status(201).json(audit);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/audits/:id", async (req, res) => {
    try {
      const audit = await storage.updateAudit(req.params.id, req.body);
      if (!audit) {
        return res.status(404).json({ message: "Audit not found" });
      }
      res.json(audit);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/audits/:id", async (req, res) => {
    await storage.deleteAudit(req.params.id);
    res.status(204).send();
  });

  // === Audit Item Routes ===

  app.post("/api/audits/:auditId/items", async (req, res) => {
    try {
      const item = await storage.createAuditItem({ ...req.body, auditId: req.params.auditId });
      res.status(201).json(item);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/audit-items/:id", async (req, res) => {
    try {
      const item = await storage.updateAuditItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/audit-items/:id", async (req, res) => {
    await storage.deleteAuditItem(req.params.id);
    res.status(204).send();
  });

  // === AI Insights Route ===

  app.post("/api/audits/:id/generate-insights", async (req, res) => {
    try {
      const auditId = req.params.id;
      const audit = await storage.getAudit(auditId);

      if (!audit) {
        return res.status(404).json({ message: "Audit not found" });
      }

      const auditContext = `
        Title: ${audit.title}
        Description: ${audit.description}
        Priority: ${audit.priority}
        Items:
        ${audit.items.map((i: any) => `- ${i.label}: ${i.value || 'N/A'} (Status: ${i.complianceStatus || 'Pending'})`).join('\n')}
      `;

      const response = await openai.chat.completions.create({
        model: "google/gemini-3.1-pro-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert audit compliance assistant. Analyze the following audit data and provide a summary, a risk score (0-100), and detailed insights/recommendations. Output JSON only."
          },
          {
            role: "user",
            content: auditContext
          }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content || "{}";
      const result = JSON.parse(content);

      const summary = result.summary || "No summary generated.";
      const riskScore = typeof result.riskScore === 'number' ? result.riskScore : 50;
      const generatedContent = result.insights || result.recommendations || JSON.stringify(result, null, 2);

      const report = await storage.createReport({
        auditId,
        summary,
        riskScore,
        generatedContent
      });

      res.json(report);
    } catch (error) {
      console.error("AI Generation Error:", error);
      res.status(500).json({ message: "Failed to generate insights" });
    }
  });

  return httpServer;
}
