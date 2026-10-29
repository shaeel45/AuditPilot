import { Router, type Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { safeEqual } from "../../lib/crypto";
import { isProd } from "../../config/env";
import jwt from "jsonwebtoken";
import { ENV } from "../../config/env";
import { logger } from "../../config/logger";
import { User, type UserDocument } from "../../models/User";
import { recordAuditLog } from "../../middleware/auditLog";
import {
  createSessionToken,
  exchangeOAuthCode,
  fetchGitHubProfile,
  githubOAuthUrl,
  sanitizeUser,
  syncUser,
} from "./service";

/**
 * GitHub OAuth App flow (mode: oauth).
 * The GitHub App flow (mode: app) is added by the App module in a later commit.
 */

const GH_STATE_COOKIE = "gh_oauth_state";

export const authRouter = Router();

authRouter.get("/auth/github", (req: Request, res: Response) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ message: "GITHUB_CLIENT_ID is not configured" });
  }
  const redirectUri =
    process.env.GITHUB_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/auth/github/callback`;

  // OAuth state: CSRF protection; 10 min single-use cookie
  const state = randomBytes(16).toString("hex");
  res.cookie(GH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60 * 1000,
  });

  res.redirect(githubOAuthUrl(redirectUri, state));
});

authRouter.get("/auth/github/callback", async (req: Request, res: Response) => {
  const { code, state } = req.query;

  // 1. Verify state cookie vs param (CSRF)
  const cookieState = (req.cookies?.[GH_STATE_COOKIE] as string) || "";
  const paramState = typeof state === "string" ? state : "";
  if (!paramState || !cookieState || !safeEqual(paramState, cookieState)) {
    return res.status(403).send("OAuth state validation failed. Please restart sign-in.");
  }
  res.clearCookie(GH_STATE_COOKIE, { path: "/" });

  try {
    const rawToken = await exchangeOAuthCode(String(code));
    const profile = await fetchGitHubProfile(rawToken);
    const user = await syncUser(profile, rawToken);

    // JWT delivered ONLY via httpOnly cookie — never in a URL
    const jwtToken = createSessionToken(user);
    res.cookie("audit_token", jwtToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    recordAuditLog(req, { action: "auth.login", targetType: "user", targetId: String(user._id), meta: { provider: "github" } });
    return res.redirect("/app");
  } catch (err) {
    logger.error({ err: (err as Error).message }, "github auth flow failed");
    return res.status(500).json({ message: "Internal server error during auth" });
  }
});

authRouter.get("/auth/logout", (req: Request, res: Response) => {
  res.clearCookie("audit_token", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
  });
  res.json({ message: "Logged out successfully" });
});

/** Silent auth status check: cookie first, Bearer fallback; never 401s. */
authRouter.get("/auth/user", async (req: Request, res: Response) => {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : undefined;
  const tokenCandidate =
    bearer || ((req as unknown as { cookies?: Record<string, string> }).cookies?.["audit_token"] as string | undefined);

  if (!tokenCandidate) {
    return res.json({ authenticated: false });
  }

  try {
    const decoded = jwt.verify(tokenCandidate, ENV.JWT_SECRET as string) as { userId?: string };
    if (!decoded.userId) {
      return res.json({ authenticated: false });
    }
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.json({ authenticated: false });
    }
    return res.json({ authenticated: true, user: sanitizeUser(user as unknown as Record<string, unknown>) });
  } catch {
    return res.json({ authenticated: false });
  }
});
