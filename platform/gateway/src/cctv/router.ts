import { Router, type Request, type Response } from "express";
import {
  authenticate,
  requireRole,
  type AuthenticatedRequest,
} from "../core/security.js";
import { Errors } from "../core/result.js";
import {
  createCameraSchema,
  updateCameraSchema,
  listEventsSchema,
  createEventSchema,
  listAlertsSchema,
  updateAlertSchema,
  createAlertSchema,
  createFaceSchema,
  updateFaceSchema,
  createSandboxSchema,
} from "./schemas.js";
import {
  listCameras,
  getCamera,
  createCamera,
  updateCamera,
  deleteCamera,
  listEvents,
  getEvent,
  createEvent,
  listAlerts,
  getAlert,
  createAlert,
  updateAlert,
  acknowledgeAlert,
  listFaces,
  getFace,
  createFace,
  updateFace,
  deleteFace,
  listSandboxes,
  provisionSandbox,
  destroySandbox,
  getSandbox,
  getAnalyticsSummary,
} from "./service.js";

export const cctvRouter = Router();

function authUser(req: Request): AuthenticatedRequest {
  return req as unknown as AuthenticatedRequest;
}

function paramId(req: Request): string {
  return req.params.id as string;
}

cctvRouter.use(authenticate);

// ─── Cameras ────────────────────────────────────────────────

cctvRouter.get("/cameras", async (req: Request, res: Response) => {
  const { user } = authUser(req);
  const result = await listCameras(user.tenantId);
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

cctvRouter.get("/cameras/:id", async (req: Request, res: Response) => {
  const { user } = authUser(req);
  const result = await getCamera(user.tenantId, paramId(req));
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

cctvRouter.post(
  "/cameras",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const parsed = createCameraSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = Errors.validation(parsed.error.flatten().fieldErrors);
      res.status(error.statusCode).json({ error });
      return;
    }
    const { user } = authUser(req);
    const result = await createCamera(user.tenantId, parsed.data);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.status(201).json({ data: result.data });
  }
);

cctvRouter.patch(
  "/cameras/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const parsed = updateCameraSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = Errors.validation(parsed.error.flatten().fieldErrors);
      res.status(error.statusCode).json({ error });
      return;
    }
    const { user } = authUser(req);
    const result = await updateCamera(user.tenantId, paramId(req), parsed.data);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.json({ data: result.data });
  }
);

cctvRouter.delete(
  "/cameras/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const { user } = authUser(req);
    const result = await deleteCamera(user.tenantId, paramId(req));
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.status(204).end();
  }
);

// ─── AI Events ──────────────────────────────────────────────

cctvRouter.get("/events", async (req: Request, res: Response) => {
  const parsed = listEventsSchema.safeParse(req.query);
  if (!parsed.success) {
    const error = Errors.validation(parsed.error.flatten().fieldErrors);
    res.status(error.statusCode).json({ error });
    return;
  }
  const { user } = authUser(req);
  const result = await listEvents(user.tenantId, parsed.data);
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

cctvRouter.get("/events/:id", async (req: Request, res: Response) => {
  const { user } = authUser(req);
  const result = await getEvent(user.tenantId, paramId(req));
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

cctvRouter.post("/events", async (req: Request, res: Response) => {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    const error = Errors.validation(parsed.error.flatten().fieldErrors);
    res.status(error.statusCode).json({ error });
    return;
  }
  const { user } = authUser(req);
  const result = await createEvent(user.tenantId, parsed.data);
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.status(201).json({ data: result.data });
});

// SSE Event Stream
cctvRouter.get("/events/stream", async (req: Request, res: Response) => {
  const { user } = authUser(req);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const interval = setInterval(async () => {
    const result = await listEvents(user.tenantId, {
      limit: 5,
      offset: 0,
    });
    if (result.ok) {
      res.write(`data: ${JSON.stringify(result.data.events)}\n\n`);
    }
  }, 5000);

  req.on("close", () => {
    clearInterval(interval);
    res.end();
  });
});

// ─── Alerts ─────────────────────────────────────────────────

cctvRouter.get("/alerts", async (req: Request, res: Response) => {
  const parsed = listAlertsSchema.safeParse(req.query);
  if (!parsed.success) {
    const error = Errors.validation(parsed.error.flatten().fieldErrors);
    res.status(error.statusCode).json({ error });
    return;
  }
  const { user } = authUser(req);
  const result = await listAlerts(user.tenantId, parsed.data);
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

cctvRouter.get("/alerts/:id", async (req: Request, res: Response) => {
  const { user } = authUser(req);
  const result = await getAlert(user.tenantId, paramId(req));
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

cctvRouter.post(
  "/alerts",
  requireRole("operator"),
  async (req: Request, res: Response) => {
    const parsed = createAlertSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = Errors.validation(parsed.error.flatten().fieldErrors);
      res.status(error.statusCode).json({ error });
      return;
    }
    const { user } = authUser(req);
    const result = await createAlert(user.tenantId, parsed.data);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.status(201).json({ data: result.data });
  }
);

cctvRouter.patch(
  "/alerts/:id",
  requireRole("operator"),
  async (req: Request, res: Response) => {
    const parsed = updateAlertSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = Errors.validation(parsed.error.flatten().fieldErrors);
      res.status(error.statusCode).json({ error });
      return;
    }
    const { user } = authUser(req);
    const result = await updateAlert(user.tenantId, paramId(req), parsed.data);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.json({ data: result.data });
  }
);

cctvRouter.post(
  "/alerts/:id/ack",
  requireRole("operator"),
  async (req: Request, res: Response) => {
    const { user } = authUser(req);
    const result = await acknowledgeAlert(
      user.tenantId,
      paramId(req),
      user.sub
    );
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.json({ data: result.data });
  }
);

// ─── Known Faces ────────────────────────────────────────────

cctvRouter.get("/faces", async (req: Request, res: Response) => {
  const { user } = authUser(req);
  const result = await listFaces(user.tenantId);
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

cctvRouter.get("/faces/:id", async (req: Request, res: Response) => {
  const { user } = authUser(req);
  const result = await getFace(user.tenantId, paramId(req));
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

cctvRouter.post(
  "/faces",
  requireRole("operator"),
  async (req: Request, res: Response) => {
    const parsed = createFaceSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = Errors.validation(parsed.error.flatten().fieldErrors);
      res.status(error.statusCode).json({ error });
      return;
    }
    const { user } = authUser(req);
    const result = await createFace(user.tenantId, parsed.data);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.status(201).json({ data: result.data });
  }
);

cctvRouter.patch(
  "/faces/:id",
  requireRole("operator"),
  async (req: Request, res: Response) => {
    const parsed = updateFaceSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = Errors.validation(parsed.error.flatten().fieldErrors);
      res.status(error.statusCode).json({ error });
      return;
    }
    const { user } = authUser(req);
    const result = await updateFace(user.tenantId, paramId(req), parsed.data);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.json({ data: result.data });
  }
);

cctvRouter.delete(
  "/faces/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const { user } = authUser(req);
    const result = await deleteFace(user.tenantId, paramId(req));
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.status(204).end();
  }
);

// ─── CUA Sandboxes ──────────────────────────────────────────

cctvRouter.get("/sandboxes", async (req: Request, res: Response) => {
  const { user } = authUser(req);
  const result = await listSandboxes(user.tenantId);
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

cctvRouter.post(
  "/sandboxes",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const parsed = createSandboxSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = Errors.validation(parsed.error.flatten().fieldErrors);
      res.status(error.statusCode).json({ error });
      return;
    }
    const { user } = authUser(req);
    const result = await provisionSandbox(user.tenantId, parsed.data.config);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.status(201).json({ data: result.data });
  }
);

cctvRouter.delete(
  "/sandboxes/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const { user } = authUser(req);
    const result = await destroySandbox(user.tenantId, paramId(req));
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.status(204).end();
  }
);

cctvRouter.get("/sandboxes/:id", async (req: Request, res: Response) => {
  const { user } = authUser(req);
  const result = await getSandbox(user.tenantId, paramId(req));
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

cctvRouter.get("/sandboxes/:id/vnc", async (req: Request, res: Response) => {
  const { user } = authUser(req);
  const result = await getSandbox(user.tenantId, paramId(req));
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  const sandbox = result.data;
  res.json({
    data: {
      vncUrl: `vnc://localhost:${sandbox.vncPort}`,
      novncUrl: `http://localhost:${sandbox.novncPort}/vnc.html`,
      apiUrl: `http://localhost:${sandbox.apiPort}`,
    },
  });
});

// ─── Analytics ──────────────────────────────────────────────

cctvRouter.get(
  "/analytics/summary",
  async (req: Request, res: Response) => {
    const { user } = authUser(req);
    const result = await getAnalyticsSummary(user.tenantId);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.json({ data: result.data });
  }
);
