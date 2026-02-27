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
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/reconcile", label: "Reconciliation", icon: GitCompare },
  { href: "/graph", label: "Graph Explorer", icon: Network },
  { href: "/audit", label: "Audit Trails", icon: FileSearch },
  { href: "/risk", label: "Vendor Risk", icon: ShieldAlert },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-64 bg-[#111827] border-r border-gray-800 p-4 flex flex-col gap-1 min-h-screen">
      <div className="flex items-center gap-2 px-3 py-4 mb-4">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <GitCompare className="w-5 h-5 text-white" />
        </div>
        <span className="text-lg font-bold text-white">GST Recon</span>
      </div>
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isActive
                ? "bg-blue-600/20 text-blue-400"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        );
      })}
      <div className="mt-auto pt-4 border-t border-gray-800">
        <div className="px-3 py-2">
          <p className="text-[10px] text-gray-600 font-mono">
            Knowledge Graph Engine v1.0
          </p>
        </div>
      </div>
    </nav>
  );
}
