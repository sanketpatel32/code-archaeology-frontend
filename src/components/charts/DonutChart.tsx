"use client";

import { arc, pie } from "d3";
import { useMemo, useState } from "react";

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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeSegment = activeIndex !== null ? segments[activeIndex] : null;
  const centerLabel = activeSegment ? activeSegment.label : "signals";
  const centerValue = activeSegment ? activeSegment.value : total;
  const centerPercent = useMemo(() => {
    if (!activeSegment || total === 0) {
      return null;
    }
    return Math.round((activeSegment.value / total) * 100);
  }, [activeSegment, total]);

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
            className={`chart-arc ${
              activeIndex !== null && activeIndex !== arcData.index
                ? "chart-arc-dim"
                : ""
            } ${activeIndex === arcData.index ? "chart-arc-active" : ""}`}
            onMouseEnter={() => setActiveIndex(arcData.index)}
            onMouseLeave={() => setActiveIndex(null)}
          />
        ))}
        <circle className="chart-donut-core" r={innerRadius - 8} />
        <text className="chart-donut-value" textAnchor="middle" dy="-0.1em">
          {centerValue}
        </text>
        <text className="chart-donut-label" textAnchor="middle" dy="1.3em">
          {centerLabel}
        </text>
        {centerPercent !== null ? (
          <text className="chart-donut-label" textAnchor="middle" dy="2.7em">
            {centerPercent}% share
          </text>
        ) : null}
      </g>
    </svg>
  );
}
