const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Dashboard stats
export const getDashboardStats = () => fetchAPI("/api/stats/dashboard");
export const getMismatchSummary = () => fetchAPI("/api/stats/mismatch-summary");
export const getTopRiskyVendors = () =>
  fetchAPI("/api/stats/top-risky-vendors");

// Reconciliation
export const triggerReconciliation = (returnPeriod = "012026") =>
  fetchAPI("/api/reconcile", {
    method: "POST",
    body: JSON.stringify({ return_period: returnPeriod }),
  });
export const getReconciliationResults = (
  returnPeriod = "012026",
  page = 1,
  pageSize = 50,
  mismatchType?: string,
  severity?: string
) => {
  const params = new URLSearchParams({
    return_period: returnPeriod,
    page: String(page),
    page_size: String(pageSize),
  });
  if (mismatchType) params.set("mismatch_type", mismatchType);
  if (severity) params.set("severity", severity);
  return fetchAPI(`/api/reconcile/results?${params}`);
};

// Graph
export const getGraphNodes = (limit = 200) =>
  fetchAPI(`/api/reconcile/graph/nodes?limit=${limit}`);
export const searchGraph = (query: string) =>
  fetchAPI(`/api/reconcile/graph/search?q=${encodeURIComponent(query)}`);
export const getCircularTrades = () =>
  fetchAPI("/api/reconcile/graph/circular-trades");

// Audit
export const generateAuditTrail = (mismatch: Record<string, unknown>) =>
  fetchAPI("/api/audit/generate", {
    method: "POST",
    body: JSON.stringify(mismatch),
  });
export const getAuditTrails = () => fetchAPI("/api/audit/trails");

// Risk
export const getVendorRisks = () => fetchAPI("/api/risk/vendors");
export const getVendorRiskDetail = (gstin: string) =>
  fetchAPI(`/api/risk/vendors/${gstin}`);
export const getVendorRiskSummary = (gstin: string) =>
  fetchAPI(`/api/risk/vendors/${gstin}/summary`);

// Upload
export const uploadFile = (
  file: File,
  returnType: string,
  returnPeriod = "012026"
) => {
  const formData = new FormData();
  formData.append("file", file);
  return fetch(
    `${API_BASE}/api/data/upload?return_type=${returnType}&return_period=${returnPeriod}`,
    { method: "POST", body: formData }
  ).then((r) => r.json());
};
export const uploadTaxpayers = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return fetch(`${API_BASE}/api/data/upload-taxpayers`, {
    method: "POST",
    body: formData,
  }).then((r) => r.json());
};
