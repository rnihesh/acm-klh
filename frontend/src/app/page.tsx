"use client";

import { useEffect, useState } from "react";
import PageShell from "@/components/PageShell";
import { StatCardSkeleton } from "@/components/Skeleton";
import {
  getDashboardStats,
  getMismatchSummary,
  getTopRiskyVendors,
} from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  AlertTriangle,
  TrendingUp,
  Building2,
  FileText,
  IndianRupee,
  ShieldAlert,
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

const CHART_COLORS = ["#d97757", "#d9534f", "#5bc0de", "#5cb85c", "#f0ad4e", "#9b8ec3"];

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

  useEffect(() => {
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

  return (
    <PageShell
      title="Dashboard"
      description="GST Reconciliation Overview"
    >
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
            <StatCard icon={Building2} label="Taxpayers" value={formatNumber(stats?.total_taxpayers ?? 0)} color="#d97757" description="Total registered taxpayers" />
            <StatCard icon={FileText} label="Invoices" value={formatNumber(stats?.total_invoices ?? 0)} color="#5cb85c" description="Total invoices processed" />
            <StatCard icon={TrendingUp} label="Txn Value" value={formatCurrency(stats?.total_transaction_value ?? 0)} color="#5bc0de" description="Total transaction value" />
            <StatCard icon={AlertTriangle} label="Mismatches" value={formatNumber(stats?.total_mismatches ?? 0)} color="#d9534f" description="Total mismatches detected" />
            <StatCard icon={IndianRupee} label="ITC at Risk" value={formatCurrency(stats?.total_itc_at_risk ?? 0)} color="#f0ad4e" description="Input Tax Credit at risk" />
            <StatCard icon={ShieldAlert} label="High Risk" value={formatNumber(stats?.high_risk_vendors ?? 0)} color="#9b8ec3" description="High risk vendor count" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Bar chart */}
            <div className="bg-surface-card rounded-xl border border-surface-border p-5 shadow-card">
              <h2 className="text-sm font-semibold text-content mb-4">
                Mismatch Distribution
              </h2>
              {mismatchData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={mismatchData.map((d) => ({
                      ...d,
                      label: MISMATCH_SHORT[d.mismatch_type] || d.mismatch_type,
                    }))}
                    margin={{ top: 5, right: 10, bottom: 5, left: -10 }}
                  >
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                      axisLine={{ stroke: "var(--bg-border)" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                      axisLine={{ stroke: "var(--bg-border)" }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--bg-border)",
                        borderRadius: "8px",
                        color: "var(--text-primary)",
                        fontSize: 12,
                        boxShadow: "var(--shadow-md)",
                      }}
                    />
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

            {/* Donut chart */}
            <div className="bg-surface-card rounded-xl border border-surface-border p-5 shadow-card">
              <h2 className="text-sm font-semibold text-content mb-4">
                ITC at Risk by Type
              </h2>
              {mismatchData.length > 0 ? (
                <div className="flex items-center">
                  <ResponsiveContainer width="50%" height={260}>
                    <PieChart>
                      <Pie
                        data={mismatchData.map((d) => ({
                          name: MISMATCH_SHORT[d.mismatch_type] || d.mismatch_type,
                          value: d.total_amount,
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {mismatchData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--bg-card)",
                          border: "1px solid var(--bg-border)",
                          borderRadius: "8px",
                          color: "var(--text-primary)",
                          fontSize: 12,
                          boxShadow: "var(--shadow-md)",
                        }}
                        formatter={(value: number) => [formatCurrency(value), "Amount"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2.5 pl-2">
                    {mismatchData.map((d, i) => (
                      <div key={d.mismatch_type} className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <span className="text-xs text-content-tertiary truncate flex-1">
                          {MISMATCH_SHORT[d.mismatch_type] || d.mismatch_type}
                        </span>
                        <span className="text-xs text-content-secondary font-mono">
                          {formatCurrency(d.total_amount)}
                        </span>
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
          <div className="bg-surface-card rounded-xl border border-surface-border p-5 shadow-card">
            <h2 className="text-sm font-semibold text-content mb-4">
              Top Risky Vendors
            </h2>
            {riskyVendors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {riskyVendors.slice(0, 6).map((v) => {
                  const rate = v.total_invoices > 0
                    ? Math.round((v.mismatch_count / v.total_invoices) * 100)
                    : 0;
                  return (
                    <div
                      key={v.gstin}
                      className="flex items-center justify-between p-3.5 rounded-lg bg-surface-dark border border-surface-border hover:border-accent/30 hover:shadow-md transition-all cursor-default group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-content truncate">
                          {v.legal_name || v.trade_name || v.gstin}
                        </p>
                        <p className="text-[10px] text-content-tertiary font-mono mt-0.5">
                          {v.gstin}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className={`text-sm font-bold ${
                          rate > 50 ? "text-red-400" : rate > 25 ? "text-accent" : "text-emerald-400"
                        }`}>
                          {rate}%
                        </p>
                        <p className="text-[10px] text-content-tertiary">
                          {v.mismatch_count}/{v.total_invoices}
                        </p>
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

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  description,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  color: string;
  description: string;
}) {
  return (
    <div className="bg-surface-card rounded-xl border border-surface-border p-4 shadow-card hover:shadow-md hover:border-accent/30 transition-all cursor-default group relative">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="p-1.5 rounded-md"
          style={{ backgroundColor: `${color}15`, color }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <span className="text-xs text-content-tertiary">{label}</span>
      </div>
      <p className="text-lg font-bold text-content">{value}</p>
      {/* Hover tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-surface-card border border-surface-border rounded-lg shadow-lg text-xs text-content-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
        {description}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-content-tertiary text-sm py-8 text-center">{text}</p>
  );
}
