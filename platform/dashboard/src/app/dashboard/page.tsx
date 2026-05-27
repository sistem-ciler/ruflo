"use client";

import { Shield, Camera, AlertTriangle, Users, Activity, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/useApi";

interface ThreatOverview {
  totalEvents: number;
  criticalEvents: number;
  openIncidents: number;
  totalIocs: number;
  eventsLast24h: number;
}

interface BillingSummary {
  currentPlan: { name: string } | null;
  subscription: { status: string } | null;
  totalSubscriptions: number;
}

export default function DashboardOverview() {
  const { user } = useAuth();
  const threats = useApi<ThreatOverview>("/api/v1/security/threats");
  const billing = useApi<BillingSummary>("/api/v1/billing/summary");

  const stats = [
    {
      icon: AlertTriangle,
      label: "Security Events",
      value: threats.data?.totalEvents ?? "—",
      color: "text-red-400",
      bg: "bg-red-950/50",
    },
    {
      icon: Shield,
      label: "Critical Threats",
      value: threats.data?.criticalEvents ?? 0,
      color: "text-orange-400",
      bg: "bg-orange-950/50",
    },
    {
      icon: Activity,
      label: "Recent (24h)",
      value: threats.data?.eventsLast24h ?? "—",
      color: "text-yellow-400",
      bg: "bg-yellow-950/50",
    },
    {
      icon: TrendingUp,
      label: "Active Plan",
      value: billing.data?.currentPlan?.name ?? "None",
      color: "text-brand-400",
      bg: "bg-brand-950/50",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Welcome back, {user?.name}</h1>
        <p className="mt-1 text-sm text-slate-400">
          Here&apos;s an overview of your security operations.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg ${s.bg} p-2.5`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <div className="text-xs text-slate-500">{s.label}</div>
                <div className="text-xl font-bold">{s.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Severity Breakdown</h2>
          {threats.data && threats.data.totalEvents > 0 ? (
            <div className="space-y-3">
              {[
                { sev: "critical", count: threats.data.criticalEvents, color: "bg-red-500" },
                { sev: "open incidents", count: threats.data.openIncidents, color: "bg-orange-500" },
                { sev: "last 24h", count: threats.data.eventsLast24h, color: "bg-yellow-500" },
                { sev: "total IOCs", count: threats.data.totalIocs, color: "bg-green-500" },
              ].map(({ sev, count, color }) => (
                <div key={sev} className="flex items-center justify-between">
                  <span className="text-sm text-slate-400 capitalize">{sev}</span>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-32 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color}`}
                        style={{
                          width: `${Math.min(100, (count / Math.max(threats.data.totalEvents, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No data yet. Ingest security events to see statistics.</p>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            {[
              { icon: AlertTriangle, label: "View Security Events", href: "/dashboard/security" },
              { icon: Camera, label: "Manage CCTV Cameras", href: "/dashboard/cctv" },
              { icon: Users, label: "Manage Users", href: "/dashboard/users" },
            ].map((action) => (
              <a
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 rounded-lg border border-slate-800 p-3 text-sm text-slate-300 hover:bg-slate-800/50 transition-colors"
              >
                <action.icon className="h-5 w-5 text-slate-500" />
                {action.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
