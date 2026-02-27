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
  gstr1_returns_filed: number;
  gstr2b_returns_generated: number;
}

interface MismatchItem {
  mismatch_type: string;
  count: number;
  total_value: number;
}

interface RiskyVendor {
  gstin: string;
  name: string;
  invoice_count: number;
  mismatch_count: number;
  mismatch_rate: number;
}

const PIE_COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#22c55e", "#8b5cf6", "#ec4899"];

const MISMATCH_LABELS: Record<string, string> = {
  MISSING_IN_GSTR2B: "Missing 2B",
  MISSING_IN_GSTR1: "Missing 1",
  VALUE_MISMATCH: "Value",
  RATE_MISMATCH: "Rate",
  DUPLICATE_INVOICE: "Duplicate",
  EXCESS_ITC: "Excess ITC",
  PERIOD_MISMATCH: "Period",
  GSTIN_ERROR: "GSTIN Error",
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
      description="GST Reconciliation Overview — Knowledge Graph Engine"
    >
      {loading ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={Building2}
              label="Taxpayers"
              value={formatNumber(stats?.total_taxpayers ?? 0)}
              color="blue"
            />
            <StatCard
              icon={FileText}
              label="Invoices"
              value={formatNumber(stats?.total_invoices ?? 0)}
              color="green"
            />
            <StatCard
              icon={TrendingUp}
              label="Transaction Value"
              value={formatCurrency(stats?.total_transaction_value ?? 0)}
              color="purple"
            />
            <StatCard
              icon={AlertTriangle}
              label="Mismatches"
              value={formatNumber(stats?.total_mismatches ?? 0)}
              color="red"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Mismatch Bar Chart */}
            <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Mismatch Breakdown
              </h2>
              {mismatchData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={mismatchData.map((d) => ({
                      ...d,
                      label: MISMATCH_LABELS[d.mismatch_type] || d.mismatch_type,
                    }))}
                    margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                  >
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={{ stroke: "#1e293b" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={{ stroke: "#1e293b" }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        color: "#e2e8f0",
                        fontSize: 12,
                      }}
                      formatter={(value: number) => [value, "Count"]}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {mismatchData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-sm py-8 text-center">
                  No mismatch data yet. Upload GST returns and run
                  reconciliation.
                </p>
              )}
            </div>

            {/* Mismatch Value Pie Chart */}
            <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                ITC at Risk by Type
              </h2>
              {mismatchData.length > 0 ? (
                <div className="flex items-center">
                  <ResponsiveContainer width="55%" height={280}>
                    <PieChart>
                      <Pie
                        data={mismatchData.map((d) => ({
                          name:
                            MISMATCH_LABELS[d.mismatch_type] ||
                            d.mismatch_type,
                          value: d.total_value,
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {mismatchData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                          color: "#e2e8f0",
                          fontSize: 12,
                        }}
                        formatter={(value: number) => [
                          formatCurrency(value),
                          "Amount",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2 pl-2">
                    {mismatchData.map((d, i) => (
                      <div key={d.mismatch_type} className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor:
                              PIE_COLORS[i % PIE_COLORS.length],
                          }}
                        />
                        <span className="text-xs text-gray-400 truncate">
                          {MISMATCH_LABELS[d.mismatch_type] || d.mismatch_type}
                        </span>
                        <span className="text-xs text-gray-300 ml-auto font-mono">
                          {formatCurrency(d.total_value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm py-8 text-center">
                  No data available yet.
                </p>
              )}
            </div>
          </div>

          {/* Top Risky Vendors */}
          <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Top Risky Vendors
            </h2>
            {riskyVendors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {riskyVendors.slice(0, 6).map((vendor) => (
                  <div
                    key={vendor.gstin}
                    className="flex items-center justify-between p-4 rounded-lg bg-gray-800/40 border border-gray-800"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {vendor.name || vendor.gstin}
                      </p>
                      <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                        {vendor.gstin}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p
                        className={`text-sm font-bold ${
                          vendor.mismatch_rate > 50
                            ? "text-red-400"
                            : vendor.mismatch_rate > 25
                              ? "text-yellow-400"
                              : "text-green-400"
                        }`}
                      >
                        {vendor.mismatch_rate}%
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {vendor.mismatch_count}/{vendor.invoice_count}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-6">
                No vendor risk data yet. Run reconciliation first.
              </p>
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: "blue" | "green" | "purple" | "red";
}) {
  const colors = {
    blue: "bg-blue-500/10 text-blue-400",
    green: "bg-green-500/10 text-green-400",
    purple: "bg-purple-500/10 text-purple-400",
    red: "bg-red-500/10 text-red-400",
  };
  return (
    <div className="bg-[#111827] rounded-xl border border-gray-800 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
