"use client";

import { hierarchy, treemap, treemapSquarify } from "d3";

export type TreemapNode = {
  name: string;
  value?: number;
  children?: TreemapNode[];
};

type TreemapChartProps = {
  data: TreemapNode;
  height?: number;
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

export default function TreemapChart({
  data,
  height = 320,
}: TreemapChartProps) {
  const width = 640;
  const root = hierarchy(data)
    .sum((node) => node.value ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  treemap<TreemapNode>()
    .size([width, height])
    .paddingInner(6)
    .paddingOuter(2)
    .tile(treemapSquarify)(root);

  const leaves = root.leaves();

  return (
    <svg
      className="chart chart-treemap"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Repository treemap"
    >
      {leaves.map((leaf, index) => {
        const tileWidth = leaf.x1 - leaf.x0;
        const tileHeight = leaf.y1 - leaf.y0;
        const showLabel = tileWidth > 90 && tileHeight > 36;
        const fill = TREEMAP_COLORS[index % TREEMAP_COLORS.length];

        return (
          <g
            key={`${leaf.data.name}-${index}`}
            transform={`translate(${leaf.x0} ${leaf.y0})`}
          >
            <rect
              className="treemap-rect"
              width={tileWidth}
              height={tileHeight}
              rx={10}
              fill={fill}
            />
            {showLabel ? (
              <text className="treemap-label" x={10} y={20}>
                {leaf.data.name}
              </text>
            ) : null}
            <title>{leaf.data.name}</title>
          </g>
        );
      })}
    </svg>
  );
}
