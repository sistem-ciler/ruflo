import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../core/security.js";
import { Errors } from "../core/result.js";
import { getEngineStatus, analyzeFrame } from "./engine.js";
import { getLlmStatus, chat } from "../core/llm.js";
import type { DetectionClass } from "./types.js";
import { createEvent } from "../cctv/service.js";

export const anywareRouter = Router();

function authUser(req: Request): AuthenticatedRequest {
  return req as unknown as AuthenticatedRequest;
}

anywareRouter.use(authenticate);

anywareRouter.get("/status", (_req: Request, res: Response) => {
  res.json({
    data: {
      ...getEngineStatus(),
      llm: getLlmStatus(),
    },
  });
});

const analyzeSchema = z.object({
  cameraId: z.string().uuid(),
  frameData: z.string().min(1),
  enabledClasses: z
    .array(
      z.enum([
        "person",
        "face",
        "vehicle",
        "animal",
        "weapon",
        "fire",
        "smoke",
        "intrusion",
        "loitering",
        "unknown",
      ])
    )
    .optional(),
});

anywareRouter.post("/analyze", async (req: Request, res: Response) => {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    const error = Errors.validation(parsed.error.flatten().fieldErrors);
    res.status(error.statusCode).json({ error });
    return;
  }

  const { user } = authUser(req);
  const analysis = await analyzeFrame(
    parsed.data.cameraId,
    parsed.data.frameData,
    parsed.data.enabledClasses as DetectionClass[] | undefined
  );

  for (const detection of analysis.detections) {
    await createEvent(user.tenantId, {
      cameraId: parsed.data.cameraId,
      eventType: detection.eventType,
      confidence: detection.confidence,
      boundingBox: detection.boundingBox,
      metadata: detection.metadata,
    }).catch(() => {
      // Non-critical: event storage failure shouldn't block response
    });
  }

  res.json({ data: analysis });
});

const describeSituationSchema = z.object({
  cameraId: z.string().uuid(),
  detections: z.array(
    z.object({
      eventType: z.string(),
      confidence: z.number(),
      label: z.string(),
    })
  ),
  context: z.string().max(500).optional(),
});

anywareRouter.post("/describe", async (req: Request, res: Response) => {
  const parsed = describeSituationSchema.safeParse(req.body);
  if (!parsed.success) {
    const error = Errors.validation(parsed.error.flatten().fieldErrors);
    res.status(error.statusCode).json({ error });
    return;
  }

  const { detections, context } = parsed.data;
  const detectionSummary = detections
    .map((d) => `${d.label} (${(d.confidence * 100).toFixed(0)}%)`)
    .join(", ");

  try {
    const result = await chat([
      {
        role: "system",
        content:
          "You are AnywareAI, a professional CCTV security analyst. " +
          "Given detection results from a camera feed, provide a concise " +
          "situation assessment (2-3 sentences) and recommend an action.",
      },
      {
        role: "user",
        content:
          `Detections: ${detectionSummary}` +
          (context ? `\nOperator context: ${context}` : ""),
      },
    ]);
    res.json({
      data: {
        description: result.content,
        model: result.model,
        provider: result.provider,
        usage: result.usage,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "LLM call failed";
    const error = Errors.internal(msg);
    res.status(error.statusCode).json({ error });
  }
});
