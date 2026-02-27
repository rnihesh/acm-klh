"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { getGraphNodes, searchGraph, getCircularTrades } from "@/lib/api";
import {
  BarChart3,
  Upload,
  GitCompare,
  Network,
  FileSearch,
  ShieldAlert,
  Search,
  AlertTriangle,
} from "lucide-react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/reconcile", label: "Reconciliation", icon: GitCompare },
  { href: "/graph", label: "Graph Explorer", icon: Network },
  { href: "/audit", label: "Audit Trails", icon: FileSearch },
  { href: "/risk", label: "Vendor Risk", icon: ShieldAlert },
];

interface GraphNode {
  id: string;
  label: string;
  type: string;
  [key: string]: unknown;
}

interface GraphLink {
  source: string;
  target: string;
  type: string;
}

interface CircularTrade {
  path: string[];
  length: number;
}

export default function GraphPage() {
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    links: GraphLink[];
  }>({ nodes: [], links: [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [circularTrades, setCircularTrades] = useState<CircularTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCircular, setShowCircular] = useState(false);
  const graphRef = useRef<unknown>(null);

  useEffect(() => {
    loadGraph();
  }, []);

  const loadGraph = async () => {
    setLoading(true);
    try {
      const data = (await getGraphNodes(300)) as {
        nodes: GraphNode[];
        links: GraphLink[];
      };
      setGraphData(data);
    } catch {
      // Graph may be empty initially
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadGraph();
      return;
    }
    setLoading(true);
    try {
      const data = (await searchGraph(searchQuery)) as {
        nodes: GraphNode[];
        links: GraphLink[];
      };
      setGraphData(data);
    } catch {
      // pass
    }
    setLoading(false);
  };

  const loadCircularTrades = async () => {
    try {
      const data = (await getCircularTrades()) as {
        circular_trades: CircularTrade[];
      };
      setCircularTrades(data.circular_trades || []);
      setShowCircular(true);
    } catch {
      // pass
    }
  };

  const nodeColor = useCallback((node: GraphNode) => {
    switch (node.type) {
      case "Taxpayer":
        return "#3b82f6";
      case "Invoice":
        return "#22c55e";
      case "GSTR1Return":
        return "#f59e0b";
      case "GSTR2BReturn":
        return "#8b5cf6";
      default:
        return "#6b7280";
    }
  }, []);

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
              item.href === "/graph"
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
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-2">
            Knowledge Graph Explorer
          </h1>
          <p className="text-gray-400 mb-6">
            Visualize taxpayer-invoice relationships and detect circular trading
          </p>

          {/* Controls */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search GSTIN, trade name, invoice..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-3 py-2 text-white text-sm"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white text-sm"
            >
              Search
            </button>
            <button
              onClick={loadCircularTrades}
              className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 rounded-lg text-red-400 text-sm"
            >
              <AlertTriangle className="w-4 h-4" />
              Detect Circular Trades
            </button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 mb-4">
            {[
              { label: "Taxpayer", color: "#3b82f6" },
              { label: "Invoice", color: "#22c55e" },
              { label: "GSTR-1", color: "#f59e0b" },
              { label: "GSTR-2B", color: "#8b5cf6" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-gray-400">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Graph */}
          <div className="bg-[#111827] rounded-xl border border-gray-800 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-[600px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : graphData.nodes.length > 0 ? (
              <ForceGraph2D
                ref={graphRef as React.MutableRefObject<null>}
                graphData={graphData}
                nodeColor={nodeColor as (node: object) => string}
                nodeLabel={(node: object) => {
                  const n = node as GraphNode;
                  return `${n.type}: ${n.label || n.id}`;
                }}
                linkColor={() => "#334155"}
                linkDirectionalArrowLength={4}
                linkDirectionalArrowRelPos={1}
                backgroundColor="#111827"
                width={1100}
                height={600}
                nodeRelSize={6}
              />
            ) : (
              <div className="flex items-center justify-center h-[600px] text-gray-500">
                No graph data. Upload GST returns first.
              </div>
            )}
          </div>

          {/* Circular Trades Panel */}
          {showCircular && (
            <div className="mt-6 bg-[#111827] rounded-xl border border-red-800/50 p-6">
              <h2 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Circular Trade Detection
              </h2>
              {circularTrades.length > 0 ? (
                <div className="space-y-3">
                  {circularTrades.map((trade, i) => (
                    <div key={i} className="p-3 bg-red-900/10 rounded-lg">
                      <span className="text-sm text-red-300 font-mono">
                        {trade.path.join(" → ")}
                      </span>
                      <span className="ml-3 text-xs text-gray-500">
                        ({trade.length} entities)
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">
                  No circular trading patterns detected.
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
