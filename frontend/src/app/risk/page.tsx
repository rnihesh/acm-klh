"use client";

import { useEffect, useState } from "react";
import PageShell from "@/components/PageShell";
import { CardSkeleton } from "@/components/Skeleton";
import { getVendorRisks, getVendorRiskSummary } from "@/lib/api";
import { riskColor } from "@/lib/utils";
import { Bot, X, ShieldAlert, Search } from "lucide-react";

interface VendorRisk {
  gstin: string;
  legal_name: string;
  trade_name: string;
  risk_level: string;
  risk_score: number;
  filing_rate: number;
  mismatch_count: number;
  total_invoices: number;
  circular_trade_flag: boolean;
  risk_factors: string[];
  trade_partners?: number;
}

interface AISummary {
  vendor: VendorRisk;
  ai_summary: string;
}

export default function RiskPage() {
  const [vendors, setVendors] = useState<VendorRisk[]>([]);
  const [filtered, setFiltered] = useState<VendorRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiPanel, setAiPanel] = useState<AISummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("");

  useEffect(() => {
    getVendorRisks()
      .then((data) => {
        const v = (data as VendorRisk[]) || [];
        setVendors(v);
        setFiltered(v);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let f = vendors;
    if (filterLevel) f = f.filter((v) => v.risk_level === filterLevel);
    if (search) {
      const q = search.toLowerCase();
      f = f.filter(
        (v) =>
          v.gstin.toLowerCase().includes(q) ||
          (v.legal_name || "").toLowerCase().includes(q) ||
          (v.trade_name || "").toLowerCase().includes(q)
      );
    }
    setFiltered(f);
  }, [vendors, filterLevel, search]);

  const loadAISummary = async (gstin: string) => {
    setAiLoading(true);
    setAiPanel(null);
    try {
      const data = (await getVendorRiskSummary(gstin)) as AISummary;
      setAiPanel(data);
    } catch {
      // pass
    }
    setAiLoading(false);
  };

  const riskCounts = {
    CRITICAL: vendors.filter((v) => v.risk_level === "CRITICAL").length,
    HIGH: vendors.filter((v) => v.risk_level === "HIGH").length,
    MEDIUM: vendors.filter((v) => v.risk_level === "MEDIUM").length,
    LOW: vendors.filter((v) => v.risk_level === "LOW").length,
  };

  return (
    <PageShell
      title="Vendor Risk Assessment"
      description="Predictive risk scoring with AI-powered analysis"
    >
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : vendors.length > 0 ? (
        <>
          {/* Risk level summary */}
          <div className="flex flex-wrap gap-3 mb-6">
            {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((level) => (
              <button
                key={level}
                onClick={() =>
                  setFilterLevel(filterLevel === level ? "" : level)
                }
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterLevel === level
                    ? `${riskColor(level)} border`
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {level}: {riskCounts[level]}
              </button>
            ))}
            <div className="relative ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendor..."
                className="bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-3 py-2 text-white text-sm w-56 focus:ring-2 focus:ring-blue-500/40 outline-none"
              />
            </div>
          </div>

          {/* Vendor Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((vendor) => (
              <div
                key={vendor.gstin}
                className="bg-[#111827] rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {vendor.legal_name || vendor.trade_name || "Unknown"}
                    </p>
                    <p className="text-[11px] text-gray-500 font-mono mt-1">
                      {vendor.gstin}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded flex-shrink-0 ml-2 ${riskColor(vendor.risk_level)}`}
                  >
                    {vendor.risk_level}
                  </span>
                </div>

                {/* Score bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Risk Score</span>
                    <span>{vendor.risk_score.toFixed(0)}/100</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        vendor.risk_score >= 75
                          ? "bg-red-500"
                          : vendor.risk_score >= 50
                            ? "bg-orange-500"
                            : vendor.risk_score >= 25
                              ? "bg-yellow-500"
                              : "bg-green-500"
                      }`}
                      style={{ width: `${Math.min(100, vendor.risk_score)}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="bg-gray-800/50 rounded-lg p-2">
                    <p className="text-[10px] text-gray-500">Invoices</p>
                    <p className="text-sm font-bold text-white">
                      {vendor.total_invoices}
                    </p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-2">
                    <p className="text-[10px] text-gray-500">Mismatches</p>
                    <p className="text-sm font-bold text-white">
                      {vendor.mismatch_count}
                    </p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-2">
                    <p className="text-[10px] text-gray-500">Filing</p>
                    <p className="text-sm font-bold text-white">
                      {vendor.filing_rate}%
                    </p>
                  </div>
                </div>

                {/* Risk factors */}
                {vendor.risk_factors.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {vendor.risk_factors.map((f, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-400 rounded"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                {vendor.circular_trade_flag && (
                  <div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-[11px] text-red-400 font-medium">
                      Circular Trading Detected
                    </span>
                  </div>
                )}

                <button
                  onClick={() => loadAISummary(vendor.gstin)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg text-blue-400 text-xs transition-colors"
                >
                  <Bot className="w-3 h-3" />
                  AI Risk Summary
                </button>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">
                No vendors match the current filters.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-[#111827] rounded-xl border border-gray-800 p-12 text-center">
          <ShieldAlert className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 font-medium mb-1">No vendor data</p>
          <p className="text-gray-500 text-sm">
            Upload GST returns and run reconciliation first.
          </p>
        </div>
      )}

      {/* AI Summary Modal */}
      {(aiPanel || aiLoading) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111827] rounded-xl border border-gray-700 w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-400" />
                AI Risk Analysis
              </h3>
              <button
                onClick={() => {
                  setAiPanel(null);
                  setAiLoading(false);
                }}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {aiLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mr-3" />
                <span className="text-gray-400">Generating analysis...</span>
              </div>
            ) : aiPanel ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {aiPanel.vendor.legal_name || aiPanel.vendor.trade_name}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      {aiPanel.vendor.gstin}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded ${riskColor(aiPanel.vendor.risk_level)}`}
                  >
                    {aiPanel.vendor.risk_level}
                  </span>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-4">
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {aiPanel.ai_summary}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </PageShell>
  );
}
