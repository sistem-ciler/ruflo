import { z } from "zod";

// ─── Camera Schemas ─────────────────────────────────────────

export const createCameraSchema = z.object({
  name: z.string().min(2).max(255),
  location: z.string().max(255).optional(),
  rtspUrl: z.string().url().optional(),
  resolution: z.string().max(20).optional(),
  fps: z.number().int().min(1).max(60).optional(),
  aiConfig: z.record(z.unknown()).optional(),
});
export type CreateCameraInput = z.infer<typeof createCameraSchema>;

export const updateCameraSchema = z
  .object({
    name: z.string().min(2).max(255).optional(),
    location: z.string().max(255).optional(),
    rtspUrl: z.string().url().nullable().optional(),
    status: z.enum(["online", "offline", "error"]).optional(),
    resolution: z.string().max(20).optional(),
    fps: z.number().int().min(1).max(60).optional(),
    aiConfig: z.record(z.unknown()).optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "At least one field must be provided" }
  );
export type UpdateCameraInput = z.infer<typeof updateCameraSchema>;

// ─── AI Events Schemas ──────────────────────────────────────

export const listEventsSchema = z.object({
  cameraId: z.string().uuid().optional(),
  eventType: z.string().max(50).optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createEventSchema = z.object({
  cameraId: z.string().uuid(),
  eventType: z.string().min(1).max(50),
  confidence: z.number().min(0).max(1),
  boundingBox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
  snapshotUrl: z.string().url().optional(),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

// ─── Alert Schemas ──────────────────────────────────────────

export const listAlertsSchema = z.object({
  status: z.enum(["open", "acknowledged", "resolved", "false_positive"]).optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  cameraId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const updateAlertSchema = z
  .object({
    status: z.enum(["open", "acknowledged", "resolved", "false_positive"]).optional(),
    assignedTo: z.string().uuid().nullable().optional(),
  })
  .refine(
    (data) => data.status !== undefined || data.assignedTo !== undefined,
    { message: "At least one of 'status' or 'assignedTo' must be provided" }
  );

export const createAlertSchema = z.object({
  cameraId: z.string().uuid().optional(),
  eventId: z.string().optional(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  alertType: z.string().min(1).max(50),
  title: z.string().min(2).max(255),
  description: z.string().max(2000).optional(),
});
export type CreateAlertInput = z.infer<typeof createAlertSchema>;

// ─── Known Faces Schemas ────────────────────────────────────

export const createFaceSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.enum(["known", "vip", "blocklist", "employee"]).default("known"),
  photoUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateFaceInput = z.infer<typeof createFaceSchema>;

export const updateFaceSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    category: z.enum(["known", "vip", "blocklist", "employee"]).optional(),
    photoUrl: z.string().url().nullable().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "At least one field must be provided" }
  );
export type UpdateFaceInput = z.infer<typeof updateFaceSchema>;

// ─── CUA Sandbox Schemas ────────────────────────────────────

export const createSandboxSchema = z.object({
  config: z.record(z.unknown()).optional(),
});
