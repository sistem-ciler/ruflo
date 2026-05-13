import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../core/security.js";
import { Errors } from "../core/result.js";
import { getEngineStatus, analyzeFrame } from "./engine.js";
import type { DetectionClass } from "./types.js";
import { createEvent } from "../cctv/service.js";

export const anywareRouter = Router();

function authUser(req: Request): AuthenticatedRequest {
  return req as unknown as AuthenticatedRequest;
}

anywareRouter.use(authenticate);

anywareRouter.get("/status", (_req: Request, res: Response) => {
  res.json({ data: getEngineStatus() });
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
