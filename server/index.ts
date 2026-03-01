import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { connectDB } from "./db";

const app = express();
const httpServer = createServer(app);
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/auditpilot";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    cookie: { maxAge: 604800000 }, // 7 days in milliseconds
    store: ((MongoStore as any).default || MongoStore).create({
      mongoUrl: MONGODB_URI,
      ttl: 7 * 24 * 60 * 60, // 7 days
    }),
    resave: false,
    saveUninitialized: false,
    secret: process.env.SESSION_SECRET || "audit-pilot-secret",
  }),
);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Define startup logic
async function startServer() {
  await connectDB();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production" && !process.env.NETLIFY) {
    serveStatic(app);
  } else if (process.env.NODE_ENV !== "production") {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Only listen on port if not in a serverless environment
  if (!process.env.NETLIFY) {
    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
      },
      () => {
        log(`serving on port ${port}`);
      },
    );
  }
}

// Global initialization for serverless or local
const initPromise = startServer();

export { app, initPromise };

