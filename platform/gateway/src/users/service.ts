import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../core/database.js";
import { users } from "../core/schema.js";
import { ok, err, Errors, type Result } from "../core/result.js";
import { hashPassword, comparePassword } from "../core/security.js";
import { publishEvent, Exchanges } from "../core/rabbitmq.js";
import { logger } from "../core/logger.js";
import type {
  CreateUserInput,
  UpdateUserInput,
  ChangePasswordInput,
} from "./schemas.js";

const PG_UNIQUE_VIOLATION = "23505";

interface SafeUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  permissions: unknown;
  lastLogin: Date | null;
  createdAt: Date;
}

function toSafeUser(row: typeof users.$inferSelect): SafeUser {
  return {
    id: row.id,
    tenantId: row.tenantId,
    email: row.email,
    name: row.name,
    role: row.role,
    permissions: row.permissions,
    lastLogin: row.lastLogin,
    createdAt: row.createdAt,
  };
}

// ─── List Users ─────────────────────────────────────────────

interface ListUsersOpts {
  role?: string;
  limit: number;
  offset: number;
}

export async function listUsers(
  tenantId: string,
  opts: ListUsersOpts
): Promise<Result<{ users: SafeUser[]; total: number }>> {
  const db = getDb();

  const conditions = [eq(users.tenantId, tenantId)];
  if (opts.role) conditions.push(eq(users.role, opts.role));

  const where = conditions.length === 1 ? conditions[0]! : and(...conditions)!;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(opts.limit)
      .offset(opts.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(where),
  ]);

  return ok({
    users: rows.map(toSafeUser),
    total: countResult[0]?.count ?? 0,
  });
}

// ─── Get User ───────────────────────────────────────────────

export async function getUser(
  tenantId: string,
  userId: string
): Promise<Result<SafeUser>> {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);

  if (!user) return err(Errors.notFound("User", userId));
  return ok(toSafeUser(user));
}

// ─── Create User ────────────────────────────────────────────

export async function createUser(
  tenantId: string,
  input: CreateUserInput
): Promise<Result<SafeUser>> {
  const db = getDb();
  const passwordHash = await hashPassword(input.password);

  try {
    const [user] = await db
      .insert(users)
      .values({
        tenantId,
        email: input.email,
        passwordHash,
        name: input.name,
        role: input.role,
      })
      .returning();

    if (!user) return err(Errors.internal("Failed to create user"));

    await publishEvent(
      Exchanges.EVENTS,
      "users.created",
      { userId: user.id, email: user.email, role: user.role },
      tenantId
    ).catch((e) => logger.warn({ err: e }, "Failed to publish user created event"));

    return ok(toSafeUser(user));
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === PG_UNIQUE_VIOLATION
    ) {
      return err(Errors.conflict(`User with email '${input.email}' already exists`));
    }
    throw e;
  }
}

// ─── Update User ────────────────────────────────────────────

export async function updateUser(
  tenantId: string,
  userId: string,
  input: UpdateUserInput
): Promise<Result<SafeUser>> {
  const db = getDb();

  const existing = await getUser(tenantId, userId);
  if (!existing.ok) return existing;

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.role !== undefined) updates.role = input.role;
  if (input.permissions !== undefined) updates.permissions = input.permissions;

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .returning();

  if (!updated) return err(Errors.internal("Failed to update user"));
  return ok(toSafeUser(updated));
}

// ─── Delete User ────────────────────────────────────────────

export async function deleteUser(
  tenantId: string,
  userId: string
): Promise<Result<{ deleted: true }>> {
  const db = getDb();

  const existing = await getUser(tenantId, userId);
  if (!existing.ok) return existing;

  if (existing.data.role === "owner") {
    return err(Errors.forbidden("Cannot delete the tenant owner"));
  }

  await db
    .delete(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));

  await publishEvent(
    Exchanges.EVENTS,
    "users.deleted",
    { userId, email: existing.data.email },
    tenantId
  ).catch((e) => logger.warn({ err: e }, "Failed to publish user deleted event"));

  return ok({ deleted: true });
}

// ─── Change Password ────────────────────────────────────────

export async function changePassword(
  tenantId: string,
  userId: string,
  input: ChangePasswordInput
): Promise<Result<{ updated: true }>> {
  const db = getDb();

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);

  if (!user) return err(Errors.notFound("User", userId));

  const valid = await comparePassword(input.currentPassword, user.passwordHash);
  if (!valid) return err(Errors.unauthorized("Current password is incorrect"));

  const newHash = await hashPassword(input.newPassword);
  await db
    .update(users)
    .set({ passwordHash: newHash })
    .where(eq(users.id, userId));

  return ok({ updated: true });
}

// ─── Get My Profile ─────────────────────────────────────────

export async function getMyProfile(
  tenantId: string,
  userId: string
): Promise<Result<SafeUser>> {
  return getUser(tenantId, userId);
}
