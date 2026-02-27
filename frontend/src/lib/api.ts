const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface AuthUser {
  username: string;
  gstin: string;
  company_name: string;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: authHeaders(),
    ...options,
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Auth
export const login = (username: string, password: string) =>
  fetchAPI<{ token: string; user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

export const register = (
  username: string,
  password: string,
  gstin: string,
  company_name: string
) =>
  fetchAPI<{ token: string; user: AuthUser }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password, gstin, company_name }),
  });

export const getMe = () => fetchAPI<AuthUser>("/api/auth/me");

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
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(
    `${API_BASE}/api/data/upload?return_type=${returnType}&return_period=${returnPeriod}`,
    { method: "POST", body: formData, headers }
  ).then((r) => r.json());
};
export const uploadTaxpayers = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API_BASE}/api/data/upload-taxpayers`, {
    method: "POST",
    body: formData,
    headers,
  }).then((r) => r.json());
};
