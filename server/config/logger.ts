import pino from "pino";
import { ENV, isDev } from "./env";

/**
 * Structured logger.
 *
 * SECURITY: the redaction list is defensive-by-default. If a code path logs an
 * object containing any of these keys, the value is removed. Customer code and
 * tokens must also never be nested under these keys.
 */
const sensitiveKeys = [
  "authorization",
  "cookie",
  "setCookie",
  "password",
  "token",
  "accessToken",
  "accessTokenEncrypted",
  "refreshToken",
  "clientSecret",
  "apiKey",
  "api_key",
  "secret",
  "signature",
  "x-hub-signature-256",
  "stripe-signature",
];

const redact = {
  paths: sensitiveKeys.map(k => `*.${k}`).concat(sensitiveKeys),
  censor: "[REDACTED]",
};

const level = ENV.LOG_LEVEL;

export const logger = pino({
  level,
  redact,
  base: { service: "auditpilot-api" },
  ...(isProd
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss.l",
            ignore: "pid,hostname,service",
          },
        },
      }),
});

export type Logger = pino.Logger;

/** Request-scoped child logger helper. */
export function childLogger(bindings: Record<string, unknown> = {}): Logger {
  return logger.child(bindings);
}

/** Convenience wrappers matching the old console-style call sites. */
export const logError = (msg: string, err?: unknown, bindings?: Record<string, unknown>) => {
  const log = bindings ? logger.child(bindings) : logger;
  log.error({ err }, msg);
};

export const logWarn = (msg: string, bindings?: Record<string, unknown>) => {
  const log = bindings ? logger.child(bindings) : logger;
  log.warn(msg);
};

export const logInfo = (msg: string, bindings?: Record<string, unknown>) => {
  const log = bindings ? logger.child(bindings) : logger;
  log.info(msg);
};

if (isDev) {
  logger.debug({ aiBase: ENV.AI_INTEGRATIONS_OPENAI_BASE_URL }, "logger initialized");
}
