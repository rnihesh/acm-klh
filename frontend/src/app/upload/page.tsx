"use client";

import { useState, useCallback, useRef } from "react";
import PageShell from "@/components/PageShell";
import { uploadFile, uploadTaxpayers } from "@/lib/api";
import { FileUp, CheckCircle2, XCircle, File, Trash2 } from "lucide-react";

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
  const [dragOver, setDragOver] = useState<"gst" | "taxpayer" | null>(null);
  const [stagedGst, setStagedGst] = useState<File[]>([]);
  const [stagedTax, setStagedTax] = useState<File[]>([]);
  const gstInputRef = useRef<HTMLInputElement>(null);
  const taxInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const stageFiles = (files: FileList | null, isTaxpayer: boolean) => {
    if (!files?.length) return;
    const arr = Array.from(files);
    if (isTaxpayer) setStagedTax((prev) => [...prev, ...arr]);
    else setStagedGst((prev) => [...prev, ...arr]);
  };

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

  const handleDrop = useCallback(
    (e: React.DragEvent, isTaxpayer: boolean) => {
      e.preventDefault();
      setDragOver(null);
      stageFiles(e.dataTransfer.files, isTaxpayer);
    },
    []
  );

  return (
    <PageShell
      title="Upload GST Data"
      description="Upload GSTR-1, GSTR-2B, GSTR-3B, or Purchase Register data (JSON / CSV)"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* GST Returns Upload */}
        <div className="c-bg-card rounded-xl border c-border p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
          <h2 className="text-lg font-semibold c-text mb-4">
            GST Returns
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm c-text-2 block mb-1">
                Return Type
              </label>
              <select
                value={returnType}
                onChange={(e) => setReturnType(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              >
                <option value="GSTR1">GSTR-1 (Outward Supplies)</option>
                <option value="GSTR2B">GSTR-2B (Auto-drafted ITC)</option>
                <option value="GSTR3B">GSTR-3B (Summary Return)</option>
                <option value="PURCHASE_REGISTER">Purchase Register</option>
                <option value="EINVOICE">E-Invoice (IRN)</option>
                <option value="EWAY_BILL">E-Way Bill</option>
              </select>
            </div>
            <div>
              <label className="text-sm c-text-2 block mb-1">
                Return Period
              </label>
              <input
                type="text"
                value={returnPeriod}
                onChange={(e) => setReturnPeriod(e.target.value)}
                placeholder="MMYYYY e.g. 012026"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              />
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver("gst");
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, false)}
              onClick={() => gstInputRef.current?.click()}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition-all ${
                dragOver === "gst"
                  ? "border-white/60 c-bg-accent-light"
                  : "c-border hover:border-white/60/40 hover:c-bg-dark"
              }`}
            >
              <FileUp
                className={`w-8 h-8 mb-2 transition-colors ${dragOver === "gst" ? "c-text-accent" : "c-text-3"}`}
              />
              <span className="text-sm c-text-2">
                {dragOver === "gst"
                  ? "Drop files here"
                  : "Drag & drop CSV/JSON or click to upload"}
              </span>
              <input
                ref={gstInputRef}
                type="file"
                accept=".json,.csv"
                multiple
                className="hidden"
                onChange={(e) => stageFiles(e.target.files, false)}
                disabled={uploading}
              />
            </div>
            {/* GST File Preview */}
            {stagedGst.length > 0 && (
              <div className="space-y-2">
                {stagedGst.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 c-bg-dark rounded-lg">
                    <File className="w-4 h-4 c-text-accent flex-shrink-0" />
                    <span className="text-sm c-text-2 truncate flex-1">{f.name}</span>
                    <span className="text-xs c-text-3 flex-shrink-0">{formatFileSize(f.size)}</span>
                    <button onClick={() => setStagedGst((p) => p.filter((_, j) => j !== i))} className="p-1 hover:c-bg-card rounded transition-colors">
                      <Trash2 className="w-3 h-3 c-text-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={async () => {
                    const dt = new DataTransfer();
                    stagedGst.forEach((f) => dt.items.add(f));
                    await handleUpload(dt.files, false);
                    setStagedGst([]);
                  }}
                  disabled={uploading}
                  className="w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
                >
                  Upload {stagedGst.length} file{stagedGst.length > 1 ? "s" : ""}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Taxpayer Upload */}
        <div className="c-bg-card rounded-xl border c-border p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
          <h2 className="text-lg font-semibold c-text mb-4">
            Taxpayer Master
          </h2>
          <p className="text-sm c-text-2 mb-4">
            Upload taxpayer details (GSTIN, trade name, registration type,
            state)
          </p>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver("taxpayer");
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => handleDrop(e, true)}
            onClick={() => taxInputRef.current?.click()}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition-all h-48 ${
              dragOver === "taxpayer"
                ? "border-white/60 c-bg-accent-light"
                : "c-border hover:border-white/60/40 hover:c-bg-dark"
            }`}
          >
            <FileUp
              className={`w-8 h-8 mb-2 transition-colors ${dragOver === "taxpayer" ? "c-text-accent" : "c-text-3"}`}
            />
            <span className="text-sm c-text-2">
              {dragOver === "taxpayer"
                ? "Drop files here"
                : "Drag & drop CSV/JSON or click to upload"}
            </span>
            <input
              ref={taxInputRef}
              type="file"
              accept=".json,.csv"
              className="hidden"
              onChange={(e) => stageFiles(e.target.files, true)}
              disabled={uploading}
            />
          </div>
          {/* Taxpayer File Preview */}
          {stagedTax.length > 0 && (
            <div className="space-y-2">
              {stagedTax.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 c-bg-dark rounded-lg">
                  <File className="w-4 h-4 c-text-accent flex-shrink-0" />
                  <span className="text-sm c-text-2 truncate flex-1">{f.name}</span>
                  <span className="text-xs c-text-3 flex-shrink-0">{formatFileSize(f.size)}</span>
                  <button onClick={() => setStagedTax((p) => p.filter((_, j) => j !== i))} className="p-1 hover:c-bg-card rounded transition-colors">
                    <Trash2 className="w-3 h-3 c-text-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={async () => {
                  const dt = new DataTransfer();
                  stagedTax.forEach((f) => dt.items.add(f));
                  await handleUpload(dt.files, true);
                  setStagedTax([]);
                }}
                disabled={uploading}
                className="w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
              >
                Upload {stagedTax.length} file{stagedTax.length > 1 ? "s" : ""}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="flex items-center gap-3 p-4 mb-4 c-bg-accent-light border rounded-xl" style={{ borderColor: "var(--bg-border)" }}>
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          <span className="text-sm c-text-accent">Processing upload...</span>
        </div>
      )}

      {/* Upload History */}
      {results.length > 0 && (
        <div className="c-bg-card rounded-xl border c-border p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold c-text">
              Upload Results
            </h2>
            <button
              onClick={() => setResults([])}
              className="text-xs c-text-3 hover:c-text-2"
            >
              Clear
            </button>
          </div>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  r.status === "success"
                    ? "bg-emerald-500/5 border border-emerald-500/10"
                    : "bg-red-500/5 border border-red-500/10"
                }`}
              >
                {r.status === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                )}
                <span className="text-sm c-text-2">
                  {r.status === "success"
                    ? `Ingested ${r.records_ingested ?? r.taxpayers_ingested ?? 0} records${r.return_type ? ` (${r.return_type})` : ""}`
                    : r.error || "Upload failed"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
