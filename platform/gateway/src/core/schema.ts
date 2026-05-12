import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
  decimal,
  bigserial,
  real,
  inet,
} from "drizzle-orm/pg-core";

// ─── Tenants ────────────────────────────────────────────────

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  planId: uuid("plan_id").references(() => plans.id),
  status: varchar("status", { length: 20 }).default("trial").notNull(),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Users ──────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).default("operator").notNull(),
  permissions: jsonb("permissions").default([]),
  lastLogin: timestamp("last_login", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Plans ──────────────────────────────────────────────────

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  product: varchar("product", { length: 50 }).notNull(),
  priceMonthly: decimal("price_monthly", { precision: 10, scale: 2 }),
  priceYearly: decimal("price_yearly", { precision: 10, scale: 2 }),
  limits: jsonb("limits").notNull(),
  features: jsonb("features").notNull(),
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  active: boolean("active").default(true).notNull(),
});

// ─── Subscriptions ──────────────────────────────────────────

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  planId: uuid("plan_id").notNull().references(() => plans.id),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Cameras (CCTV) ────────────────────────────────────────

export const cameras = pgTable("cameras", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  rtspUrl: text("rtsp_url"),
  status: varchar("status", { length: 20 }).default("offline").notNull(),
  resolution: varchar("resolution", { length: 20 }),
  fps: integer("fps").default(15),
  aiConfig: jsonb("ai_config").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── AI Events (CCTV — high-throughput) ─────────────────────

export const aiEvents = pgTable("ai_events", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  cameraId: uuid("camera_id").notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  confidence: real("confidence").notNull(),
  boundingBox: jsonb("bounding_box"),
  metadata: jsonb("metadata"),
  snapshotUrl: text("snapshot_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Alerts ─────────────────────────────────────────────────

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  eventId: bigserial("event_id", { mode: "bigint" }),
  cameraId: uuid("camera_id"),
  severity: varchar("severity", { length: 20 }).notNull(),
  alertType: varchar("alert_type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).default("open").notNull(),
  assignedTo: uuid("assigned_to"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Known Faces ────────────────────────────────────────────

export const knownFaces = pgTable("known_faces", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 50 }).default("known").notNull(),
  photoUrl: text("photo_url"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── CUA Sandboxes ──────────────────────────────────────────

export const cuaSandboxes = pgTable("cua_sandboxes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  containerId: varchar("container_id", { length: 255 }),
  status: varchar("status", { length: 20 }).default("provisioning").notNull(),
  vncPort: integer("vnc_port"),
  novncPort: integer("novnc_port"),
  apiPort: integer("api_port"),
  config: jsonb("config").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Security Events (Cyber — high-throughput) ──────────────

export const securityEvents = pgTable("security_events", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  source: varchar("source", { length: 100 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull(),
  category: varchar("category", { length: 100 }),
  ruleId: varchar("rule_id", { length: 100 }),
  description: text("description"),
  rawLog: jsonb("raw_log"),
  sourceIp: inet("source_ip"),
  destinationIp: inet("destination_ip"),
  iocMatches: jsonb("ioc_matches"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Incidents (Cyber) ──────────────────────────────────────

export const incidents = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull(),
  status: varchar("status", { length: 30 }).default("open").notNull(),
  attackType: varchar("attack_type", { length: 100 }),
  affectedAssets: jsonb("affected_assets"),
  timeline: jsonb("timeline"),
  responseActions: jsonb("response_actions"),
  assignedTo: uuid("assigned_to"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── IOCs (Threat Intelligence) ─────────────────────────────

export const iocs = pgTable("iocs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  iocType: varchar("ioc_type", { length: 50 }).notNull(),
  value: text("value").notNull(),
  source: varchar("source", { length: 100 }),
  threatScore: real("threat_score"),
  tags: jsonb("tags").default([]),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Audit Log ──────────────────────────────────────────────

export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id"),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resource_type", { length: 50 }),
  resourceId: uuid("resource_id"),
  details: jsonb("details"),
  ipAddress: inet("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Agent Logs ─────────────────────────────────────────────

export const agentLogs = pgTable("agent_logs", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  tenantId: uuid("tenant_id"),
  agentId: varchar("agent_id", { length: 100 }).notNull(),
  agentType: varchar("agent_type", { length: 50 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  traceId: varchar("trace_id", { length: 100 }),
  input: jsonb("input"),
  output: jsonb("output"),
  status: varchar("status", { length: 20 }).notNull(),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
