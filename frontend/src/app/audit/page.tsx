"use client";

import { useEffect, useState } from "react";
import PageShell from "@/components/PageShell";
import { CardSkeleton } from "@/components/Skeleton";
import { getAuditTrails } from "@/lib/api";
import { ChevronDown, ChevronRight, FileSearch, Copy, Check } from "lucide-react";

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
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    getAuditTrails()
      .then((data) => setTrails((data as AuditTrail[]) || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const copyTrail = (trail: AuditTrail) => {
    const text = `Mismatch: ${trail.mismatch_id}\n\nExplanation:\n${trail.explanation}\n\nRecommendation:\n${trail.recommendation}`;
    navigator.clipboard.writeText(text);
    setCopied(trail.id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <PageShell
      title="Audit Trails"
      description="AI-generated audit explanations and invoice chain tracing"
    >
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : trails.length > 0 ? (
        <div className="space-y-4">
          {trails.map((trail) => (
            <div
              key={trail.id}
              className="bg-surface-card rounded-xl border border-surface-border overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedId(expandedId === trail.id ? null : trail.id)
                }
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-dark/30 transition-colors"
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-content">
                    Mismatch: {trail.mismatch_id || trail.id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-content-tertiary mt-1">
                    Generated: {new Date(trail.generated_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyTrail(trail);
                    }}
                    className="p-1.5 hover:bg-surface-border rounded transition-colors"
                  >
                    {copied === trail.id ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-content-tertiary" />
                    )}
                  </button>
                  {expandedId === trail.id ? (
                    <ChevronDown className="w-5 h-5 text-content-secondary" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-content-secondary" />
                  )}
                </div>
              </button>

              {expandedId === trail.id && (
                <div className="px-6 pb-6 border-t border-surface-border pt-4 space-y-6">
                  {/* AI Explanation */}
                  <div>
                    <h3 className="text-sm font-semibold text-accent mb-2">
                      AI Explanation
                    </h3>
                    <p className="text-sm text-content-secondary leading-relaxed whitespace-pre-wrap bg-surface-dark/50 rounded-lg p-4">
                      {trail.explanation}
                    </p>
                  </div>

                  {/* Invoice Chain */}
                  <div>
                    <h3 className="text-sm font-semibold text-accent mb-3">
                      Invoice Chain
                    </h3>
                    <div className="relative">
                      {/* Vertical line connector */}
                      <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-surface-border" />
                      <div className="space-y-3">
                        {trail.invoice_chain.map((step) => (
                          <div
                            key={step.step}
                            className="flex items-start gap-3 relative"
                          >
                            <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center flex-shrink-0 z-10">
                              <span className="text-xs text-white font-bold">
                                {step.step}
                              </span>
                            </div>
                            <div className="flex-1 p-3 bg-surface-dark/50 rounded-lg">
                              <p className="text-sm text-content">
                                {step.action}
                              </p>
                              <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-content-tertiary">
                                {step.gstin && (
                                  <span className="font-mono">
                                    GSTIN: {step.gstin}
                                  </span>
                                )}
                                {step.invoice && (
                                  <span className="font-mono">
                                    Invoice: {step.invoice}
                                  </span>
                                )}
                                {step.status && (
                                  <span className="text-yellow-400 font-medium">
                                    {step.status}
                                  </span>
                                )}
                                {step.impact && (
                                  <span className="text-red-400 font-medium">
                                    {step.impact}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-emerald-400 mb-2">
                      Recommendation
                    </h3>
                    <p className="text-sm text-content-secondary">
                      {trail.recommendation}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface-card rounded-xl border border-surface-border p-12 text-center">
          <FileSearch className="w-12 h-12 text-content-tertiary mx-auto mb-4" />
          <p className="text-content-secondary font-medium mb-1">No audit trails yet</p>
          <p className="text-content-tertiary text-sm">
            Run reconciliation, then click &quot;Generate AI Audit&quot; on any mismatch.
          </p>
        </div>
      )}
    </PageShell>
  );
}
