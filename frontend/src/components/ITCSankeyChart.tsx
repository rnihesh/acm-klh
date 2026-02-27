"use client";

import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";

const ResponsiveSankey = dynamic(
  () => import("@nivo/sankey").then((m) => m.ResponsiveSankey),
  { ssr: false }
);

interface SankeyNode {
  id: string;
  label: string;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

interface ITCSankeyChartProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

class SankeyErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <p className="c-text-3 text-sm py-8 text-center">
          Unable to render Sankey chart.
        </p>
      );
    }
    return this.props.children;
  }
}

export default function ITCSankeyChart({ nodes, links }: ITCSankeyChartProps) {
  if (!nodes.length || !links.length) {
    return (
      <p className="c-text-3 text-sm py-8 text-center">
        No ITC flow data available. Run reconciliation first.
      </p>
    );
  }

  const validLinks = links.filter((l) => l.value > 0);
  if (!validLinks.length) {
    return (
      <p className="c-text-3 text-sm py-8 text-center">
        No ITC flow data to visualize.
      </p>
    );
  }

  return (
    <SankeyErrorBoundary>
      <div style={{ height: 300 }}>
        <ResponsiveSankey
          data={{ nodes, links: validLinks }}
          margin={{ top: 20, right: 160, bottom: 20, left: 20 }}
          align="justify"
          colors={["#e5e5e5", "#a3a3a3", "#737373", "#525252"]}
          nodeOpacity={1}
          nodeHoverOthersOpacity={0.35}
          nodeThickness={18}
          nodeSpacing={24}
          nodeBorderWidth={0}
          nodeBorderRadius={3}
          linkOpacity={0.3}
          linkHoverOthersOpacity={0.1}
          linkContract={3}
          enableLinkGradient={true}
          labelPosition="outside"
          labelOrientation="horizontal"
          labelPadding={16}
          labelTextColor="var(--text-secondary)"
          theme={{
            text: { fill: "var(--text-secondary)", fontSize: 11 },
            tooltip: {
              container: {
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                border: "1px solid var(--bg-border)",
                borderRadius: "8px",
                fontSize: "12px",
                boxShadow: "var(--shadow-md)",
              },
            },
          }}
        />
      </div>
    </SankeyErrorBoundary>
  );
}
