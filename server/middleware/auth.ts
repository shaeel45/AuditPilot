import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ENV, isProd } from "../config/env";
import { logger } from "../config/logger";
import { User } from "../models/User";
import { decryptSecret, encryptSecret } from "../lib/crypto";

export const AUTH_COOKIE = "audit_token";

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // match JWT expiry of 7d
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
  });
}

/**
 * Transparent migration: legacy plaintext `accessToken` is encrypted once on
 * first authenticated use and the plaintext field removed.
 */
async function migrateToken(user: { _id: unknown; accessToken?: string; accessTokenEncrypted?: string }) {
  if (!user.accessToken) {
    return user.accessTokenEncrypted ?? null;
  }
  try {
    const encrypted = encryptSecret(user.accessToken);
    await User.updateOne({ _id: user._id }, { $set: { accessTokenEncrypted: encrypted }, $unset: { accessToken: 1 } });
    logger.info({ userId: String(user._id) }, "migrated legacy plaintext GitHub token to encrypted storage");
    return encrypted;
  } catch (err) {
    logger.warn({ err: err?.message }, "token encryption migration failed");
    return user.accessTokenEncrypted ?? null;
  }
}

/**
 * Route protection. Reads the httpOnly auth cookie first, with a Bearer header
 * fallback kept temporarily for older clients. Attaches:
 *   req.user            — full user document (never sent to client verbatim)
 *   req.githubTokenEnc — encrypted token (never sent to client)
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? (req.headers.authorization as string).split(" ")[1]
    : undefined;
  const token = (req.cookies?.[AUTH_COOKIE] as string) || bearer;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: Missing or invalid token" });
  }

  let decoded: { userId?: string };
  try {
    decoded = jwt.verify(token, ENV.JWT_SECRET as string, {}) as { userId?: string };
  } catch {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }

  if (!decoded.userId) {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }

  const userDoc = await User.findById(decoded.userId).select(
    "+accessToken +accessTokenEncrypted",
  );
  if (!userDoc) {
    return res.status(401).json({ message: "Unauthorized: User not found" });
  }

  const enc = await migrateToken(userDoc);
  let githubAccessToken: string | null = null;
  if (enc) {
    try {
      githubAccessToken = decryptSecret(enc);
    } catch {
      logger.warn(
        { userId: String(userDoc._id) },
        "failed to decrypt stored GitHub token — user must re-authenticate",
      );
      githubAccessToken = null;
    }
  }

  (req as { user?: unknown }).user = userDoc;
  (req as { githubTokenEnc?: string | null }).githubTokenEnc = enc;
  (req as { githubAccessToken?: string | null }).githubAccessToken = githubAccessToken;
  next();
}

declare module "express" {
  interface Request {
    user?: import("../models/User").UserDocument;
    githubTokenEnc?: string | null;
  }
}
