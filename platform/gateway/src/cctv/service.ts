import { eq, and, desc, gte, sql } from "drizzle-orm";
import { getDb } from "../core/database.js";
import { cameras, aiEvents, alerts, cuaSandboxes } from "../core/schema.js";
import { ok, err, Errors, type Result } from "../core/result.js";
import { publishEvent, Exchanges } from "../core/rabbitmq.js";
import { logger } from "../core/logger.js";
import type {
  CreateCameraInput,
  UpdateCameraInput,
  CreateEventInput,
  CreateAlertInput,
} from "./schemas.js";

// ─── Camera Service ─────────────────────────────────────────

export async function listCameras(
  tenantId: string
): Promise<Result<typeof cameras.$inferSelect[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(cameras)
    .where(eq(cameras.tenantId, tenantId))
    .orderBy(desc(cameras.createdAt));
  return ok(rows);
}

export async function getCamera(
  tenantId: string,
  cameraId: string
): Promise<Result<typeof cameras.$inferSelect>> {
  const db = getDb();
  const [camera] = await db
    .select()
    .from(cameras)
    .where(and(eq(cameras.id, cameraId), eq(cameras.tenantId, tenantId)))
    .limit(1);

  if (!camera) return err(Errors.notFound("Camera", cameraId));
  return ok(camera);
}

export async function createCamera(
  tenantId: string,
  input: CreateCameraInput
): Promise<Result<typeof cameras.$inferSelect>> {
  const db = getDb();
  const [camera] = await db
    .insert(cameras)
    .values({
      tenantId,
      name: input.name,
      location: input.location,
      rtspUrl: input.rtspUrl,
      resolution: input.resolution,
      fps: input.fps,
      aiConfig: input.aiConfig ?? {},
    })
    .returning();

  if (!camera) return err(Errors.internal("Failed to create camera"));

  await publishEvent(Exchanges.EVENTS, "cctv.camera.created", {
    cameraId: camera.id,
    name: camera.name,
  }, tenantId).catch((e) => logger.warn({ err: e }, "Failed to publish camera.created event"));

  return ok(camera);
}

export async function updateCamera(
  tenantId: string,
  cameraId: string,
  input: UpdateCameraInput
): Promise<Result<typeof cameras.$inferSelect>> {
  const db = getDb();

  const existing = await getCamera(tenantId, cameraId);
  if (!existing.ok) return existing;

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.location !== undefined) updates.location = input.location;
  if (input.rtspUrl !== undefined) updates.rtspUrl = input.rtspUrl;
  if (input.status !== undefined) updates.status = input.status;
  if (input.resolution !== undefined) updates.resolution = input.resolution;
  if (input.fps !== undefined) updates.fps = input.fps;
  if (input.aiConfig !== undefined) updates.aiConfig = input.aiConfig;

  const [updated] = await db
    .update(cameras)
    .set(updates)
    .where(and(eq(cameras.id, cameraId), eq(cameras.tenantId, tenantId)))
    .returning();

  if (!updated) return err(Errors.internal("Failed to update camera"));
  return ok(updated);
}

export async function deleteCamera(
  tenantId: string,
  cameraId: string
): Promise<Result<{ deleted: true }>> {
  const db = getDb();

  const existing = await getCamera(tenantId, cameraId);
  if (!existing.ok) return existing;

  await db
    .delete(cameras)
    .where(and(eq(cameras.id, cameraId), eq(cameras.tenantId, tenantId)));

  await publishEvent(Exchanges.EVENTS, "cctv.camera.deleted", {
    cameraId,
  }, tenantId).catch((e) => logger.warn({ err: e }, "Failed to publish camera.deleted event"));

  return ok({ deleted: true as const });
}

// ─── AI Events Service ──────────────────────────────────────

interface ListEventsOpts {
  cameraId?: string;
  eventType?: string;
  minConfidence?: number;
  limit: number;
  offset: number;
}

export async function listEvents(
  tenantId: string,
  opts: ListEventsOpts
): Promise<Result<{ events: typeof aiEvents.$inferSelect[]; total: number }>> {
  const db = getDb();

  const conditions = [eq(aiEvents.tenantId, tenantId)];
  if (opts.cameraId) conditions.push(eq(aiEvents.cameraId, opts.cameraId));
  if (opts.eventType) conditions.push(eq(aiEvents.eventType, opts.eventType));
  if (opts.minConfidence !== undefined) {
    conditions.push(gte(aiEvents.confidence, opts.minConfidence));
  }

  const where = conditions.length === 1 ? conditions[0]! : and(...conditions)!;

  const [events, countResult] = await Promise.all([
    db
      .select()
      .from(aiEvents)
      .where(where)
      .orderBy(desc(aiEvents.createdAt))
      .limit(opts.limit)
      .offset(opts.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiEvents)
      .where(where),
  ]);

  return ok({ events, total: countResult[0]?.count ?? 0 });
}

export async function getEvent(
  tenantId: string,
  eventId: string
): Promise<Result<typeof aiEvents.$inferSelect>> {
  const db = getDb();
  const [event] = await db
    .select()
    .from(aiEvents)
    .where(and(eq(aiEvents.id, BigInt(eventId)), eq(aiEvents.tenantId, tenantId)))
    .limit(1);

  if (!event) return err(Errors.notFound("AI Event", eventId));
  return ok(event);
}

export async function createEvent(
  tenantId: string,
  input: CreateEventInput
): Promise<Result<typeof aiEvents.$inferSelect>> {
  const db = getDb();

  const [event] = await db
    .insert(aiEvents)
    .values({
      tenantId,
      cameraId: input.cameraId,
      eventType: input.eventType,
      confidence: input.confidence,
      boundingBox: input.boundingBox,
      metadata: input.metadata,
      snapshotUrl: input.snapshotUrl,
    })
    .returning();

  if (!event) return err(Errors.internal("Failed to create event"));

  await publishEvent(Exchanges.EVENTS, `cctv.event.${input.eventType}`, {
    eventId: event.id.toString(),
    cameraId: input.cameraId,
    eventType: input.eventType,
    confidence: input.confidence,
  }, tenantId).catch((e) => logger.warn({ err: e }, "Failed to publish AI event"));

  if (input.confidence >= 0.8) {
    await autoCreateAlert(tenantId, event).catch((e) =>
      logger.warn({ err: e }, "Failed to auto-create alert")
    );
  }

  return ok(event);
}

async function autoCreateAlert(
  tenantId: string,
  event: typeof aiEvents.$inferSelect
): Promise<void> {
  const severity =
    event.confidence >= 0.95
      ? "critical"
      : event.confidence >= 0.9
        ? "high"
        : "medium";

  await createAlert(tenantId, {
    cameraId: event.cameraId,
    eventId: event.id.toString(),
    severity,
    alertType: event.eventType,
    title: `AnywareAI: ${event.eventType} detected (${(event.confidence * 100).toFixed(0)}%)`,
    description: `Automatic alert from AnywareAI vision engine. Confidence: ${event.confidence}`,
  });
}

// ─── Alerts Service ─────────────────────────────────────────

interface ListAlertsOpts {
  status?: string;
  severity?: string;
  cameraId?: string;
  limit: number;
  offset: number;
}

export async function listAlerts(
  tenantId: string,
  opts: ListAlertsOpts
): Promise<Result<{ alerts: typeof alerts.$inferSelect[]; total: number }>> {
  const db = getDb();

  const conditions = [eq(alerts.tenantId, tenantId)];
  if (opts.status) conditions.push(eq(alerts.status, opts.status));
  if (opts.severity) conditions.push(eq(alerts.severity, opts.severity));
  if (opts.cameraId) conditions.push(eq(alerts.cameraId, opts.cameraId));

  const where = conditions.length === 1 ? conditions[0]! : and(...conditions)!;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(alerts)
      .where(where)
      .orderBy(desc(alerts.createdAt))
      .limit(opts.limit)
      .offset(opts.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(alerts)
      .where(where),
  ]);

  return ok({ alerts: rows, total: countResult[0]?.count ?? 0 });
}

export async function getAlert(
  tenantId: string,
  alertId: string
): Promise<Result<typeof alerts.$inferSelect>> {
  const db = getDb();
  const [alert] = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.tenantId, tenantId)))
    .limit(1);

  if (!alert) return err(Errors.notFound("Alert", alertId));
  return ok(alert);
}

export async function createAlert(
  tenantId: string,
  input: CreateAlertInput
): Promise<Result<typeof alerts.$inferSelect>> {
  const db = getDb();

  const [alert] = await db
    .insert(alerts)
    .values({
      tenantId,
      severity: input.severity,
      alertType: input.alertType,
      title: input.title,
      description: input.description,
      cameraId: input.cameraId ?? null,
      eventId: input.eventId ? BigInt(input.eventId) : undefined,
    })
    .returning();

  if (!alert) return err(Errors.internal("Failed to create alert"));

  const routingKey =
    input.severity === "critical"
      ? "cctv.alert.critical"
      : "cctv.alert.created";

  await publishEvent(Exchanges.ALERTS, routingKey, {
    alertId: alert.id,
    severity: input.severity,
    title: input.title,
    cameraId: input.cameraId,
  }, tenantId).catch((e) => logger.warn({ err: e }, "Failed to publish alert event"));

  return ok(alert);
}

export async function updateAlert(
  tenantId: string,
  alertId: string,
  input: { status?: string; assignedTo?: string | null }
): Promise<Result<typeof alerts.$inferSelect>> {
  const db = getDb();

  const existing = await getAlert(tenantId, alertId);
  if (!existing.ok) return existing;

  const updates: Record<string, unknown> = {};
  if (input.status !== undefined) {
    updates.status = input.status;
    if (input.status === "resolved") updates.resolvedAt = new Date();
  }
  if (input.assignedTo !== undefined) updates.assignedTo = input.assignedTo;

  const [updated] = await db
    .update(alerts)
    .set(updates)
    .where(and(eq(alerts.id, alertId), eq(alerts.tenantId, tenantId)))
    .returning();

  if (!updated) return err(Errors.internal("Failed to update alert"));
  return ok(updated);
}

export async function acknowledgeAlert(
  tenantId: string,
  alertId: string,
  userId: string
): Promise<Result<typeof alerts.$inferSelect>> {
  return updateAlert(tenantId, alertId, {
    status: "acknowledged",
    assignedTo: userId,
  });
}

// ─── CUA Sandbox Service ────────────────────────────────────

export async function listSandboxes(
  tenantId: string
): Promise<Result<typeof cuaSandboxes.$inferSelect[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(cuaSandboxes)
    .where(eq(cuaSandboxes.tenantId, tenantId))
    .orderBy(desc(cuaSandboxes.createdAt));
  return ok(rows);
}

export async function provisionSandbox(
  tenantId: string,
  config: Record<string, unknown> = {}
): Promise<Result<typeof cuaSandboxes.$inferSelect>> {
  const db = getDb();

  const sandboxId = crypto.randomUUID();
  const vncPort = 5900 + Math.floor(Math.random() * 1000);
  const novncPort = 6080 + Math.floor(Math.random() * 1000);
  const apiPort = 8000 + Math.floor(Math.random() * 1000);

  const [sandbox] = await db
    .insert(cuaSandboxes)
    .values({
      tenantId,
      containerId: `cua-${sandboxId.slice(0, 8)}`,
      status: "provisioning",
      vncPort,
      novncPort,
      apiPort,
      config,
    })
    .returning();

  if (!sandbox) return err(Errors.internal("Failed to provision sandbox"));

  await publishEvent(Exchanges.COMMANDS, "cua.sandbox.provision", {
    sandboxId: sandbox.id,
    containerId: sandbox.containerId,
    vncPort,
    novncPort,
    apiPort,
    config,
  }, tenantId).catch((e) => logger.warn({ err: e }, "Failed to publish sandbox provision event"));

  // Mark as running (in production, a worker would listen for the provision event)
  await db
    .update(cuaSandboxes)
    .set({ status: "running" })
    .where(eq(cuaSandboxes.id, sandbox.id));

  return ok({ ...sandbox, status: "running" });
}

export async function destroySandbox(
  tenantId: string,
  sandboxId: string
): Promise<Result<{ deleted: true }>> {
  const db = getDb();
  const [sandbox] = await db
    .select()
    .from(cuaSandboxes)
    .where(and(eq(cuaSandboxes.id, sandboxId), eq(cuaSandboxes.tenantId, tenantId)))
    .limit(1);

  if (!sandbox) return err(Errors.notFound("Sandbox", sandboxId));

  await publishEvent(Exchanges.COMMANDS, "cua.sandbox.destroy", {
    sandboxId,
    containerId: sandbox.containerId,
  }, tenantId).catch((e) => logger.warn({ err: e }, "Failed to publish sandbox destroy event"));

  await db
    .delete(cuaSandboxes)
    .where(and(eq(cuaSandboxes.id, sandboxId), eq(cuaSandboxes.tenantId, tenantId)));

  return ok({ deleted: true as const });
}

export async function getSandbox(
  tenantId: string,
  sandboxId: string
): Promise<Result<typeof cuaSandboxes.$inferSelect>> {
  const db = getDb();
  const [sandbox] = await db
    .select()
    .from(cuaSandboxes)
    .where(and(eq(cuaSandboxes.id, sandboxId), eq(cuaSandboxes.tenantId, tenantId)))
    .limit(1);

  if (!sandbox) return err(Errors.notFound("Sandbox", sandboxId));
  return ok(sandbox);
}

// ─── Analytics Service ──────────────────────────────────────

export async function getAnalyticsSummary(
  tenantId: string
): Promise<Result<Record<string, unknown>>> {
  const db = getDb();

  const [cameraCount, eventCount, alertCount, openAlertCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(cameras).where(eq(cameras.tenantId, tenantId)),
    db.select({ count: sql<number>`count(*)::int` }).from(aiEvents).where(eq(aiEvents.tenantId, tenantId)),
    db.select({ count: sql<number>`count(*)::int` }).from(alerts).where(eq(alerts.tenantId, tenantId)),
    db.select({ count: sql<number>`count(*)::int` }).from(alerts).where(and(eq(alerts.tenantId, tenantId), eq(alerts.status, "open"))),
  ]);

  return ok({
    cameras: cameraCount[0]?.count ?? 0,
    totalEvents: eventCount[0]?.count ?? 0,
    totalAlerts: alertCount[0]?.count ?? 0,
    openAlerts: openAlertCount[0]?.count ?? 0,
  });
}
