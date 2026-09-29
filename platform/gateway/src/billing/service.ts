import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "../core/database.js";
import { plans, subscriptions, tenants } from "../core/schema.js";
import { ok, err, Errors, type Result } from "../core/result.js";
import { publishEvent, Exchanges } from "../core/rabbitmq.js";
import { logger } from "../core/logger.js";
import type { SubscribeInput } from "./schemas.js";

// ─── Plans ──────────────────────────────────────────────────

export async function listPlans(
  product?: string
): Promise<Result<{ plans: typeof plans.$inferSelect[] }>> {
  const db = getDb();

  const conditions = [eq(plans.active, true)];
  if (product) conditions.push(eq(plans.product, product));

  const where = conditions.length === 1 ? conditions[0]! : and(...conditions)!;

  const rows = await db
    .select()
    .from(plans)
    .where(where)
    .orderBy(plans.priceMonthly);

  return ok({ plans: rows });
}

export async function getPlan(
  planId: string
): Promise<Result<typeof plans.$inferSelect>> {
  const db = getDb();
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1);

  if (!plan) return err(Errors.notFound("Plan", planId));
  return ok(plan);
}

// ─── Subscriptions ──────────────────────────────────────────

export async function getSubscription(
  tenantId: string
): Promise<Result<typeof subscriptions.$inferSelect | null>> {
  const db = getDb();
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, "active"))
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  return ok(sub ?? null);
}

export async function subscribe(
  tenantId: string,
  input: SubscribeInput
): Promise<Result<typeof subscriptions.$inferSelect>> {
  const db = getDb();

  const planResult = await getPlan(input.planId);
  if (!planResult.ok) return planResult;

  const existing = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.status, "active")
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return err(
      Errors.conflict(
        "Tenant already has an active subscription. Cancel or change plan instead."
      )
    );
  }

  const now = new Date();
  const periodEnd = new Date(now);
  if (input.billingCycle === "yearly") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const [sub] = await db
    .insert(subscriptions)
    .values({
      tenantId,
      planId: input.planId,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    })
    .returning();

  if (!sub) return err(Errors.internal("Failed to create subscription"));

  await db
    .update(tenants)
    .set({ planId: input.planId, status: "active" })
    .where(eq(tenants.id, tenantId));

  await publishEvent(
    Exchanges.EVENTS,
    "billing.subscription.created",
    {
      subscriptionId: sub.id,
      planId: input.planId,
      planName: planResult.data.name,
      billingCycle: input.billingCycle,
    },
    tenantId
  ).catch((e) => logger.warn({ err: e }, "Failed to publish subscription event"));

  return ok(sub);
}

export async function cancelSubscription(
  tenantId: string
): Promise<Result<typeof subscriptions.$inferSelect>> {
  const db = getDb();

  const [activeSub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, "active"))
    )
    .limit(1);

  if (!activeSub) {
    return err(Errors.notFound("Active subscription"));
  }

  const [cancelled] = await db
    .update(subscriptions)
    .set({ status: "cancelled" })
    .where(eq(subscriptions.id, activeSub.id))
    .returning();

  if (!cancelled) return err(Errors.internal("Failed to cancel subscription"));

  await db
    .update(tenants)
    .set({ status: "cancelled" })
    .where(eq(tenants.id, tenantId));

  await publishEvent(
    Exchanges.EVENTS,
    "billing.subscription.cancelled",
    { subscriptionId: activeSub.id },
    tenantId
  ).catch((e) => logger.warn({ err: e }, "Failed to publish cancellation event"));

  return ok(cancelled);
}

export async function changePlan(
  tenantId: string,
  newPlanId: string
): Promise<Result<typeof subscriptions.$inferSelect>> {
  const db = getDb();

  const planResult = await getPlan(newPlanId);
  if (!planResult.ok) return planResult;

  const [activeSub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, "active"))
    )
    .limit(1);

  if (!activeSub) {
    return err(Errors.notFound("Active subscription"));
  }

  const [updated] = await db
    .update(subscriptions)
    .set({ planId: newPlanId })
    .where(eq(subscriptions.id, activeSub.id))
    .returning();

  if (!updated) return err(Errors.internal("Failed to change plan"));

  await db
    .update(tenants)
    .set({ planId: newPlanId })
    .where(eq(tenants.id, tenantId));

  await publishEvent(
    Exchanges.EVENTS,
    "billing.plan.changed",
    {
      subscriptionId: activeSub.id,
      oldPlanId: activeSub.planId,
      newPlanId,
      newPlanName: planResult.data.name,
    },
    tenantId
  ).catch((e) => logger.warn({ err: e }, "Failed to publish plan change event"));

  return ok(updated);
}

// ─── Usage & Billing Summary ────────────────────────────────

export async function getBillingSummary(
  tenantId: string
): Promise<Result<Record<string, unknown>>> {
  const db = getDb();

  const [activeSub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, "active"))
    )
    .limit(1);

  let plan: typeof plans.$inferSelect | undefined;
  if (activeSub) {
    const [p] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, activeSub.planId))
      .limit(1);
    plan = p;
  }

  const [subCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId));

  return ok({
    currentPlan: plan
      ? {
          id: plan.id,
          name: plan.name,
          product: plan.product,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          features: plan.features,
          limits: plan.limits,
        }
      : null,
    subscription: activeSub
      ? {
          id: activeSub.id,
          status: activeSub.status,
          periodStart: activeSub.currentPeriodStart,
          periodEnd: activeSub.currentPeriodEnd,
        }
      : null,
    totalSubscriptions: subCount?.count ?? 0,
  });
}
