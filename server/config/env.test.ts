import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const base: Record<string, string | undefined> = {
  NODE_ENV: "development",
};

describe("parseEnv", () => {
  it("applies defaults in development", () => {
    const r = parseEnv(base);
    expect(r.ok).toBe(true);
    expect(r.env!.PORT).toBe(5000);
    expect(r.env!.AI_INTEGRATIONS_OPENAI_BASE_URL).toBe("https://openrouter.ai/api/v1");
    expect(r.env!.CLIENT_ORIGIN).toBe("http://localhost:5000,http://localhost:5173");
  });

  it("fails without JWT_SECRET in production", () => {
    const r = parseEnv({ ...base, NODE_ENV: "production", ENCRYPTION_KEY: "a".repeat(64) });
    expect(r.ok).toBe(false);
    const issue = r.errors!.issues.find(i => i.path.includes("JWT_SECRET"));
    expect(issue).toBeDefined();
    expect(issue!.message).toContain("required in production");
  });

  it("fails without ENCRYPTION_KEY in production", () => {
    const r = parseEnv({
      ...base,
      NODE_ENV: "production",
      JWT_SECRET: "s".repeat(48),
    });
    expect(r.ok).toBe(false);
    const issue = r.errors!.issues.find(i => i.path.includes("ENCRYPTION_KEY"));
    expect(issue).toBeDefined();
    expect(issue!.message).toContain("required in production");
  });

  it("passes production with all required secrets", () => {
    const r = parseEnv({
      ...base,
      NODE_ENV: "production",
      JWT_SECRET: "s".repeat(48),
      ENCRYPTION_KEY: "a".repeat(64),
      MONGODB_URI: "mongodb://user:pass@host:27017/db",
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some(w => w.field === "JWT_SECRET")).toBe(false);
  });

  it("warns (not fails) on missing JWT_SECRET in development", () => {
    const r = parseEnv(base);
    expect(r.ok).toBe(true);
    expect(r.warnings.some(w => w.field === "JWT_SECRET")).toBe(true);
  });

  it("rejects a short ENCRYPTION_KEY", () => {
    const r = parseEnv({ ...base, ENCRYPTION_KEY: "abcd" });
    expect(r.ok).toBe(false);
  });

  it("parses WORKER_ONLY and DISABLE_WORKERS flags", () => {
    const r = parseEnv({ ...base, WORKER_ONLY: "1", DISABLE_WORKERS: "true" });
    expect(r.ok).toBe(true);
    expect(r.env!.WORKER_ONLY).toBe(true);
    expect(r.env!.DISABLE_WORKERS).toBe(true);
  });

  it("accepts valid GitHub auth modes only", () => {
    expect(parseEnv({ ...base, GITHUB_AUTH_MODE: "bogus" }).ok).toBe(false);
    expect(parseEnv({ ...base, GITHUB_AUTH_MODE: "app" }).ok).toBe(true);
  });
});
