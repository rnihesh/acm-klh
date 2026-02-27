"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageShell from "@/components/PageShell";
import { StatCardSkeleton } from "@/components/Skeleton";
import {
  getDashboardStats,
  getMismatchSummary,
  getTopRiskyVendors,
  downloadPDF,
} from "@/lib/api";
import { formatCurrency, formatNumber, severityColor } from "@/lib/utils";
import {
  AlertTriangle,
  TrendingUp,
  Building2,
  FileText,
  IndianRupee,
  ShieldAlert,
  Download,
  Play,
  Network,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface DashboardStats {
  total_taxpayers: number;
  total_invoices: number;
  total_transaction_value: number;
  total_mismatches: number;
  total_itc_at_risk: number;
  high_risk_vendors: number;
  gstr1_returns_filed: number;
  gstr2b_returns_generated: number;
  gstr3b_returns_filed: number;
  mismatch_breakdown: Record<string, number>;
  severity_breakdown: Record<string, number>;
}

interface MismatchItem {
  mismatch_type: string;
  count: number;
  total_amount: number;
}

interface RiskyVendor {
  gstin: string;
  legal_name: string;
  trade_name: string;
  risk_score: number;
  risk_level: string;
  mismatch_count: number;
  total_invoices: number;
  filing_rate: number;
}

const CHART_COLORS = ["#e5e5e5", "#a3a3a3", "#737373", "#d4d4d4", "#525252", "#8b8b8b"];
const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#d9534f",
  HIGH: "#f0ad4e",
  MEDIUM: "#a3a3a3",
  LOW: "#5cb85c",
};

const MISMATCH_SHORT: Record<string, string> = {
  MISSING_IN_GSTR2B: "Missing 2B",
  MISSING_IN_GSTR1: "Missing 1",
  VALUE_MISMATCH: "Value",
  RATE_MISMATCH: "Rate",
  DUPLICATE_INVOICE: "Duplicate",
  EXCESS_ITC: "Excess ITC",
  PERIOD_MISMATCH: "Period",
  GSTIN_ERROR: "GSTIN",
};

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [mismatchData, setMismatchData] = useState<MismatchItem[]>([]);
  const [riskyVendors, setRiskyVendors] = useState<RiskyVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    Promise.allSettled([
      getDashboardStats(),
      getMismatchSummary(),
      getTopRiskyVendors(),
    ]).then(([statsRes, mismatchRes, vendorRes]) => {
      if (statsRes.status === "fulfilled")
        setStats(statsRes.value as DashboardStats);
      if (mismatchRes.status === "fulfilled") {
        const data = mismatchRes.value as { breakdown: MismatchItem[] };
        setMismatchData(data.breakdown || []);
      }
      if (vendorRes.status === "fulfilled") {
        const data = vendorRes.value as { top_risky_vendors: RiskyVendor[] };
        setRiskyVendors(data.top_risky_vendors || []);
      }
      setLoading(false);
    });
  }, []);

  const handlePdfDownload = async () => {
    setPdfLoading(true);
    try {
      await downloadPDF("012026");
    } catch {
      // PDF may not be available if reconciliation hasn't been run
    }
    setPdfLoading(false);
  };

  const severityData = stats?.severity_breakdown
    ? Object.entries(stats.severity_breakdown).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  return (
    <PageShell title="Dashboard" description="GST Reconciliation Overview">
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          {/* Stat Cards with staggered fade-in */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
            {[
              { icon: Building2, label: "Taxpayers", value: formatNumber(stats?.total_taxpayers ?? 0), color: "#e5e5e5", desc: "Total registered taxpayers" },
              { icon: FileText, label: "Invoices", value: formatNumber(stats?.total_invoices ?? 0), color: "#a3a3a3", desc: "Total invoices processed" },
              { icon: TrendingUp, label: "Txn Value", value: formatCurrency(stats?.total_transaction_value ?? 0), color: "#737373", desc: "Total transaction value" },
              { icon: AlertTriangle, label: "Mismatches", value: formatNumber(stats?.total_mismatches ?? 0), color: "#d4d4d4", desc: "Total mismatches detected" },
              { icon: IndianRupee, label: "ITC at Risk", value: formatCurrency(stats?.total_itc_at_risk ?? 0), color: "#525252", desc: "Input Tax Credit at risk" },
              { icon: ShieldAlert, label: "High Risk", value: formatNumber(stats?.high_risk_vendors ?? 0), color: "#8b8b8b", desc: "High risk vendor count" },
            ].map((card, i) => (
              <div
                key={card.label}
                className="transition-all duration-500"
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateY(0)" : "translateY(12px)",
                  transitionDelay: `${i * 80}ms`,
                }}
              >
                <StatCard {...card} />
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Link
              href="/reconcile"
              className="flex items-center gap-2 px-4 py-2 c-bg-accent rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
            >
              <Play className="w-3.5 h-3.5" /> Run Reconciliation
            </Link>
            <button
              onClick={handlePdfDownload}
              disabled={pdfLoading || (stats?.total_mismatches ?? 0) === 0}
              className="flex items-center gap-2 px-4 py-2 c-bg-dark hover:c-bg-card rounded-lg text-sm c-text-2 transition-colors disabled:opacity-40 border c-border"
            >
              {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export PDF
            </button>
            <Link
              href="/graph"
              className="flex items-center gap-2 px-4 py-2 c-bg-dark hover:c-bg-card rounded-lg text-sm c-text-2 transition-colors border c-border"
            >
              <Network className="w-3.5 h-3.5" /> View Graph
            </Link>
          </div>

          {/* Charts Row: Mismatch + Severity Donut + ITC Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Mismatch Distribution Bar Chart */}
            <div className="c-bg-card rounded-xl border c-border p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
              <h2 className="text-sm font-semibold c-text mb-4">Mismatch Distribution</h2>
              {mismatchData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={mismatchData.map((d) => ({
                      ...d,
                      label: MISMATCH_SHORT[d.mismatch_type] || d.mismatch_type,
                    }))}
                    margin={{ top: 5, right: 10, bottom: 5, left: -10 }}
                  >
                    <XAxis dataKey="label" tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} axisLine={{ stroke: "var(--bg-border)" }} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} axisLine={{ stroke: "var(--bg-border)" }} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: "8px", color: "var(--text-primary)", fontSize: 12, boxShadow: "var(--shadow-md)" }} />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                      {mismatchData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState text="No mismatch data. Run reconciliation first." />
              )}
            </div>

            {/* Severity Distribution Donut */}
            <div className="c-bg-card rounded-xl border c-border p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
              <h2 className="text-sm font-semibold c-text mb-4">Severity Distribution</h2>
              {severityData.length > 0 ? (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={severityData}
                        cx="50%" cy="50%"
                        innerRadius={45} outerRadius={75}
                        paddingAngle={4} dataKey="value" stroke="none"
                      >
                        {severityData.map((d) => (
                          <Cell key={d.name} fill={SEVERITY_COLORS[d.name] || "#6b6b6b"} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: "8px", color: "var(--text-primary)", fontSize: 12, boxShadow: "var(--shadow-md)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {severityData.map((d) => (
                      <div key={d.name} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[d.name] || "#6b6b6b" }} />
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${severityColor(d.name)}`}>
                          {d.name}: {d.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState text="No severity data." />
              )}
            </div>

            {/* ITC at Risk Pie */}
            <div className="c-bg-card rounded-xl border c-border p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
              <h2 className="text-sm font-semibold c-text mb-4">ITC at Risk by Type</h2>
              {mismatchData.length > 0 ? (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={mismatchData.map((d) => ({ name: MISMATCH_SHORT[d.mismatch_type] || d.mismatch_type, value: d.total_amount }))}
                        cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none"
                      >
                        {mismatchData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: "8px", color: "var(--text-primary)", fontSize: 12, boxShadow: "var(--shadow-md)" }} formatter={(value: number) => [formatCurrency(value), "Amount"]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
                    {mismatchData.map((d, i) => (
                      <div key={d.mismatch_type} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-[10px] c-text-3">{MISMATCH_SHORT[d.mismatch_type] || d.mismatch_type}</span>
                        <span className="text-[10px] c-text-2 font-mono">{formatCurrency(d.total_amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState text="No data available." />
              )}
            </div>
          </div>

          {/* Top Risky Vendors */}
          <div className="c-bg-card rounded-xl border c-border p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h2 className="text-sm font-semibold c-text mb-4">Top Risky Vendors</h2>
            {riskyVendors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {riskyVendors.slice(0, 6).map((v) => {
                  const rate = v.total_invoices > 0 ? Math.round((v.mismatch_count / v.total_invoices) * 100) : 0;
                  return (
                    <div
                      key={v.gstin}
                      className="flex items-center justify-between p-3.5 rounded-lg c-bg-dark border c-border hover:c-border-accent transition-all cursor-default"
                      style={{ boxShadow: "var(--shadow-sm)" }}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium c-text truncate">{v.legal_name || v.trade_name || v.gstin}</p>
                        <p className="text-[10px] c-text-3 font-mono mt-0.5">{v.gstin}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className={`text-sm font-bold ${rate > 50 ? "text-red-400" : rate > 25 ? "text-amber-400" : "text-emerald-400"}`}>{rate}%</p>
                        <p className="text-[10px] c-text-3">{v.mismatch_count}/{v.total_invoices}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState text="No vendor risk data. Run reconciliation first." />
            )}
          </div>
        </>
      )}
    </PageShell>
  );
}

function StatCard({ icon: Icon, label, value, color, desc }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  color: string;
  desc: string;
}) {
  return (
    <div
      className="c-bg-card rounded-xl border c-border p-4 hover:c-border-accent transition-all cursor-default group relative"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-md" style={{ backgroundColor: `${color}15`, color }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <span className="text-xs c-text-3">{label}</span>
      </div>
      <p className="text-lg font-bold c-text">{value}</p>
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 c-bg-card border c-border rounded-lg text-xs c-text-2 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10"
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        {desc}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="c-text-3 text-sm py-8 text-center">{text}</p>;
}
