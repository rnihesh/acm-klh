"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import PageShell from "@/components/PageShell";
import { getGraphNodes, searchGraph, getCircularTrades } from "@/lib/api";
import { Search, AlertTriangle, RotateCcw } from "lucide-react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

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
  cycle: string[];
  names: string[];
  cycle_length: number;
}

const NODE_COLORS: Record<string, string> = {
  Taxpayer: "#d97757",
  Invoice: "#5cb85c",
  GSTR1Return: "#f0ad4e",
  GSTR2BReturn: "#9b8ec3",
  GSTR3BReturn: "#d9534f",
};

export default function GraphPage() {
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    links: GraphLink[];
  }>({ nodes: [], links: [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [circularTrades, setCircularTrades] = useState<CircularTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCircular, setShowCircular] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

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
      const data = (await getCircularTrades()) as CircularTrade[];
      setCircularTrades(Array.isArray(data) ? data : []);
      setShowCircular(true);
    } catch {
      // pass
    }
  };

  const nodeColor = useCallback((node: object) => {
    const n = node as GraphNode;
    return NODE_COLORS[n.type] || "#6b6b6b";
  }, []);

  return (
    <PageShell
      title="Knowledge Graph Explorer"
      description="Visualize taxpayer-invoice relationships and detect circular trading"
    >
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search GSTIN, trade name, invoice..."
            className="w-full rounded-lg pl-10 pr-3 py-2 text-sm outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-surface-dark hover:bg-surface-card rounded-lg text-content text-sm transition-colors"
        >
          Search
        </button>
        <button
          onClick={loadGraph}
          className="px-4 py-2 bg-surface-dark hover:bg-surface-card rounded-lg text-content text-sm transition-colors flex items-center gap-2"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
        <button
          onClick={loadCircularTrades}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 rounded-lg text-red-400 text-sm transition-colors"
        >
          <AlertTriangle className="w-4 h-4" />
          Detect Circular Trades
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 mb-4">
        {Object.entries(NODE_COLORS).map(([label, color]) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-content-secondary">{label}</span>
          </div>
        ))}
        <span className="text-xs text-content-tertiary ml-auto">
          {graphData.nodes.length} nodes
        </span>
      </div>

      {/* Graph + Node Detail side-by-side */}
      <div className="flex gap-4">
        <div className="flex-1 bg-surface-card rounded-xl border border-surface-border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-[600px]">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
            </div>
          ) : graphData.nodes.length > 0 ? (
            <ForceGraph2D
              graphData={graphData}
              nodeColor={nodeColor}
              nodeLabel={(node: object) => {
                const n = node as GraphNode;
                return `${n.type}: ${n.label || n.id}`;
              }}
              onNodeClick={(node: object) => setSelectedNode(node as GraphNode)}
              linkColor={() => "#3a3a3a"}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              backgroundColor="#1a1a1a"
              height={600}
              nodeRelSize={6}
            />
          ) : (
            <div className="flex items-center justify-center h-[600px] text-content-tertiary">
              No graph data. Upload GST returns first.
            </div>
          )}
        </div>

        {/* Node detail panel */}
        {selectedNode && (
          <div className="w-72 bg-surface-card rounded-xl border border-surface-border p-4 h-fit max-h-[600px] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-xs font-medium px-2 py-1 rounded"
                style={{
                  backgroundColor: `${NODE_COLORS[selectedNode.type] || "#6b6b6b"}20`,
                  color: NODE_COLORS[selectedNode.type] || "#6b6b6b",
                }}
              >
                {selectedNode.type}
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-content-tertiary hover:text-content-secondary text-xs"
              >
                Close
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(selectedNode)
                .filter(
                  ([k]) =>
                    !["id", "x", "y", "vx", "vy", "fx", "fy", "index", "__indexColor"].includes(k)
                )
                .map(([key, value]) => (
                  <div key={key}>
                    <span className="text-[10px] text-content-tertiary uppercase tracking-wider">
                      {key}
                    </span>
                    <p className="text-xs text-content-secondary font-mono break-all">
                      {String(value)}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Circular Trades Panel */}
      {showCircular && (
        <div className="mt-6 bg-surface-card rounded-xl border border-red-500/20 p-6">
          <h2 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Circular Trade Detection
          </h2>
          {circularTrades.length > 0 ? (
            <div className="space-y-3">
              {circularTrades.map((trade, i) => (
                <div key={i} className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                  <div className="flex items-center gap-2 flex-wrap">
                    {trade.cycle.map((gstin, j) => (
                      <span key={j} className="flex items-center gap-1">
                        <span className="text-sm text-red-300 font-mono bg-red-900/20 px-2 py-0.5 rounded">
                          {gstin.slice(0, 4)}...{gstin.slice(-4)}
                        </span>
                        {j < trade.cycle.length - 1 && (
                          <span className="text-content-tertiary">&rarr;</span>
                        )}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-content-tertiary mt-1.5">
                    {trade.cycle_length} entities in cycle
                    {trade.names?.[0] && ` — starting from ${trade.names[0]}`}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-content-tertiary text-sm">
              No circular trading patterns detected.
            </p>
          )}
        </div>
      )}
    </PageShell>
  );
}
