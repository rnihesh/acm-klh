"use client";

import { useState, useMemo } from "react";
import PageShell from "@/components/PageShell";
import { TableSkeleton } from "@/components/Skeleton";
import {
  triggerReconciliation,
  getReconciliationResults,
  generateAuditTrail,
  downloadPDF,
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
  Download,
  ArrowUpDown,
  AlertTriangle,
  IndianRupee,
} from "lucide-react";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import SearchableDropdown, { DropdownOption } from "@/components/SearchableDropdown";

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

type SortKey = "mismatch_type" | "severity" | "amount_difference" | "invoice_number" | "supplier_gstin";
type SortDir = "asc" | "desc";

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export default function ReconcilePage() {
  const [period, setPeriod] = useState("012026");
  const [status, setStatus] = useState<ReconcileStatus | null>(null);
  const [allResults, setAllResults] = useState<Mismatch[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterVendor, setFilterVendor] = useState("");
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState<string | null>(null);
  const [auditResults, setAuditResults] = useState<Record<string, string>>({});
  const [pdfLoading, setPdfLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | "">("");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const PAGE_SIZE = 50;

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
        1,
        500,
        undefined,
        undefined
      )) as { results: Mismatch[]; total: number };
      setAllResults(res.results || []);
      setTotal(res.total || 0);
      setPage(p);
    } finally {
      setLoading(false);
    }
  };

  // Client-side filtering + sorting
  const filteredResults = useMemo(() => {
    let r = [...allResults];
    if (filterType) r = r.filter((m) => m.mismatch_type === filterType);
    if (filterSeverity) r = r.filter((m) => m.severity === filterSeverity);
    if (filterVendor) {
      r = r.filter(
        (m) => m.supplier_gstin === filterVendor || m.buyer_gstin === filterVendor
      );
    }
    if (sortKey) {
      r.sort((a, b) => {
        let cmp = 0;
        if (sortKey === "amount_difference") {
          cmp = a.amount_difference - b.amount_difference;
        } else if (sortKey === "severity") {
          cmp = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
        } else {
          cmp = (a[sortKey] || "").localeCompare(b[sortKey] || "");
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return r;
  }, [allResults, filterType, filterSeverity, filterVendor, sortKey, sortDir]);

  const pagedResults = filteredResults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredResults.length / PAGE_SIZE));

  // Vendor dropdown options
  const vendorOptions: DropdownOption[] = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of allResults) {
      if (m.supplier_gstin) map.set(m.supplier_gstin, m.supplier_gstin);
      if (m.buyer_gstin) map.set(m.buyer_gstin, m.buyer_gstin);
    }
    return Array.from(map.entries()).map(([gstin]) => ({
      value: gstin,
      label: gstin.slice(0, 4) + "..." + gstin.slice(-4),
      sublabel: gstin,
    }));
  }, [allResults]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalItc = filteredResults.reduce((s, m) => s + m.amount_difference, 0);
    const bySeverity: Record<string, number> = {};
    for (const m of filteredResults) {
      bySeverity[m.severity] = (bySeverity[m.severity] || 0) + 1;
    }
    return { total: filteredResults.length, totalItc, bySeverity };
  }, [filteredResults]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
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

  const handlePdfDownload = async () => {
    setPdfLoading(true);
    try {
      await downloadPDF(period);
    } catch {
      // pass
    }
    setPdfLoading(false);
  };

  const SortHeader = ({ label, sortField, align = "left" }: { label: string; sortField: SortKey; align?: string }) => (
    <th
      className={`text-${align} px-4 py-3 c-text-2 font-medium cursor-pointer hover:c-text select-none transition-colors`}
      onClick={() => handleSort(sortField)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortKey === sortField ? "c-text-accent" : "c-text-3"}`} />
      </span>
    </th>
  );

  // Page numbers for pagination
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  return (
    <PageShell
      title="GST Reconciliation"
      description="Match GSTR-1 vs GSTR-2B via Knowledge Graph traversal"
    >
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="text"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          placeholder="Return period (MMYYYY)"
          className="rounded-lg px-3 py-2 text-sm w-44 outline-none"
        />
        <button
          onClick={runReconciliation}
          disabled={running}
          className="flex items-center gap-2 px-5 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)" }}
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? "Running..." : "Run Reconciliation"}
        </button>

        {status && (
          <>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <span className="text-sm text-emerald-400">{status.total_mismatches} mismatches found</span>
            </div>
            <button
              onClick={handlePdfDownload}
              disabled={pdfLoading}
              className="flex items-center gap-2 px-4 py-2 c-bg-dark hover:c-bg-card rounded-lg text-sm c-text-2 transition-colors disabled:opacity-40 border c-border ml-auto"
            >
              {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export PDF
            </button>
          </>
        )}
      </div>

      {/* Breakdown chips */}
      {status?.breakdown && Object.keys(status.breakdown).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {Object.entries(status.breakdown).map(([type, count]) => (
            <button
              key={type}
              onClick={() => {
                setFilterType(filterType === type ? "" : type);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all ${
                filterType === type ? "text-white" : "c-bg-dark c-text-2 hover:c-bg-card"
              }`}
              style={filterType === type ? { backgroundColor: "var(--accent)" } : undefined}
            >
              {type}: {count as number}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      {allResults.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
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
            onChange={(e) => { setFilterSeverity(e.target.value); setPage(1); }}
            className="rounded-lg px-3 py-2 text-sm outline-none"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <SearchableDropdown
            options={vendorOptions}
            value={filterVendor}
            onChange={(v) => { setFilterVendor(v); setPage(1); }}
            placeholder="Filter by vendor GSTIN..."
            className="w-full sm:w-56"
          />
        </div>
      )}

      {/* Summary Bar */}
      {allResults.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2 px-3 py-2 c-bg-dark rounded-lg border c-border">
            <AlertTriangle className="w-3.5 h-3.5 c-text-accent" />
            <span className="text-xs c-text-2">{summaryStats.total} mismatches</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 c-bg-dark rounded-lg border c-border">
            <IndianRupee className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs c-text-2">{formatCurrency(summaryStats.totalItc)} at risk</span>
          </div>
          {Object.entries(summaryStats.bySeverity).map(([sev, cnt]) => (
            <div key={sev} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${severityColor(sev)}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {sev}: {cnt}
            </div>
          ))}
        </div>
      )}

      {/* Results Table */}
      {loading ? (
        <TableSkeleton rows={8} />
      ) : pagedResults.length > 0 ? (
        <>
          <div className="c-bg-card rounded-xl border c-border overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b c-border c-bg-dark">
                    <th className="text-left px-4 py-3 c-text-2 font-medium w-8" />
                    <SortHeader label="Type" sortField="mismatch_type" />
                    <SortHeader label="Severity" sortField="severity" />
                    <SortHeader label="Invoice" sortField="invoice_number" />
                    <SortHeader label="Supplier GSTIN" sortField="supplier_gstin" />
                    <SortHeader label="Difference" sortField="amount_difference" align="right" />
                  </tr>
                </thead>
                <tbody>
                  {pagedResults.map((r) => (
                    <>
                      <tr
                        key={r.id}
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                        className="border-b c-border hover:c-bg-dark cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          {expandedId === r.id ? <ChevronUp className="w-4 h-4 c-text-3" /> : <ChevronDown className="w-4 h-4 c-text-3" />}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs c-text-2">{r.mismatch_type}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded ${severityColor(r.severity)}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {r.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 c-text-2 font-mono text-xs">{r.invoice_number}</td>
                        <td className="px-4 py-3 c-text-2 font-mono text-xs">{r.supplier_gstin}</td>
                        <td className={`px-4 py-3 text-right font-medium font-mono text-sm ${r.amount_difference > 10000 ? "text-red-400" : r.amount_difference > 5000 ? "c-text-accent" : "c-text"}`}>
                          {formatCurrency(r.amount_difference)}
                        </td>
                      </tr>
                      {expandedId === r.id && (
                        <tr key={`${r.id}-detail`} className="border-b c-border">
                          <td colSpan={6} className="px-4 py-4 c-bg-dark">
                            <div className="space-y-3">
                              <p className="text-sm c-text-2">{r.description}</p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div>
                                  <span className="c-text-3">Buyer GSTIN</span>
                                  <p className="c-text-2 font-mono mt-0.5">{r.buyer_gstin || "N/A"}</p>
                                </div>
                                {r.field_name && (
                                  <div>
                                    <span className="c-text-3">Field</span>
                                    <p className="c-text-2 font-mono mt-0.5">{r.field_name}</p>
                                  </div>
                                )}
                                {r.expected_value && (
                                  <div>
                                    <span className="c-text-3">Expected</span>
                                    <p className="text-emerald-400 font-mono mt-0.5">{r.expected_value}</p>
                                  </div>
                                )}
                                {r.actual_value && (
                                  <div>
                                    <span className="c-text-3">Actual</span>
                                    <p className="text-red-400 font-mono mt-0.5">{r.actual_value}</p>
                                  </div>
                                )}
                              </div>
                              {/* AI Audit Button */}
                              <div className="pt-2 border-t c-border">
                                {auditResults[r.id] ? (
                                  <div className="c-bg-accent-subtle border border-[#d97757]/10 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Bot className="w-4 h-4 c-text-accent" />
                                      <span className="text-xs font-medium c-text-accent">AI Audit Explanation</span>
                                    </div>
                                    <MarkdownRenderer content={auditResults[r.id]} />
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleAudit(r); }}
                                    disabled={auditLoading === r.id}
                                    className="flex items-center gap-2 px-3 py-1.5 c-bg-accent-light hover:c-bg-accent-light rounded-lg c-text-accent text-xs transition-colors disabled:opacity-50"
                                  >
                                    {auditLoading === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
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
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm c-text-2">{filteredResults.length} results total</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="p-2 c-bg-dark rounded-lg disabled:opacity-30 c-text-2 hover:c-text transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {pageNumbers[0] > 1 && (
                <>
                  <button onClick={() => setPage(1)} className="px-3 py-1.5 c-bg-dark rounded-lg text-sm c-text-2 hover:c-text transition-colors">1</button>
                  {pageNumbers[0] > 2 && <span className="c-text-3 px-1">...</span>}
                </>
              )}
              {pageNumbers.map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    p === page ? "text-white" : "c-bg-dark c-text-2 hover:c-text"
                  }`}
                  style={p === page ? { backgroundColor: "var(--accent)" } : undefined}
                >
                  {p}
                </button>
              ))}
              {pageNumbers[pageNumbers.length - 1] < totalPages && (
                <>
                  {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <span className="c-text-3 px-1">...</span>}
                  <button onClick={() => setPage(totalPages)} className="px-3 py-1.5 c-bg-dark rounded-lg text-sm c-text-2 hover:c-text transition-colors">{totalPages}</button>
                </>
              )}
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="p-2 c-bg-dark rounded-lg disabled:opacity-30 c-text-2 hover:c-text transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      ) : status ? (
        <div className="c-bg-card rounded-xl border c-border p-12 text-center">
          <p className="c-text-3">No mismatches found for period {period}.</p>
        </div>
      ) : null}
    </PageShell>
  );
}
