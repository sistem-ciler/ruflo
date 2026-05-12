import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "../core/database.js";
import { tenants } from "../core/schema.js";
import {
  authenticate,
  requireRole,
  Roles,
  type AuthenticatedRequest,
} from "../core/security.js";
import { Errors } from "../core/result.js";

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
    const { user } = req as AuthenticatedRequest;

    const [updated] = await getDb()
      .update(tenants)
      .set({
        name: req.body.name,
        settings: req.body.settings,
        updatedAt: new Date(),
      })
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
