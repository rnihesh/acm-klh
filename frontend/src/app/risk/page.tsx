"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import PageShell from "@/components/PageShell";
import { CardSkeleton } from "@/components/Skeleton";
import { getVendorRisks, getVendorRiskSummary } from "@/lib/api";
import { riskColor } from "@/lib/utils";
import { Bot, X, ShieldAlert } from "lucide-react";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import SearchableDropdown, { DropdownOption } from "@/components/SearchableDropdown";

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
  const [selectedVendor, setSelectedVendor] = useState("");
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
    if (selectedVendor) {
      f = f.filter((v) => v.gstin === selectedVendor);
    }
    setFiltered(f);
  }, [vendors, filterLevel, selectedVendor]);

  const vendorOptions: DropdownOption[] = useMemo(() => {
    return vendors.map((v) => ({
      value: v.gstin,
      label: v.legal_name || v.trade_name || v.gstin,
      sublabel: v.gstin,
    }));
  }, [vendors]);

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
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6">
            {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((level) => (
              <button
                key={level}
                onClick={() =>
                  setFilterLevel(filterLevel === level ? "" : level)
                }
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterLevel === level
                    ? `${riskColor(level)} border`
                    : "c-bg-dark c-text-2 hover:c-bg-card"
                }`}
              >
                {level}: {riskCounts[level]}
              </button>
            ))}
            <div className="sm:ml-auto w-full sm:w-64">
              <SearchableDropdown
                options={vendorOptions}
                value={selectedVendor}
                onChange={setSelectedVendor}
                placeholder="Search vendor..."
              />
            </div>
          </div>

          {/* Vendor Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((vendor) => (
              <div
                key={vendor.gstin}
                className="c-bg-card rounded-xl border c-border p-5 hover:c-border-accent transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold c-text truncate">
                      {vendor.legal_name || vendor.trade_name || "Unknown"}
                    </p>
                    <p className="text-[11px] c-text-3 font-mono mt-1">
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
                  <div className="flex justify-between text-xs c-text-2 mb-1">
                    <span>Risk Score</span>
                    <span>{vendor.risk_score.toFixed(0)}/100</span>
                  </div>
                  <div className="w-full c-bg-dark rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        vendor.risk_score >= 75
                          ? "bg-red-500"
                          : vendor.risk_score >= 50
                            ? "bg-amber-500"
                            : vendor.risk_score >= 25
                              ? "bg-gray-400"
                              : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, vendor.risk_score)}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="c-bg-dark rounded-lg p-2">
                    <p className="text-[10px] c-text-3">Invoices</p>
                    <p className="text-sm font-bold c-text">
                      {vendor.total_invoices}
                    </p>
                  </div>
                  <div className="c-bg-dark rounded-lg p-2">
                    <p className="text-[10px] c-text-3">Mismatches</p>
                    <p className="text-sm font-bold c-text">
                      {vendor.mismatch_count}
                    </p>
                  </div>
                  <div className="c-bg-dark rounded-lg p-2">
                    <p className="text-[10px] c-text-3">Filing</p>
                    <p className="text-sm font-bold c-text">
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
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 c-bg-accent-light hover:c-bg-accent-light rounded-lg c-text-accent text-xs transition-colors"
                >
                  <Bot className="w-3 h-3" />
                  AI Risk Summary
                </button>
                <Link
                  href={`/risk/vendor?gstin=${vendor.gstin}`}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 c-bg-dark hover:c-bg-card rounded-lg c-text-2 text-xs transition-colors mt-2"
                >
                  <ShieldAlert className="w-3 h-3" />
                  View Scorecard
                </Link>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="c-text-3 text-sm">
                No vendors match the current filters.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="c-bg-card rounded-xl border c-border p-12 text-center">
          <ShieldAlert className="w-12 h-12 c-text-3 mx-auto mb-4" />
          <p className="c-text-2 font-medium mb-1">No vendor data</p>
          <p className="c-text-3 text-sm">
            Upload GST returns and run reconciliation first.
          </p>
        </div>
      )}

      {/* AI Summary Modal */}
      {(aiPanel || aiLoading) && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto" style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div
            className="rounded-xl w-full max-w-lg p-6 my-auto max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--bg-border)", boxShadow: "var(--shadow-lg)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <Bot className="w-5 h-5" style={{ color: "var(--accent)" }} />
                AI Risk Analysis
              </h3>
              <button
                onClick={() => {
                  setAiPanel(null);
                  setAiLoading(false);
                }}
                className="p-1 rounded-md transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {aiLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-2 mr-3" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
                <span style={{ color: "var(--text-secondary)" }}>Generating analysis...</span>
              </div>
            ) : aiPanel ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {aiPanel.vendor.legal_name || aiPanel.vendor.trade_name}
                    </p>
                    <p className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
                      {aiPanel.vendor.gstin}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded ${riskColor(aiPanel.vendor.risk_level)}`}
                  >
                    {aiPanel.vendor.risk_level}
                  </span>
                </div>
                <div className="rounded-lg p-4" style={{ backgroundColor: "var(--bg-dark)" }}>
                  <MarkdownRenderer content={aiPanel.ai_summary} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </PageShell>
  );
}
