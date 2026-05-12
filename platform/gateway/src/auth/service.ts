import { eq, and } from "drizzle-orm";
import { getDb } from "../core/database.js";
import { tenants, users } from "../core/schema.js";
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
  verifyToken,
  Roles,
  type Role,
} from "../core/security.js";
import { ok, err, Errors, type Result, type AppError } from "../core/result.js";
import type { RegisterInput, LoginInput } from "./schemas.js";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    tenantId: string;
    tenantName: string;
  };
}

export async function registerTenant(
  input: RegisterInput
): Promise<Result<AuthTokens>> {
  const db = getDb();

  // Check slug uniqueness
  const existing = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, input.tenantSlug))
    .limit(1);

  if (existing.length > 0) {
    return err(Errors.conflict(`Tenant slug '${input.tenantSlug}' already exists`));
  }

  // Create tenant
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: input.tenantName,
      slug: input.tenantSlug,
      status: "trial",
    })
    .returning();

  if (!tenant) {
    return err(Errors.internal("Failed to create tenant"));
  }

  // Create admin user
  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      email: input.email,
      passwordHash,
      name: input.name,
      role: Roles.OWNER,
    })
    .returning();

  if (!user) {
    return err(Errors.internal("Failed to create user"));
  }

  const tokenPayload = {
    sub: user.id,
    tenantId: tenant.id,
    role: user.role as Role,
    email: user.email,
  };

  return ok({
    accessToken: signAccessToken(tokenPayload),
    refreshToken: signRefreshToken(tokenPayload),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      tenantId: tenant.id,
      tenantName: tenant.name,
    },
  });
}

export async function login(
  input: LoginInput
): Promise<Result<AuthTokens>> {
  const db = getDb();

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      passwordHash: users.passwordHash,
      role: users.role,
      tenantId: users.tenantId,
    })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (!user) {
    return err(Errors.unauthorized("Invalid email or password"));
  }

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) {
    return err(Errors.unauthorized("Invalid email or password"));
  }

  // Get tenant name
  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, user.tenantId))
    .limit(1);

  // Update last login
  await db
    .update(users)
    .set({ lastLogin: new Date() })
    .where(eq(users.id, user.id));

  const tokenPayload = {
    sub: user.id,
    tenantId: user.tenantId,
    role: user.role as Role,
    email: user.email,
  };

  return ok({
    accessToken: signAccessToken(tokenPayload),
    refreshToken: signRefreshToken(tokenPayload),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      tenantId: user.tenantId,
      tenantName: tenant?.name ?? "",
    },
  });
}

export async function refreshTokens(
  refreshToken: string
): Promise<Result<{ accessToken: string; refreshToken: string }>> {
  try {
    const payload = verifyToken(refreshToken);
    if (payload.type !== "refresh") {
      return err(Errors.unauthorized("Invalid token type"));
    }

    const tokenPayload = {
      sub: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      email: payload.email,
    };

    return ok({
      accessToken: signAccessToken(tokenPayload),
      refreshToken: signRefreshToken(tokenPayload),
    });
  } catch {
    return err(Errors.unauthorized("Invalid or expired refresh token"));
  }
}
