"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BarChart from "@/components/charts/BarChart";
import { apiGet } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatNumber, formatScore } from "@/lib/format";
import { useAnalysisState } from "@/lib/useAnalysisState";

type Hotspot = {
  file_path: string;
  touches: number;
  churn: number;
  hotspot_score: number | string;
};

type IntensityMetric = "score" | "touches" | "churn";

const toNumber = (value: number | string) => {
  const numeric = Number.parseFloat(String(value));
  return Number.isFinite(numeric) ? numeric : 0;
};

const TILE_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#64748b",
];

export default function HotspotsPage() {
  const { state } = useAnalysisState();
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("score");
  const [intensityMetric, setIntensityMetric] =
    useState<IntensityMetric>("score");
  const [limit, setLimit] = useState(25);

  useEffect(() => {
    if (!state.repoId) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGet<Hotspot[]>(
          `/api/repositories/${state.repoId}/hotspots?limit=50`,
        );
        setHotspots(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load hotspots.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [state.repoId]);

  const scoreSorted = useMemo(
    () =>
      [...hotspots].sort(
        (a, b) => toNumber(b.hotspot_score) - toNumber(a.hotspot_score),
      ),
    [hotspots],
  );
  const metricValue = (row: Hotspot) => {
    if (intensityMetric === "touches") {
      return row.touches;
    }
    if (intensityMetric === "churn") {
      return row.churn;
    }
    return toNumber(row.hotspot_score);
  };
  const intensitySorted = useMemo(
    () =>
      [...hotspots].sort((a, b) => metricValue(b) - metricValue(a)),
    [hotspots, intensityMetric],
  );
  const intensityTop = useMemo(
    () => intensitySorted.slice(0, 12),
    [intensitySorted],
  );
  const intensityRanked = useMemo(
    () => intensitySorted.slice(0, 6),
    [intensitySorted],
  );
  const maxMetricValue = useMemo(
    () =>
      intensityRanked.reduce(
        (max, row) => Math.max(max, metricValue(row)),
        0,
      ),
    [intensityRanked, intensityMetric],
  );
  const intensityLabel =
    intensityMetric === "touches"
      ? "Touches"
      : intensityMetric === "churn"
        ? "Churn"
        : "Score";
  const topHotspot = scoreSorted[0];
  const tiles = useMemo(() => scoreSorted.slice(0, 12), [scoreSorted]);
  const barData = useMemo(
    () =>
      intensityTop.map((row) => ({
        label: row.file_path.split("/").slice(-1)[0] ?? row.file_path,
        value: metricValue(row),
        title: row.file_path,
      })),
    [intensityTop, intensityMetric],
  );

  const filteredHotspots = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const base = normalized
      ? scoreSorted.filter((row) =>
          row.file_path.toLowerCase().includes(normalized),
        )
      : scoreSorted;

    const sorted = [...base].sort((a, b) => {
      if (sortBy === "touches") {
        return b.touches - a.touches;
      }
      if (sortBy === "churn") {
        return b.churn - a.churn;
      }
      if (sortBy === "file") {
        return a.file_path.localeCompare(b.file_path);
      }
      return toNumber(b.hotspot_score) - toNumber(a.hotspot_score);
    });

    return sorted;
  }, [query, scoreSorted, sortBy]);

  const displayedHotspots = useMemo(
    () => filteredHotspots.slice(0, limit),
    [filteredHotspots, limit],
  );

  if (!state.repoId) {
    return (
      <section className="soft-panel rounded-3xl p-8">
        <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">
          Hotspots and churn analysis
        </h2>
        <p className="mt-3 text-sm text-[color:var(--muted)]">
          Run an analysis to see the files with the highest churn and touch
          frequency.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex w-fit rounded-full border border-[color:var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--foreground)]"
        >
          Start analysis
        </Link>
      </section>
    );
  }

  return (
    <>
      <header className="reveal flex flex-col gap-4">
        <h1 className="text-3xl font-semibold text-[color:var(--foreground)]">
          Hotspots and churn analysis
        </h1>
        <p className="max-w-2xl text-sm text-[color:var(--muted)]">
          Identify files that accumulate the most change pressure. Combine touch
          frequency and churn to see the parts of the codebase that will need
          the most attention.
        </p>
      </header>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Hotspot intensity
            </h2>
            <p className="text-xs text-[color:var(--muted)]">
              Top 12 ranked by {intensityLabel.toLowerCase()}.
            </p>
          </div>
          <div className="toggle-group">
            <button
              className={`toggle-button ${
                intensityMetric === "score" ? "toggle-active" : ""
              }`}
              type="button"
              onClick={() => setIntensityMetric("score")}
            >
              Score
            </button>
            <button
              className={`toggle-button ${
                intensityMetric === "touches" ? "toggle-active" : ""
              }`}
              type="button"
              onClick={() => setIntensityMetric("touches")}
            >
              Touches
            </button>
            <button
              className={`toggle-button ${
                intensityMetric === "churn" ? "toggle-active" : ""
              }`}
              type="button"
              onClick={() => setIntensityMetric("churn")}
            >
              Churn
            </button>
          </div>
        </div>
        {barData.length ? (
          <div className="mt-5 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="h-56">
              <BarChart data={barData} color="var(--accent)" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Intensity ladder
                </span>
                <span className="text-xs text-[color:var(--muted)]">
                  Top 6
                </span>
              </div>
              <div className="mt-4 metric-list">
                {intensityRanked.map((row, index) => {
                  const value = metricValue(row);
                  const width = maxMetricValue
                    ? Math.min((value / maxMetricValue) * 100, 100)
                    : 0;
                  const formatted =
                    intensityMetric === "score"
                      ? formatScore(value)
                      : formatNumber(value);
                  return (
                    <div className="metric-row" key={row.file_path}>
                      <div className="metric-label">
                        {index + 1}.{" "}
                        {row.file_path.split("/").slice(-1)[0] ?? row.file_path}
                      </div>
                      <div className="metric-bar">
                        <span
                          className="metric-bar-fill"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <div className="metric-value">{formatted}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[color:var(--muted)]">
            {loading ? "Loading hotspots..." : "No hotspots available yet."}
          </p>
        )}
      </section>

      <section
        className="reveal grid gap-6 lg:grid-cols-[1.2fr_1fr]"
        style={{ animationDelay: "0.2s" }}
      >
        <div className="soft-panel rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Hotspot field
            </h2>
            <span className="text-xs text-[color:var(--muted)]">
              {hotspots.length} files
            </span>
          </div>
          {tiles.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {tiles.map((tile, index) => (
                <div
                  key={tile.file_path}
                  className="rounded-2xl px-4 py-5 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-md"
                  style={{
                    background: TILE_COLORS[index % TILE_COLORS.length],
                    opacity: 0.9,
                  }}
                >
                  {tile.file_path.split("/").slice(-1)[0]}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[color:var(--muted)]">
              {loading ? "Loading hotspots..." : "No hotspots available yet."}
            </p>
          )}
        </div>

        <div className="soft-panel rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
            Hotspot focus
          </h2>
          {topHotspot ? (
            <div className="mt-4 grid gap-4 text-sm text-[color:var(--muted)]">
              <div className="panel-muted rounded-2xl px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  File
                </div>
                <div className="mt-2 font-mono text-xs text-[color:var(--foreground)]">
                  {topHotspot.file_path}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="panel-muted rounded-2xl px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Score
                  </div>
                  <div className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
                    {formatScore(topHotspot.hotspot_score)}
                  </div>
                </div>
                <div className="panel-muted rounded-2xl px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Touches
                  </div>
                  <div className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
                    {formatNumber(topHotspot.touches)}
                  </div>
                </div>
                <div className="panel-muted rounded-2xl px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Churn
                  </div>
                  <div className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
                    {formatNumber(topHotspot.churn)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[color:var(--muted)]">
              {loading ? "Loading focus file..." : "No hotspot data yet."}
            </p>
          )}
        </div>
      </section>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.3s" }}
      >
        <div className="toolbar">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Hotspot list
            </h2>
            <span className="toolbar-meta">
              {formatNumber(filteredHotspots.length)} files
            </span>
          </div>
          <div className="toolbar-group">
            <input
              className="input-field rounded-full px-3 py-2 text-xs"
              placeholder="Search file path"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="input-field rounded-full px-3 py-2 text-xs"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="score">Sort: Score</option>
              <option value="touches">Sort: Touches</option>
              <option value="churn">Sort: Churn</option>
              <option value="file">Sort: File</option>
            </select>
            <select
              className="input-field rounded-full px-3 py-2 text-xs"
              value={limit}
              onChange={(event) =>
                setLimit(Number.parseInt(event.target.value, 10))
              }
            >
              <option value={10}>Show 10</option>
              <option value={25}>Show 25</option>
              <option value={50}>Show 50</option>
            </select>
            <button
              className="toolbar-button"
              type="button"
              onClick={() =>
                downloadCsv(
                  "hotspots.csv",
                  filteredHotspots.map((row) => ({
                    file_path: row.file_path,
                    hotspot_score: toNumber(row.hotspot_score),
                    touches: row.touches,
                    churn: row.churn,
                  })),
                )
              }
            >
              Export CSV
            </button>
            {error ? (
              <span className="text-xs text-[color:var(--risk)]">{error}</span>
            ) : null}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-[color:var(--muted)]">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-[0.2em]">
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Touches</th>
                <th className="px-3 py-2">Churn</th>
              </tr>
            </thead>
            <tbody>
              {displayedHotspots.length ? (
                displayedHotspots.map((row) => (
                  <tr
                    key={row.file_path}
                    className="border-b border-[color:var(--border)]/60"
                  >
                    <td className="px-3 py-3 font-mono text-xs text-[color:var(--foreground)]">
                      {row.file_path}
                    </td>
                    <td className="px-3 py-3">
                      {formatScore(row.hotspot_score)}
                    </td>
                    <td className="px-3 py-3">{formatNumber(row.touches)}</td>
                    <td className="px-3 py-3">{formatNumber(row.churn)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-3 py-6 text-sm text-[color:var(--muted)]"
                    colSpan={4}
                  >
                    {loading ? "Loading hotspots..." : "No hotspots available."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
