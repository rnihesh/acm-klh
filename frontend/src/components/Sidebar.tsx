"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Upload,
  GitCompare,
  Network,
  FileSearch,
  ShieldAlert,
  Hexagon,
  Sun,
  Moon,
  LogOut,
  X,
  MessageSquare,
  Plug,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/upload", label: "Upload Data", icon: Upload },
  { href: "/reconcile", label: "Reconciliation", icon: GitCompare },
  { href: "/graph", label: "Graph Explorer", icon: Network },
  { href: "/audit", label: "Audit Trails", icon: FileSearch },
  { href: "/risk", label: "Vendor Risk", icon: ShieldAlert },
  { href: "/chat", label: "AI Assistant", icon: MessageSquare },
  { href: "/integrations", label: "Integrations", icon: Plug },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <nav
        className={`
          fixed top-0 left-0 z-50 w-60 border-r p-3 flex flex-col h-screen
          transition-transform duration-200 ease-in-out
          md:sticky md:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ backgroundColor: "var(--bg-dark)", borderColor: "var(--bg-border)" }}
      >
        {/* Logo + mobile close */}
        <div className="flex items-center justify-between px-3 py-4 mb-2">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
              style={{ backgroundColor: "var(--accent)" }}
            >
              <Hexagon className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                GST Recon
              </span>
              <span className="text-[10px] block -mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                Knowledge Graph
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-1 rounded-md c-text-3 hover:c-text-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-2"
          style={{ color: "var(--text-tertiary)" }}
        >
          Navigation
        </div>

        <div className="space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="sidebar-link flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-150"
                style={
                  isActive
                    ? {
                        backgroundColor: "var(--accent-light)",
                        color: "var(--accent)",
                        fontWeight: 500,
                      }
                    : { color: "var(--text-secondary)" }
                }
              >
                <item.icon className="w-4 h-4" style={isActive ? { color: "var(--accent)" } : undefined} />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-auto pt-4 space-y-2" style={{ borderTop: "1px solid var(--bg-border)" }}>
          <button
            onClick={toggleTheme}
            className="sidebar-link w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-150"
            style={{ color: "var(--text-secondary)" }}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {isDark ? "Light Mode" : "Dark Mode"}
          </button>

          {user && (
            <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--bg-card)" }}>
              <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {user.company_name}
              </p>
              <p className="text-[10px] font-mono truncate" style={{ color: "var(--text-tertiary)" }}>
                {user.gstin}
              </p>
            </div>
          )}

          <button
            onClick={logout}
            className="sidebar-link w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </nav>
    </>
  );
}
