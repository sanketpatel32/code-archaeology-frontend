"use client";

import { arc, pie } from "d3";

export type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

type DonutChartProps = {
  segments: DonutSegment[];
  size?: number;
  innerRadius?: number;
};

export default function DonutChart({
  segments,
  size = 220,
  innerRadius = 70,
}: DonutChartProps) {
  const radius = size / 2;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  const pieGenerator = pie<DonutSegment>()
    .value((segment) => segment.value)
    .sort(null);

  const arcGenerator = arc<ReturnType<typeof pieGenerator>[number]>()
    .innerRadius(innerRadius)
    .outerRadius(radius - 8)
    .cornerRadius(6);

  const arcs = pieGenerator(segments);

  return (
    <svg
      className="chart chart-donut"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Insight severity breakdown"
    >
      <g transform={`translate(${radius} ${radius})`}>
        {arcs.map((arcData) => (
          <path
            key={arcData.data.label}
            d={arcGenerator(arcData) ?? ""}
            fill={arcData.data.color}
            className="chart-arc"
          />
        ))}
        <circle className="chart-donut-core" r={innerRadius - 8} />
        <text className="chart-donut-value" textAnchor="middle" dy="-0.1em">
          {total}
        </text>
        <text className="chart-donut-label" textAnchor="middle" dy="1.3em">
          signals
        </text>
      </g>
    </svg>
  );
}
