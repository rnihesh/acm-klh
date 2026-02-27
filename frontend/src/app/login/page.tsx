"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Loader2,
  Shield,
  GitCompare,
  Network,
  FileSearch,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Sun,
  Moon,
  Building2,
  Receipt,
  Scale,
  Eye,
  EyeOff,
} from "lucide-react";
import { login } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";

/* ───────── Feature data ───────── */
const FEATURES = [
  {
    icon: GitCompare,
    title: "GSTR-1 vs GSTR-2B Reconciliation",
    desc: "Automatically match outward supplies against auto-generated inward data to detect ITC mismatches.",
  },
  {
    icon: Network,
    title: "Knowledge Graph Engine",
    desc: "Neo4j-powered graph traversal reveals circular trading patterns and hidden vendor relationships.",
  },
  {
    icon: Shield,
    title: "Fraud Detection & Risk Scoring",
    desc: "Composite risk model with 4 weighted factors scores every vendor from LOW to CRITICAL.",
  },
  {
    icon: FileSearch,
    title: "LLM-Powered Audit Trail",
    desc: "AI-generated explanations for every mismatch with actionable recommendations.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Dashboard",
    desc: "Monitor mismatch counts, ITC exposure, and vendor risk across all filing periods.",
  },
  {
    icon: Receipt,
    title: "Multi-Format Data Ingestion",
    desc: "Upload CSV or JSON invoices for GSTR-1, GSTR-2B, and GSTR-3B returns seamlessly.",
  },
];

const STATS = [
  { value: "99.9%", label: "Reconciliation Accuracy" },
  { value: "<2s", label: "Graph Traversal Time" },
  { value: "15+", label: "Mismatch Types Detected" },
  { value: "24/7", label: "Automated Monitoring" },
];

const COMPLIANCE = [
  "GSTR-1 Outward Supply Matching",
  "GSTR-2B Auto-populated ITC Verification",
  "GSTR-3B Excess ITC Detection",
  "Circular Trading Pattern Analysis",
  "Duplicate Invoice Identification",
  "Vendor Filing Compliance Tracking",
];

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { loginUser } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(username, password);
      loginUser(res.token, res.user);
    } catch {
      setError("Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen c-bg-main relative overflow-x-hidden">
      {/* ─── Sticky top bar ─── */}
      <header
        className="sticky top-0 z-40 w-full border-b backdrop-blur-md"
        style={{
          backgroundColor: isDark
            ? "rgba(17,17,17,0.85)"
            : "rgba(245,244,239,0.85)",
          borderColor: "var(--bg-border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/gst-recon.png"
              alt="GST Recon"
              className="w-8 h-8 rounded-lg"
            />
            <span className="text-sm font-bold tracking-tight c-text">
              GST Recon
            </span>
            <span
              className="hidden sm:inline text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: "var(--accent-light)",
                color: "var(--text-secondary)",
              }}
            >
              Knowledge Graph
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-colors"
              style={{ color: "var(--text-secondary)" }}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            <a
              href="#login-section"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium c-bg-accent transition-colors"
            >
              Sign In
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </header>

      {/* ─── Hero Section ─── */}
      <section className="relative">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-[100px] transition-opacity duration-1000"
            style={{
              backgroundColor: isDark
                ? "rgba(255,255,255,0.03)"
                : "rgba(0,0,0,0.03)",
              opacity: mounted ? 1 : 0,
            }}
          />
          <div
            className="absolute top-60 -left-20 w-72 h-72 rounded-full blur-[80px] transition-opacity duration-1000 delay-300"
            style={{
              backgroundColor: isDark
                ? "rgba(255,255,255,0.02)"
                : "rgba(0,0,0,0.02)",
              opacity: mounted ? 1 : 0,
            }}
          />
          {/* Grid pattern */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: isDark
                ? "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)"
                : "linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-16 sm:pb-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — Hero copy */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium border"
                  style={{
                    borderColor: "var(--bg-border)",
                    color: "var(--text-secondary)",
                    backgroundColor: "var(--bg-card)",
                  }}
                >
                  <Building2 className="w-3 h-3" />
                  Government of India — GST Compliance Platform
                </div>
                <h1
                  className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1]"
                  style={{ color: "var(--text-primary)" }}
                >
                  Intelligent GST
                  <br />
                  <span style={{ color: "var(--text-tertiary)" }}>
                    Reconciliation
                  </span>
                </h1>
                <p
                  className="text-base sm:text-lg leading-relaxed max-w-lg"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Match GSTR-1 against GSTR-2B with a Neo4j Knowledge Graph.
                  Detect ITC mismatches, circular trading fraud, and vendor
                  compliance risk — all in real time.
                </p>
              </div>

              {/* Stats row */}
              <div
                className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-y"
                style={{ borderColor: "var(--bg-border)" }}
              >
                {STATS.map((s) => (
                  <div key={s.label}>
                    <div
                      className="text-xl sm:text-2xl font-bold tracking-tight"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {s.value}
                    </div>
                    <div
                      className="text-[11px] mt-0.5"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* GST compliance checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {COMPLIANCE.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 text-[13px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Login card */}
            <div id="login-section" className="flex justify-center lg:justify-end">
              <div
                className="w-full max-w-[400px] rounded-2xl border p-6 sm:p-8"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--bg-border)",
                  boxShadow: "var(--shadow-lg)",
                }}
              >
                {/* Card header */}
                <div className="text-center mb-6">
                  <div
                    className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center"
                    style={{ backgroundColor: "var(--accent)" }}
                  >
                    <Scale
                      className="w-6 h-6"
                      style={{ color: "var(--accent-text)" }}
                      strokeWidth={2}
                    />
                  </div>
                  <h2
                    className="text-lg font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Sign in to your account
                  </h2>
                  <p
                    className="text-sm mt-1"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Access your GST reconciliation dashboard
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      className="text-xs font-medium mb-1.5 block"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      required
                      className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors"
                      style={{
                        backgroundColor: "var(--bg-input)",
                        borderColor: "var(--bg-border)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      className="text-xs font-medium mb-1.5 block"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        className="w-full rounded-lg px-3.5 py-2.5 pr-10 text-sm outline-none transition-colors"
                        style={{
                          backgroundColor: "var(--bg-input)",
                          borderColor: "var(--bg-border)",
                          color: "var(--text-primary)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
                        style={{ color: "var(--text-tertiary)" }}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p
                      className="text-xs px-3 py-2 rounded-lg"
                      style={{
                        color: "var(--status-error)",
                        backgroundColor: isDark
                          ? "rgba(220,38,38,0.1)"
                          : "rgba(220,38,38,0.06)",
                      }}
                    >
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                    style={{
                      backgroundColor: "var(--accent)",
                      color: "var(--accent-text)",
                    }}
                  >
                    {loading && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    {loading ? "Signing in..." : "Sign in"}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>

                <div
                  className="my-5 flex items-center gap-3"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <div
                    className="flex-1 h-px"
                    style={{ backgroundColor: "var(--bg-border)" }}
                  />
                  <span className="text-[11px]">or</span>
                  <div
                    className="flex-1 h-px"
                    style={{ backgroundColor: "var(--bg-border)" }}
                  />
                </div>

                <Link
                  href="/register"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all"
                  style={{
                    borderColor: "var(--bg-border)",
                    color: "var(--text-secondary)",
                    backgroundColor: "var(--bg-main)",
                  }}
                >
                  <Building2 className="w-4 h-4" />
                  Register your business
                </Link>

                <p
                  className="text-center text-[11px] mt-5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  By signing in, you agree to the GST Recon Terms of Service
                  and Privacy Policy
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features Section ─── */}
      <section
        className="border-t"
        style={{
          borderColor: "var(--bg-border)",
          backgroundColor: "var(--bg-card)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12 sm:mb-16">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium border mb-4"
              style={{
                borderColor: "var(--bg-border)",
                color: "var(--text-secondary)",
                backgroundColor: "var(--bg-main)",
              }}
            >
              <Shield className="w-3 h-3" />
              Platform Capabilities
            </div>
            <h2
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              Enterprise-Grade GST Compliance
            </h2>
            <p
              className="text-sm sm:text-base mt-3 max-w-2xl mx-auto"
              style={{ color: "var(--text-secondary)" }}
            >
              Built for chartered accountants, auditors, and finance teams who
              need precision in tax reconciliation.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border p-5 sm:p-6 transition-all duration-200"
                style={{
                  borderColor: "var(--bg-border)",
                  backgroundColor: "var(--bg-main)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "var(--accent)";
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "var(--shadow-md)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "var(--bg-border)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
                  style={{
                    backgroundColor: "var(--accent-light)",
                    color: "var(--accent)",
                  }}
                >
                  <f.icon className="w-4.5 h-4.5" />
                </div>
                <h3
                  className="text-sm font-semibold mb-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  {f.title}
                </h3>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section
        className="border-t"
        style={{ borderColor: "var(--bg-border)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h2
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              How It Works
            </h2>
            <p
              className="text-sm sm:text-base mt-3 max-w-xl mx-auto"
              style={{ color: "var(--text-secondary)" }}
            >
              From data upload to actionable insights — in three simple steps.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                step: "01",
                title: "Upload GST Returns",
                desc: "Upload your GSTR-1, GSTR-2B, and GSTR-3B data in CSV or JSON format. The system ingests and normalizes everything.",
              },
              {
                step: "02",
                title: "Automated Reconciliation",
                desc: "Our Knowledge Graph engine matches invoices across returns, detecting mismatches, excess ITC, and duplicate entries.",
              },
              {
                step: "03",
                title: "Insights & Audit Trail",
                desc: "Get risk scores per vendor, AI-generated audit explanations, and exportable reports for compliance review.",
              },
            ].map((s) => (
              <div key={s.step} className="relative">
                <div
                  className="text-5xl sm:text-6xl font-black tracking-tighter opacity-10 mb-3"
                  style={{ color: "var(--text-primary)" }}
                >
                  {s.step}
                </div>
                <h3
                  className="text-sm font-semibold mb-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  {s.title}
                </h3>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section
        className="border-t"
        style={{
          borderColor: "var(--bg-border)",
          backgroundColor: "var(--accent)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 text-center">
          <h2
            className="text-xl sm:text-2xl font-bold tracking-tight mb-3"
            style={{ color: "var(--accent-text)" }}
          >
            Ready to streamline your GST compliance?
          </h2>
          <p
            className="text-sm mb-6 max-w-lg mx-auto"
            style={{ color: "var(--accent-text)", opacity: 0.7 }}
          >
            Join finance teams using knowledge-graph powered reconciliation for
            accurate ITC claims and fraud detection.
          </p>
          <a
            href="#login-section"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: "var(--bg-main)",
              color: "var(--text-primary)",
            }}
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer
        className="border-t"
        style={{
          borderColor: "var(--bg-border)",
          backgroundColor: "var(--bg-card)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img
                src="/gst-recon.png"
                alt="GST Recon"
                className="w-6 h-6 rounded-md"
              />
              <span
                className="text-xs font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                GST Recon
              </span>
            </div>
            <p
              className="text-[11px] text-center sm:text-right"
              style={{ color: "var(--text-tertiary)" }}
            >
              &copy; {new Date().getFullYear()} GST Recon — Intelligent Tax
              Reconciliation Engine. Built with Neo4j Knowledge Graph.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
