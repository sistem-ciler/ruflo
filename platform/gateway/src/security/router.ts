import { Router, type Request, type Response } from "express";
import {
  authenticate,
  requireRole,
  type AuthenticatedRequest,
} from "../core/security.js";
import { Errors } from "../core/result.js";
import {
  listSecurityEventsSchema,
  ingestSecurityEventSchema,
  listIncidentsSchema,
  createIncidentSchema,
  updateIncidentSchema,
  listIocsSchema,
  createIocSchema,
  executeResponseSchema,
} from "./schemas.js";
import {
  listSecurityEvents,
  ingestSecurityEvent,
  listIncidents,
  getIncident,
  createIncident,
  updateIncident,
  listIocs,
  createIoc,
  getThreatOverview,
  getSecurityTrends,
  listPlaybooks,
  executePlaybook,
} from "./service.js";

export const securityRouter = Router();

function authUser(req: Request): AuthenticatedRequest {
  return req as unknown as AuthenticatedRequest;
}

function paramId(req: Request): string {
  return req.params.id as string;
}

securityRouter.use(authenticate);

// ─── Security Events ────────────────────────────────────────

securityRouter.get("/events", async (req: Request, res: Response) => {
  const parsed = listSecurityEventsSchema.safeParse(req.query);
  if (!parsed.success) {
    const error = Errors.validation(parsed.error.flatten().fieldErrors);
    res.status(error.statusCode).json({ error });
    return;
  }
  const { user } = authUser(req);
  const result = await listSecurityEvents(user.tenantId, parsed.data);
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

securityRouter.get("/events/stream", async (req: Request, res: Response) => {
  const { user } = authUser(req);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const interval = setInterval(async () => {
    const result = await listSecurityEvents(user.tenantId, {
      limit: 10,
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

securityRouter.post(
  "/events",
  requireRole("operator"),
  async (req: Request, res: Response) => {
    const parsed = ingestSecurityEventSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = Errors.validation(parsed.error.flatten().fieldErrors);
      res.status(error.statusCode).json({ error });
      return;
    }
    const { user } = authUser(req);
    const result = await ingestSecurityEvent(user.tenantId, parsed.data);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.status(201).json({ data: result.data });
  }
);

// ─── Incidents ──────────────────────────────────────────────

securityRouter.get("/incidents", async (req: Request, res: Response) => {
  const parsed = listIncidentsSchema.safeParse(req.query);
  if (!parsed.success) {
    const error = Errors.validation(parsed.error.flatten().fieldErrors);
    res.status(error.statusCode).json({ error });
    return;
  }
  const { user } = authUser(req);
  const result = await listIncidents(user.tenantId, parsed.data);
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

securityRouter.get("/incidents/:id", async (req: Request, res: Response) => {
  const { user } = authUser(req);
  const result = await getIncident(user.tenantId, paramId(req));
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

securityRouter.post(
  "/incidents",
  requireRole("operator"),
  async (req: Request, res: Response) => {
    const parsed = createIncidentSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = Errors.validation(parsed.error.flatten().fieldErrors);
      res.status(error.statusCode).json({ error });
      return;
    }
    const { user } = authUser(req);
    const result = await createIncident(user.tenantId, parsed.data);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.status(201).json({ data: result.data });
  }
);

securityRouter.patch(
  "/incidents/:id",
  requireRole("operator"),
  async (req: Request, res: Response) => {
    const parsed = updateIncidentSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = Errors.validation(parsed.error.flatten().fieldErrors);
      res.status(error.statusCode).json({ error });
      return;
    }
    const { user } = authUser(req);
    const result = await updateIncident(user.tenantId, paramId(req), parsed.data);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.json({ data: result.data });
  }
);

// ─── Threat Intelligence ────────────────────────────────────

securityRouter.get("/threats", async (req: Request, res: Response) => {
  const { user } = authUser(req);
  const result = await getThreatOverview(user.tenantId);
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

securityRouter.get("/iocs", async (req: Request, res: Response) => {
  const parsed = listIocsSchema.safeParse(req.query);
  if (!parsed.success) {
    const error = Errors.validation(parsed.error.flatten().fieldErrors);
    res.status(error.statusCode).json({ error });
    return;
  }
  const { user } = authUser(req);
  const result = await listIocs(user.tenantId, parsed.data);
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

securityRouter.post(
  "/iocs",
  requireRole("operator"),
  async (req: Request, res: Response) => {
    const parsed = createIocSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = Errors.validation(parsed.error.flatten().fieldErrors);
      res.status(error.statusCode).json({ error });
      return;
    }
    const { user } = authUser(req);
    const result = await createIoc(user.tenantId, parsed.data);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.status(201).json({ data: result.data });
  }
);

// ─── Analytics ──────────────────────────────────────────────

securityRouter.get(
  "/analytics/dashboard",
  async (req: Request, res: Response) => {
    const { user } = authUser(req);
    const result = await getThreatOverview(user.tenantId);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.json({ data: result.data });
  }
);

securityRouter.get(
  "/analytics/trends",
  async (req: Request, res: Response) => {
    const { user } = authUser(req);
    const result = await getSecurityTrends(user.tenantId);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.json({ data: result.data });
  }
);

// ─── Response Engine ────────────────────────────────────────

securityRouter.get("/response/playbooks", (_req: Request, res: Response) => {
  const result = listPlaybooks();
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

securityRouter.post(
  "/response/execute",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const parsed = executeResponseSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = Errors.validation(parsed.error.flatten().fieldErrors);
      res.status(error.statusCode).json({ error });
      return;
    }
    const { user } = authUser(req);
    const result = await executePlaybook(user.tenantId, parsed.data);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.json({ data: result.data });
  }
);
