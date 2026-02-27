"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { uploadFile, uploadTaxpayers } from "@/lib/api";
import {
  Upload,
  FileUp,
  CheckCircle2,
  XCircle,
  BarChart3,
  GitCompare,
  Network,
  FileSearch,
  ShieldAlert,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/reconcile", label: "Reconciliation", icon: GitCompare },
  { href: "/graph", label: "Graph Explorer", icon: Network },
  { href: "/audit", label: "Audit Trails", icon: FileSearch },
  { href: "/risk", label: "Vendor Risk", icon: ShieldAlert },
];

type UploadResult = {
  status: string;
  records_ingested?: number;
  taxpayers_ingested?: number;
  return_type?: string;
  error?: string;
};

export default function UploadPage() {
  const [returnType, setReturnType] = useState("GSTR1");
  const [returnPeriod, setReturnPeriod] = useState("012026");
  const [results, setResults] = useState<UploadResult[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleUpload = useCallback(
    async (files: FileList | null, isTaxpayer = false) => {
      if (!files?.length) return;
      setUploading(true);
      const newResults: UploadResult[] = [];

      for (const file of Array.from(files)) {
        try {
          const res = isTaxpayer
            ? await uploadTaxpayers(file)
            : await uploadFile(file, returnType, returnPeriod);
          newResults.push(res);
        } catch (err) {
          newResults.push({
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed",
          });
        }
      }

      setResults((prev) => [...newResults, ...prev]);
      setUploading(false);
    },
    [returnType, returnPeriod]
  );

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
              item.href === "/upload"
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
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-2">
            Upload GST Data
          </h1>
          <p className="text-gray-400 mb-8">
            Upload GSTR-1, GSTR-2B, GSTR-3B, or Purchase Register data (JSON /
            CSV)
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* GST Returns Upload */}
            <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                GST Returns
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">
                    Return Type
                  </label>
                  <select
                    value={returnType}
                    onChange={(e) => setReturnType(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="GSTR1">GSTR-1 (Outward Supplies)</option>
                    <option value="GSTR2B">GSTR-2B (Auto-drafted ITC)</option>
                    <option value="GSTR3B">GSTR-3B (Summary Return)</option>
                    <option value="PURCHASE_REGISTER">Purchase Register</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">
                    Return Period
                  </label>
                  <input
                    type="text"
                    value={returnPeriod}
                    onChange={(e) => setReturnPeriod(e.target.value)}
                    placeholder="MMYYYY e.g. 012026"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-lg p-8 cursor-pointer hover:border-blue-500/50 transition-colors">
                  <FileUp className="w-8 h-8 text-gray-500 mb-2" />
                  <span className="text-sm text-gray-400">
                    Drop CSV/JSON or click to upload
                  </span>
                  <input
                    type="file"
                    accept=".json,.csv"
                    multiple
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files)}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            {/* Taxpayer Upload */}
            <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Taxpayer Master
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                Upload taxpayer details (GSTIN, trade name, registration type,
                state)
              </p>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-lg p-8 cursor-pointer hover:border-blue-500/50 transition-colors h-48">
                <FileUp className="w-8 h-8 text-gray-500 mb-2" />
                <span className="text-sm text-gray-400">
                  Drop CSV/JSON or click to upload
                </span>
                <input
                  type="file"
                  accept=".json,.csv"
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files, true)}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          {/* Upload History */}
          {results.length > 0 && (
            <div className="bg-[#111827] rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Upload Results
              </h2>
              <div className="space-y-2">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50"
                  >
                    {r.status === "success" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className="text-sm text-gray-300">
                      {r.status === "success"
                        ? `Ingested ${r.records_ingested ?? r.taxpayers_ingested ?? 0} records${r.return_type ? ` (${r.return_type})` : ""}`
                        : r.error || "Upload failed"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploading && (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3" />
              <span className="text-gray-400">Uploading...</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
