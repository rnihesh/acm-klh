"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import { Menu } from "lucide-react";

export default function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen c-bg-main">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 min-w-0 p-4 md:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-lg c-text-2 hover:c-bg-dark transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold c-text">{title}</h1>
          </div>
          <p className="c-text-3 text-sm mb-8 md:ml-0">{description}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
