"use client";

import { area, curveMonotoneX, line, max, scaleLinear } from "d3";

export type TimelineDatum = {
  bucket: string;
  commit_count: number;
  additions: number;
  deletions: number;
};

type ChartPoint = {
  index: number;
  value: number;
};

type TimelineChartProps = {
  data: TimelineDatum[];
  height?: number;
};

export default function TimelineChart({
  data,
  height = 240,
}: TimelineChartProps) {
  const width = 640;
  const padding = { top: 16, right: 24, bottom: 28, left: 24 };

  const points = data.map((row, index) => ({
    index,
    commits: row.commit_count,
    churn: (row.additions || 0) + (row.deletions || 0),
  }));

  if (points.length < 2) {
    return (
      <div className="chart-empty text-sm text-[color:var(--muted)]">
        Not enough activity data to render the trend line.
      </div>
    );
  }

  const maxValue = Math.max(
    1,
    max(points, (point) => Math.max(point.commits, point.churn)) ?? 1,
  );

  const x = scaleLinear()
    .domain([0, Math.max(1, points.length - 1)])
    .range([padding.left, width - padding.right]);

  const y = scaleLinear()
    .domain([0, maxValue])
    .nice()
    .range([height - padding.bottom, padding.top]);

  const gridLines = y.ticks(3).map((tick) => ({
    y: y(tick),
    value: tick,
  }));

  const commitSeries: ChartPoint[] = points.map((point) => ({
    index: point.index,
    value: point.commits,
  }));
  const churnSeries: ChartPoint[] = points.map((point) => ({
    index: point.index,
    value: point.churn,
  }));

  const lineGenerator = line<ChartPoint>()
    .x((point) => x(point.index))
    .y((point) => y(point.value))
    .curve(curveMonotoneX);

  const areaGenerator = area<ChartPoint>()
    .x((point) => x(point.index))
    .y0(y(0))
    .y1((point) => y(point.value))
    .curve(curveMonotoneX);

  const commitPath = lineGenerator(commitSeries) ?? "";
  const churnPath = lineGenerator(churnSeries) ?? "";
  const churnArea = areaGenerator(churnSeries) ?? "";

  const lastPoint = commitSeries[commitSeries.length - 1];

  return (
    <svg
      className="chart chart-timeline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Commit and churn trend chart"
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
      <path className="chart-area" d={churnArea} />
      <path className="chart-line chart-line-churn" d={churnPath} />
      <path className="chart-line chart-line-commits" d={commitPath} />
      <circle
        cx={x(lastPoint.index)}
        cy={y(lastPoint.value)}
        r={4}
        className="chart-dot"
      />
    </svg>
  );
}
