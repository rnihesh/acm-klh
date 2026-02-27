"use client";

import { useEffect, useState, useRef } from "react";
import PageShell from "@/components/PageShell";
import {
  getGSTNStatus,
  fetchGSTN,
  importERP,
  getNotificationSettings,
  configureNotifications,
  testNotification,
} from "@/lib/api";
import {
  Cloud,
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  Bell,
  FileUp,
  ExternalLink,
} from "lucide-react";

export default function IntegrationsPage() {
  const [gstnStatus, setGstnStatus] = useState<any>(null);
  const [notifSettings, setNotifSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchResult, setFetchResult] = useState<any>(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [gstin, setGstin] = useState("");
  const [period, setPeriod] = useState("012026");
  const tallyRef = useRef<HTMLInputElement>(null);
  const zohoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.allSettled([getGSTNStatus(), getNotificationSettings()]).then(
      ([gstnRes, notifRes]) => {
        if (gstnRes.status === "fulfilled") setGstnStatus(gstnRes.value);
        if (notifRes.status === "fulfilled") setNotifSettings(notifRes.value);
        setLoading(false);
      }
    );
  }, []);

  const handleFetchGSTN = async (type: string) => {
    if (!gstin) return;
    setFetchLoading(true);
    setFetchResult(null);
    try {
      const data = await fetchGSTN(type, gstin, period);
      setFetchResult(data);
    } catch (e: any) {
      setFetchResult({ status: "error", message: e.message });
    }
    setFetchLoading(false);
  };

  const handleERPImport = async (source: string, file: File) => {
    setImportLoading(true);
    setImportResult(null);
    try {
      const data = await importERP(source, file, period);
      setImportResult(data);
    } catch (e: any) {
      setImportResult({ status: "error", message: e.message });
    }
    setImportLoading(false);
  };

  const handleNotifSave = async (updates: any) => {
    try {
      const data = await configureNotifications({ ...notifSettings, ...updates });
      setNotifSettings((data as any).settings || data);
    } catch {}
  };

  const handleTestNotif = async () => {
    try {
      const data = await testNotification();
      setTestResult(data);
    } catch (e: any) {
      setTestResult({ status: "error", message: e.message });
    }
  };

  return (
    <PageShell
      title="Integrations"
      description="Connect with GSTN, ERP systems, and configure notifications"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GSTN/GSP Card */}
        <div className="c-bg-card rounded-xl border c-border p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(163,163,163,0.1)" }}>
              <Cloud className="w-5 h-5" style={{ color: "#a3a3a3" }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold c-text">GSTN / GSP Portal</h3>
              <p className="text-xs c-text-3">Fetch returns from government portal</p>
            </div>
            {gstnStatus && (
              <span className="ml-auto text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
                {gstnStatus.status}
              </span>
            )}
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              placeholder="Enter GSTIN..."
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            />
            <input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="Period (MMYYYY)"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            />
            <div className="flex gap-2">
              {["gstr1", "gstr2b", "gstr3b"].map((type) => (
                <button
                  key={type}
                  onClick={() => handleFetchGSTN(type)}
                  disabled={fetchLoading || !gstin}
                  className="flex-1 py-2 rounded-lg text-xs font-medium c-bg-dark hover:c-bg-card c-text-2 transition-colors disabled:opacity-40"
                >
                  {fetchLoading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : `Fetch ${type.toUpperCase()}`}
                </button>
              ))}
            </div>
          </div>

          {fetchResult && (
            <div className={`mt-3 p-3 rounded-lg text-xs ${fetchResult.status === "success" ? "bg-emerald-500/5 border border-emerald-500/10" : "bg-red-500/5 border border-red-500/10"}`}>
              <div className="flex items-center gap-2">
                {fetchResult.status === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                <span className="c-text-2">{fetchResult.record_count ?? 0} records fetched ({fetchResult.return_type})</span>
              </div>
            </div>
          )}
        </div>

        {/* Tally Import */}
        <div className="c-bg-card rounded-xl border c-border p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(163,163,163,0.1)" }}>
              <Upload className="w-5 h-5" style={{ color: "#a3a3a3" }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold c-text">Tally ERP</h3>
              <p className="text-xs c-text-3">Import Tally XML voucher data</p>
            </div>
          </div>
          <div
            onClick={() => tallyRef.current?.click()}
            className="flex flex-col items-center justify-center border-2 border-dashed c-border rounded-lg p-8 cursor-pointer hover:border-white/40 hover:c-bg-dark transition-all"
          >
            <FileUp className="w-6 h-6 c-text-3 mb-2" />
            <span className="text-sm c-text-2">Drop Tally XML or click to upload</span>
            <input
              ref={tallyRef}
              type="file"
              accept=".xml"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleERPImport("tally", e.target.files[0])}
            />
          </div>
        </div>

        {/* Zoho Books Import */}
        <div className="c-bg-card rounded-xl border c-border p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(163,163,163,0.1)" }}>
              <Upload className="w-5 h-5" style={{ color: "#a3a3a3" }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold c-text">Zoho Books</h3>
              <p className="text-xs c-text-3">Import Zoho Books CSV export</p>
            </div>
          </div>
          <div
            onClick={() => zohoRef.current?.click()}
            className="flex flex-col items-center justify-center border-2 border-dashed c-border rounded-lg p-8 cursor-pointer hover:border-white/40 hover:c-bg-dark transition-all"
          >
            <FileUp className="w-6 h-6 c-text-3 mb-2" />
            <span className="text-sm c-text-2">Drop Zoho CSV or click to upload</span>
            <input
              ref={zohoRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleERPImport("zoho", e.target.files[0])}
            />
          </div>
        </div>

        {/* SAP / Oracle — Coming Soon */}
        <div className="c-bg-card rounded-xl border c-border p-6 opacity-60" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(163,163,163,0.1)" }}>
              <ExternalLink className="w-5 h-5" style={{ color: "#a3a3a3" }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold c-text">SAP / Oracle</h3>
              <p className="text-xs c-text-3">Enterprise ERP integration</p>
            </div>
            <span className="ml-auto text-[10px] px-2 py-1 rounded-full bg-gray-500/10 text-gray-400">Coming Soon</span>
          </div>
          <p className="text-sm c-text-3">
            Direct integration with SAP S/4HANA and Oracle ERP Cloud is planned for the next release.
          </p>
        </div>

        {/* Notifications */}
        <div className="c-bg-card rounded-xl border c-border p-6 lg:col-span-2" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(163,163,163,0.1)" }}>
              <Bell className="w-5 h-5" style={{ color: "#a3a3a3" }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold c-text">Notifications</h3>
              <p className="text-xs c-text-3">Email and webhook alerts for risk events</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs c-text-2 block mb-1">Channel</label>
              <select
                value={notifSettings?.channel || "email"}
                onChange={(e) => handleNotifSave({ channel: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              >
                <option value="email">Email</option>
                <option value="webhook">Webhook (Slack/Teams)</option>
              </select>
            </div>

            {notifSettings?.channel === "email" ? (
              <div>
                <label className="text-xs c-text-2 block mb-1">Email To</label>
                <input
                  type="email"
                  value={notifSettings?.email_to || ""}
                  onChange={(e) => handleNotifSave({ email_to: e.target.value })}
                  placeholder="alerts@company.com"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="text-xs c-text-2 block mb-1">Webhook URL</label>
                <input
                  type="url"
                  value={notifSettings?.webhook_url || ""}
                  onChange={(e) => handleNotifSave({ webhook_url: e.target.value })}
                  placeholder="https://hooks.slack.com/..."
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                />
              </div>
            )}

            <div className="flex items-end gap-2">
              <button
                onClick={() => handleNotifSave({ enabled: !notifSettings?.enabled })}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${notifSettings?.enabled ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "c-bg-dark c-text-2"}`}
              >
                {notifSettings?.enabled ? "Enabled" : "Disabled"}
              </button>
              <button
                onClick={handleTestNotif}
                className="px-4 py-2 c-bg-dark hover:c-bg-card rounded-lg text-sm c-text-2 transition-colors"
              >
                Test
              </button>
            </div>
          </div>

          {testResult && (
            <div className={`mt-3 p-3 rounded-lg text-xs ${testResult.status === "success" || testResult.status === "simulated" ? "bg-emerald-500/5 border border-emerald-500/10" : "bg-red-500/5 border border-red-500/10"}`}>
              <span className="c-text-2">{testResult.status}: {testResult.message || `Sent via ${testResult.channel}`}</span>
            </div>
          )}
        </div>

        {/* Import Result */}
        {importResult && (
          <div className={`lg:col-span-2 p-4 rounded-xl text-sm ${importResult.status === "success" ? "bg-emerald-500/5 border border-emerald-500/10" : "bg-red-500/5 border border-red-500/10"}`}>
            <div className="flex items-center gap-2">
              {importResult.status === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
              <span className="c-text-2">
                {importResult.status === "success"
                  ? `Imported ${importResult.records_ingested} records from ${importResult.source}`
                  : importResult.message || importResult.detail || "Import failed"}
              </span>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
