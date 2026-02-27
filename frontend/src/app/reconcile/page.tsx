"use client";

import { useState } from "react";
import PageShell from "@/components/PageShell";
import { TableSkeleton } from "@/components/Skeleton";
import {
  triggerReconciliation,
  getReconciliationResults,
  generateAuditTrail,
} from "@/lib/api";
import { formatCurrency, severityColor } from "@/lib/utils";
import {
  Play,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Bot,
  Loader2,
} from "lucide-react";

interface Mismatch {
  id: string;
  mismatch_type: string;
  severity: string;
  supplier_gstin: string;
  buyer_gstin: string;
  invoice_number: string;
  amount_difference: number;
  description: string;
  field_name?: string;
  expected_value?: string;
  actual_value?: string;
  return_period?: string;
}

interface ReconcileStatus {
  status: string;
  total_mismatches: number;
  breakdown: Record<string, number>;
}

export default function ReconcilePage() {
  const [period, setPeriod] = useState("012026");
  const [status, setStatus] = useState<ReconcileStatus | null>(null);
  const [results, setResults] = useState<Mismatch[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState<string | null>(null);
  const [auditResults, setAuditResults] = useState<Record<string, string>>({});

  const runReconciliation = async () => {
    setRunning(true);
    try {
      const res = (await triggerReconciliation(period)) as ReconcileStatus;
      setStatus(res);
      await fetchResults(1);
    } finally {
      setRunning(false);
    }
  };

  const fetchResults = async (p: number) => {
    setLoading(true);
    try {
      const res = (await getReconciliationResults(
        period,
        p,
        50,
        filterType || undefined,
        filterSeverity || undefined
      )) as { results: Mismatch[]; total: number };
      setResults(res.results || []);
      setTotal(res.total || 0);
      setPage(p);
    } finally {
      setLoading(false);
    }
  };

  const handleAudit = async (mismatch: Mismatch) => {
    if (auditResults[mismatch.id]) return;
    setAuditLoading(mismatch.id);
    try {
      const res = (await generateAuditTrail(
        mismatch as unknown as Record<string, unknown>
      )) as { explanation: string };
      setAuditResults((prev) => ({
        ...prev,
        [mismatch.id]: res.explanation,
      }));
    } catch {
      setAuditResults((prev) => ({
        ...prev,
        [mismatch.id]: "Failed to generate audit explanation.",
      }));
    }
    setAuditLoading(null);
  };

  return (
    <PageShell
      title="GST Reconciliation"
      description="Match GSTR-1 vs GSTR-2B via Knowledge Graph traversal"
    >
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <input
          type="text"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          placeholder="Return period (MMYYYY)"
          className="rounded-lg px-3 py-2 text-sm w-48 outline-none"
        />
        <button
          onClick={runReconciliation}
          disabled={running}
          className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 rounded-lg text-white text-sm font-medium transition-colors"
        >
          {running ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {running ? "Running..." : "Run Reconciliation"}
        </button>

        {status && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <span className="text-sm text-emerald-400">
              {status.total_mismatches} mismatches found
            </span>
          </div>
        )}
      </div>

      {/* Breakdown chips */}
      {status?.breakdown && Object.keys(status.breakdown).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(status.breakdown).map(([type, count]) => (
            <button
              key={type}
              onClick={() => {
                setFilterType(filterType === type ? "" : type);
                fetchResults(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all ${
                filterType === type
                  ? "bg-accent text-white"
                  : "bg-surface-dark text-content-secondary hover:bg-surface-card"
              }`}
            >
              {type}: {count as number}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      {results.length > 0 && (
        <div className="flex items-center gap-4 mb-4">
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              fetchResults(1);
            }}
            className="rounded-lg px-3 py-2 text-sm outline-none"
          >
            <option value="">All Types</option>
            <option value="MISSING_IN_GSTR2B">Missing in GSTR-2B</option>
            <option value="MISSING_IN_GSTR1">Missing in GSTR-1</option>
            <option value="VALUE_MISMATCH">Value Mismatch</option>
            <option value="RATE_MISMATCH">Rate Mismatch</option>
            <option value="DUPLICATE_INVOICE">Duplicate Invoice</option>
            <option value="EXCESS_ITC">Excess ITC</option>
          </select>
          <select
            value={filterSeverity}
            onChange={(e) => {
              setFilterSeverity(e.target.value);
              fetchResults(1);
            }}
            className="rounded-lg px-3 py-2 text-sm outline-none"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      )}

      {/* Results Table */}
      {loading ? (
        <TableSkeleton rows={8} />
      ) : results.length > 0 ? (
        <>
          <div className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-dark/50">
                  <th className="text-left px-4 py-3 text-content-secondary font-medium w-8" />
                  <th className="text-left px-4 py-3 text-content-secondary font-medium">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-content-secondary font-medium">
                    Severity
                  </th>
                  <th className="text-left px-4 py-3 text-content-secondary font-medium">
                    Invoice
                  </th>
                  <th className="text-left px-4 py-3 text-content-secondary font-medium">
                    Supplier GSTIN
                  </th>
                  <th className="text-right px-4 py-3 text-content-secondary font-medium">
                    Difference
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <>
                    <tr
                      key={r.id}
                      onClick={() =>
                        setExpandedId(expandedId === r.id ? null : r.id)
                      }
                      className="border-b border-surface-border/60 hover:bg-surface-dark/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        {expandedId === r.id ? (
                          <ChevronUp className="w-4 h-4 text-content-tertiary" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-content-tertiary" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-content-secondary">
                          {r.mismatch_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded ${severityColor(r.severity)}`}
                        >
                          {r.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-content-secondary font-mono text-xs">
                        {r.invoice_number}
                      </td>
                      <td className="px-4 py-3 text-content-secondary font-mono text-xs">
                        {r.supplier_gstin}
                      </td>
                      <td className="px-4 py-3 text-right text-content font-medium">
                        {formatCurrency(r.amount_difference)}
                      </td>
                    </tr>
                    {expandedId === r.id && (
                      <tr key={`${r.id}-detail`} className="border-b border-surface-border/60">
                        <td colSpan={6} className="px-4 py-4 bg-surface-dark/20">
                          <div className="space-y-3">
                            <p className="text-sm text-content-secondary">
                              {r.description}
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div>
                                <span className="text-content-tertiary">Buyer GSTIN</span>
                                <p className="text-content-secondary font-mono mt-0.5">
                                  {r.buyer_gstin || "N/A"}
                                </p>
                              </div>
                              {r.field_name && (
                                <div>
                                  <span className="text-content-tertiary">Field</span>
                                  <p className="text-content-secondary font-mono mt-0.5">
                                    {r.field_name}
                                  </p>
                                </div>
                              )}
                              {r.expected_value && (
                                <div>
                                  <span className="text-content-tertiary">Expected</span>
                                  <p className="text-emerald-400 font-mono mt-0.5">
                                    {r.expected_value}
                                  </p>
                                </div>
                              )}
                              {r.actual_value && (
                                <div>
                                  <span className="text-content-tertiary">Actual</span>
                                  <p className="text-red-400 font-mono mt-0.5">
                                    {r.actual_value}
                                  </p>
                                </div>
                              )}
                            </div>
                            {/* AI Audit Button */}
                            <div className="pt-2 border-t border-surface-border">
                              {auditResults[r.id] ? (
                                <div className="bg-accent-subtle border border-accent/10 rounded-lg p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Bot className="w-4 h-4 text-accent" />
                                    <span className="text-xs font-medium text-accent">
                                      AI Audit Explanation
                                    </span>
                                  </div>
                                  <p className="text-sm text-content-secondary leading-relaxed whitespace-pre-wrap">
                                    {auditResults[r.id]}
                                  </p>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAudit(r);
                                  }}
                                  disabled={auditLoading === r.id}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-accent-light hover:bg-accent-subtle rounded-lg text-accent text-xs transition-colors disabled:opacity-50"
                                >
                                  {auditLoading === r.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Bot className="w-3 h-3" />
                                  )}
                                  Generate AI Audit Explanation
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-content-secondary">
              {total} results total
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchResults(page - 1)}
                disabled={page <= 1}
                className="p-2 bg-surface-dark rounded-lg disabled:opacity-30 text-content-secondary hover:text-content transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-content-secondary min-w-[100px] text-center">
                Page {page} of {Math.max(1, Math.ceil(total / 50))}
              </span>
              <button
                onClick={() => fetchResults(page + 1)}
                disabled={page >= Math.ceil(total / 50)}
                className="p-2 bg-surface-dark rounded-lg disabled:opacity-30 text-content-secondary hover:text-content transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      ) : status ? (
        <div className="bg-surface-card rounded-xl border border-surface-border p-12 text-center">
          <p className="text-content-tertiary">
            No mismatches found for period {period}.
          </p>
        </div>
      ) : null}
    </PageShell>
  );
}
