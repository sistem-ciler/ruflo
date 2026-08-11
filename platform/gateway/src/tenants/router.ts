import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../core/database.js";
import { tenants } from "../core/schema.js";
import {
  authenticate,
  requireRole,
  Roles,
  type AuthenticatedRequest,
} from "../core/security.js";
import { Errors } from "../core/result.js";

const updateTenantSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  settings: z.record(z.unknown()).optional(),
}).refine((data) => data.name !== undefined || data.settings !== undefined, {
  message: "At least one of 'name' or 'settings' must be provided",
});

export const tenantRouter = Router();

tenantRouter.use(authenticate);

tenantRouter.get("/me", async (req: Request, res: Response) => {
  const { user } = req as AuthenticatedRequest;

  const [tenant] = await getDb()
    .select()
    .from(tenants)
    .where(eq(tenants.id, user.tenantId))
    .limit(1);

  if (!tenant) {
    const error = Errors.notFound("Tenant", user.tenantId);
    res.status(error.statusCode).json({ error });
    return;
  }

  res.json({ data: tenant });
});

tenantRouter.patch(
  "/me",
  requireRole(Roles.ADMIN),
  async (req: Request, res: Response) => {
    const parsed = updateTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = Errors.validation(parsed.error.flatten().fieldErrors);
      res.status(error.statusCode).json({ error });
      return;
    }

    const { user } = req as AuthenticatedRequest;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.settings !== undefined) updates.settings = parsed.data.settings;

    const [updated] = await getDb()
      .update(tenants)
      .set(updates)
      .where(eq(tenants.id, user.tenantId))
      .returning();

    if (!updated) {
      const error = Errors.notFound("Tenant", user.tenantId);
      res.status(error.statusCode).json({ error });
      return;
    }

    res.json({ data: updated });
  }
);
