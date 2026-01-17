"use client";

import { max, scaleBand, scaleLinear } from "d3";

export type BarDatum = {
  label: string;
  value: number;
  title?: string;
};

type BarChartProps = {
  data: BarDatum[];
  height?: number;
  color?: string;
};

export default function BarChart({
  data,
  height = 220,
  color = "var(--accent)",
}: BarChartProps) {
  const width = 640;
  const padding = { top: 16, right: 16, bottom: 24, left: 16 };
  const maxValue = Math.max(1, max(data, (datum) => datum.value) ?? 1);

  const x = scaleBand()
    .domain(data.map((_, index) => index.toString()))
    .range([padding.left, width - padding.right])
    .padding(0.22);

  const y = scaleLinear()
    .domain([0, maxValue])
    .nice()
    .range([height - padding.bottom, padding.top]);

  const gridLines = y.ticks(3).map((tick) => ({
    y: y(tick),
    value: tick,
  }));

  return (
    <svg
      className="chart chart-bar"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Bar chart"
    >
      <g className="chart-grid">
        {gridLines.map((line) => (
          <line
            key={`grid-${line.value}`}
            x1={padding.left}
            x2={width - padding.right}
            y1={line.y}
            y2={line.y}
          />
        ))}
      </g>
      <g>
        {data.map((datum, index) => {
          const barHeight = Math.max(0, y(0) - y(datum.value));
          const barX = x(index.toString()) ?? padding.left;
          const barY = y(datum.value);

          return (
            <g key={`${datum.label}-${index}`}>
              <rect
                className="chart-bar-rect"
                x={barX}
                y={barY}
                width={x.bandwidth()}
                height={barHeight}
                fill={color}
                style={{ animationDelay: `${index * 0.05}s` }}
              />
              <title>{datum.title ?? datum.label}</title>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
