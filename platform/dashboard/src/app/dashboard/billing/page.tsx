"use client";

import { useState } from "react";
import { CreditCard, Check, ArrowRight, Loader2, Star } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { clsx } from "clsx";

interface Plan {
  id: string;
  name: string;
  product: string;
  priceMonthly: string;
  priceYearly: string;
  features: string[];
  limits: Record<string, number>;
}

interface Subscription {
  id: string;
  planId: string;
  status: string;
  billingCycle: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

interface BillingSummary {
  activePlan: Plan | null;
  subscription: Subscription | null;
  status: string | null;
}

function formatFeature(f: string): string {
  return f.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const productLabels: Record<string, string> = {
  cctv: "CCTV",
  cybersecurity: "Cybersecurity",
  bundle: "Bundle",
};

export default function BillingPage() {
  const { token } = useAuth();
  const [subscribing, setSubscribing] = useState<string | null>(null);

  const billing = useApi<BillingSummary>("/api/v1/billing/summary");
  const plansApi = useApi<{ plans: Plan[] }>("/api/v1/billing/plans");

  const plans = plansApi.data?.plans ?? [];
  const grouped = plans.reduce<Record<string, Plan[]>>((acc, p) => {
    (acc[p.product] ??= []).push(p);
    return acc;
  }, {});

  async function subscribe(planId: string, cycle: "monthly" | "yearly") {
    if (!token) return;
    setSubscribing(planId);
    try {
      await api.post("/api/v1/billing/subscribe", { planId, billingCycle: cycle }, token);
      billing.refetch();
    } finally {
      setSubscribing(null);
    }
  }

  async function cancel() {
    if (!token || !billing.data?.subscription) return;
    await api.post(`/api/v1/billing/cancel`, {}, token);
    billing.refetch();
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <CreditCard className="h-7 w-7 text-brand-500" />
          Billing &amp; Subscription
        </h1>
        <p className="mt-1 text-sm text-slate-400">Manage your plan and subscription.</p>
      </div>

      {/* Current Plan */}
      <div className="card p-6 mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Current Plan</h2>
        {billing.loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
        ) : billing.data?.activePlan ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xl font-bold flex items-center gap-2">
                <Star className="h-5 w-5 text-brand-500" />
                {billing.data.activePlan.name}
                <span className="text-xs font-normal text-slate-500 uppercase">
                  ({billing.data.activePlan.product})
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-sm text-slate-400">
                <span
                  className={clsx(
                    "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                    billing.data.status === "active"
                      ? "bg-green-500/10 text-green-400"
                      : "bg-red-500/10 text-red-400"
                  )}
                >
                  {billing.data.status}
                </span>
                <span>{billing.data.subscription?.billingCycle}</span>
              </div>
              {billing.data.subscription && (
                <div className="mt-2 text-xs text-slate-500">
                  Period: {new Date(billing.data.subscription.currentPeriodStart).toLocaleDateString()} —{" "}
                  {new Date(billing.data.subscription.currentPeriodEnd).toLocaleDateString()}
                </div>
              )}
            </div>
            <button
              onClick={cancel}
              className="rounded-lg border border-red-800/50 px-4 py-2 text-sm text-red-400 hover:bg-red-950/30 transition-colors"
            >
              Cancel Subscription
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No active subscription. Choose a plan below to get started.</p>
        )}
      </div>

      {/* Available Plans */}
      {Object.entries(grouped).map(([product, items]) => (
        <div key={product} className="mb-10">
          <h2 className="text-lg font-semibold mb-4 text-slate-300">
            {productLabels[product] || product} Plans
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((plan, i) => {
              const isActive = billing.data?.activePlan?.id === plan.id;
              return (
                <div
                  key={plan.id}
                  className={clsx("card p-6 flex flex-col", {
                    "border-brand-600 ring-1 ring-brand-600/30": i === 1 && !isActive,
                    "border-green-600 ring-1 ring-green-600/30": isActive,
                  })}
                >
                  {isActive && (
                    <span className="mb-3 inline-flex self-start items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400">
                      <Check className="h-3 w-3" /> Current Plan
                    </span>
                  )}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <div className="mt-3">
                    <span className="text-3xl font-bold">${plan.priceMonthly}</span>
                    <span className="text-slate-500">/mo</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    or ${plan.priceYearly}/yr
                  </div>

                  <ul className="mt-5 flex-1 space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-400">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                        {formatFeature(f)}
                      </li>
                    ))}
                  </ul>

                  {!isActive && (
                    <div className="mt-5 flex gap-2">
                      <button
                        onClick={() => subscribe(plan.id, "monthly")}
                        disabled={subscribing === plan.id}
                        className="flex-1 rounded-lg gradient-brand py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {subscribing === plan.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>Monthly <ArrowRight className="h-3 w-3" /></>
                        )}
                      </button>
                      <button
                        onClick={() => subscribe(plan.id, "yearly")}
                        disabled={subscribing === plan.id}
                        className="flex-1 rounded-lg border border-slate-700 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        Yearly
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
