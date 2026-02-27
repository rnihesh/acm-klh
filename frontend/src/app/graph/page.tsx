"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import PageShell from "@/components/PageShell";
import { getGraphNodes, searchGraph, getCircularTrades } from "@/lib/api";
import {
  Search,
  AlertTriangle,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Network,
} from "lucide-react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

interface GraphNode {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
  [key: string]: unknown;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
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
  User: "#6b6b6b",
};

const NODE_SIZES: Record<string, number> = {
  Taxpayer: 8,
  Invoice: 5,
  GSTR1Return: 6,
  GSTR2BReturn: 6,
  GSTR3BReturn: 6,
  User: 4,
};

const LINK_LABELS: Record<string, string> = {
  SUPPLIED_BY: "supplied by",
  SUPPLIED_TO: "supplied to",
  TRADES_WITH: "trades with",
  CONTAINS_OUTWARD: "contains",
  CONTAINS_INWARD: "contains",
  FILED: "filed",
  RECEIVED: "received",
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
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
    new Set(Object.keys(NODE_COLORS))
  );

  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Measure container
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: window.innerWidth < 768 ? 400 : 600,
        });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    loadGraph();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleZoomIn = () => {
    if (graphRef.current) {
      const curr = graphRef.current.zoom();
      graphRef.current.zoom(curr * 1.4, 300);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      const curr = graphRef.current.zoom();
      graphRef.current.zoom(curr / 1.4, 300);
    }
  };

  const handleZoomFit = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 60);
    }
  };

  // Auto-fit after engine stabilizes
  const handleEngineStop = useCallback(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      graphRef.current.zoomToFit(600, 60);
    }
  }, [graphData.nodes.length]);

  // Filter graph data by visible types
  const filteredData = {
    nodes: graphData.nodes.filter((n) => visibleTypes.has(n.type)),
    links: graphData.links.filter((l) => {
      const srcId = typeof l.source === "string" ? l.source : l.source?.id;
      const tgtId = typeof l.target === "string" ? l.target : l.target?.id;
      const srcNode = graphData.nodes.find((n) => n.id === srcId);
      const tgtNode = graphData.nodes.find((n) => n.id === tgtId);
      return (
        srcNode &&
        tgtNode &&
        visibleTypes.has(srcNode.type) &&
        visibleTypes.has(tgtNode.type)
      );
    }),
  };

  const toggleType = (type: string) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Count nodes by type
  const typeCounts: Record<string, number> = {};
  for (const n of graphData.nodes) {
    typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
  }

  // Custom node rendering
  const paintNode = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode;
      if (n.x == null || n.y == null) return;

      const size = NODE_SIZES[n.type] || 5;
      const color = NODE_COLORS[n.type] || "#6b6b6b";
      const isHovered = hoveredNode?.id === n.id;
      const isSelected = selectedNode?.id === n.id;

      // Glow for hovered/selected
      if (isHovered || isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, size + 4, 0, 2 * Math.PI);
        ctx.fillStyle = `${color}30`;
        ctx.fill();
      }

      // Outer ring for selected
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, size + 2, 0, 2 * Math.PI);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Main circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, size, 0, 2 * Math.PI);
      ctx.fillStyle = isHovered ? `${color}dd` : color;
      ctx.fill();

      // Label (show when zoomed in enough or for Taxpayer nodes)
      const showLabel =
        globalScale > 1.2 || n.type === "Taxpayer" || isHovered || isSelected;
      if (showLabel && n.label) {
        const label =
          n.label.length > 18 ? n.label.slice(0, 16) + "..." : n.label;
        const fontSize = Math.max(10 / globalScale, 2.5);
        ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle =
          isHovered || isSelected ? "#ffffff" : "rgba(200,200,200,0.85)";
        ctx.fillText(label, n.x, n.y + size + 2);
      }
    },
    [hoveredNode, selectedNode]
  );

  // Custom pointer area (matches visual size)
  const paintPointerArea = useCallback(
    (node: object, color: string, ctx: CanvasRenderingContext2D) => {
      const n = node as GraphNode;
      if (n.x == null || n.y == null) return;
      const size = NODE_SIZES[n.type] || 5;
      ctx.beginPath();
      ctx.arc(n.x, n.y, size + 4, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    []
  );

  // Custom link rendering
  const paintLink = useCallback(
    (
      link: object,
      ctx: CanvasRenderingContext2D,
      globalScale: number
    ) => {
      const l = link as GraphLink & {
        source: GraphNode;
        target: GraphNode;
      };
      if (!l.source?.x || !l.target?.x) return;

      const isRelatedToHovered =
        hoveredNode &&
        (l.source.id === hoveredNode.id || l.target.id === hoveredNode.id);

      ctx.beginPath();
      ctx.moveTo(l.source.x, l.source.y);
      ctx.lineTo(l.target.x, l.target.y);
      ctx.strokeStyle = isRelatedToHovered
        ? "rgba(217, 119, 87, 0.6)"
        : "rgba(100, 100, 100, 0.2)";
      ctx.lineWidth = isRelatedToHovered ? 1.5 : 0.5;
      ctx.stroke();

      // Arrow
      const dx = l.target.x - l.source.x;
      const dy = l.target.y - l.source.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return;

      const targetSize = NODE_SIZES[(l.target as GraphNode).type] || 5;
      const arrowPos = 1 - targetSize / len;
      const ax = l.source.x + dx * arrowPos;
      const ay = l.source.y + dy * arrowPos;
      const angle = Math.atan2(dy, dx);
      const arrowLen = isRelatedToHovered ? 5 : 3;

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(
        ax - arrowLen * Math.cos(angle - Math.PI / 6),
        ay - arrowLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        ax - arrowLen * Math.cos(angle + Math.PI / 6),
        ay - arrowLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = isRelatedToHovered
        ? "rgba(217, 119, 87, 0.6)"
        : "rgba(100, 100, 100, 0.3)";
      ctx.fill();

      // Link label when zoomed in
      if (globalScale > 2.5 && isRelatedToHovered && LINK_LABELS[l.type]) {
        const mx = (l.source.x + l.target.x) / 2;
        const my = (l.source.y + l.target.y) / 2;
        const fontSize = Math.max(8 / globalScale, 2);
        ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(217, 119, 87, 0.8)";
        ctx.fillText(LINK_LABELS[l.type], mx, my - 3);
      }
    },
    [hoveredNode]
  );

  const HIDDEN_KEYS = new Set([
    "id",
    "x",
    "y",
    "vx",
    "vy",
    "fx",
    "fy",
    "index",
    "__indexColor",
  ]);

  return (
    <PageShell
      title="Knowledge Graph Explorer"
      description="Visualize taxpayer-invoice relationships and detect circular trading"
    >
      {/* Controls */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-0 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 c-text-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search GSTIN, trade name, invoice..."
            className="w-full rounded-lg pl-10 pr-3 py-2 text-sm outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSearch}
            className="px-4 py-2 c-bg-dark hover:c-bg-card rounded-lg c-text text-sm transition-colors"
          >
            Search
          </button>
          <button
            onClick={loadGraph}
            className="px-4 py-2 c-bg-dark hover:c-bg-card rounded-lg c-text text-sm transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            onClick={loadCircularTrades}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 rounded-lg text-red-400 text-sm transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            <span className="hidden sm:inline">Detect Circular Trades</span>
            <span className="sm:hidden">Circular</span>
          </button>
        </div>
      </div>

      {/* Legend — clickable type filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {Object.entries(NODE_COLORS)
          .filter(([type]) => type !== "User")
          .map(([type, color]) => {
            const active = visibleTypes.has(type);
            const count = typeCounts[type] || 0;
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs transition-all border ${
                  active
                    ? "c-border opacity-100"
                    : "border-transparent opacity-40"
                }`}
                style={active ? { borderColor: `${color}40` } : undefined}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="c-text-2">
                  {type} <span className="c-text-3">({count})</span>
                </span>
              </button>
            );
          })}
        <span className="text-xs c-text-3 ml-auto">
          {filteredData.nodes.length} nodes &middot; {filteredData.links.length}{" "}
          edges
        </span>
      </div>

      {/* Graph + Node Detail */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div
          ref={containerRef}
          className="flex-1 c-bg-card rounded-xl border c-border overflow-hidden relative"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          {/* Zoom controls overlay */}
          {!loading && graphData.nodes.length > 0 && (
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
              <button
                onClick={handleZoomIn}
                className="p-1.5 c-bg-dark/80 hover:c-bg-dark rounded-lg c-text-2 hover:c-text backdrop-blur-sm transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-1.5 c-bg-dark/80 hover:c-bg-dark rounded-lg c-text-2 hover:c-text backdrop-blur-sm transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomFit}
                className="p-1.5 c-bg-dark/80 hover:c-bg-dark rounded-lg c-text-2 hover:c-text backdrop-blur-sm transition-colors"
                title="Fit to view"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center h-[400px] md:h-[600px] gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#d97757] border-t-transparent" />
              <span className="text-xs c-text-3">Loading graph data...</span>
            </div>
          ) : filteredData.nodes.length > 0 ? (
            <ForceGraph2D
              ref={graphRef}
              graphData={filteredData}
              width={dimensions.width}
              height={dimensions.height}
              nodeCanvasObject={paintNode}
              nodeCanvasObjectMode={() => "replace"}
              nodePointerAreaPaint={paintPointerArea}
              linkCanvasObject={paintLink}
              linkCanvasObjectMode={() => "replace"}
              onNodeClick={(node: object) =>
                setSelectedNode(node as GraphNode)
              }
              onNodeHover={(node: object | null) =>
                setHoveredNode(node as GraphNode | null)
              }
              onBackgroundClick={() => setSelectedNode(null)}
              backgroundColor="transparent"
              cooldownTicks={80}
              onEngineStop={handleEngineStop}
              d3AlphaDecay={0.03}
              d3VelocityDecay={0.3}
              minZoom={0.3}
              maxZoom={12}
              enableNodeDrag={true}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-[400px] md:h-[600px] gap-3">
              <Network className="w-10 h-10 c-text-3 opacity-40" />
              <p className="c-text-3 text-sm">No graph data available</p>
              <p className="c-text-3 text-xs">
                Upload GST returns and run reconciliation first
              </p>
            </div>
          )}
        </div>

        {/* Node detail panel */}
        {selectedNode && (
          <div
            className="w-full lg:w-80 c-bg-card rounded-xl border c-border p-4 h-fit max-h-[600px] overflow-y-auto"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor:
                      NODE_COLORS[selectedNode.type] || "#6b6b6b",
                  }}
                />
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: `${NODE_COLORS[selectedNode.type] || "#6b6b6b"}15`,
                    color: NODE_COLORS[selectedNode.type] || "#6b6b6b",
                  }}
                >
                  {selectedNode.type}
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-md c-text-3 hover:c-text-2 hover:c-bg-dark transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Primary label */}
            {selectedNode.label && (
              <p className="text-sm font-medium c-text mb-3 break-all">
                {String(selectedNode.label)}
              </p>
            )}

            {/* Properties */}
            <div className="space-y-2.5">
              {Object.entries(selectedNode)
                .filter(
                  ([k]) => !HIDDEN_KEYS.has(k) && k !== "label" && k !== "type"
                )
                .map(([key, value]) => (
                  <div
                    key={key}
                    className="pb-2 border-b c-border last:border-0"
                  >
                    <span className="text-[10px] c-text-3 uppercase tracking-wider font-medium">
                      {key.replace(/_/g, " ")}
                    </span>
                    <p className="text-xs c-text-2 font-mono break-all mt-0.5">
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
        <div
          className="mt-6 c-bg-card rounded-xl border border-red-500/20 p-6"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Circular Trade Detection
            </h2>
            <button
              onClick={() => setShowCircular(false)}
              className="p-1 rounded-md c-text-3 hover:c-text-2 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {circularTrades.length > 0 ? (
            <div className="space-y-3">
              {circularTrades.map((trade, i) => (
                <div
                  key={i}
                  className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {trade.cycle.map((gstin, j) => (
                      <span key={j} className="flex items-center gap-1">
                        <span className="text-sm text-red-300 font-mono bg-red-900/20 px-2 py-0.5 rounded">
                          {gstin.slice(0, 4)}...{gstin.slice(-4)}
                        </span>
                        {j < trade.cycle.length - 1 && (
                          <span className="c-text-3">&rarr;</span>
                        )}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs c-text-3 mt-1.5">
                    {trade.cycle_length} entities in cycle
                    {trade.names?.[0] && ` — starting from ${trade.names[0]}`}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="c-text-3 text-sm">
              No circular trading patterns detected.
            </p>
          )}
        </div>
      )}
    </PageShell>
  );
}
