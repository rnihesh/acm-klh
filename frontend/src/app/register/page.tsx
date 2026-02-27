"use client";

import { useState } from "react";
import Link from "next/link";
import { Hexagon, Loader2, Sun, Moon, ArrowLeft } from "lucide-react";
import { register } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [gstin, setGstin] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await register(username, password, gstin, companyName);
      loginUser(res.token, res.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen c-bg-main flex items-center justify-center p-4 relative">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 sm:px-6 h-14">
        <Link href="/login" className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Link>
        <button onClick={toggleTheme} className="p-2 rounded-lg" style={{ color: "var(--text-secondary)" }} aria-label="Toggle theme">
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
            style={{ backgroundColor: "var(--accent)" }}
          >
            <Hexagon className="w-5 h-5" style={{ color: "var(--accent-text)" }} strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight c-text">
              GST Recon
            </span>
            <span className="text-[11px] block -mt-0.5 c-text-3">
              Knowledge Graph Engine
            </span>
          </div>
        </div>

        {/* Card */}
        <div
          className="c-bg-card rounded-xl border c-border p-6"
          style={{ boxShadow: "var(--shadow-md)" }}
        >
          <h1 className="text-lg font-semibold c-text mb-1">Create account</h1>
          <p className="text-sm c-text-3 mb-6">
            Register your business for GST reconciliation
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium c-text-2 mb-1.5 block">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                required
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium c-text-2 mb-1.5 block">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                required
                minLength={6}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium c-text-2 mb-1.5 block">
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your company name"
                required
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium c-text-2 mb-1.5 block">
                GSTIN
              </label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="e.g. 29ABCDE1234F1Z5"
                required
                maxLength={15}
                className="w-full rounded-lg px-3 py-2.5 text-sm font-mono outline-none"
              />
              <p className="text-[10px] c-text-3 mt-1">
                15-character GST Identification Number
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 c-bg-accent hover:c-bg-accent-hover disabled:opacity-50 rounded-lg text-white text-sm font-medium transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="text-center text-xs c-text-3 mt-5">
            Already have an account?{" "}
            <Link
              href="/login"
              className="c-text-accent hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
