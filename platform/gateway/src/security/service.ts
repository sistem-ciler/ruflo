import { eq, and, desc, gte, sql } from "drizzle-orm";
import { getDb } from "../core/database.js";
import { securityEvents, incidents, iocs } from "../core/schema.js";
import { ok, err, Errors, type Result } from "../core/result.js";
import { publishEvent, Exchanges } from "../core/rabbitmq.js";
import { logger } from "../core/logger.js";
import type {
  IngestSecurityEventInput,
  CreateIncidentInput,
  UpdateIncidentInput,
  CreateIocInput,
  ExecuteResponseInput,
} from "./schemas.js";

// ─── Security Events Service ────────────────────────────────

interface ListSecurityEventsOpts {
  source?: string;
  severity?: string;
  category?: string;
  limit: number;
  offset: number;
}

export async function listSecurityEvents(
  tenantId: string,
  opts: ListSecurityEventsOpts
): Promise<Result<{ events: typeof securityEvents.$inferSelect[]; total: number }>> {
  const db = getDb();

  const conditions = [eq(securityEvents.tenantId, tenantId)];
  if (opts.source) conditions.push(eq(securityEvents.source, opts.source));
  if (opts.severity) conditions.push(eq(securityEvents.severity, opts.severity));
  if (opts.category) conditions.push(eq(securityEvents.category, opts.category));

  const where = conditions.length === 1 ? conditions[0]! : and(...conditions)!;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(securityEvents)
      .where(where)
      .orderBy(desc(securityEvents.createdAt))
      .limit(opts.limit)
      .offset(opts.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(securityEvents)
      .where(where),
  ]);

  return ok({ events: rows, total: countResult[0]?.count ?? 0 });
}

export async function ingestSecurityEvent(
  tenantId: string,
  input: IngestSecurityEventInput
): Promise<Result<typeof securityEvents.$inferSelect>> {
  const db = getDb();

  const [event] = await db
    .insert(securityEvents)
    .values({
      tenantId,
      source: input.source,
      severity: input.severity,
      category: input.category,
      ruleId: input.ruleId,
      description: input.description,
      rawLog: input.rawLog,
      sourceIp: input.sourceIp,
      destinationIp: input.destinationIp,
    })
    .returning();

  if (!event) return err(Errors.internal("Failed to ingest security event"));

  await publishEvent(
    Exchanges.EVENTS,
    `security.event.${input.severity}`,
    {
      eventId: event.id.toString(),
      source: input.source,
      severity: input.severity,
      category: input.category,
    },
    tenantId
  ).catch((e) => logger.warn({ err: e }, "Failed to publish security event"));

  if (input.severity === "critical" || input.severity === "high") {
    await autoCreateIncident(tenantId, event).catch((e) =>
      logger.warn({ err: e }, "Failed to auto-create incident from security event")
    );
  }

  return ok(event);
}

async function autoCreateIncident(
  tenantId: string,
  event: typeof securityEvents.$inferSelect
): Promise<void> {
  await createIncident(tenantId, {
    title: `Auto: ${event.source} — ${event.severity} event (${event.category ?? "uncategorized"})`,
    severity: event.severity as "critical" | "high" | "medium" | "low",
    attackType: event.category ?? undefined,
    description: event.description ?? `Automatically created from security event ${event.id}`,
  });
}

// ─── Incident Service ──────────────────────────────────────

interface ListIncidentsOpts {
  status?: string;
  severity?: string;
  limit: number;
  offset: number;
}

export async function listIncidents(
  tenantId: string,
  opts: ListIncidentsOpts
): Promise<Result<{ incidents: typeof incidents.$inferSelect[]; total: number }>> {
  const db = getDb();

  const conditions = [eq(incidents.tenantId, tenantId)];
  if (opts.status) conditions.push(eq(incidents.status, opts.status));
  if (opts.severity) conditions.push(eq(incidents.severity, opts.severity));

  const where = conditions.length === 1 ? conditions[0]! : and(...conditions)!;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(incidents)
      .where(where)
      .orderBy(desc(incidents.createdAt))
      .limit(opts.limit)
      .offset(opts.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(incidents)
      .where(where),
  ]);

  return ok({ incidents: rows, total: countResult[0]?.count ?? 0 });
}

export async function getIncident(
  tenantId: string,
  incidentId: string
): Promise<Result<typeof incidents.$inferSelect>> {
  const db = getDb();
  const [incident] = await db
    .select()
    .from(incidents)
    .where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, tenantId)))
    .limit(1);

  if (!incident) return err(Errors.notFound("Incident", incidentId));
  return ok(incident);
}

export async function createIncident(
  tenantId: string,
  input: CreateIncidentInput
): Promise<Result<typeof incidents.$inferSelect>> {
  const db = getDb();

  const [incident] = await db
    .insert(incidents)
    .values({
      tenantId,
      title: input.title,
      severity: input.severity,
      attackType: input.attackType,
      affectedAssets: input.affectedAssets,
      timeline: [
        {
          timestamp: new Date().toISOString(),
          action: "created",
          details: input.description ?? "Incident created",
        },
      ],
    })
    .returning();

  if (!incident) return err(Errors.internal("Failed to create incident"));

  const routingKey =
    input.severity === "critical"
      ? "security.incident.critical"
      : "security.incident.created";

  await publishEvent(
    Exchanges.ALERTS,
    routingKey,
    {
      incidentId: incident.id,
      severity: input.severity,
      title: input.title,
    },
    tenantId
  ).catch((e) => logger.warn({ err: e }, "Failed to publish incident event"));

  return ok(incident);
}

export async function updateIncident(
  tenantId: string,
  incidentId: string,
  input: UpdateIncidentInput
): Promise<Result<typeof incidents.$inferSelect>> {
  const db = getDb();

  const existing = await getIncident(tenantId, incidentId);
  if (!existing.ok) return existing;

  const updates: Record<string, unknown> = {};
  if (input.status !== undefined) {
    updates.status = input.status;
    if (input.status === "resolved" || input.status === "closed") {
      updates.resolvedAt = new Date();
    }

    const currentTimeline = (existing.data.timeline as Array<Record<string, unknown>>) ?? [];
    updates.timeline = [
      ...currentTimeline,
      {
        timestamp: new Date().toISOString(),
        action: `status_changed_to_${input.status}`,
        details: `Status updated to ${input.status}`,
      },
    ];
  }
  if (input.severity !== undefined) updates.severity = input.severity;
  if (input.attackType !== undefined) updates.attackType = input.attackType;
  if (input.affectedAssets !== undefined) updates.affectedAssets = input.affectedAssets;
  if (input.responseActions !== undefined) updates.responseActions = input.responseActions;
  if (input.assignedTo !== undefined) updates.assignedTo = input.assignedTo;

  const [updated] = await db
    .update(incidents)
    .set(updates)
    .where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, tenantId)))
    .returning();

  if (!updated) return err(Errors.internal("Failed to update incident"));
  return ok(updated);
}

// ─── IOC Service ───────────────────────────────────────────

interface ListIocsOpts {
  iocType?: string;
  minScore?: number;
  limit: number;
  offset: number;
}

export async function listIocs(
  tenantId: string,
  opts: ListIocsOpts
): Promise<Result<{ iocs: typeof iocs.$inferSelect[]; total: number }>> {
  const db = getDb();

  const conditions = [
    sql`(${iocs.tenantId} = ${tenantId} OR ${iocs.tenantId} IS NULL)`,
  ];
  if (opts.iocType) conditions.push(eq(iocs.iocType, opts.iocType));
  if (opts.minScore !== undefined) conditions.push(gte(iocs.threatScore, opts.minScore));

  const where = conditions.length === 1 ? conditions[0]! : and(...conditions)!;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(iocs)
      .where(where)
      .orderBy(desc(iocs.createdAt))
      .limit(opts.limit)
      .offset(opts.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(iocs)
      .where(where),
  ]);

  return ok({ iocs: rows, total: countResult[0]?.count ?? 0 });
}

export async function createIoc(
  tenantId: string,
  input: CreateIocInput
): Promise<Result<typeof iocs.$inferSelect>> {
  const db = getDb();

  const [ioc] = await db
    .insert(iocs)
    .values({
      tenantId,
      iocType: input.iocType,
      value: input.value,
      source: input.source,
      threatScore: input.threatScore,
      tags: input.tags ?? [],
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    })
    .returning();

  if (!ioc) return err(Errors.internal("Failed to create IOC"));

  await publishEvent(
    Exchanges.EVENTS,
    "security.ioc.created",
    {
      iocId: ioc.id,
      iocType: input.iocType,
      value: input.value,
      threatScore: input.threatScore,
    },
    tenantId
  ).catch((e) => logger.warn({ err: e }, "Failed to publish IOC event"));

  return ok(ioc);
}

// ─── Threat Intelligence Service ────────────────────────────

export async function getThreatOverview(
  tenantId: string
): Promise<Result<Record<string, unknown>>> {
  const db = getDb();

  const [
    totalEventsResult,
    criticalEventsResult,
    openIncidentsResult,
    iocCountResult,
    recentEventsResult,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(securityEvents)
      .where(eq(securityEvents.tenantId, tenantId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(securityEvents)
      .where(
        and(
          eq(securityEvents.tenantId, tenantId),
          eq(securityEvents.severity, "critical")
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(incidents)
      .where(
        and(
          eq(incidents.tenantId, tenantId),
          eq(incidents.status, "open")
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(iocs)
      .where(
        sql`(${iocs.tenantId} = ${tenantId} OR ${iocs.tenantId} IS NULL)`
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(securityEvents)
      .where(
        and(
          eq(securityEvents.tenantId, tenantId),
          gte(securityEvents.createdAt, sql`NOW() - INTERVAL '24 hours'`)
        )
      ),
  ]);

  return ok({
    totalEvents: totalEventsResult[0]?.count ?? 0,
    criticalEvents: criticalEventsResult[0]?.count ?? 0,
    openIncidents: openIncidentsResult[0]?.count ?? 0,
    totalIocs: iocCountResult[0]?.count ?? 0,
    eventsLast24h: recentEventsResult[0]?.count ?? 0,
  });
}

export async function getSecurityTrends(
  tenantId: string
): Promise<Result<Record<string, unknown>>> {
  const db = getDb();

  const severityBreakdown = await db
    .select({
      severity: securityEvents.severity,
      count: sql<number>`count(*)::int`,
    })
    .from(securityEvents)
    .where(eq(securityEvents.tenantId, tenantId))
    .groupBy(securityEvents.severity);

  const sourceBreakdown = await db
    .select({
      source: securityEvents.source,
      count: sql<number>`count(*)::int`,
    })
    .from(securityEvents)
    .where(eq(securityEvents.tenantId, tenantId))
    .groupBy(securityEvents.source)
    .orderBy(sql`count(*) DESC`)
    .limit(10);

  const dailyTrend = await db
    .select({
      day: sql<string>`date_trunc('day', ${securityEvents.createdAt})::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(securityEvents)
    .where(
      and(
        eq(securityEvents.tenantId, tenantId),
        gte(securityEvents.createdAt, sql`NOW() - INTERVAL '30 days'`)
      )
    )
    .groupBy(sql`date_trunc('day', ${securityEvents.createdAt})`)
    .orderBy(sql`date_trunc('day', ${securityEvents.createdAt})`);

  return ok({
    bySeverity: severityBreakdown,
    bySource: sourceBreakdown,
    daily: dailyTrend,
  });
}

// ─── Response Engine Service ────────────────────────────────

interface Playbook {
  id: string;
  name: string;
  description: string;
  actions: string[];
  severity: string[];
}

const PLAYBOOKS: Playbook[] = [
  {
    id: "block-ip",
    name: "Block IP Address",
    description: "Add IP to firewall blocklist and notify SOC",
    actions: ["firewall_block", "soc_notify", "log_action"],
    severity: ["critical", "high"],
  },
  {
    id: "isolate-host",
    name: "Isolate Host",
    description: "Network-isolate compromised host and capture forensic snapshot",
    actions: ["network_isolate", "forensic_snapshot", "soc_notify", "log_action"],
    severity: ["critical"],
  },
  {
    id: "quarantine-file",
    name: "Quarantine File",
    description: "Move suspicious file to quarantine and scan with multiple engines",
    actions: ["file_quarantine", "multi_scan", "log_action"],
    severity: ["critical", "high", "medium"],
  },
  {
    id: "reset-credentials",
    name: "Reset Credentials",
    description: "Force password reset and revoke active sessions",
    actions: ["password_reset", "session_revoke", "mfa_enforce", "log_action"],
    severity: ["critical", "high"],
  },
  {
    id: "notify-only",
    name: "Notify & Monitor",
    description: "Send alert to SOC team and increase monitoring level",
    actions: ["soc_notify", "increase_monitoring", "log_action"],
    severity: ["high", "medium", "low"],
  },
];

export function listPlaybooks(): Result<Playbook[]> {
  return ok(PLAYBOOKS);
}

export async function executePlaybook(
  tenantId: string,
  input: ExecuteResponseInput
): Promise<Result<Record<string, unknown>>> {
  const playbook = PLAYBOOKS.find((p) => p.id === input.playbookId);
  if (!playbook) return err(Errors.notFound("Playbook", input.playbookId));

  const executionId = crypto.randomUUID();
  const results: Array<{ action: string; status: string; timestamp: string }> = [];

  for (const action of playbook.actions) {
    results.push({
      action,
      status: "executed",
      timestamp: new Date().toISOString(),
    });
  }

  await publishEvent(
    Exchanges.COMMANDS,
    "security.response.executed",
    {
      executionId,
      playbookId: input.playbookId,
      incidentId: input.incidentId,
      actions: results,
    },
    tenantId
  ).catch((e) => logger.warn({ err: e }, "Failed to publish response execution event"));

  if (input.incidentId) {
    await updateIncident(tenantId, input.incidentId, {
      responseActions: results.map((r) => r.action),
    }).catch((e) => logger.warn({ err: e }, "Failed to update incident with response actions"));
  }

  logger.info(
    { executionId, playbookId: input.playbookId, tenantId },
    "Playbook executed"
  );

  return ok({
    executionId,
    playbook: playbook.name,
    actions: results,
    status: "completed",
  });
}
