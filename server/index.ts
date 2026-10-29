import "dotenv/config";
import { createServer } from "http";
import { connectDB } from "./config/mongo";
import { ENV, isProd } from "./config/env";
import { logger } from "./config/logger";
import { app, registerTerminalHandlers } from "./app";
import { serveStatic } from "./static";

export function log(message: string, source = "express") {
  // legacy string logger kept while old call sites are migrated module-by-module
  logger.info({ source }, message);
}

const httpServer = createServer(app);

async function startServer() {
  await connectDB();

  if (isProd && !process.env.NETLIFY) {
    serveStatic(app);
  } else if (ENV.NODE_ENV !== "production") {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Central 404 + error handlers come AFTER static/vite setup so they don't
  // shadow those responders.
  registerTerminalHandlers(app);

  // Only listen if not running serverless
  if (!process.env.NETLIFY) {
    httpServer.listen(
      { port: ENV.PORT, host: "0.0.0.0" },
      () => {
        log(`serving on port ${ENV.PORT}`);
      },
    );
  }
}

const initPromise = startServer().catch(err => {
  logger.fatal({ err: (err as Error).message }, "CRITICAL: Server initialization failed");
  throw err;
});

export { app, initPromise };
