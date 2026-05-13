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

const PG_UNIQUE_VIOLATION = "23505";

export async function registerTenant(
  input: RegisterInput
): Promise<Result<AuthTokens>> {
  const db = getDb();
  const passwordHash = await hashPassword(input.password);

  try {
    const result = await db.transaction(async (tx) => {
      const [tenant] = await tx
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

      const [user] = await tx
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
    });

    return result;
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === PG_UNIQUE_VIOLATION
    ) {
      return err(Errors.conflict(`Tenant slug '${input.tenantSlug}' already exists`));
    }
    throw e;
  }
}

export async function login(
  input: LoginInput
): Promise<Result<AuthTokens>> {
  const db = getDb();

  // Resolve tenant by slug
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, input.tenantSlug))
    .limit(1);

  if (!tenant) {
    return err(Errors.unauthorized("Invalid tenant, email, or password"));
  }

  // Find user scoped to the resolved tenant
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
    .where(and(eq(users.email, input.email), eq(users.tenantId, tenant.id)))
    .limit(1);

  if (!user) {
    return err(Errors.unauthorized("Invalid tenant, email, or password"));
  }

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) {
    return err(Errors.unauthorized("Invalid tenant, email, or password"));
  }

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
      tenantName: tenant.name,
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
