import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { getConfig } from "./core/config.js";
import { logger } from "./core/logger.js";
import { traceMiddleware } from "./core/security.js";
import { checkDbHealth, closeDb } from "./core/database.js";
import { checkRedisHealth, closeRedis, getRedis } from "./core/redis.js";
import {
  connectRabbitMQ,
  checkRabbitMQHealth,
  closeRabbitMQ,
} from "./core/rabbitmq.js";
import { closeQueues } from "./core/events.js";
import { authRouter } from "./auth/router.js";
import { tenantRouter } from "./tenants/router.js";
import { cctvRouter } from "./cctv/router.js";
import { anywareRouter } from "./anyware-ai/router.js";
import { securityRouter } from "./security/router.js";
import { billingRouter } from "./billing/router.js";
import { usersRouter } from "./users/router.js";

// BigInt JSON serialization (PostgreSQL bigserial returns BigInt)
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

const config = getConfig();
const app = express();

// ─── Middleware ──────────────────────────────────────────────

app.use(helmet());
app.use(
  cors({
    origin: config.CORS_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(traceMiddleware);
app.use(
  pinoHttp({
    logger,
    customLogLevel(_req, res, err) {
      if (res.statusCode >= 500 || err) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage(req, res) {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },
    redact: ["req.headers.authorization", "req.headers.cookie"],
  })
);

// ─── Health Checks (mandatory per blueprint) ────────────────

app.get("/health/live", (_req, res) => {
  res.json({ status: "ok", service: config.SERVICE_NAME });
});

app.get("/health/ready", async (_req, res) => {
  const [db, redis, rabbitmq] = await Promise.all([
    checkDbHealth(),
    checkRedisHealth(),
    checkRabbitMQHealth(),
  ]);

  const ready = db && redis && rabbitmq;
  const status = {
    status: ready ? "ready" : "degraded",
    service: config.SERVICE_NAME,
    version: config.SERVICE_VERSION,
    checks: { db, redis, rabbitmq },
  };

  res.status(ready ? 200 : 503).json(status);
});

// ─── Metrics (Prometheus format) ────────────────────────────

let requestCount = 0;
let errorCount = 0;

app.use((_req, res, next) => {
  requestCount++;
  res.on("finish", () => {
    if (res.statusCode >= 500) errorCount++;
  });
  next();
});

app.get("/metrics", (_req, res) => {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();

  res.set("Content-Type", "text/plain; version=0.0.4");
  res.send(
    [
      `# HELP csaas_gateway_requests_total Total HTTP requests`,
      `# TYPE csaas_gateway_requests_total counter`,
      `csaas_gateway_requests_total ${requestCount}`,
      `# HELP csaas_gateway_errors_total Total HTTP 5xx errors`,
      `# TYPE csaas_gateway_errors_total counter`,
      `csaas_gateway_errors_total ${errorCount}`,
      `# HELP csaas_gateway_uptime_seconds Service uptime`,
      `# TYPE csaas_gateway_uptime_seconds gauge`,
      `csaas_gateway_uptime_seconds ${uptime.toFixed(1)}`,
      `# HELP csaas_gateway_memory_bytes Memory usage`,
      `# TYPE csaas_gateway_memory_bytes gauge`,
      `csaas_gateway_memory_bytes{type="rss"} ${memUsage.rss}`,
      `csaas_gateway_memory_bytes{type="heap_used"} ${memUsage.heapUsed}`,
      `csaas_gateway_memory_bytes{type="heap_total"} ${memUsage.heapTotal}`,
    ].join("\n") + "\n"
  );
});

// ─── API Routes ─────────────────────────────────────────────

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/tenants", tenantRouter);
app.use("/api/v1/cctv", cctvRouter);
app.use("/api/v1/anyware", anywareRouter);
app.use("/api/v1/security", securityRouter);
app.use("/api/v1/billing", billingRouter);
app.use("/api/v1/users", usersRouter);

// ─── 404 handler ────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "Endpoint not found", statusCode: 404 },
  });
});

// ─── Global error handler ───────────────────────────────────

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error({ err }, "Unhandled error");
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        statusCode: 500,
      },
    });
  }
);

// ─── Startup ────────────────────────────────────────────────

async function start(): Promise<void> {
  logger.info({ config: { port: config.PORT, env: config.NODE_ENV } }, "Starting gateway");

  // Connect to dependencies
  try {
    await getRedis().connect();
    logger.info("Redis connected");
  } catch (e) {
    logger.warn({ err: e }, "Redis connection failed — running without cache");
  }

  try {
    await connectRabbitMQ();
    logger.info("RabbitMQ connected");
  } catch (e) {
    logger.warn({ err: e }, "RabbitMQ connection failed — running without event bus");
  }

  // Verify DB
  const dbOk = await checkDbHealth();
  if (dbOk) {
    logger.info("PostgreSQL connected");
  } else {
    logger.warn("PostgreSQL connection failed — some features unavailable");
  }

  app.listen(config.PORT, config.HOST, () => {
    logger.info(
      { host: config.HOST, port: config.PORT },
      `Gateway listening on ${config.HOST}:${config.PORT}`
    );
  });
}

// ─── Graceful Shutdown (mandatory per blueprint) ────────────

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down gracefully");

  // Drain in-flight requests by giving Express time to finish
  await new Promise((resolve) => setTimeout(resolve, 2000));

  await Promise.allSettled([closeQueues(), closeRabbitMQ(), closeRedis(), closeDb()]);

  logger.info("All connections closed, exiting");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

start().catch((err) => {
  logger.fatal({ err }, "Failed to start gateway");
  process.exit(1);
});
