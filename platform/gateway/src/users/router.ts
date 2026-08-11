import { Router, type Request, type Response } from "express";
import {
  authenticate,
  requireRole,
  type AuthenticatedRequest,
} from "../core/security.js";
import { Errors } from "../core/result.js";
import {
  listUsersSchema,
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
} from "./schemas.js";
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
  getMyProfile,
} from "./service.js";

export const usersRouter = Router();

function authUser(req: Request): AuthenticatedRequest {
  return req as unknown as AuthenticatedRequest;
}

function paramId(req: Request): string {
  return req.params.id as string;
}

usersRouter.use(authenticate);

// ─── Current User ───────────────────────────────────────────

usersRouter.get("/me", async (req: Request, res: Response) => {
  const { user } = authUser(req);
  const result = await getMyProfile(user.tenantId, user.sub);
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

usersRouter.post("/me/password", async (req: Request, res: Response) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const error = Errors.validation(parsed.error.flatten().fieldErrors);
    res.status(error.statusCode).json({ error });
    return;
  }
  const { user } = authUser(req);
  const result = await changePassword(user.tenantId, user.sub, parsed.data);
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }
  res.json({ data: result.data });
});

// ─── User Management (admin+) ───────────────────────────────

usersRouter.get(
  "/",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const parsed = listUsersSchema.safeParse(req.query);
    if (!parsed.success) {
      const error = Errors.validation(parsed.error.flatten().fieldErrors);
      res.status(error.statusCode).json({ error });
      return;
    }
    const { user } = authUser(req);
    const result = await listUsers(user.tenantId, parsed.data);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.json({ data: result.data });
  }
);

usersRouter.get(
  "/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const { user } = authUser(req);
    const result = await getUser(user.tenantId, paramId(req));
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.json({ data: result.data });
  }
);

usersRouter.post(
  "/",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = Errors.validation(parsed.error.flatten().fieldErrors);
      res.status(error.statusCode).json({ error });
      return;
    }
    const { user } = authUser(req);
    const result = await createUser(user.tenantId, parsed.data);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.status(201).json({ data: result.data });
  }
);

usersRouter.patch(
  "/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = Errors.validation(parsed.error.flatten().fieldErrors);
      res.status(error.statusCode).json({ error });
      return;
    }
    const { user } = authUser(req);
    const result = await updateUser(user.tenantId, paramId(req), parsed.data);
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.json({ data: result.data });
  }
);

usersRouter.delete(
  "/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const { user } = authUser(req);
    const result = await deleteUser(user.tenantId, paramId(req));
    if (!result.ok) {
      res.status(result.error.statusCode).json({ error: result.error });
      return;
    }
    res.json({ data: result.data });
  }
);
