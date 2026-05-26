import Link from "next/link";
import {
  Shield,
  Camera,
  Zap,
  Lock,
  BarChart3,
  Users,
  AlertTriangle,
  Eye,
  Server,
  ArrowRight,
  Check,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";

const features = [
  {
    icon: Shield,
    title: "SIEM & Threat Detection",
    description:
      "Real-time security event ingestion, correlation, and automated incident response with customizable playbooks.",
  },
  {
    icon: Camera,
    title: "CCTV Monitoring",
    description:
      "Centralized camera management with RTSP/WebRTC streaming, AI-powered face recognition, and motion detection.",
  },
  {
    icon: AlertTriangle,
    title: "Incident Management",
    description:
      "Full incident lifecycle from auto-creation on critical events to resolution tracking with team assignment.",
  },
  {
    icon: Eye,
    title: "IOC Database",
    description:
      "Maintain indicators of compromise — IPs, domains, file hashes — with threat scoring and expiration.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description:
      "Threat trends, severity breakdowns, and real-time metrics with Grafana and Prometheus integration.",
  },
  {
    icon: Lock,
    title: "Multi-Tenant RBAC",
    description:
      "Complete tenant isolation with role-based access control. Owner, admin, operator, and viewer roles.",
  },
  {
    icon: Zap,
    title: "AI-Powered Analysis",
    description:
      "LLM-powered threat analysis via OpenRouter or local Ollama. Automatic threat description enrichment.",
  },
  {
    icon: Users,
    title: "User Management",
    description:
      "Tenant-scoped user CRUD with safe projections, password management, and permission controls.",
  },
  {
    icon: Server,
    title: "Event-Driven Architecture",
    description:
      "RabbitMQ message bus with topic exchanges. Every action publishes events for audit and integration.",
  },
];

interface Plan {
  id: string;
  name: string;
  product: string;
  priceMonthly: string;
  priceYearly: string;
  features: string[];
  limits: Record<string, number>;
}

async function getPlans(): Promise<Plan[]> {
  try {
    const url = process.env.API_URL || "http://localhost:4000";
    const res = await fetch(`${url}/api/v1/billing/plans`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.data?.plans ?? [];
  } catch {
    return [];
  }
}

function formatFeature(f: string): string {
  return f
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function LandingPage() {
  const plans = await getPlans();

  const cctvPlans = plans.filter((p) => p.product === "cctv");
  const cyberPlans = plans.filter((p) => p.product === "cybersecurity");
  const bundlePlans = plans.filter((p) => p.product === "bundle");

  return (
    <main className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="gradient-hero relative overflow-hidden pt-32 pb-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-900/20 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-700/40 bg-brand-950/50 px-4 py-1.5 text-sm text-brand-300 mb-8">
            <Zap className="h-4 w-4" /> Now with AI-Powered Threat Analysis
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Cybersecurity &amp; CCTV
            <br />
            <span className="gradient-brand bg-clip-text text-transparent">as a Service</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400 leading-relaxed">
            Enterprise-grade SIEM, surveillance, and threat intelligence. Multi-tenant, event-driven,
            and AI-powered. Deploy in minutes, not months.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="rounded-xl gradient-brand px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-900/30 hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              Start Free Trial <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="rounded-xl border border-slate-700 px-8 py-3.5 text-base font-semibold text-slate-300 hover:bg-slate-800/50 transition-colors"
            >
              See Features
            </a>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-8 sm:grid-cols-4 text-center">
            {[
              ["99.9%", "Uptime SLA"],
              ["< 100ms", "Event Ingestion"],
              ["17+", "Database Tables"],
              ["14+", "API Endpoints"],
            ].map(([value, label]) => (
              <div key={label}>
                <div className="text-2xl font-bold text-white">{value}</div>
                <div className="text-sm text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold sm:text-4xl">Everything You Need</h2>
            <p className="mt-4 text-lg text-slate-400">
              A complete security operations platform — from log ingestion to incident response.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="card-hover p-6">
                <div className="mb-4 inline-flex rounded-lg bg-brand-950/80 p-3">
                  <f.icon className="h-6 w-6 text-brand-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="border-y border-slate-800 bg-slate-900/30 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold sm:text-4xl">Production-Ready Architecture</h2>
            <p className="mt-4 text-lg text-slate-400">
              Built on battle-tested infrastructure with full observability.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "PostgreSQL 16", desc: "pgvector + RLS isolation", color: "text-blue-400" },
              { label: "Redis 7", desc: "Session cache + rate limiting", color: "text-red-400" },
              { label: "RabbitMQ", desc: "Event-driven messaging", color: "text-orange-400" },
              { label: "Prometheus", desc: "Metrics + Grafana dashboards", color: "text-yellow-400" },
              { label: "MediaMTX", desc: "RTSP/WebRTC streaming", color: "text-green-400" },
              { label: "MinIO", desc: "S3-compatible object storage", color: "text-purple-400" },
              { label: "Ollama", desc: "Local LLM inference", color: "text-pink-400" },
              { label: "Caddy", desc: "Auto-TLS reverse proxy", color: "text-cyan-400" },
            ].map((item) => (
              <div key={item.label} className="card p-5">
                <div className={`text-sm font-semibold ${item.color}`}>{item.label}</div>
                <div className="mt-1 text-xs text-slate-500">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold sm:text-4xl">Simple, Transparent Pricing</h2>
            <p className="mt-4 text-lg text-slate-400">
              Choose CCTV, Cybersecurity, or bundle both. All plans include a 14-day free trial.
            </p>
          </div>

          {[
            { title: "CCTV Plans", items: cctvPlans },
            { title: "Cybersecurity Plans", items: cyberPlans },
            { title: "Bundle Plans", items: bundlePlans },
          ].map(
            (group) =>
              group.items.length > 0 && (
                <div key={group.title} className="mb-16">
                  <h3 className="text-xl font-semibold mb-6 text-center text-slate-300">{group.title}</h3>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
                    {group.items.map((plan, i) => (
                      <div
                        key={plan.id}
                        className={`card p-6 flex flex-col ${
                          i === 1 ? "border-brand-600 ring-1 ring-brand-600/30 relative" : ""
                        }`}
                      >
                        {i === 1 && (
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-brand px-3 py-0.5 text-xs font-medium text-white">
                            Popular
                          </span>
                        )}
                        <h4 className="text-lg font-semibold">{plan.name}</h4>
                        <div className="mt-4">
                          <span className="text-4xl font-bold">${plan.priceMonthly}</span>
                          <span className="text-slate-500">/mo</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          or ${plan.priceYearly}/yr (save{" "}
                          {Math.round(
                            (1 - parseFloat(plan.priceYearly) / (parseFloat(plan.priceMonthly) * 12)) * 100
                          )}
                          %)
                        </div>
                        <ul className="mt-6 flex-1 space-y-3">
                          {plan.features.map((f) => (
                            <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                              {formatFeature(f)}
                            </li>
                          ))}
                        </ul>
                        <Link
                          href="/register"
                          className={`mt-6 block rounded-lg py-2.5 text-center text-sm font-medium transition-colors ${
                            i === 1
                              ? "gradient-brand text-white hover:opacity-90"
                              : "border border-slate-700 text-slate-300 hover:bg-slate-800"
                          }`}
                        >
                          Start Free Trial
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Ready to Secure Your Operations?</h2>
          <p className="mt-4 text-lg text-slate-400">
            Deploy a full security operations center in minutes. No hardware, no long-term contracts.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-xl gradient-brand px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-900/30 hover:opacity-90 transition-opacity"
          >
            Get Started Now <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Shield className="h-4 w-4" /> CSaaS Platform
          </div>
          <div className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} CSaaS. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
