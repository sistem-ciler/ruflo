import pino from "pino";
import { getConfig } from "./config.js";

const config = getConfig();

export const logger = pino({
  name: config.SERVICE_NAME,
  level: config.NODE_ENV === "production" ? "info" : "debug",
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: {
    service: config.SERVICE_NAME,
    version: config.SERVICE_VERSION,
    env: config.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "body.password",
      "body.token",
    ],
    censor: "[REDACTED]",
  },
});

export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
