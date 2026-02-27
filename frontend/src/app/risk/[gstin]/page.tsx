"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PageShell from "@/components/PageShell";
import { getVendorRiskDetail, getVendorScorecard, getVendorRiskSummary } from "@/lib/api";
import { riskColor, formatCurrency } from "@/lib/utils";
import { ArrowLeft, Bot, ShieldAlert, X } from "lucide-react";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
} from "recharts";

const CHART_COLORS = ["#e5e5e5", "#a3a3a3", "#737373", "#525252"];

export default function VendorScorecardPage() {
  const params = useParams();
  const gstin = params.gstin as string;
  const [vendor, setVendor] = useState<any>(null);
  const [scorecard, setScorecard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      getVendorRiskDetail(gstin),
      getVendorScorecard(gstin),
    ]).then(([vendorRes, scorecardRes]) => {
      if (vendorRes.status === "fulfilled") setVendor(vendorRes.value);
      if (scorecardRes.status === "fulfilled") setScorecard(scorecardRes.value);
      setLoading(false);
    });
  }, [gstin]);

  const loadAISummary = async () => {
    setAiLoading(true);
    try {
      const data = (await getVendorRiskSummary(gstin)) as any;
      setAiSummary(data.ai_summary || "No summary available.");
    } catch {
      setAiSummary("Unable to generate AI summary.");
    }
    setAiLoading(false);
  };

  const riskBreakdown = scorecard?.risk_breakdown
    ? Object.entries(scorecard.risk_breakdown).map(([key, val]: [string, any]) => ({
        name: key.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
        score: Math.round(val.score * 10) / 10,
        weight: val.weight * 100,
      }))
    : [];

  return (
    <PageShell
      title="Vendor Scorecard"
      description={`Detailed risk analysis for ${gstin}`}
    >
      <Link
        href="/risk"
        className="inline-flex items-center gap-2 text-sm c-text-2 hover:c-text mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Vendor Risk
      </Link>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{ borderColor: "var(--text-secondary)", borderTopColor: "transparent" }} />
        </div>
      ) : vendor ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="c-bg-card rounded-xl border c-border p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold c-text">
                  {vendor.legal_name || vendor.trade_name || "Unknown"}
                </h2>
                <p className="text-sm c-text-3 font-mono mt-1">{vendor.gstin}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold c-text">{Math.round(vendor.risk_score)}</p>
                  <p className="text-xs c-text-3">Risk Score</p>
                </div>
                <span className={`text-sm font-bold px-3 py-1.5 rounded-lg ${riskColor(vendor.risk_level)}`}>
                  {vendor.risk_level}
                </span>
              </div>
            </div>
            {/* Score bar */}
            <div className="mt-4">
              <div className="w-full c-bg-dark rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    vendor.risk_score >= 75 ? "bg-red-500" : vendor.risk_score >= 50 ? "bg-amber-500" : vendor.risk_score >= 25 ? "bg-gray-400" : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, vendor.risk_score)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Risk Factor Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {riskBreakdown.map((factor, i) => (
              <div key={factor.name} className="c-bg-card rounded-xl border c-border p-4" style={{ boxShadow: "var(--shadow-sm)" }}>
                <p className="text-xs c-text-3 mb-2">{factor.name}</p>
                <p className="text-2xl font-bold c-text">{factor.score}</p>
                <p className="text-[10px] c-text-3 mt-1">Weight: {factor.weight}%</p>
                <div className="mt-2 w-full c-bg-dark rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${Math.min(100, factor.score * 4)}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Invoices", value: vendor.total_invoices },
              { label: "Mismatches", value: vendor.mismatch_count },
              { label: "Filing Rate", value: `${vendor.filing_rate}%` },
              { label: "Trade Partners", value: scorecard?.trade_partners?.length || 0 },
            ].map((stat) => (
              <div key={stat.label} className="c-bg-card rounded-xl border c-border p-4 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
                <p className="text-xs c-text-3">{stat.label}</p>
                <p className="text-xl font-bold c-text mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ITC Claimed vs Eligible */}
            <div className="c-bg-card rounded-xl border c-border p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
              <h3 className="text-sm font-semibold c-text mb-4">ITC Claimed vs Eligible</h3>
              {scorecard?.itc_breakdown?.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={scorecard.itc_breakdown} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                    <XAxis dataKey="period" tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} axisLine={{ stroke: "var(--bg-border)" }} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} axisLine={{ stroke: "var(--bg-border)" }} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: "8px", color: "var(--text-primary)", fontSize: 12 }} formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="claimed" name="Claimed" fill="#a3a3a3" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="eligible" name="Eligible" fill="#e5e5e5" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="c-text-3 text-sm py-8 text-center">No ITC data available.</p>
              )}
            </div>

            {/* Mismatch Timeline */}
            <div className="c-bg-card rounded-xl border c-border p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
              <h3 className="text-sm font-semibold c-text mb-4">Mismatch Timeline</h3>
              {scorecard?.mismatch_timeline?.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={scorecard.mismatch_timeline} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                    <XAxis dataKey="period" tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} axisLine={{ stroke: "var(--bg-border)" }} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} axisLine={{ stroke: "var(--bg-border)" }} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: "8px", color: "var(--text-primary)", fontSize: 12 }} />
                    <Area type="monotone" dataKey="count" stroke="#a3a3a3" fill="#a3a3a3" fillOpacity={0.2} name="Mismatches" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="c-text-3 text-sm py-8 text-center">No mismatch timeline data.</p>
              )}
            </div>
          </div>

          {/* Trade Partners */}
          {scorecard?.trade_partners?.length > 0 && (
            <div className="c-bg-card rounded-xl border c-border p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
              <h3 className="text-sm font-semibold c-text mb-4">Trade Partners</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b c-border">
                      <th className="text-left py-2 px-3 c-text-2 text-xs font-medium">Partner</th>
                      <th className="text-left py-2 px-3 c-text-2 text-xs font-medium">GSTIN</th>
                      <th className="text-right py-2 px-3 c-text-2 text-xs font-medium">Volume</th>
                      <th className="text-right py-2 px-3 c-text-2 text-xs font-medium">Transactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scorecard.trade_partners.map((p: any) => (
                      <tr key={p.gstin} className="border-b c-border hover:c-bg-dark transition-colors">
                        <td className="py-2 px-3 c-text text-sm">{p.name || "Unknown"}</td>
                        <td className="py-2 px-3 c-text-3 text-xs font-mono">{p.gstin}</td>
                        <td className="py-2 px-3 c-text text-sm text-right font-mono">{formatCurrency(p.volume || 0)}</td>
                        <td className="py-2 px-3 c-text-2 text-sm text-right">{p.frequency || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Filing History */}
          {scorecard?.filing_history?.length > 0 && (
            <div className="c-bg-card rounded-xl border c-border p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
              <h3 className="text-sm font-semibold c-text mb-4">Filing History</h3>
              <div className="flex flex-wrap gap-2">
                {scorecard.filing_history.map((f: any, i: number) => (
                  <div key={i} className="px-3 py-2 c-bg-dark rounded-lg text-center">
                    <p className="text-[10px] c-text-3">{f.return_type}</p>
                    <p className="text-xs c-text font-mono">{f.period}</p>
                    <span className="text-[9px] text-emerald-400">{f.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Summary Button */}
          <div className="c-bg-card rounded-xl border c-border p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <button
              onClick={loadAISummary}
              disabled={aiLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
            >
              <Bot className="w-4 h-4" />
              {aiLoading ? "Generating..." : "Generate AI Risk Summary"}
            </button>
            {aiSummary && (
              <div className="mt-4 p-4 c-bg-dark rounded-lg">
                <MarkdownRenderer content={aiSummary} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="c-bg-card rounded-xl border c-border p-12 text-center">
          <ShieldAlert className="w-12 h-12 c-text-3 mx-auto mb-4" />
          <p className="c-text-2 font-medium mb-1">Vendor not found</p>
          <p className="c-text-3 text-sm">No data available for GSTIN: {gstin}</p>
        </div>
      )}
    </PageShell>
  );
}
