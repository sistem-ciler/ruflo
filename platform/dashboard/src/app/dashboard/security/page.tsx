"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Shield,
  Search,
  Plus,
  Clock,
  ArrowUpRight,
  Loader2,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { clsx } from "clsx";

interface SecurityEvent {
  id: string;
  source: string;
  severity: string;
  category: string;
  description: string;
  sourceIp: string | null;
  createdAt: string;
}

interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
  attackType: string | null;
  createdAt: string;
}

interface IOC {
  id: string;
  iocType: string;
  value: string;
  threatScore: number;
  source: string;
  createdAt: string;
}

interface ThreatOverview {
  total: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  recentEvents: number;
}

const severityColor: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  low: "bg-green-500/10 text-green-400 border-green-500/20",
  info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const statusColor: Record<string, string> = {
  open: "bg-red-500/10 text-red-400",
  investigating: "bg-yellow-500/10 text-yellow-400",
  contained: "bg-blue-500/10 text-blue-400",
  resolved: "bg-green-500/10 text-green-400",
};

export default function SecurityPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<"events" | "incidents" | "iocs">("events");
  const [showIngest, setShowIngest] = useState(false);
  const [ingesting, setIngesting] = useState(false);

  const events = useApi<{ events: SecurityEvent[]; total: number }>("/api/v1/security/events?limit=20");
  const incidents = useApi<{ incidents: Incident[]; total: number }>("/api/v1/security/incidents?limit=20");
  const iocs = useApi<{ iocs: IOC[]; total: number }>("/api/v1/security/iocs?limit=20");
  const threats = useApi<ThreatOverview>("/api/v1/security/threats");

  async function ingestSample(severity: string) {
    if (!token) return;
    setIngesting(true);
    try {
      await api.post(
        "/api/v1/security/events",
        {
          source: "demo-sensor",
          severity,
          category: severity === "critical" ? "intrusion" : "anomaly",
          description: `[Demo] ${severity} severity event detected from perimeter sensor`,
          sourceIp: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
          destinationIp: "10.0.0.1",
        },
        token
      );
      events.refetch();
      incidents.refetch();
      threats.refetch();
    } finally {
      setIngesting(false);
      setShowIngest(false);
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Shield className="h-7 w-7 text-brand-500" />
            Security Operations
          </h1>
          <p className="mt-1 text-sm text-slate-400">Monitor threats, manage incidents, and track IOCs.</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowIngest(!showIngest)}
            className="flex items-center gap-2 rounded-lg gradient-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Ingest Event
          </button>
          {showIngest && (
            <div className="absolute right-0 top-12 z-10 card p-3 w-48 space-y-2">
              <p className="text-xs text-slate-500 mb-2">Select severity:</p>
              {["critical", "high", "medium", "low", "info"].map((s) => (
                <button
                  key={s}
                  onClick={() => ingestSample(s)}
                  disabled={ingesting}
                  className={clsx(
                    "w-full rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                    severityColor[s],
                    "hover:opacity-80"
                  )}
                >
                  {ingesting ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4 mb-8">
        {[
          { label: "Total Events", value: threats.data?.total ?? 0, color: "text-brand-400" },
          { label: "Critical", value: threats.data?.bySeverity?.critical ?? 0, color: "text-red-400" },
          { label: "High", value: threats.data?.bySeverity?.high ?? 0, color: "text-orange-400" },
          { label: "Recent (24h)", value: threats.data?.recentEvents ?? 0, color: "text-yellow-400" },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-xs text-slate-500">{s.label}</div>
            <div className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-800 mb-6">
        {(["events", "incidents", "iocs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "px-4 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors",
              tab === t
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Events Tab */}
      {tab === "events" && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 hidden lg:table-cell">Description</th>
                <th className="px-4 py-3">Source IP</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {events.data?.events?.map((e) => (
                <tr key={e.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <span className={clsx("rounded-full border px-2 py-0.5 text-xs font-medium capitalize", severityColor[e.severity])}>
                      {e.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{e.source}</td>
                  <td className="px-4 py-3 text-slate-400">{e.category}</td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell max-w-xs truncate">{e.description}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.sourceIp || "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    {events.loading ? (
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    ) : (
                      "No events yet. Click 'Ingest Event' to generate sample data."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Incidents Tab */}
      {tab === "incidents" && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Attack Type</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {incidents.data?.incidents?.map((inc) => (
                <tr key={inc.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium capitalize", statusColor[inc.status] ?? "text-slate-400")}>
                      {inc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{inc.title}</td>
                  <td className="px-4 py-3">
                    <span className={clsx("rounded-full border px-2 py-0.5 text-xs capitalize", severityColor[inc.severity])}>
                      {inc.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{inc.attackType || "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(inc.createdAt).toLocaleString()}
                  </td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    {incidents.loading ? (
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    ) : (
                      "No incidents. Critical/high events auto-create incidents."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* IOCs Tab */}
      {tab === "iocs" && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Threat Score</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Added</th>
              </tr>
            </thead>
            <tbody>
              {iocs.data?.iocs?.map((ioc) => (
                <tr key={ioc.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono">{ioc.iocType}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{ioc.value}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={clsx("h-full rounded-full", {
                            "bg-red-500": ioc.threatScore >= 80,
                            "bg-orange-500": ioc.threatScore >= 50 && ioc.threatScore < 80,
                            "bg-yellow-500": ioc.threatScore >= 20 && ioc.threatScore < 50,
                            "bg-green-500": ioc.threatScore < 20,
                          })}
                          style={{ width: `${ioc.threatScore}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">{ioc.threatScore}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{ioc.source}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(ioc.createdAt).toLocaleString()}
                  </td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    {iocs.loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "No IOCs tracked yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
