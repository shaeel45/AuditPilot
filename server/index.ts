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

  // Serverless mode (legacy Netlify function): no workers, no listener,
  // no dev assets. initPromise must still resolve for the function handler.
  if (process.env.NETLIFY) {
    return;
  }

  // Background workers (job queue consumers).
  // DISABLE_WORKERS=1 → API-only process; WORKER_ONLY=1 → this process runs
  // ONLY workers (no listener). Default (neither set): one web+worker process.
  if (!ENV.DISABLE_WORKERS) {
    const { startWorkers } = await import("./modules/jobs/workers");
    startWorkers();
  }

  if (ENV.WORKER_ONLY) {
    return;
  }

  if (isProd) {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Central 404 + error handlers come AFTER static/vite setup so they don't
  // shadow those responders.
  registerTerminalHandlers(app);

  httpServer.listen(
    { port: ENV.PORT, host: "0.0.0.0" },
    () => {
      log(`serving on port ${ENV.PORT}`);
    },
  );
}

const initPromise = startServer().catch(err => {
  logger.fatal({ err: (err as Error).message }, "CRITICAL: Server initialization failed");
  throw err;
});

export { app, initPromise };
