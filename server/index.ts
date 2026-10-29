import "dotenv/config";
import express from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { connectDB } from "./config/mongo";
import { ENV, isProd } from "./config/env";
import { logger } from "./config/logger";
import { errorHandler } from "./middleware/errorHandler";
import { requestContext } from "./middleware/requestContext";
import cookieParser from "cookie-parser";

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);
const maskedUri = ENV.MONGODB_URI.replace(/:([^@]+)@/, ":****@");
logger.info({ uri: maskedUri }, "[Main] Initializing with MongoDB URI");
logger.info(
  { env: ENV.NODE_ENV, netlify: Boolean(process.env.NETLIFY) },
  "[Main] Environment",
);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = Buffer.from(buf);
  },
}));

app.use(express.urlencoded({ extended: false }));

app.use(cookieParser());

app.use(requestContext);

export function log(message: string, source = "express") {
  // legacy string logger kept while old call sites are migrated module-by-module
  logger.info({ source }, message);
}

// Define startup logic
async function startServer() {
  await connectDB();
  await registerRoutes(httpServer, app);

  // central error handler — must be registered after all routes
  app.use(errorHandler);

  if (isProd && !process.env.NETLIFY) {
    serveStatic(app);
  } else if (ENV.NODE_ENV !== "production") {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Only listen on port if not in a serverless environment
  if (!process.env.NETLIFY) {
    httpServer.listen(
      {
        port: ENV.PORT,
        host: "0.0.0.0",
      },
      () => {
        log(`serving on port ${ENV.PORT}`);
      },
    );
  }
}

// Global initialization for serverless or local
const initPromise = startServer().catch(err => {
  console.error("CRITICAL: Server initialization failed!", err);
  throw err;
});

export { app, initPromise };

