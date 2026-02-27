"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getVendorRisks, getVendorRiskSummary } from "@/lib/api";
import { riskColor } from "@/lib/utils";
import {
  BarChart3,
  Upload,
  GitCompare,
  Network,
  FileSearch,
  ShieldAlert,
  Bot,
  X,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/reconcile", label: "Reconciliation", icon: GitCompare },
  { href: "/graph", label: "Graph Explorer", icon: Network },
  { href: "/audit", label: "Audit Trails", icon: FileSearch },
  { href: "/risk", label: "Vendor Risk", icon: ShieldAlert },
];

interface VendorRisk {
  gstin: string;
  trade_name: string;
  risk_level: string;
  risk_score: number;
  factors: {
    filing_compliance: number;
    mismatch_frequency: number;
    circular_trading: number;
    volume_anomaly: number;
  };
  total_invoices: number;
  mismatch_count: number;
  trade_partners: number;
}

interface AISummary {
  vendor: VendorRisk;
  ai_summary: string;
}

export default function RiskPage() {
  const [vendors, setVendors] = useState<VendorRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiPanel, setAiPanel] = useState<AISummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    getVendorRisks()
      .then((data) => setVendors((data as VendorRisk[]) || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadAISummary = async (gstin: string) => {
    setAiLoading(true);
    try {
      const data = (await getVendorRiskSummary(gstin)) as AISummary;
      setAiPanel(data);
    } catch {
      // pass
    }
    setAiLoading(false);
  };

  return (
    <div className="flex min-h-screen">
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
              item.href === "/risk"
                ? "bg-blue-600/20 text-blue-400"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-2">
            Vendor Risk Assessment
          </h1>
          <p className="text-gray-400 mb-8">
            Predictive risk scoring with AI-powered analysis
          </p>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
            </div>
          ) : vendors.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vendors.map((vendor) => (
                <div
                  key={vendor.gstin}
                  className={`bg-[#111827] rounded-xl border p-5 ${riskColor(vendor.risk_level)}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {vendor.trade_name || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-500 font-mono mt-1">
                        {vendor.gstin}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded ${riskColor(vendor.risk_level)}`}
                    >
                      {vendor.risk_level}
                    </span>
                  </div>

                  {/* Score bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Risk Score</span>
                      <span>{(vendor.risk_score * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          vendor.risk_score > 0.75
                            ? "bg-red-500"
                            : vendor.risk_score > 0.5
                              ? "bg-orange-500"
                              : vendor.risk_score > 0.25
                                ? "bg-yellow-500"
                                : "bg-green-500"
                        }`}
                        style={{
                          width: `${vendor.risk_score * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center mb-4">
                    <div className="bg-gray-800/50 rounded-lg p-2">
                      <p className="text-xs text-gray-400">Invoices</p>
                      <p className="text-sm font-bold text-white">
                        {vendor.total_invoices}
                      </p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-2">
                      <p className="text-xs text-gray-400">Mismatches</p>
                      <p className="text-sm font-bold text-white">
                        {vendor.mismatch_count}
                      </p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-2">
                      <p className="text-xs text-gray-400">Partners</p>
                      <p className="text-sm font-bold text-white">
                        {vendor.trade_partners}
                      </p>
                    </div>
                  </div>

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
          ) : (
            <div className="bg-[#111827] rounded-xl border border-gray-800 p-12 text-center">
              <ShieldAlert className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500">
                No vendor data available. Upload GST returns and run
                reconciliation first.
              </p>
            </div>
          )}

          {/* AI Summary Panel */}
          {(aiPanel || aiLoading) && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="bg-[#111827] rounded-xl border border-gray-700 w-full max-w-lg mx-4 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Bot className="w-5 h-5 text-blue-400" />
                    AI Risk Analysis
                  </h3>
                  <button
                    onClick={() => setAiPanel(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {aiLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3" />
                    <span className="text-gray-400">
                      Generating analysis...
                    </span>
                  </div>
                ) : aiPanel ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {aiPanel.vendor.trade_name}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">
                        {aiPanel.vendor.gstin}
                      </p>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {aiPanel.ai_summary}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
