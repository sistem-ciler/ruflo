import { Router, type Request, type Response } from "express";
import { registerSchema, loginSchema, refreshSchema } from "./schemas.js";
import { registerTenant, login, refreshTokens } from "./service.js";
import { Errors } from "../core/result.js";
import { logger } from "../core/logger.js";

export const authRouter = Router();

authRouter.post("/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const error = Errors.validation(parsed.error.flatten().fieldErrors);
    res.status(error.statusCode).json({ error });
    return;
  }

  const result = await registerTenant(parsed.data);
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }

  logger.info(
    { tenantId: result.data.user.tenantId, email: result.data.user.email },
    "Tenant registered"
  );

  res.status(201).json({ data: result.data });
});

authRouter.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    const error = Errors.validation(parsed.error.flatten().fieldErrors);
    res.status(error.statusCode).json({ error });
    return;
  }

  const result = await login(parsed.data);
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }

  logger.info({ email: parsed.data.email }, "User logged in");
  res.json({ data: result.data });
});

authRouter.post("/refresh", async (req: Request, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    const error = Errors.validation(parsed.error.flatten().fieldErrors);
    res.status(error.statusCode).json({ error });
    return;
  }

  const result = await refreshTokens(parsed.data.refreshToken);
  if (!result.ok) {
    res.status(result.error.statusCode).json({ error: result.error });
    return;
  }

  res.json({ data: result.data });
});

authRouter.post("/logout", (_req: Request, res: Response) => {
  // Stateless JWT — client discards tokens.
  // For revocation, add token to Redis blacklist (future enhancement).
  res.json({ data: { message: "Logged out" } });
});
