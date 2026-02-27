"use client";

import { useState } from "react";
import Link from "next/link";
import {
  triggerReconciliation,
  getReconciliationResults,
  generateAuditTrail,
} from "@/lib/api";
import { formatCurrency, severityColor } from "@/lib/utils";
import {
  BarChart3,
  Upload,
  GitCompare,
  Network,
  FileSearch,
  ShieldAlert,
  Play,
  ChevronLeft,
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

interface Mismatch {
  id: string;
  mismatch_type: string;
  severity: string;
  supplier_gstin: string;
  buyer_gstin: string;
  invoice_number: string;
  amount_difference: number;
  description: string;
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
              item.href === "/reconcile"
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
            GST Reconciliation
          </h1>
          <p className="text-gray-400 mb-6">
            Match GSTR-1 vs GSTR-2B via Knowledge Graph traversal
          </p>

          {/* Controls */}
          <div className="flex items-center gap-4 mb-6">
            <input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="Return period (MMYYYY)"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm w-48"
            />
            <button
              onClick={runReconciliation}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white text-sm font-medium transition-colors"
            >
              <Play className="w-4 h-4" />
              {running ? "Running..." : "Run Reconciliation"}
            </button>

            {status && (
              <span className="text-sm text-gray-400">
                Found {status.total_mismatches} mismatches
              </span>
            )}
          </div>

          {/* Breakdown */}
          {status?.breakdown && Object.keys(status.breakdown).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {Object.entries(status.breakdown).map(([type, count]) => (
                <span
                  key={type}
                  className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-300 font-mono"
                >
                  {type}: {count as number}
                </span>
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
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
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
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
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
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="bg-[#111827] rounded-xl border border-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">
                        Type
                      </th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">
                        Severity
                      </th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">
                        Invoice
                      </th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">
                        Supplier GSTIN
                      </th>
                      <th className="text-right px-4 py-3 text-gray-400 font-medium">
                        Difference
                      </th>
                      <th className="text-right px-4 py-3 text-gray-400 font-medium">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30"
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-gray-300">
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
                        <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                          {r.invoice_number}
                        </td>
                        <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                          {r.supplier_gstin}
                        </td>
                        <td className="px-4 py-3 text-right text-white">
                          {formatCurrency(r.amount_difference)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => generateAuditTrail(r as unknown as Record<string, unknown>)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            Generate Audit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-gray-400">
                  {total} results total
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchResults(page - 1)}
                    disabled={page <= 1}
                    className="p-2 bg-gray-800 rounded-lg disabled:opacity-30 text-gray-400 hover:text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-400">
                    Page {page} of {Math.ceil(total / 50)}
                  </span>
                  <button
                    onClick={() => fetchResults(page + 1)}
                    disabled={page >= Math.ceil(total / 50)}
                    className="p-2 bg-gray-800 rounded-lg disabled:opacity-30 text-gray-400 hover:text-white"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : status ? (
            <p className="text-gray-500 text-center py-12">
              No mismatches found for period {period}.
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
