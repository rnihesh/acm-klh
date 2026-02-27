"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import PageShell from "@/components/PageShell";
import {
  getGraphNodes,
  searchGraph,
  getCircularTrades,
  getTaxpayerNetwork,
} from "@/lib/api";
import {
  Search,
  AlertTriangle,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Network,
  ArrowRight,
  Focus,
  ChevronLeft,
  Info,
  ExternalLink,
} from "lucide-react";
import SearchableDropdown, { DropdownOption } from "@/components/SearchableDropdown";
import { useTheme } from "@/hooks/useTheme";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

/* ── Types ── */
interface GraphNode {
  id: string;
  label: string;
  type: string;
  isCenter?: boolean;
  gstin?: string;
  x?: number;
  y?: number;
  fx?: number | undefined;
  fy?: number | undefined;
  [key: string]: unknown;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  [key: string]: unknown;
}

interface CircularTrade {
  cycle: string[];
  names: string[];
  cycle_length: number;
}

/* ── Color Palette ── */
const NODE_COLORS_DARK: Record<string, string> = {
  Taxpayer: "#ffffff",
  Invoice: "#888888",
  GSTR1Return: "#c0c0c0",
  GSTR2BReturn: "#a0a0a0",
  GSTR3BReturn: "#707070",
  User: "#505050",
  EInvoice: "#d4d4d4",
  EWayBill: "#b0b0b0",
  PurchaseRegisterEntry: "#909090",
};

const NODE_COLORS_LIGHT: Record<string, string> = {
  Taxpayer: "#1a1a1a",
  Invoice: "#555555",
  GSTR1Return: "#333333",
  GSTR2BReturn: "#444444",
  GSTR3BReturn: "#666666",
  User: "#777777",
  EInvoice: "#2a2a2a",
  EWayBill: "#3a3a3a",
  PurchaseRegisterEntry: "#4a4a4a",
};

// Default export for static references (legend chips, detail panel dots)
const NODE_COLORS = NODE_COLORS_DARK;

const NODE_SIZES: Record<string, number> = {
  Taxpayer: 14,
  Invoice: 6,
  GSTR1Return: 8,
  GSTR2BReturn: 8,
  GSTR3BReturn: 8,
  User: 5,
  EInvoice: 7,
  EWayBill: 7,
  PurchaseRegisterEntry: 6,
};

const NODE_LABELS: Record<string, string> = {
  Taxpayer: "Taxpayers",
  Invoice: "Invoices",
  GSTR1Return: "GSTR-1",
  GSTR2BReturn: "GSTR-2B",
  GSTR3BReturn: "GSTR-3B",
};

const LINK_LABELS: Record<string, string> = {
  SUPPLIED_BY: "supplied by",
  SUPPLIED_TO: "supplied to",
  TRADES_WITH: "trades with",
  CONTAINS_OUTWARD: "contains",
  CONTAINS_INWARD: "contains",
  FILED: "filed",
  RECEIVED: "received",
  GENERATES: "generates",
  COVERS: "covers",
  TRANSPORTED_BY: "transported by",
  RECORDED_IN: "recorded in",
  CLAIMS_ITC: "claims ITC",
};

const HIDDEN_KEYS = new Set([
  "id", "x", "y", "vx", "vy", "fx", "fy", "index", "isCenter", "__indexColor",
]);

/* ── Helpers ── */
const nodeId = (ref: string | GraphNode) =>
  typeof ref === "string" ? ref : ref?.id;

/* ────────────────────── Component ────────────────────── */
export default function GraphPage() {
  const { isDark } = useTheme();

  /* Theme-aware color maps */
  const nodeColors = isDark ? NODE_COLORS_DARK : NODE_COLORS_LIGHT;

  /* State */
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    links: GraphLink[];
  }>({ nodes: [], links: [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
    new Set(["Taxpayer"])
  );

  /* Hub mode */
  const [hubMode, setHubMode] = useState(false);
  const [hubGstin, setHubGstin] = useState("");
  const [hubLabel, setHubLabel] = useState("");

  /* Circular trades */
  const [circularTrades, setCircularTrades] = useState<CircularTrade[]>([]);
  const [showCircular, setShowCircular] = useState(false);
  const [circularHighlight, setCircularHighlight] = useState<Set<string>>(new Set());

  /* Taxpayer options for hub dropdown */
  const taxpayerOptions: DropdownOption[] = useMemo(() =>
    graphData.nodes
      .filter((n) => n.type === "Taxpayer")
      .map((n) => ({
        value: String(n.gstin || n.id),
        label: String(n.label || n.gstin || ""),
        sublabel: String(n.gstin || ""),
      })),
    [graphData.nodes]
  );

  /* Refs */
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  /* ── Measure container ── */
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: Math.max(500, window.innerHeight - 260),
        });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  /* ── Pre-position helper ── */
  const prePosition = (nodes: GraphNode[]) => {
    const taxpayers = nodes.filter((n) => n.type === "Taxpayer");
    const others = nodes.filter((n) => n.type !== "Taxpayer");
    const radius = Math.max(100, taxpayers.length * 8);

    taxpayers.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / taxpayers.length - Math.PI / 2;
      n.x = radius * Math.cos(angle);
      n.y = radius * Math.sin(angle);
      n.fx = n.x;
      n.fy = n.y;
    });

    others.forEach((n, i) => {
      const r = radius * 0.5 * Math.sqrt(Math.random());
      const a = (2 * Math.PI * i) / others.length;
      n.x = r * Math.cos(a);
      n.y = r * Math.sin(a);
    });
  };

  /* ── Data loading ── */
  const loadGraph = useCallback(async () => {
    setLoading(true);
    setHubMode(false);
    setHubGstin("");
    setHubLabel("");
    setSelectedNode(null);
    setShowCircular(false);
    setCircularHighlight(new Set());
    try {
      const data = (await getGraphNodes(300)) as {
        nodes: GraphNode[];
        links: GraphLink[];
      };
      prePosition(data.nodes);
      setGraphData(data);
    } catch {
      /* empty graph */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  /* Search */
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadGraph();
      return;
    }
    setLoading(true);
    setHubMode(false);
    setSelectedNode(null);
    setVisibleTypes(new Set(Object.keys(NODE_COLORS)));
    try {
      const data = (await searchGraph(searchQuery)) as {
        nodes: GraphNode[];
        links: GraphLink[];
      };
      prePosition(data.nodes);
      setGraphData(data);
    } catch {
      /* pass */
    }
    setLoading(false);
  };

  /* Hub network — click on taxpayer */
  const loadHubNetwork = async (gstin: string, label?: string) => {
    if (!gstin) return;
    setLoading(true);
    setHubGstin(gstin);
    setHubLabel(label || gstin);
    setHubMode(true);
    setVisibleTypes(new Set(Object.keys(NODE_COLORS)));
    try {
      const data = (await getTaxpayerNetwork(gstin)) as {
        nodes: GraphNode[];
        links: GraphLink[];
      };

      // Center node fixed at origin, taxpayers fixed in circle, others float
      const center = data.nodes.find((n) => n.isCenter);
      if (center) {
        center.fx = 0;
        center.fy = 0;
      }
      const others = data.nodes.filter((n) => !n.isCenter);
      const taxpayers = others.filter((n) => n.type === "Taxpayer");
      const nonTaxpayers = others.filter((n) => n.type !== "Taxpayer");
      // Inner ring: taxpayers (fixed positions)
      const r1 = Math.max(200, taxpayers.length * 25);
      taxpayers.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / taxpayers.length - Math.PI / 2;
        n.fx = r1 * Math.cos(angle);
        n.fy = r1 * Math.sin(angle);
        n.x = n.fx;
        n.y = n.fy;
      });
      // Outer ring: invoices & returns (floating, but pre-positioned)
      const r2 = r1 * 0.6;
      nonTaxpayers.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / nonTaxpayers.length - Math.PI / 2;
        n.x = r2 * Math.cos(angle);
        n.y = r2 * Math.sin(angle);
        n.fx = undefined;
        n.fy = undefined;
      });

      setGraphData(data);
      setSelectedNode(center || null);
    } catch {
      /* pass */
    }
    setLoading(false);
  };

  /* Circular trades */
  const loadCircularTrades = async () => {
    try {
      const data = (await getCircularTrades()) as CircularTrade[];
      setCircularTrades(Array.isArray(data) ? data : []);
      setShowCircular(true);
      // Build highlight set from all cycle GSTINs
      const highlight = new Set<string>();
      for (const c of data) {
        for (const g of c.cycle) highlight.add(g);
      }
      setCircularHighlight(highlight);
    } catch {
      /* pass */
    }
  };

  /* ── Zoom controls ── */
  const handleZoomIn = () => graphRef.current?.zoom(graphRef.current.zoom() * 1.4, 300);
  const handleZoomOut = () => graphRef.current?.zoom(graphRef.current.zoom() / 1.4, 300);
  const handleZoomFit = () => graphRef.current?.zoomToFit(400, 60);

  /* ── D3 force config ── */
  useEffect(() => {
    if (!graphRef.current || graphData.nodes.length === 0) return;
    const timer = setTimeout(() => {
      const fg = graphRef.current;
      if (!fg) return;
      try {
        const charge = fg.d3Force("charge");
        if (charge) {
          charge.strength(hubMode ? -1500 : -500);
          charge.distanceMax(1000);
        }
      } catch { /* ignore */ }
      try {
        const link = fg.d3Force("link");
        if (link) {
          link.distance(hubMode ? 200 : 160);
          link.strength(hubMode ? 0.15 : 0.3);
        }
      } catch { /* ignore */ }
      try {
        const center = fg.d3Force("center");
        if (center) center.strength(0.03);
      } catch { /* ignore */ }

      // When multiple types visible and not hub mode, unfix taxpayers for natural layout
      const typesShown = new Set(
        graphData.nodes
          .filter((n) => visibleTypes.has(n.type))
          .map((n) => n.type)
      );
      if (typesShown.size > 1 && !hubMode) {
        graphData.nodes.forEach((n) => {
          if (n.type === "Taxpayer" && !n.isCenter) {
            n.fx = undefined;
            n.fy = undefined;
          }
        });
      }

      fg.d3ReheatSimulation();
    }, 100);
    return () => clearTimeout(timer);
  }, [graphData, hubMode, visibleTypes]);

  /* Auto-fit */
  const handleEngineStop = useCallback(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      graphRef.current.zoomToFit(600, 50);
    }
  }, [graphData.nodes.length]);

  /* ── Filtered data ── */
  const filteredData = useMemo(() => ({
    nodes: graphData.nodes.filter((n) => visibleTypes.has(n.type)),
    links: graphData.links.filter((l) => {
      const src = graphData.nodes.find((n) => n.id === nodeId(l.source));
      const tgt = graphData.nodes.find((n) => n.id === nodeId(l.target));
      return src && tgt && visibleTypes.has(src.type) && visibleTypes.has(tgt.type);
    }),
  }), [graphData, visibleTypes]);

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

  const typeCounts: Record<string, number> = {};
  for (const n of graphData.nodes) {
    typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
  }

  /* ── Connected nodes for detail panel ── */
  const connectedNodes = useMemo(() => {
    if (!selectedNode) return [];
    const connected: GraphNode[] = [];
    const seen = new Set<string>();
    for (const l of graphData.links) {
      const s = nodeId(l.source);
      const t = nodeId(l.target);
      let otherId = "";
      if (s === selectedNode.id) otherId = t;
      else if (t === selectedNode.id) otherId = s;
      if (otherId && !seen.has(otherId)) {
        seen.add(otherId);
        const node = graphData.nodes.find((n) => n.id === otherId);
        if (node) connected.push(node);
      }
    }
    return connected;
  }, [selectedNode, graphData]);

  /* ── Canvas rendering ── */
  const paintNode = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode;
      if (n.x == null || n.y == null) return;

      const baseSize = (n.isCenter ? 16 : NODE_SIZES[n.type]) || 6;
      const color = nodeColors[n.type] || "#6B7280";
      const isHovered = hoveredNode?.id === n.id;
      const isSelected = selectedNode?.id === n.id;
      const isCircularHighlighted = circularHighlight.has(String(n.gstin || n.id));

      const ref = hoveredNode || selectedNode;
      const isConnected =
        ref &&
        graphData.links.some((l) => {
          const s = nodeId(l.source);
          const t = nodeId(l.target);
          return (s === ref.id && t === n.id) || (t === ref.id && s === n.id);
        });
      const dimmed = ref && !isHovered && !isSelected && !isConnected;

      ctx.globalAlpha = dimmed ? 0.15 : 1;

      /* Circular trade pulsing ring */
      if (showCircular && isCircularHighlighted && !dimmed) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, baseSize + 6, 0, 2 * Math.PI);
        ctx.strokeStyle = "#EF444488";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(n.x, n.y, baseSize + 9, 0, 2 * Math.PI);
        ctx.strokeStyle = "#EF444433";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      /* Center glow */
      if (n.isCenter) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, baseSize + 8, 0, 2 * Math.PI);
        ctx.fillStyle = `${color}15`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x, n.y, baseSize + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = `${color}50`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      /* Hover / selection effect */
      if (isHovered || isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, baseSize + 4, 0, 2 * Math.PI);
        ctx.fillStyle = `${color}25`;
        ctx.fill();
      }
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, baseSize + 2, 0, 2 * Math.PI);
        ctx.strokeStyle = isDark ? "#ffffff" : "#000000";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      /* Main circle */
      ctx.beginPath();
      ctx.arc(n.x, n.y, baseSize, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      /* Inner highlight */
      if (baseSize >= 8) {
        ctx.beginPath();
        ctx.arc(n.x - baseSize * 0.2, n.y - baseSize * 0.25, baseSize * 0.3, 0, 2 * Math.PI);
        ctx.fillStyle = isDark ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.3)";
        ctx.fill();
      }

      /* Label */
      const showLabel =
        globalScale > 0.8 ||
        n.type === "Taxpayer" ||
        isHovered ||
        isSelected ||
        n.isCenter ||
        isConnected;
      if (showLabel && n.label) {
        const label = n.label.length > 20 ? n.label.slice(0, 18) + "..." : n.label;
        const fontSize = n.isCenter
          ? Math.max(12 / globalScale, 3.5)
          : n.type === "Taxpayer"
            ? Math.max(10 / globalScale, 3)
            : Math.max(8 / globalScale, 2.5);
        ctx.font = `${isHovered || isSelected || n.isCenter ? "600 " : "400 "}${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        // Background for label
        const metrics = ctx.measureText(label);
        const padding = 2 / globalScale;
        ctx.fillStyle = isDark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)";
        ctx.fillRect(
          n.x - metrics.width / 2 - padding,
          n.y + baseSize + 1.5,
          metrics.width + padding * 2,
          fontSize + padding
        );

        ctx.fillStyle = isDark
          ? (isHovered || isSelected || n.isCenter ? "#ffffff" : "rgba(220,220,220,0.9)")
          : (isHovered || isSelected || n.isCenter ? "#000000" : "rgba(40,40,40,0.9)");
        ctx.fillText(label, n.x, n.y + baseSize + 2);
      }

      ctx.globalAlpha = 1;
    },
    [hoveredNode, selectedNode, graphData.links, circularHighlight, showCircular, isDark, nodeColors]
  );

  const paintPointerArea = useCallback(
    (node: object, color: string, ctx: CanvasRenderingContext2D) => {
      const n = node as GraphNode;
      if (n.x == null || n.y == null) return;
      ctx.beginPath();
      ctx.arc(n.x, n.y, (NODE_SIZES[n.type] || 5) + 6, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    []
  );

  const paintLink = useCallback(
    (link: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const l = link as GraphLink & { source: GraphNode; target: GraphNode };
      if (!l.source?.x || !l.target?.x || l.source.y == null || l.target.y == null) return;

      const ref = hoveredNode || selectedNode;
      const isHighlighted = ref && (l.source.id === ref.id || l.target.id === ref.id);
      const dimmed = ref && !isHighlighted;

      // Circular trade link highlight
      const srcGstin = String((l.source as GraphNode).gstin || l.source.id);
      const tgtGstin = String((l.target as GraphNode).gstin || l.target.id);
      const isCircularLink = showCircular && circularHighlight.has(srcGstin) && circularHighlight.has(tgtGstin);

      const dx = l.target.x! - l.source.x!;
      const dy = l.target.y! - l.source.y!;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return;

      /* Line */
      ctx.beginPath();
      ctx.moveTo(l.source.x!, l.source.y!);
      ctx.lineTo(l.target.x!, l.target.y!);
      ctx.strokeStyle = isCircularLink
        ? "rgba(239, 68, 68, 0.6)"
        : isHighlighted
          ? (isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.5)")
          : dimmed
            ? (isDark ? "rgba(100, 100, 100, 0.03)" : "rgba(100, 100, 100, 0.06)")
            : (isDark ? "rgba(120, 120, 120, 0.12)" : "rgba(80, 80, 80, 0.2)");
      ctx.lineWidth = isCircularLink ? 2.5 : isHighlighted ? 1.8 : 0.5;
      ctx.stroke();

      /* Arrow */
      if (!dimmed && (isHighlighted || isCircularLink || globalScale > 1.5)) {
        const targetSize = NODE_SIZES[(l.target as GraphNode).type] || 5;
        const arrowPos = 1 - (targetSize + 2) / len;
        const ax = l.source.x! + dx * arrowPos;
        const ay = l.source.y! + dy * arrowPos;
        const angle = Math.atan2(dy, dx);
        const arrowLen = isHighlighted || isCircularLink ? 5 : 3;

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - arrowLen * Math.cos(angle - Math.PI / 6), ay - arrowLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(ax - arrowLen * Math.cos(angle + Math.PI / 6), ay - arrowLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = isCircularLink
          ? "rgba(239, 68, 68, 0.6)"
          : isHighlighted
            ? (isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.5)")
            : (isDark ? "rgba(100, 100, 100, 0.2)" : "rgba(60, 60, 60, 0.3)");
        ctx.fill();
      }

      /* Link label */
      if (isHighlighted && globalScale > 1.8 && LINK_LABELS[l.type]) {
        const mx = (l.source.x! + l.target.x!) / 2;
        const my = (l.source.y! + l.target.y!) / 2;
        const fontSize = Math.max(8 / globalScale, 2.5);
        ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.8)" : "rgba(0, 0, 0, 0.8)";
        ctx.fillText(LINK_LABELS[l.type], mx, my - 3 / globalScale);
      }
    },
    [hoveredNode, selectedNode, circularHighlight, showCircular, isDark]
  );

  /* ═══════════ RENDER ═══════════ */
  return (
    <PageShell
      title="Graph Explorer"
      description="Visualize taxpayer relationships and detect circular trading patterns"
    >
      {/* ── Top Controls ── */}
      <div className="flex flex-col gap-3 mb-4">
        {/* Search bar + actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 min-w-0 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 c-text-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search GSTIN, trade name, or invoice..."
              className="w-full rounded-xl pl-10 pr-3 py-2.5 text-sm outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSearch}
              className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
            >
              Search
            </button>
            {hubMode && (
              <button
                onClick={() => {
                  setVisibleTypes(new Set(["Taxpayer"]));
                  loadGraph();
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 c-bg-dark hover:c-bg-card rounded-xl c-text text-sm transition-colors border c-border"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back to Overview
              </button>
            )}
            {!hubMode && (
              <button
                onClick={() => {
                  setVisibleTypes(new Set(["Taxpayer"]));
                  loadGraph();
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 c-bg-dark hover:c-bg-card rounded-xl c-text text-sm transition-colors border c-border"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
            <button
              onClick={() => {
                if (showCircular) {
                  setShowCircular(false);
                  setCircularHighlight(new Set());
                } else {
                  loadCircularTrades();
                }
              }}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm transition-colors border ${
                showCircular
                  ? "bg-red-500/20 border-red-500/30 text-red-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/15"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {showCircular ? "Hide Circular Trades" : "Circular Trades"}
              </span>
              <span className="sm:hidden">Circular</span>
            </button>
          </div>
        </div>

        {/* Type filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(nodeColors)
            .filter(([type]) => type !== "User" && (typeCounts[type] || 0) > 0)
            .map(([type, color]) => {
              const active = visibleTypes.has(type);
              const count = typeCounts[type] || 0;
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    active
                      ? "border-transparent"
                      : "c-border opacity-40 hover:opacity-70"
                  }`}
                  style={active ? {
                    backgroundColor: `${color}20`,
                    color: color,
                    borderColor: `${color}40`,
                  } : undefined}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {NODE_LABELS[type] || type}
                  <span className="opacity-60">({count})</span>
                </button>
              );
            })}
          <span className="text-[11px] c-text-3 ml-2">
            {filteredData.nodes.length} nodes &middot; {filteredData.links.length} edges
          </span>
        </div>

        {/* Hub View selector */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              if (hubMode) {
                setHubMode(false);
                setHubGstin("");
                setHubLabel("");
                setVisibleTypes(new Set(["Taxpayer"]));
                loadGraph();
              } else {
                setHubMode(true);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              hubMode
                ? "border-transparent"
                : "c-bg-dark c-text-2 c-border hover:c-bg-card"
            }`}
            style={hubMode ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : undefined}
          >
            <Focus className="w-3.5 h-3.5" />
            Hub View
          </button>
          {hubMode && (
            <SearchableDropdown
              options={taxpayerOptions}
              value={hubGstin}
              onChange={(v) => {
                const opt = taxpayerOptions.find((o) => o.value === v);
                loadHubNetwork(v, opt?.label);
              }}
              placeholder="Select taxpayer to center..."
              className="w-64"
            />
          )}
          {hubMode && hubGstin && (
            <span className="text-[11px] c-text-3">
              Showing network for{" "}
              <span className="font-mono c-text-2 font-medium">{hubLabel || hubGstin}</span>
            </span>
          )}
        </div>

        {/* Circular trades banner */}
        {showCircular && circularTrades.length > 0 && (
          <div className="flex flex-col gap-2 p-3 bg-red-500/5 border border-red-500/15 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                {circularTrades.length} circular trading pattern{circularTrades.length > 1 ? "s" : ""} detected
              </span>
              <button onClick={() => { setShowCircular(false); setCircularHighlight(new Set()); }}
                className="p-1 rounded c-text-3 hover:c-text-2">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {circularTrades.slice(0, 3).map((trade, i) => (
                <div key={i} className="flex items-center gap-1 text-[11px]">
                  {trade.cycle.map((gstin, j) => (
                    <span key={j} className="flex items-center gap-0.5">
                      <span className="text-red-300 font-mono bg-red-900/25 px-1.5 py-0.5 rounded">
                        {gstin.slice(0, 4)}...{gstin.slice(-4)}
                      </span>
                      {j < trade.cycle.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-red-400/50" />
                      )}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Main Layout ── */}
      <div className="flex gap-4" style={{ height: `${dimensions.height}px` }}>
        {/* Graph Canvas */}
        <div
          ref={containerRef}
          className="flex-1 c-bg-card rounded-xl border c-border overflow-hidden relative"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          {/* Floating zoom controls */}
          {!loading && graphData.nodes.length > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 p-1 c-bg-dark/90 backdrop-blur-sm rounded-xl border c-border shadow-lg">
              {[
                { icon: ZoomIn, handler: handleZoomIn, label: "Zoom in" },
                { icon: ZoomOut, handler: handleZoomOut, label: "Zoom out" },
                { icon: Maximize2, handler: handleZoomFit, label: "Fit" },
              ].map(({ icon: Icon, handler, label }) => (
                <button
                  key={label}
                  onClick={handler}
                  className="p-2 hover:c-bg-card rounded-lg c-text-2 hover:c-text transition-colors"
                  title={label}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          )}

          {/* Interaction hint */}
          {!loading && graphData.nodes.length > 0 && !hubMode && !selectedNode && (
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 c-bg-dark/80 backdrop-blur-sm rounded-lg text-[10px] c-text-3">
              <Info className="w-3 h-3" />
              Click a taxpayer to explore their network
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div
                className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
                style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
              />
              <span className="text-xs c-text-3">Loading graph data...</span>
            </div>
          ) : filteredData.nodes.length > 0 ? (
            <ForceGraph2D
              ref={graphRef}
              graphData={filteredData}
              width={dimensions.width - 2}
              height={dimensions.height - 2}
              nodeCanvasObject={paintNode}
              nodeCanvasObjectMode={() => "replace"}
              nodePointerAreaPaint={paintPointerArea}
              linkCanvasObject={paintLink}
              linkCanvasObjectMode={() => "replace"}
              onNodeClick={(node: object) => {
                const n = node as GraphNode;
                setSelectedNode(n);
                if (n.type === "Taxpayer" && n.gstin && !n.isCenter) {
                  loadHubNetwork(String(n.gstin), String(n.label || n.gstin));
                }
              }}
              onNodeHover={(node: object | null) =>
                setHoveredNode(node as GraphNode | null)
              }
              onBackgroundClick={() => {
                setSelectedNode(null);
                setHoveredNode(null);
              }}
              backgroundColor="transparent"
              cooldownTicks={300}
              onEngineStop={handleEngineStop}
              d3AlphaDecay={0.01}
              d3VelocityDecay={hubMode ? 0.2 : 0.15}
              minZoom={0.1}
              maxZoom={12}
              enableNodeDrag={true}
              warmupTicks={0}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Network className="w-12 h-12 c-text-3 opacity-30" />
              <p className="c-text-3 text-sm font-medium">No graph data available</p>
              <p className="c-text-3 text-xs opacity-70">Upload GST returns and run reconciliation first</p>
            </div>
          )}
        </div>

        {/* ── Node Detail Panel ── */}
        {selectedNode && (
          <div
            className="w-72 flex-shrink-0 c-bg-card rounded-xl border c-border overflow-hidden flex flex-col"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--bg-border)" }}>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: nodeColors[selectedNode.type] || "#6B7280" }}
                />
                <span className="text-xs font-semibold c-text">
                  {NODE_LABELS[selectedNode.type] || selectedNode.type}
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-md c-text-3 hover:c-text-2 hover:c-bg-dark transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Name */}
              {selectedNode.label && (
                <div>
                  <p className="text-sm font-semibold c-text break-all">
                    {String(selectedNode.label)}
                  </p>
                  {selectedNode.isCenter && (
                    <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded mt-1 inline-block">
                      Center Node
                    </span>
                  )}
                </div>
              )}

              {/* Properties */}
              <div className="space-y-2.5">
                {Object.entries(selectedNode)
                  .filter(([k]) => !HIDDEN_KEYS.has(k) && k !== "label" && k !== "type")
                  .map(([key, value]) => (
                    <div key={key}>
                      <span className="text-[10px] c-text-3 uppercase tracking-wider font-medium">
                        {key.replace(/_/g, " ")}
                      </span>
                      <p className="text-xs c-text font-mono break-all mt-0.5">
                        {String(value)}
                      </p>
                    </div>
                  ))}
              </div>

              {/* Connected Nodes */}
              {connectedNodes.length > 0 && (
                <div>
                  <span className="text-[10px] c-text-3 uppercase tracking-wider font-medium">
                    Connected ({connectedNodes.length})
                  </span>
                  <div className="mt-1.5 space-y-1">
                    {connectedNodes.slice(0, 12).map((cn) => (
                      <button
                        key={cn.id}
                        onClick={() => {
                          setSelectedNode(cn);
                          if (cn.type === "Taxpayer" && cn.gstin) {
                            loadHubNetwork(String(cn.gstin), String(cn.label || cn.gstin));
                          }
                        }}
                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg c-bg-dark hover:c-bg-card text-left transition-colors group"
                      >
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: nodeColors[cn.type] || "#6B7280" }}
                        />
                        <span className="text-[11px] c-text-2 truncate flex-1">
                          {cn.label || cn.id}
                        </span>
                        {cn.type === "Taxpayer" && (
                          <ExternalLink className="w-3 h-3 c-text-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    ))}
                    {connectedNodes.length > 12 && (
                      <p className="text-[10px] c-text-3 px-2">
                        +{connectedNodes.length - 12} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              {selectedNode.type === "Taxpayer" && selectedNode.gstin && !selectedNode.isCenter && (
                <div>
                  <span className="text-[10px] c-text-3 uppercase tracking-wider font-medium">
                    Actions
                  </span>
                  <div className="mt-1.5 space-y-1">
                    <button
                      onClick={() => loadHubNetwork(String(selectedNode.gstin), String(selectedNode.label || selectedNode.gstin))}
                      className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-xs transition-colors"
                      style={{ backgroundColor: "var(--accent-light)", color: "var(--accent)" }}
                    >
                      <Focus className="w-3.5 h-3.5" />
                      Explore Network
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
