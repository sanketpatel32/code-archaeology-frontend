"use client";

import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from "d3";
import { useMemo, useRef, useState } from "react";

export type TreemapNode = {
  name: string;
  value?: number;
  path?: string;
  children?: TreemapNode[];
};

type TreemapChartProps = {
  data: TreemapNode;
  height?: number;
  selectedPath?: string | null;
  onSelect?: (path: string) => void;
};

const TREEMAP_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#8b5cf6",
  "#64748b",
];

const formatValue = (value: number) => value.toLocaleString("en-US");

export default function TreemapChart({
  data,
  height = 320,
  selectedPath = null,
  onSelect,
}: TreemapChartProps) {
  const width = 640;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const leaves = useMemo(() => {
    const root = hierarchy(data)
      .sum((node) => node.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const layout = treemap<TreemapNode>()
      .size([width, height])
      .paddingInner(6)
      .paddingOuter(2)
      .tile(treemapSquarify)(root);

    return (layout.leaves() as HierarchyRectangularNode<TreemapNode>[]).map((leaf, index) => {
      const path =
        leaf.data.path ??
        leaf
          .ancestors()
          .slice(0, -1)
          .reverse()
          .map((node) => node.data.name)
          .join("/");
      const paletteIndex = (leaf.depth + index) % TREEMAP_COLORS.length;
      return {
        name: leaf.data.name,
        path,
        value: leaf.value ?? 0,
        depth: leaf.depth,
        x0: leaf.x0 ?? 0,
        y0: leaf.y0 ?? 0,
        x1: leaf.x1 ?? 0,
        y1: leaf.y1 ?? 0,
        color: TREEMAP_COLORS[paletteIndex],
      };
    });
  }, [data, height]);

  const activeLeaf = activeIndex !== null ? leaves[activeIndex] : null;
  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    const bounds = svg.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * width;
    const y = ((event.clientY - bounds.top) / bounds.height) * height;
    const nextIndex = leaves.findIndex(
      (leaf) => x >= leaf.x0 && x <= leaf.x1 && y >= leaf.y0 && y <= leaf.y1,
    );
    setActiveIndex(nextIndex >= 0 ? nextIndex : null);
  };

  return (
    <div className="treemap-shell">
      <svg
        className="chart chart-treemap"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Repository treemap"
        ref={svgRef}
        onMouseMove={handleMove}
        onMouseLeave={() => setActiveIndex(null)}
      >
        {leaves.map((leaf, index) => {
          const tileWidth = leaf.x1 - leaf.x0;
          const tileHeight = leaf.y1 - leaf.y0;
          const showLabel = tileWidth > 110 && tileHeight > 44;
          const isActive = activeIndex === index;
          const isSelected = selectedPath === leaf.path;
          const maxChars = Math.max(6, Math.floor(tileWidth / 9));
          const safeChars = Math.max(4, maxChars);
          const displayLabel =
            leaf.name.length > safeChars
              ? `${leaf.name.slice(0, safeChars - 3)}...`
              : leaf.name;
          const isDimmed = activeLeaf
            ? !isActive && !isSelected
            : false;

          return (
            <g
              key={`${leaf.path}-${index}`}
              transform={`translate(${leaf.x0} ${leaf.y0})`}
            >
              <rect
                className={`treemap-rect ${isDimmed ? "treemap-rect-dim" : ""
                  } ${isActive || isSelected ? "treemap-rect-active" : ""}`}
                width={tileWidth}
                height={tileHeight}
                rx={10}
                fill={leaf.color}
                onClick={() => {
                  if (onSelect && leaf.path) {
                    onSelect(leaf.path);
                  }
                }}
              />
              {showLabel ? (
                <text className="treemap-label" x={10} y={20}>
                  {displayLabel}
                </text>
              ) : null}
              <title>{leaf.path}</title>
            </g>
          );
        })}
      </svg>
      <div className={`treemap-tooltip ${activeLeaf ? "is-visible" : ""}`}>
        <div className="treemap-tooltip-title">
          {activeLeaf ? activeLeaf.path : "Hover a block"}
        </div>
        <div className="treemap-tooltip-value">
          {activeLeaf ? formatValue(activeLeaf.value) : "--"}
        </div>
        <div className="treemap-tooltip-meta">
          {activeLeaf ? `Depth ${activeLeaf.depth}` : ""}
        </div>
      </div>
    </div>
  );
}
