"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAuditTrails } from "@/lib/api";
import {
  BarChart3,
  Upload,
  GitCompare,
  Network,
  FileSearch,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/reconcile", label: "Reconciliation", icon: GitCompare },
  { href: "/graph", label: "Graph Explorer", icon: Network },
  { href: "/audit", label: "Audit Trails", icon: FileSearch },
  { href: "/risk", label: "Vendor Risk", icon: ShieldAlert },
];

interface AuditTrail {
  id: string;
  mismatch_id: string;
  explanation: string;
  invoice_chain: Array<{
    step: number;
    action: string;
    gstin?: string;
    invoice?: string;
    status?: string;
    impact?: string;
  }>;
  recommendation: string;
  generated_at: string;
}

export default function AuditPage() {
  const [trails, setTrails] = useState<AuditTrail[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuditTrails()
      .then((data) => setTrails((data as AuditTrail[]) || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
              item.href === "/audit"
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
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-2">Audit Trails</h1>
          <p className="text-gray-400 mb-8">
            AI-generated audit explanations and invoice chain tracing
          </p>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
            </div>
          ) : trails.length > 0 ? (
            <div className="space-y-4">
              {trails.map((trail) => (
                <div
                  key={trail.id}
                  className="bg-[#111827] rounded-xl border border-gray-800 overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedId(
                        expandedId === trail.id ? null : trail.id
                      )
                    }
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-800/30 transition-colors"
                  >
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">
                        Mismatch: {trail.mismatch_id || trail.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Generated:{" "}
                        {new Date(trail.generated_at).toLocaleString()}
                      </p>
                    </div>
                    {expandedId === trail.id ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {expandedId === trail.id && (
                    <div className="px-6 pb-6 border-t border-gray-800 pt-4 space-y-6">
                      {/* AI Explanation */}
                      <div>
                        <h3 className="text-sm font-semibold text-blue-400 mb-2">
                          AI Explanation
                        </h3>
                        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {trail.explanation}
                        </p>
                      </div>

                      {/* Invoice Chain */}
                      <div>
                        <h3 className="text-sm font-semibold text-blue-400 mb-3">
                          Invoice Chain
                        </h3>
                        <div className="space-y-2">
                          {trail.invoice_chain.map((step) => (
                            <div
                              key={step.step}
                              className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg"
                            >
                              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-xs text-white font-bold">
                                  {step.step}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm text-white">
                                  {step.action}
                                </p>
                                <div className="flex gap-4 mt-1 text-xs text-gray-500">
                                  {step.gstin && (
                                    <span>GSTIN: {step.gstin}</span>
                                  )}
                                  {step.invoice && (
                                    <span>Invoice: {step.invoice}</span>
                                  )}
                                  {step.status && (
                                    <span className="text-yellow-400">
                                      {step.status}
                                    </span>
                                  )}
                                  {step.impact && (
                                    <span className="text-red-400">
                                      {step.impact}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recommendation */}
                      <div>
                        <h3 className="text-sm font-semibold text-green-400 mb-2">
                          Recommendation
                        </h3>
                        <p className="text-sm text-gray-300">
                          {trail.recommendation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#111827] rounded-xl border border-gray-800 p-12 text-center">
              <FileSearch className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500">
                No audit trails generated yet. Run reconciliation and generate
                audit trails from mismatch results.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
