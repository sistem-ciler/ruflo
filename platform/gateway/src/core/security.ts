import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { getConfig } from "./config.js";
import { Errors } from "./result.js";

// --- Branded IDs ---
export type TenantId = string & { readonly __brand: "TenantId" };
export type UserId = string & { readonly __brand: "UserId" };

export function tenantId(id: string): TenantId {
  return id as TenantId;
}

export function userId(id: string): UserId {
  return id as UserId;
}

// --- Roles ---
export const Roles = {
  OWNER: "owner",
  ADMIN: "admin",
  OPERATOR: "operator",
  VIEWER: "viewer",
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

const roleHierarchy: Record<Role, number> = {
  owner: 4,
  admin: 3,
  operator: 2,
  viewer: 1,
};

export function hasMinRole(userRole: Role, requiredRole: Role): boolean {
  return (roleHierarchy[userRole] ?? 0) >= (roleHierarchy[requiredRole] ?? 0);
}

// --- JWT ---
export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: Role;
  email: string;
  type: "access" | "refresh";
}

export function signAccessToken(payload: Omit<JwtPayload, "type">): string {
  const config = getConfig();
  return jwt.sign({ ...payload, type: "access" }, config.JWT_SECRET, {
    expiresIn: config.JWT_ACCESS_TTL as string & jwt.SignOptions["expiresIn"],
    algorithm: "HS256",
  });
}

export function signRefreshToken(payload: Omit<JwtPayload, "type">): string {
  const config = getConfig();
  return jwt.sign({ ...payload, type: "refresh" }, config.JWT_SECRET, {
    expiresIn: config.JWT_REFRESH_TTL as string & jwt.SignOptions["expiresIn"],
    algorithm: "HS256",
  });
}

export function verifyToken(token: string): JwtPayload {
  const config = getConfig();
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
}

// --- Password hashing ---
const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// --- Trace ID ---
export function getTraceId(req: Request): string {
  const existing = req.headers["x-trace-id"];
  if (typeof existing === "string" && existing.length > 0) {
    return existing;
  }
  return uuidv4();
}

// --- Express Middleware ---

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
  traceId: string;
}

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const traceId = getTraceId(req);
  (req as AuthenticatedRequest).traceId = traceId;
  res.setHeader("X-Trace-Id", traceId);

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    const error = Errors.unauthorized();
    res.status(error.statusCode).json({ error });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload.type !== "access") {
      const error = Errors.unauthorized("Invalid token type");
      res.status(error.statusCode).json({ error });
      return;
    }
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch {
    const error = Errors.unauthorized("Invalid or expired token");
    res.status(error.statusCode).json({ error });
  }
}

export function requireRole(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      const error = Errors.unauthorized();
      res.status(error.statusCode).json({ error });
      return;
    }
    if (!hasMinRole(authReq.user.role as Role, minRole)) {
      const error = Errors.forbidden(
        `Role '${minRole}' or higher required`
      );
      res.status(error.statusCode).json({ error });
      return;
    }
    next();
  };
}

export function traceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const traceId = getTraceId(req);
  (req as AuthenticatedRequest).traceId = traceId;
  res.setHeader("X-Trace-Id", traceId);
  next();
}
