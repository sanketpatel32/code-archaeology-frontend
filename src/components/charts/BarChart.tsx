"use client";

import { max, scaleBand, scaleLinear } from "d3";
import { useRef, useState } from "react";

export type BarDatum = {
  label: string;
  value: number;
  title?: string;
};

type BarChartProps = {
  data: BarDatum[];
  height?: number;
  color?: string;
  formatValue?: (value: number) => string;
};

export default function BarChart({
  data,
  height = 220,
  color = "var(--accent)",
  formatValue,
}: BarChartProps) {
  const width = 640;
  const padding = { top: 16, right: 16, bottom: 24, left: 16 };
  const maxValue = Math.max(1, max(data, (datum: BarDatum) => datum.value) ?? 1);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const shellRef = useRef<HTMLDivElement | null>(null);

  const formatDisplay =
    formatValue ?? ((value: number) => value.toLocaleString("en-US"));
  const activeDatum = activeIndex !== null ? data[activeIndex] : null;

  const x = scaleBand()
    .domain(data.map((_, index) => index.toString()))
    .range([padding.left, width - padding.right])
    .padding(0.22);

  const y = scaleLinear()
    .domain([0, maxValue])
    .nice()
    .range([height - padding.bottom, padding.top]);

  const gridLines = y.ticks(3).map((tick: number) => ({
    y: y(tick),
    value: tick,
  }));

  return (
    <div className="chart-shell" ref={shellRef}>
      <svg
        className="chart chart-bar"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Bar chart"
      >
        <g className="chart-grid">
          {gridLines.map((line: { y: number; value: number }) => (
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
            const isActive = activeIndex === index;
            const isDimmed = activeIndex !== null && !isActive;

            return (
              <g key={`${datum.label}-${index}`}>
                <rect
                  className={`chart-bar-rect ${isActive ? "chart-bar-rect-active" : ""
                    } ${isDimmed ? "chart-bar-rect-dim" : ""}`}
                  x={barX}
                  y={barY}
                  width={x.bandwidth()}
                  height={barHeight}
                  fill={color}
                  style={{ animationDelay: `${index * 0.05}s` }}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseMove={(event) => {
                    const bounds = shellRef.current?.getBoundingClientRect();
                    if (!bounds) {
                      return;
                    }
                    setPointer({
                      x: event.clientX - bounds.left,
                      y: event.clientY - bounds.top,
                    });
                  }}
                  onMouseLeave={() => setActiveIndex(null)}
                />
                <title>{datum.title ?? datum.label}</title>
              </g>
            );
          })}
        </g>
      </svg>
      <div
        className={`chart-tooltip ${activeDatum ? "is-visible" : ""}`}
        style={{
          transform: `translate(${pointer.x + 12}px, ${pointer.y + 12}px)`,
        }}
      >
        <div className="chart-tooltip-title">
          {activeDatum ? activeDatum.title ?? activeDatum.label : "Hover a bar"}
        </div>
        <div className="chart-tooltip-value">
          {activeDatum ? formatDisplay(activeDatum.value) : "--"}
        </div>
      </div>
    </div>
  );
}
