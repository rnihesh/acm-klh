"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import PageShell from "@/components/PageShell";
import { getGraphNodes, searchGraph, getCircularTrades, getTaxpayerNetwork } from "@/lib/api";
import {
  Search,
  AlertTriangle,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Network,
  Focus,
  GitBranch,
  Table2,
  Waypoints,
  ArrowUpDown,
  ArrowRight,
} from "lucide-react";
import SearchableDropdown, { DropdownOption } from "@/components/SearchableDropdown";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

interface GraphNode {
  id: string;
  label: string;
  type: string;
  isCenter?: boolean;
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
    new Set(["Taxpayer"])
  );
  const [hubMode, setHubMode] = useState(false);
  const [hubGstin, setHubGstin] = useState("");
  const [viewMode, setViewMode] = useState<"force" | "tree" | "table">("force");
  const [treeLayout, setTreeLayout] = useState<"radialout" | "td" | "lr">("radialout");
  const [treeRoot, setTreeRoot] = useState<string>("");
  const [tableSortKey, setTableSortKey] = useState<"from" | "to" | "volume" | "frequency">("volume");
  const [tableSortDir, setTableSortDir] = useState<"asc" | "desc">("desc");

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
          height: window.innerWidth < 768 ? 450 : 700,
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

  // Pre-position nodes in a spatial layout so they start spread out
  const prePositionNodes = (nodes: GraphNode[], fixTaxpayers = true) => {
    const taxpayers = nodes.filter((n) => n.type === "Taxpayer");
    const others = nodes.filter((n) => n.type !== "Taxpayer");
    const radius = Math.max(180, taxpayers.length * 10);

    // Place taxpayers in a circle (fixed positions for clean layout)
    taxpayers.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / taxpayers.length - Math.PI / 2;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      n.x = x;
      n.y = y;
      if (fixTaxpayers) {
        n.fx = x;
        n.fy = y;
      }
    });

    // Place other nodes near their connected taxpayer
    others.forEach((n, i) => {
      const r = radius * 0.5 * Math.sqrt(Math.random());
      const a = (2 * Math.PI * i) / others.length;
      n.x = r * Math.cos(a);
      n.y = r * Math.sin(a);
    });
  };

  const loadGraph = async () => {
    setLoading(true);
    try {
      const data = (await getGraphNodes(300)) as {
        nodes: GraphNode[];
        links: GraphLink[];
      };
      prePositionNodes(data.nodes);
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

  const loadHubNetwork = async (gstin: string) => {
    if (!gstin) return;
    setLoading(true);
    setHubGstin(gstin);
    setHubMode(true);
    // Show all node types in hub view
    setVisibleTypes(new Set(Object.keys(NODE_COLORS)));
    try {
      const data = (await getTaxpayerNetwork(gstin)) as {
        nodes: GraphNode[];
        links: GraphLink[];
      };

      // Position center node at origin, group others by type in concentric rings
      const center = data.nodes.find((n) => n.isCenter);
      const taxpayers = data.nodes.filter((n) => n.type === "Taxpayer" && !n.isCenter);
      const invoices = data.nodes.filter((n) => n.type === "Invoice");
      const returns = data.nodes.filter((n) => n.type === "GSTR1Return" || n.type === "GSTR2BReturn" || n.type === "GSTR3BReturn");

      if (center) {
        center.x = 0;
        center.y = 0;
        center.fx = 0;
        center.fy = 0;
      }

      // Ring 1: Taxpayer partners (closest)
      const r1 = Math.max(150, taxpayers.length * 15);
      taxpayers.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / taxpayers.length - Math.PI / 2;
        n.x = r1 * Math.cos(angle);
        n.y = r1 * Math.sin(angle);
        n.fx = n.x;
        n.fy = n.y;
      });

      // Ring 2: Invoices (middle)
      const r2 = r1 + 80;
      invoices.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / invoices.length + 0.1;
        n.x = r2 * Math.cos(angle);
        n.y = r2 * Math.sin(angle);
        n.fx = n.x;
        n.fy = n.y;
      });

      // Ring 3: Returns (outer)
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
      // pass
    }
    setLoading(false);
  };

  // Extract taxpayer options from the current graph data for hub selector
  const taxpayerOptions: DropdownOption[] = graphData.nodes
    .filter((n) => n.type === "Taxpayer")
    .map((n) => ({
      value: String(n.gstin || n.id),
      label: String(n.label || n.gstin || ""),
      sublabel: String(n.gstin || ""),
    }));

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

  // Configure d3 forces for better spatial layout
  useEffect(() => {
    if (!graphRef.current || graphData.nodes.length === 0) return;

    // Small delay to ensure ForceGraph2D has initialized its simulation
    const timer = setTimeout(() => {
      const fg = graphRef.current;
      if (!fg) return;

      const nodeCount = graphData.nodes.filter((n) => visibleTypes.has(n.type)).length;

      // Charge: very strong repulsion to spread nodes apart
      const chargeStrength = hubMode
        ? -600
        : nodeCount > 100
          ? -400
          : -800;
      try {
        const charge = fg.d3Force('charge');
        if (charge) {
          charge.strength(chargeStrength);
          charge.distanceMax(800);
        }
      } catch { /* ignore */ }

      // Link distance
      const baseLinkDist = hubMode ? 150 : nodeCount > 100 ? 120 : 200;
      try {
        const link = fg.d3Force('link');
        if (link) {
          link.distance(baseLinkDist);
          link.strength(0.3);
        }
      } catch { /* ignore */ }

      // Center force
      try {
        const center = fg.d3Force('center');
        if (center) center.strength(0.03);
      } catch { /* ignore */ }

      // Pin center node at origin in hub mode
      if (hubMode) {
        graphData.nodes.forEach((n) => {
          if (n.isCenter) {
            n.fx = 0;
            n.fy = 0;
          }
        });
      }

      // When more than just Taxpayers are visible, unfix taxpayer positions
      // so the force simulation can position all nodes together
      const typesShown = new Set(
        graphData.nodes.filter((n) => visibleTypes.has(n.type)).map((n) => n.type)
      );
      if (typesShown.size > 1 && !hubMode) {
        graphData.nodes.forEach((n) => {
          if (n.type === "Taxpayer" && !n.isCenter) {
            n.fx = undefined;
            n.fy = undefined;
          }
        });
      }

      // Reheat simulation with new forces
      fg.d3ReheatSimulation();
    }, 100);

    return () => clearTimeout(timer);
  }, [graphData, hubMode, visibleTypes]);

  // Auto-fit after engine stabilizes
  const handleEngineStop = useCallback(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      graphRef.current.zoomToFit(600, 50);
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

  // ---------- Spanning Tree computation (BFS) ----------
  const computeSpanningTree = useCallback(
    (rootId: string) => {
      const nodeMap = new Map(filteredData.nodes.map((n) => [n.id, n]));
      if (!nodeMap.has(rootId)) return { nodes: filteredData.nodes, links: [] as GraphLink[] };

      // Build adjacency list from filtered links
      const adj = new Map<string, { target: string; link: GraphLink }[]>();
      for (const l of filteredData.links) {
        const srcId = typeof l.source === "string" ? l.source : (l.source as GraphNode)?.id;
        const tgtId = typeof l.target === "string" ? l.target : (l.target as GraphNode)?.id;
        if (!srcId || !tgtId) continue;
        if (!adj.has(srcId)) adj.set(srcId, []);
        if (!adj.has(tgtId)) adj.set(tgtId, []);
        adj.get(srcId)!.push({ target: tgtId, link: l });
        adj.get(tgtId)!.push({ target: srcId, link: l });
      }

      // BFS
      const visited = new Set<string>();
      const treeLinks: GraphLink[] = [];
      const treeNodeIds = new Set<string>();
      const queue = [rootId];
      visited.add(rootId);
      treeNodeIds.add(rootId);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        const neighbors = adj.get(curr) || [];
        for (const { target, link } of neighbors) {
          if (!visited.has(target)) {
            visited.add(target);
            treeNodeIds.add(target);
            treeLinks.push(link);
            queue.push(target);
          }
        }
      }

      // Include disconnected nodes too (they'll float nearby)
      return {
        nodes: filteredData.nodes.filter((n) => treeNodeIds.has(n.id)),
        links: treeLinks,
      };
    },
    [filteredData]
  );

  // Effective tree root — first taxpayer or user-selected
  const effectiveTreeRoot = treeRoot || filteredData.nodes.find((n) => n.type === "Taxpayer")?.id || filteredData.nodes[0]?.id || "";

  // Tree data for the spanning tree view
  const treeData = viewMode === "tree" ? computeSpanningTree(effectiveTreeRoot) : { nodes: [], links: [] };

  // ---------- Table data: summarize TRADES_WITH relationships ----------
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
      const srcId = typeof l.source === "string" ? l.source : (l.source as GraphNode)?.id;
      const tgtId = typeof l.target === "string" ? l.target : (l.target as GraphNode)?.id;
      if (!srcId || !tgtId) continue;
      const key = `${srcId}-${tgtId}-${l.type}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const srcNode = nodeMap.get(srcId);
      const tgtNode = nodeMap.get(tgtId);
      if (!srcNode || !tgtNode) continue;

      // Only include links between Taxpayers (TRADES_WITH) or Invoice links
      if (srcNode.type === "Taxpayer" && tgtNode.type === "Taxpayer") {
        rows.push({
          from: srcId,
          fromLabel: String(srcNode.label || srcId),
          to: tgtId,
          toLabel: String(tgtNode.label || tgtId),
          volume: Number((l as unknown as Record<string, unknown>).totalVolume || (l as unknown as Record<string, unknown>).total_volume || 0),
          frequency: Number((l as unknown as Record<string, unknown>).transactionCount || (l as unknown as Record<string, unknown>).transaction_count || 0),
          relType: l.type,
        });
      }
    }

    // Sort
    rows.sort((a, b) => {
      const mul = tableSortDir === "asc" ? 1 : -1;
      if (tableSortKey === "from") return mul * a.fromLabel.localeCompare(b.fromLabel);
      if (tableSortKey === "to") return mul * a.toLabel.localeCompare(b.toLabel);
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

  // Custom node rendering
  const paintNode = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode;
      if (n.x == null || n.y == null) return;

      const baseSize = (n.isCenter ? 16 : NODE_SIZES[n.type]) || 5;
      const color = NODE_COLORS[n.type] || "#6b6b6b";
      const isHovered = hoveredNode?.id === n.id;
      const isSelected = selectedNode?.id === n.id;

      // Check if this node is connected to hovered/selected
      const isConnected =
        (hoveredNode || selectedNode) &&
        graphData.links.some((l) => {
          const srcId = typeof l.source === "string" ? l.source : (l.source as GraphNode)?.id;
          const tgtId = typeof l.target === "string" ? l.target : (l.target as GraphNode)?.id;
          const ref = hoveredNode || selectedNode;
          return (
            (srcId === ref?.id && tgtId === n.id) ||
            (tgtId === ref?.id && srcId === n.id)
          );
        });
      const dimmed = (hoveredNode || selectedNode) && !isHovered && !isSelected && !isConnected;
      const alpha = dimmed ? 0.15 : 1;

      ctx.globalAlpha = alpha;

      // Pulsing ring for center node in hub mode
      if (n.isCenter) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, baseSize + 8, 0, 2 * Math.PI);
        ctx.fillStyle = `${color}10`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x, n.y, baseSize + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = `${color}50`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Glow for hovered/selected
      if (isHovered || isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, baseSize + 5, 0, 2 * Math.PI);
        ctx.fillStyle = `${color}25`;
        ctx.fill();
      }

      // Outer ring for selected
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, baseSize + 2.5, 0, 2 * Math.PI);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Main circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, baseSize, 0, 2 * Math.PI);
      ctx.fillStyle = isHovered ? `${color}ee` : color;
      ctx.fill();

      // Inner highlight for depth
      if (baseSize >= 6) {
        ctx.beginPath();
        ctx.arc(n.x - baseSize * 0.2, n.y - baseSize * 0.2, baseSize * 0.35, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fill();
      }

      // Label (show when zoomed in enough or for Taxpayer nodes)
      const showLabel =
        globalScale > 1.2 || n.type === "Taxpayer" || isHovered || isSelected || n.isCenter || isConnected;
      if (showLabel && n.label) {
        const label =
          n.label.length > 20 ? n.label.slice(0, 18) + "…" : n.label;
        const fontSize = n.isCenter
          ? Math.max(13 / globalScale, 3.5)
          : n.type === "Taxpayer"
            ? Math.max(11 / globalScale, 2.8)
            : Math.max(9 / globalScale, 2.2);
        ctx.font = `${isHovered || isSelected || n.isCenter ? "600 " : ""}${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        // Text shadow for readability
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillText(label, n.x + 0.5, n.y + baseSize + 2.5);
        ctx.fillStyle =
          isHovered || isSelected || n.isCenter ? "#ffffff" : "rgba(210,210,210,0.85)";
        ctx.fillText(label, n.x, n.y + baseSize + 2);
      }

      ctx.globalAlpha = 1;
    },
    [hoveredNode, selectedNode, graphData.links]
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

  // Custom link rendering with curvature
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
      if (!l.source?.x || !l.target?.x || l.source.y == null || l.target.y == null) return;

      const isRelatedToHovered =
        hoveredNode &&
        (l.source.id === hoveredNode.id || l.target.id === hoveredNode.id);
      const isRelatedToSelected =
        selectedNode &&
        (l.source.id === selectedNode.id || l.target.id === selectedNode.id);
      const isHighlighted = isRelatedToHovered || isRelatedToSelected;

      // Dim non-highlighted links when something is hovered
      const dimmed = (hoveredNode || selectedNode) && !isHighlighted;

      const dx = l.target.x! - l.source.x!;
      const dy = l.target.y! - l.source.y!;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return;

      // Straight lines for cleaner look (slight curvature only when highlighted)
      const useCurve = isHighlighted;
      const mx = (l.source.x! + l.target.x!) / 2;
      const my = (l.source.y! + l.target.y!) / 2;
      let cx = mx;
      let cy = my;
      
      if (useCurve) {
        const curvature = 0.12;
        const nx = -dy / len * curvature * len * 0.15;
        const ny = dx / len * curvature * len * 0.15;
        cx = mx + nx;
        cy = my + ny;
      }

      ctx.beginPath();
      ctx.moveTo(l.source.x!, l.source.y!);
      if (useCurve) {
        ctx.quadraticCurveTo(cx, cy, l.target.x!, l.target.y!);
      } else {
        ctx.lineTo(l.target.x!, l.target.y!);
      }
      ctx.strokeStyle = isHighlighted
        ? "rgba(217, 119, 87, 0.7)"
        : dimmed
          ? "rgba(100, 100, 100, 0.02)"
          : "rgba(100, 100, 100, 0.07)";
      ctx.lineWidth = isHighlighted ? 2 : 0.3;
      ctx.stroke();

      // Arrow
      const targetSize = NODE_SIZES[(l.target as GraphNode).type] || 5;
      const arrowPos = 1 - (targetSize + 2) / len;
      const ax = l.source.x! + dx * arrowPos;
      const ay = l.source.y! + dy * arrowPos;
      const angle = Math.atan2(dy, dx);
      const arrowLen = isHighlighted ? 5 : 2.5;

      if (!dimmed && (isHighlighted || globalScale > 1.5)) {
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
          ? "rgba(217, 119, 87, 0.7)"
          : "rgba(100, 100, 100, 0.2)";
        ctx.fill();
      }

      // Link label when zoomed in
      if (globalScale > 2.2 && isHighlighted && LINK_LABELS[l.type]) {
        const fontSize = Math.max(8 / globalScale, 2);
        ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(217, 119, 87, 0.9)";
        ctx.fillText(LINK_LABELS[l.type], cx, cy - 3 / globalScale);
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

      {/* Hub View Controls */}
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
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all border ${
            hubMode
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
            Showing network around {hubGstin.slice(0, 6)}...{hubGstin.slice(-4)}
          </span>
        )}
      </div>

      {/* View Mode Tabs */}
      <div className="flex items-center gap-1 mb-4 p-1 c-bg-dark rounded-lg w-fit">
        {([
          { key: "force" as const, label: "Force Graph", icon: Waypoints },
          { key: "tree" as const, label: "Spanning Tree", icon: GitBranch },
          { key: "table" as const, label: "Relationships", icon: Table2 },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setViewMode(key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${
              viewMode === key
                ? "c-bg-card c-text font-medium shadow-sm"
                : "c-text-3 hover:c-text-2"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
        {viewMode === "tree" && (
          <div className="flex items-center gap-1 ml-2 pl-2 border-l c-border">
            {([
              { key: "radialout" as const, label: "Radial" },
              { key: "td" as const, label: "Top-Down" },
              { key: "lr" as const, label: "Left-Right" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTreeLayout(key)}
                className={`px-2 py-1 rounded text-xs transition-all ${
                  treeLayout === key
                    ? "text-white"
                    : "c-text-3 hover:c-text-2"
                }`}
                style={treeLayout === key ? { backgroundColor: "var(--accent)" } : undefined}
              >
                {label}
              </button>
            ))}
            <div className="ml-1">
              <SearchableDropdown
                options={taxpayerOptions}
                value={treeRoot}
                onChange={(v) => setTreeRoot(v)}
                placeholder="Root node..."
                className="w-48"
              />
            </div>
          </div>
        )}
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
        {viewMode === "table" ? (
          /* ============================== TABLE VIEW ============================== */
          <div className="flex-1 c-bg-card rounded-xl border c-border overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 c-bg-dark border-b c-border z-10">
                  <tr>
                    {([
                      { key: "from" as const, label: "Supplier" },
                      { key: "to" as const, label: "Buyer" },
                      { key: "volume" as const, label: "Trade Volume (₹)" },
                      { key: "frequency" as const, label: "Transactions" },
                    ]).map(({ key, label }) => (
                      <th
                        key={key}
                        className="px-4 py-3 text-left c-text-2 font-medium cursor-pointer hover:c-text select-none"
                        onClick={() => toggleTableSort(key)}
                      >
                        <div className="flex items-center gap-1.5">
                          {label}
                          <ArrowUpDown className={`w-3 h-3 ${tableSortKey === key ? "c-text" : "c-text-3 opacity-40"}`} />
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left c-text-2 font-medium">Type</th>
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
                          <div>
                            <span className="c-text font-medium text-sm">{row.fromLabel}</span>
                            <span className="block text-[10px] c-text-3 font-mono">{row.from.slice(0, 8)}...{row.from.slice(-4)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ArrowRight className="w-3 h-3 c-text-3 flex-shrink-0" />
                            <div>
                              <span className="c-text font-medium text-sm">{row.toLabel}</span>
                              <span className="block text-[10px] c-text-3 font-mono">{row.to.slice(0, 8)}...{row.to.slice(-4)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono c-text">
                          {row.volume > 0 ? `₹${row.volume.toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono c-text-2">
                          {row.frequency > 0 ? row.frequency : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#d9775720", color: "#d97757" }}>
                            {row.relType.replace(/_/g, " ").toLowerCase()}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-16 text-center c-text-3">
                        <Table2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No trade relationships found</p>
                        <p className="text-xs mt-1">Upload data and run reconciliation to see relationships</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {tableRows.length > 0 && (
              <div className="px-4 py-2 border-t c-border text-xs c-text-3">
                {tableRows.length} trade relationships &middot; Total volume: ₹{tableRows.reduce((s, r) => s + r.volume, 0).toLocaleString("en-IN")}
              </div>
            )}
          </div>
        ) : (
          /* ============================== FORCE / TREE VIEW ============================== */
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

            {/* Tree view info badge */}
            {viewMode === "tree" && treeData.nodes.length > 0 && (
              <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 c-bg-dark/80 backdrop-blur-sm rounded-lg text-xs c-text-2">
                <GitBranch className="w-3.5 h-3.5" />
                BFS Spanning Tree &middot; {treeData.nodes.length} nodes &middot; {treeData.links.length} edges
                {effectiveTreeRoot && (
                  <span className="c-text-3">
                    &middot; Root: {graphData.nodes.find((n) => n.id === effectiveTreeRoot)?.label || effectiveTreeRoot.slice(0, 8) + "..."}
                  </span>
                )}
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center h-[450px] md:h-[700px] gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#d97757] border-t-transparent" />
                <span className="text-xs c-text-3">Loading graph data...</span>
              </div>
            ) : (viewMode === "tree" ? treeData.nodes.length : filteredData.nodes.length) > 0 ? (
              <ForceGraph2D
                ref={graphRef}
                graphData={viewMode === "tree" ? treeData : filteredData}
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
                  if (hubMode && n.type === "Taxpayer" && n.gstin && !n.isCenter) {
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
                dagMode={viewMode === "tree" ? treeLayout : undefined}
                dagLevelDistance={viewMode === "tree" ? 60 : undefined}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-[450px] md:h-[700px] gap-3">
                <Network className="w-10 h-10 c-text-3 opacity-40" />
                <p className="c-text-3 text-sm">No graph data available</p>
                <p className="c-text-3 text-xs">
                  Upload GST returns and run reconciliation first
                </p>
              </div>
            )}
          </div>
        )}

        {/* Node detail panel */}
        {selectedNode && viewMode !== "table" && (
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
