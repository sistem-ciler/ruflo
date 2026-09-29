import { Router, type Request, type Response } from "express";
import {
  authenticate,
  requireRole,
  type AuthenticatedRequest,
} from "../core/security.js";
import { Errors } from "../core/result.js";
import { subscribeSchema } from "./schemas.js";
import {
  listPlans,
  getPlan,
  getSubscription,
  subscribe,
  cancelSubscription,
  changePlan,
  getBillingSummary,
} from "./service.js";

export const billingRouter = Router();

function authUser(req: Request): AuthenticatedRequest {
  return req as unknown as AuthenticatedRequest;
}

// Plans are public (no auth required)
billingRouter.get("/plans", async (req: Request, res: Response) => {
  const product = typeof req.query.product === "string" ? req.query.product : undefined;
  const result = await listPlans(product);
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

billingRouter.get("/plans/:id", async (req: Request, res: Response) => {
  const result = await getPlan(req.params.id as string);
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

// Everything below requires auth
billingRouter.use(authenticate);

billingRouter.get("/subscription", async (req: Request, res: Response) => {
  const { user } = authUser(req);
  const result = await getSubscription(user.tenantId);
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

billingRouter.post(
  "/subscribe",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = Errors.validation(parsed.error.flatten().fieldErrors);
      res.status(error.statusCode).json({ error });
      return;
    }
    const { user } = authUser(req);
    const result = await subscribe(user.tenantId, parsed.data);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.status(201).json({ data: result.data });
  }
);

billingRouter.post(
  "/cancel",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const { user } = authUser(req);
    const result = await cancelSubscription(user.tenantId);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.json({ data: result.data });
  }
);

billingRouter.patch(
  "/plan",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const planId = (req.body as Record<string, unknown>).planId;
    if (typeof planId !== "string") {
      const error = Errors.validation({ planId: ["planId is required"] });
      res.status(error.statusCode).json({ error });
      return;
    }
    const { user } = authUser(req);
    const result = await changePlan(user.tenantId, planId);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.json({ data: result.data });
  }
);

billingRouter.get("/summary", async (req: Request, res: Response) => {
  const { user } = authUser(req);
  const result = await getBillingSummary(user.tenantId);
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});
