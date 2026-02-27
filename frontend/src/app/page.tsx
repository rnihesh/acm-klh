"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getDashboardStats,
  getMismatchSummary,
  getTopRiskyVendors,
} from "@/lib/api";
import { formatCurrency, formatNumber, severityColor } from "@/lib/utils";
import {
  BarChart3,
  Upload,
  GitCompare,
  Network,
  FileSearch,
  ShieldAlert,
  AlertTriangle,
  TrendingUp,
  Building2,
  FileText,
} from "lucide-react";

interface DashboardStats {
  total_taxpayers: number;
  total_invoices: number;
  total_transaction_value: number;
  total_mismatches: number;
  gstr1_returns_filed: number;
  gstr2b_returns_generated: number;
}

interface MismatchBreakdown {
  breakdown: Array<{
    mismatch_type: string;
    count: number;
    total_value: number;
  }>;
}

interface RiskyVendor {
  gstin: string;
  name: string;
  invoice_count: number;
  mismatch_count: number;
  mismatch_rate: number;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/reconcile", label: "Reconciliation", icon: GitCompare },
  { href: "/graph", label: "Graph Explorer", icon: Network },
  { href: "/audit", label: "Audit Trails", icon: FileSearch },
  { href: "/risk", label: "Vendor Risk", icon: ShieldAlert },
];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [mismatchData, setMismatchData] = useState<MismatchBreakdown | null>(
    null
  );
  const [riskyVendors, setRiskyVendors] = useState<RiskyVendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      getDashboardStats(),
      getMismatchSummary(),
      getTopRiskyVendors(),
    ]).then(([statsRes, mismatchRes, vendorRes]) => {
      if (statsRes.status === "fulfilled") setStats(statsRes.value as DashboardStats);
      if (mismatchRes.status === "fulfilled")
        setMismatchData(mismatchRes.value as MismatchBreakdown);
      if (vendorRes.status === "fulfilled") {
        const data = vendorRes.value as { top_risky_vendors: RiskyVendor[] };
        setRiskyVendors(data.top_risky_vendors || []);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <nav className="w-64 bg-[#111827] border-r border-gray-800 p-4 flex flex-col gap-1">
        <div className="flex items-center gap-2 px-3 py-4 mb-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <GitCompare className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">GST Recon</span>
        </div>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              item.href === "/"
                ? "bg-blue-600/20 text-blue-400"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-gray-400 mb-8">
            GST Reconciliation Overview &mdash; Knowledge Graph Engine
          </p>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Mismatch Breakdown */}
                <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">
                    Mismatch Breakdown
                  </h2>
                  {mismatchData?.breakdown?.length ? (
                    <div className="space-y-3">
                      {mismatchData.breakdown.map((item) => (
                        <div
                          key={item.mismatch_type}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono px-2 py-1 rounded bg-gray-800 text-gray-300">
                              {item.mismatch_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-400">
                              {item.count} cases
                            </span>
                            <span className="text-sm font-medium text-white">
                              {formatCurrency(item.total_value)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">
                      No mismatch data yet. Upload GST returns and run
                      reconciliation.
                    </p>
                  )}
                </div>

                {/* Top Risky Vendors */}
                <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">
                    Top Risky Vendors
                  </h2>
                  {riskyVendors.length > 0 ? (
                    <div className="space-y-3">
                      {riskyVendors.slice(0, 5).map((vendor) => (
                        <div
                          key={vendor.gstin}
                          className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50"
                        >
                          <div>
                            <p className="text-sm font-medium text-white">
                              {vendor.name || vendor.gstin}
                            </p>
                            <p className="text-xs text-gray-500 font-mono">
                              {vendor.gstin}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-sm font-bold ${
                                vendor.mismatch_rate > 50
                                  ? "text-red-400"
                                  : vendor.mismatch_rate > 25
                                    ? "text-yellow-400"
                                    : "text-green-400"
                              }`}
                            >
                              {vendor.mismatch_rate}% risk
                            </p>
                            <p className="text-xs text-gray-500">
                              {vendor.mismatch_count}/{vendor.invoice_count}{" "}
                              mismatches
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">
                      No vendor risk data yet. Run reconciliation first.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
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
