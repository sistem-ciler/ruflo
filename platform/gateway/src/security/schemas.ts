import { z } from "zod";

// ─── Security Event Schemas ────────────────────────────────

export const listSecurityEventsSchema = z.object({
  source: z.string().max(100).optional(),
  severity: z.enum(["critical", "high", "medium", "low", "info"]).optional(),
  category: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const ingestSecurityEventSchema = z.object({
  source: z.string().min(1).max(100),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  category: z.string().max(100).optional(),
  ruleId: z.string().max(100).optional(),
  description: z.string().max(5000).optional(),
  rawLog: z.record(z.unknown()).optional(),
  sourceIp: z.string().optional(),
  destinationIp: z.string().optional(),
});
export type IngestSecurityEventInput = z.infer<typeof ingestSecurityEventSchema>;

// ─── Incident Schemas ──────────────────────────────────────

export const listIncidentsSchema = z.object({
  status: z.enum(["open", "investigating", "contained", "resolved", "closed"]).optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createIncidentSchema = z.object({
  title: z.string().min(2).max(255),
  severity: z.enum(["critical", "high", "medium", "low"]),
  attackType: z.string().max(100).optional(),
  affectedAssets: z.array(z.string()).optional(),
  description: z.string().max(5000).optional(),
});
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;

export const updateIncidentSchema = z
  .object({
    status: z.enum(["open", "investigating", "contained", "resolved", "closed"]).optional(),
    severity: z.enum(["critical", "high", "medium", "low"]).optional(),
    attackType: z.string().max(100).optional(),
    affectedAssets: z.array(z.string()).optional(),
    responseActions: z.array(z.string()).optional(),
    assignedTo: z.string().uuid().nullable().optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "At least one field must be provided" }
  );
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;

// ─── IOC Schemas ───────────────────────────────────────────

export const listIocsSchema = z.object({
  iocType: z.enum(["ip", "domain", "hash", "url", "email"]).optional(),
  minScore: z.coerce.number().min(0).max(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createIocSchema = z.object({
  iocType: z.enum(["ip", "domain", "hash", "url", "email"]),
  value: z.string().min(1).max(2048),
  source: z.string().max(100).optional(),
  threatScore: z.number().min(0).max(1).optional(),
  tags: z.array(z.string().max(50)).optional(),
  expiresAt: z.string().datetime().optional(),
});
export type CreateIocInput = z.infer<typeof createIocSchema>;

// ─── Response Schemas ──────────────────────────────────────

export const executeResponseSchema = z.object({
  playbookId: z.string().min(1).max(100),
  incidentId: z.string().uuid().optional(),
  parameters: z.record(z.unknown()).optional(),
});
export type ExecuteResponseInput = z.infer<typeof executeResponseSchema>;
