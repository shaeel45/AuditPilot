import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { requestContext } from "./middleware/requestContext";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/routes";
import { reposRouter } from "./modules/repos/routes";
import { auditsRouter } from "./modules/audits/routes";
import { reviewsRouter } from "./modules/reviews/routes";
import { reportsRouter } from "./modules/reports/routes";
import { billingRouter } from "./modules/billing/routes";
import { logger } from "./config/logger";

declare module "http" {
  interface IncomingMessage {
    rawBody: Buffer | undefined;
  }
}

/**
 * Application factory — middleware chain + module routers.
 * Pure: no listening, no DB connection (wired in index.ts / netlify.ts).
 */
export function createApp(): express.Express {
  const app = express();
  app.set("trust proxy", 1);

  app.use(express.json({
    // rawBody is required by signature-verified webhooks (Stripe, GitHub)
    verify: (req, _res, buf) => {
      req.rawBody = Buffer.from(buf);
    },
  }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(requestContext);

  // Module routers (paths preserved from the legacy routes.ts)
  app.use("/api", authRouter);
  app.use("/api", reposRouter);
  app.use("/api", auditsRouter);
  app.use("/api", reviewsRouter);
  app.use("/api", reportsRouter);
  app.use("/api", billingRouter);

  logger.debug("app assembled");

  return app;
}

/**
 * Terminal handlers (404 → central error handler).
 *
 * MUST be registered AFTER dev vite middleware / static serving — these are
 * catch-alls and would otherwise shadow the vite/static responders. index.ts
 * and netlify.ts both call this after their serve-time setup.
 */
export function registerTerminalHandlers(app: express.Express): void {
  app.use(notFoundHandler);
  app.use(errorHandler);
}

export const app = createApp();
