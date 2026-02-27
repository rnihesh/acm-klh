"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  ArrowUpDown,
  Focus,
} from "lucide-react";
import SearchableDropdown, { DropdownOption } from "@/components/SearchableDropdown";

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

/* ── Constants ── */
const NODE_COLORS: Record<string, string> = {
  Taxpayer: "#d97757",
  Invoice: "#5cb85c",
  GSTR1Return: "#f0ad4e",
  GSTR2BReturn: "#9b8ec3",
  GSTR3BReturn: "#d9534f",
  User: "#6b6b6b",
};

const NODE_SIZES: Record<string, number> = {
  Taxpayer: 10,
  Invoice: 4,
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

/* ── Helpers ── */
const nodeId = (ref: string | GraphNode) =>
  typeof ref === "string" ? ref : ref?.id;

/* ── Component ── */
export default function GraphPage() {
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
  const [viewMode, setViewMode] = useState<"graph" | "table">("graph");
  const [hubMode, setHubMode] = useState(false);
  const [hubGstin, setHubGstin] = useState("");

  /* Circular trades */
  const [circularTrades, setCircularTrades] = useState<CircularTrade[]>([]);
  const [showCircular, setShowCircular] = useState(false);

  /* Table sort */
  const [tableSortKey, setTableSortKey] = useState<
    "from" | "to" | "volume" | "frequency"
  >("volume");
  const [tableSortDir, setTableSortDir] = useState<"asc" | "desc">("desc");

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
          height: window.innerWidth < 768 ? 450 : 640,
        });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  /* ── Data loading ── */
  const prePosition = (nodes: GraphNode[]) => {
    const taxpayers = nodes.filter((n) => n.type === "Taxpayer");
    const others = nodes.filter((n) => n.type !== "Taxpayer");
    const radius = Math.max(180, taxpayers.length * 12);

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

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setHubMode(false);
    setHubGstin("");
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadGraph();
      return;
    }
    setLoading(true);
    setHubMode(false);
    setHubGstin("");
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

  /* Load hub network for a specific taxpayer */
  const loadHubNetwork = async (gstin: string) => {
    if (!gstin) return;
    setLoading(true);
    setHubGstin(gstin);
    setHubMode(true);
    setVisibleTypes(new Set(Object.keys(NODE_COLORS)));
    try {
      const data = (await getTaxpayerNetwork(gstin)) as {
        nodes: GraphNode[];
        links: GraphLink[];
      };

      const center = data.nodes.find((n) => n.isCenter);
      const taxpayers = data.nodes.filter(
        (n) => n.type === "Taxpayer" && !n.isCenter
      );
      const invoices = data.nodes.filter((n) => n.type === "Invoice");
      const returns = data.nodes.filter(
        (n) =>
          n.type === "GSTR1Return" ||
          n.type === "GSTR2BReturn" ||
          n.type === "GSTR3BReturn"
      );

      if (center) {
        center.x = 0;
        center.y = 0;
        center.fx = 0;
        center.fy = 0;
      }

      const r1 = Math.max(150, taxpayers.length * 15);
      taxpayers.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / taxpayers.length - Math.PI / 2;
        n.x = r1 * Math.cos(angle);
        n.y = r1 * Math.sin(angle);
        n.fx = n.x;
        n.fy = n.y;
      });

      const r2 = r1 + 80;
      invoices.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / invoices.length + 0.1;
        n.x = r2 * Math.cos(angle);
        n.y = r2 * Math.sin(angle);
        n.fx = n.x;
        n.fy = n.y;
      });

      const r3 = r2 + 60;
      returns.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / Math.max(returns.length, 1);
        n.x = r3 * Math.cos(angle);
        n.y = r3 * Math.sin(angle);
        n.fx = n.x;
        n.fy = n.y;
      });

      setGraphData(data);
    } catch {
      /* pass */
    }
    setLoading(false);
  };

  /* Taxpayer options for hub dropdown */
  const taxpayerOptions: DropdownOption[] = graphData.nodes
    .filter((n) => n.type === "Taxpayer")
    .map((n) => ({
      value: String(n.gstin || n.id),
      label: String(n.label || n.gstin || ""),
      sublabel: String(n.gstin || ""),
    }));

  const loadCircularTrades = async () => {
    try {
      const data = (await getCircularTrades()) as CircularTrade[];
      setCircularTrades(Array.isArray(data) ? data : []);
      setShowCircular(true);
    } catch {
      /* pass */
    }
  };

  /* ── Zoom controls ── */
  const handleZoomIn = () => {
    graphRef.current?.zoom(graphRef.current.zoom() * 1.4, 300);
  };
  const handleZoomOut = () => {
    graphRef.current?.zoom(graphRef.current.zoom() / 1.4, 300);
  };
  const handleZoomFit = () => {
    graphRef.current?.zoomToFit(400, 60);
  };

  /* ── D3 force config ── */
  useEffect(() => {
    if (!graphRef.current || graphData.nodes.length === 0) return;
    const timer = setTimeout(() => {
      const fg = graphRef.current;
      if (!fg) return;

      try {
        const charge = fg.d3Force("charge");
        if (charge) {
          charge.strength(hubMode ? -600 : -500);
          charge.distanceMax(800);
        }
      } catch {
        /* ignore */
      }

      try {
        const link = fg.d3Force("link");
        if (link) {
          link.distance(hubMode ? 150 : 160);
          link.strength(0.3);
        }
      } catch {
        /* ignore */
      }

      try {
        const center = fg.d3Force("center");
        if (center) center.strength(0.03);
      } catch {
        /* ignore */
      }

      // When multiple types visible and not focused, unfix taxpayers
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

  /* Auto-fit on engine stop */
  const handleEngineStop = useCallback(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      graphRef.current.zoomToFit(600, 50);
    }
  }, [graphData.nodes.length]);

  /* ── Filtered data ── */
  const filteredData = {
    nodes: graphData.nodes.filter((n) => visibleTypes.has(n.type)),
    links: graphData.links.filter((l) => {
      const src = graphData.nodes.find((n) => n.id === nodeId(l.source));
      const tgt = graphData.nodes.find((n) => n.id === nodeId(l.target));
      return (
        src && tgt && visibleTypes.has(src.type) && visibleTypes.has(tgt.type)
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

  const typeCounts: Record<string, number> = {};
  for (const n of graphData.nodes) {
    typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
  }

  /* ── Table data ── */
  interface TradeRow {
    from: string;
    fromLabel: string;
    to: string;
    toLabel: string;
    volume: number;
    frequency: number;
    relType: string;
  }

  const tableRows: TradeRow[] = (() => {
    if (viewMode !== "table") return [];
    const nodeMap = new Map(graphData.nodes.map((n) => [n.id, n]));
    const rows: TradeRow[] = [];
    const seen = new Set<string>();

    for (const l of graphData.links) {
      const srcId = nodeId(l.source);
      const tgtId = nodeId(l.target);
      if (!srcId || !tgtId) continue;
      const key = `${srcId}-${tgtId}-${l.type}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const srcNode = nodeMap.get(srcId);
      const tgtNode = nodeMap.get(tgtId);
      if (
        !srcNode ||
        !tgtNode ||
        srcNode.type !== "Taxpayer" ||
        tgtNode.type !== "Taxpayer"
      )
        continue;

      rows.push({
        from: srcId,
        fromLabel: String(srcNode.label || srcId),
        to: tgtId,
        toLabel: String(tgtNode.label || tgtId),
        volume: Number(
          (l as Record<string, unknown>).volume ||
          (l as Record<string, unknown>).totalVolume ||
          (l as Record<string, unknown>).total_volume ||
          0
        ),
        frequency: Number(
          (l as Record<string, unknown>).frequency ||
          (l as Record<string, unknown>).transactionCount ||
          (l as Record<string, unknown>).transaction_count ||
          0
        ),
        relType: l.type,
      });
    }

    rows.sort((a, b) => {
      const mul = tableSortDir === "asc" ? 1 : -1;
      if (tableSortKey === "from")
        return mul * a.fromLabel.localeCompare(b.fromLabel);
      if (tableSortKey === "to")
        return mul * a.toLabel.localeCompare(b.toLabel);
      if (tableSortKey === "volume") return mul * (a.volume - b.volume);
      return mul * (a.frequency - b.frequency);
    });
    return rows;
  })();

  const toggleTableSort = (key: typeof tableSortKey) => {
    if (tableSortKey === key) {
      setTableSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setTableSortKey(key);
      setTableSortDir("desc");
    }
  };

  /* ── Canvas rendering ── */
  const paintNode = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode;
      if (n.x == null || n.y == null) return;

      const baseSize = (n.isCenter ? 14 : NODE_SIZES[n.type]) || 5;
      const color = NODE_COLORS[n.type] || "#6b6b6b";
      const isHovered = hoveredNode?.id === n.id;
      const isSelected = selectedNode?.id === n.id;

      const ref = hoveredNode || selectedNode;
      const isConnected =
        ref &&
        graphData.links.some((l) => {
          const s = nodeId(l.source);
          const t = nodeId(l.target);
          return (s === ref.id && t === n.id) || (t === ref.id && s === n.id);
        });
      const dimmed = ref && !isHovered && !isSelected && !isConnected;

      ctx.globalAlpha = dimmed ? 0.12 : 1;

      /* Center glow ring */
      if (n.isCenter) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, baseSize + 6, 0, 2 * Math.PI);
        ctx.fillStyle = `${color}15`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x, n.y, baseSize + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = `${color}40`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      /* Hover / selection glow */
      if (isHovered || isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, baseSize + 4, 0, 2 * Math.PI);
        ctx.fillStyle = `${color}20`;
        ctx.fill();
      }
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, baseSize + 2, 0, 2 * Math.PI);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      /* Main circle */
      ctx.beginPath();
      ctx.arc(n.x, n.y, baseSize, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      /* Highlight dot */
      if (baseSize >= 6) {
        ctx.beginPath();
        ctx.arc(
          n.x - baseSize * 0.2,
          n.y - baseSize * 0.2,
          baseSize * 0.3,
          0,
          2 * Math.PI
        );
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fill();
      }

      /* Label */
      const showLabel =
        globalScale > 1.2 ||
        n.type === "Taxpayer" ||
        isHovered ||
        isSelected ||
        n.isCenter ||
        isConnected;
      if (showLabel && n.label) {
        const label =
          n.label.length > 20 ? n.label.slice(0, 18) + "…" : n.label;
        const fontSize = n.isCenter
          ? Math.max(12 / globalScale, 3.5)
          : n.type === "Taxpayer"
            ? Math.max(10 / globalScale, 2.8)
            : Math.max(8 / globalScale, 2.2);
        ctx.font = `${isHovered || isSelected || n.isCenter ? "600 " : ""}${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillText(label, n.x + 0.5, n.y + baseSize + 2.5);
        ctx.fillStyle =
          isHovered || isSelected || n.isCenter
            ? "#ffffff"
            : "rgba(210,210,210,0.85)";
        ctx.fillText(label, n.x, n.y + baseSize + 2);
      }

      ctx.globalAlpha = 1;
    },
    [hoveredNode, selectedNode, graphData.links]
  );

  const paintPointerArea = useCallback(
    (node: object, color: string, ctx: CanvasRenderingContext2D) => {
      const n = node as GraphNode;
      if (n.x == null || n.y == null) return;
      ctx.beginPath();
      ctx.arc(n.x, n.y, (NODE_SIZES[n.type] || 5) + 4, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    []
  );

  const paintLink = useCallback(
    (link: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const l = link as GraphLink & { source: GraphNode; target: GraphNode };
      if (!l.source?.x || !l.target?.x || l.source.y == null || l.target.y == null)
        return;

      const ref = hoveredNode || selectedNode;
      const isHighlighted =
        ref &&
        (l.source.id === ref.id || l.target.id === ref.id);
      const dimmed = ref && !isHighlighted;

      const dx = l.target.x! - l.source.x!;
      const dy = l.target.y! - l.source.y!;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return;

      /* Draw line */
      ctx.beginPath();
      ctx.moveTo(l.source.x!, l.source.y!);
      ctx.lineTo(l.target.x!, l.target.y!);
      ctx.strokeStyle = isHighlighted
        ? "rgba(217, 119, 87, 0.65)"
        : dimmed
          ? "rgba(100, 100, 100, 0.02)"
          : "rgba(100, 100, 100, 0.08)";
      ctx.lineWidth = isHighlighted ? 1.8 : 0.4;
      ctx.stroke();

      /* Arrow */
      if (!dimmed && (isHighlighted || globalScale > 1.5)) {
        const targetSize = NODE_SIZES[(l.target as GraphNode).type] || 5;
        const arrowPos = 1 - (targetSize + 2) / len;
        const ax = l.source.x! + dx * arrowPos;
        const ay = l.source.y! + dy * arrowPos;
        const angle = Math.atan2(dy, dx);
        const arrowLen = isHighlighted ? 4.5 : 2.5;

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
        ctx.fillStyle = isHighlighted
          ? "rgba(217, 119, 87, 0.65)"
          : "rgba(100, 100, 100, 0.2)";
        ctx.fill();
      }

      /* Link label */
      if (globalScale > 2.2 && isHighlighted && LINK_LABELS[l.type]) {
        const mx = (l.source.x! + l.target.x!) / 2;
        const my = (l.source.y! + l.target.y!) / 2;
        const fontSize = Math.max(8 / globalScale, 2);
        ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(217, 119, 87, 0.9)";
        ctx.fillText(LINK_LABELS[l.type], mx, my - 3 / globalScale);
      }
    },
    [hoveredNode, selectedNode]
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
    "isCenter",
    "__indexColor",
  ]);

  /* ═══════════ RENDER ═══════════ */
  return (
    <PageShell
      title="Graph Explorer"
      description="Visualize taxpayer relationships and detect circular trading patterns"
    >
      {/* ── Top bar: Search + Actions ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
        {/* Search */}
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

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSearch}
            className="px-4 py-2 c-bg-dark hover:c-bg-card rounded-lg c-text text-sm transition-colors"
          >
            Search
          </button>
          <button
            onClick={() => {
              setHubMode(false);
              setHubGstin("");
              setVisibleTypes(new Set(["Taxpayer"]));
              loadGraph();
            }}
            className="px-4 py-2 c-bg-dark hover:c-bg-card rounded-lg c-text text-sm transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            onClick={loadCircularTrades}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 rounded-lg text-red-400 text-sm transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Circular Trades</span>
            <span className="sm:hidden">Circular</span>
          </button>
        </div>
      </div>

      {/* ── Hub View Controls ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={() => {
            if (hubMode) {
              setHubMode(false);
              setHubGstin("");
              setVisibleTypes(new Set(["Taxpayer"]));
              loadGraph();
            } else {
              setHubMode(true);
            }
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all border ${hubMode
            ? "text-white border-transparent"
            : "c-bg-dark c-text-2 c-border hover:c-bg-card"
            }`}
          style={hubMode ? { backgroundColor: "var(--accent)" } : undefined}
        >
          <Focus className="w-4 h-4" />
          Hub View
        </button>
        {hubMode && (
          <SearchableDropdown
            options={taxpayerOptions}
            value={hubGstin}
            onChange={(v) => loadHubNetwork(v)}
            placeholder="Select taxpayer to center..."
            className="w-64"
          />
        )}
        {hubMode && hubGstin && (
          <span className="text-xs c-text-3">
            Showing network around{" "}
            <span className="font-mono c-text-2">
              {hubGstin.slice(0, 6)}…{hubGstin.slice(-4)}
            </span>
          </span>
        )}
      </div>

      {/* ── View toggle + Legend ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Graph / Table toggle */}
        <div className="flex items-center gap-1 p-1 c-bg-dark rounded-lg">
          <button
            onClick={() => setViewMode("graph")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all ${viewMode === "graph"
              ? "c-bg-card c-text font-medium shadow-sm"
              : "c-text-3 hover:c-text-2"
              }`}
          >
            <Network className="w-3.5 h-3.5" />
            Graph
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all ${viewMode === "table"
              ? "c-bg-card c-text font-medium shadow-sm"
              : "c-text-3 hover:c-text-2"
              }`}
          >
            <ArrowRight className="w-3.5 h-3.5" />
            Relationships
          </button>
        </div>

        {/* Type legend chips */}
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {Object.entries(NODE_COLORS)
            .filter(([type]) => type !== "User")
            .map(([type, color]) => {
              const active = visibleTypes.has(type);
              const count = typeCounts[type] || 0;
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-all ${active ? "opacity-100" : "opacity-35"
                    }`}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="c-text-2">
                    {type}{" "}
                    <span className="c-text-3">({count})</span>
                  </span>
                </button>
              );
            })}
          <span className="text-[11px] c-text-3 pl-1">
            {filteredData.nodes.length} nodes · {filteredData.links.length} edges
          </span>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-col lg:flex-row gap-4">
        {viewMode === "table" ? (
          /* ── Relationships Table ── */
          <div
            className="flex-1 c-bg-card rounded-xl border c-border overflow-hidden"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 c-bg-dark border-b c-border z-10">
                  <tr>
                    {(
                      [
                        { key: "from" as const, label: "Supplier" },
                        { key: "to" as const, label: "Buyer" },
                        { key: "volume" as const, label: "Trade Volume (₹)" },
                        { key: "frequency" as const, label: "Transactions" },
                      ] as const
                    ).map(({ key, label }) => (
                      <th
                        key={key}
                        className="px-4 py-3 text-left c-text-2 font-medium cursor-pointer hover:c-text select-none text-xs"
                        onClick={() => toggleTableSort(key)}
                      >
                        <div className="flex items-center gap-1.5">
                          {label}
                          <ArrowUpDown
                            className={`w-3 h-3 ${tableSortKey === key
                              ? "c-text"
                              : "c-text-3 opacity-40"
                              }`}
                          />
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left c-text-2 font-medium text-xs">
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.length > 0 ? (
                    tableRows.map((row, i) => (
                      <tr
                        key={`${row.from}-${row.to}-${i}`}
                        className="border-b c-border hover:c-bg-dark/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="c-text font-medium text-sm block">
                            {row.fromLabel}
                          </span>
                          <span className="text-[10px] c-text-3 font-mono">
                            {row.from.slice(0, 8)}…{row.from.slice(-4)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ArrowRight className="w-3 h-3 c-text-3 flex-shrink-0" />
                            <div>
                              <span className="c-text font-medium text-sm block">
                                {row.toLabel}
                              </span>
                              <span className="text-[10px] c-text-3 font-mono">
                                {row.to.slice(0, 8)}…{row.to.slice(-4)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono c-text text-sm">
                          {row.volume > 0
                            ? `₹${row.volume.toLocaleString("en-IN")}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono c-text-2 text-sm">
                          {row.frequency > 0 ? row.frequency : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: "#d9775718",
                              color: "#d97757",
                            }}
                          >
                            {row.relType.replace(/_/g, " ").toLowerCase()}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-20 text-center c-text-3"
                      >
                        <Network className="w-8 h-8 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">
                          No trade relationships found
                        </p>
                        <p className="text-xs mt-1 opacity-70">
                          Upload data and run reconciliation to populate
                          relationships
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {tableRows.length > 0 && (
              <div className="px-4 py-2.5 border-t c-border text-xs c-text-3">
                {tableRows.length} relationships · Total volume: ₹
                {tableRows
                  .reduce((s, r) => s + r.volume, 0)
                  .toLocaleString("en-IN")}
              </div>
            )}
          </div>
        ) : (
          /* ── Force Graph ── */
          <div
            ref={containerRef}
            className="flex-1 c-bg-card rounded-xl border c-border overflow-hidden relative"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            {/* Zoom controls */}
            {!loading && graphData.nodes.length > 0 && (
              <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
                {[
                  { icon: ZoomIn, handler: handleZoomIn, title: "Zoom in" },
                  { icon: ZoomOut, handler: handleZoomOut, title: "Zoom out" },
                  {
                    icon: Maximize2,
                    handler: handleZoomFit,
                    title: "Fit to view",
                  },
                ].map(({ icon: Icon, handler, title }) => (
                  <button
                    key={title}
                    onClick={handler}
                    className="p-1.5 c-bg-dark/80 hover:c-bg-dark rounded-lg c-text-2 hover:c-text backdrop-blur-sm transition-colors"
                    title={title}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center h-[450px] md:h-[640px] gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#d97757] border-t-transparent" />
                <span className="text-xs c-text-3">
                  Loading graph data…
                </span>
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
                onNodeClick={(node: object) => {
                  const n = node as GraphNode;
                  setSelectedNode(n);
                  if (n.type === "Taxpayer" && n.gstin && !n.isCenter) {
                    loadHubNetwork(String(n.gstin));
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
                cooldownTicks={200}
                onEngineStop={handleEngineStop}
                d3AlphaDecay={0.015}
                d3VelocityDecay={hubMode ? 0.25 : 0.2}
                minZoom={0.1}
                maxZoom={12}
                enableNodeDrag={true}
                warmupTicks={0}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-[450px] md:h-[640px] gap-3">
                <Network className="w-10 h-10 c-text-3 opacity-30" />
                <p className="c-text-3 text-sm font-medium">
                  No graph data available
                </p>
                <p className="c-text-3 text-xs opacity-70">
                  Upload GST returns and run reconciliation first
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Node Detail Panel ── */}
        {selectedNode && viewMode === "graph" && (
          <div
            className="w-full lg:w-72 c-bg-card rounded-xl border c-border p-4 h-fit max-h-[600px] overflow-y-auto"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded"
                style={{
                  backgroundColor: `${NODE_COLORS[selectedNode.type] || "#6b6b6b"}15`,
                  color: NODE_COLORS[selectedNode.type] || "#6b6b6b",
                }}
              >
                {selectedNode.type}
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-md c-text-3 hover:c-text-2 hover:c-bg-dark transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {selectedNode.label && (
              <p className="text-sm font-medium c-text mb-3 break-all">
                {String(selectedNode.label)}
              </p>
            )}

            <div className="space-y-2">
              {Object.entries(selectedNode)
                .filter(
                  ([k]) =>
                    !HIDDEN_KEYS.has(k) && k !== "label" && k !== "type"
                )
                .map(([key, value]) => (
                  <div key={key} className="pb-2 border-b c-border last:border-0">
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

      {/* ── Circular Trades Panel ── */}
      {showCircular && (
        <div
          className="mt-6 c-bg-card rounded-xl border border-red-500/20 p-5"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
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
            <div className="space-y-2.5">
              {circularTrades.map((trade, i) => (
                <div
                  key={i}
                  className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {trade.cycle.map((gstin, j) => (
                      <span key={j} className="flex items-center gap-1">
                        <span className="text-xs text-red-300 font-mono bg-red-900/20 px-2 py-0.5 rounded">
                          {gstin.slice(0, 4)}…{gstin.slice(-4)}
                        </span>
                        {j < trade.cycle.length - 1 && (
                          <span className="c-text-3 text-xs">→</span>
                        )}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] c-text-3 mt-1.5">
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
