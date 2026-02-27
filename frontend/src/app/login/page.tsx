"use client";

import { useState } from "react";
import Link from "next/link";
import { Hexagon, Loader2 } from "lucide-react";
import { login } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();

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
    <div className="min-h-screen c-bg-main flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
            style={{ backgroundColor: "var(--accent)" }}
          >
            <Hexagon className="w-5 h-5 text-white" strokeWidth={2.5} />
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
          <h1 className="text-lg font-semibold c-text mb-1">Welcome back</h1>
          <p className="text-sm c-text-3 mb-6">
            Sign in to your account
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
                placeholder="Enter username"
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
                placeholder="Enter password"
                required
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              />
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
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-center text-xs c-text-3 mt-5">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="c-text-accent hover:underline font-medium"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
