"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BarChart from "@/components/charts/BarChart";
import { apiGet } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatNumber, formatScore } from "@/lib/format";
import { useAnalysisState } from "@/lib/useAnalysisState";

type Fragility = {
  file_path: string;
  touches: number;
  churn: number;
  fragility_index: number | string;
};

const toNumber = (value: number | string) => {
  const numeric = Number.parseFloat(String(value));
  return Number.isFinite(numeric) ? numeric : 0;
};

export default function FragilityPage() {
  const { state } = useAnalysisState();
  const [fragility, setFragility] = useState<Fragility[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("index");
  const [limit, setLimit] = useState(25);
  const indexSorted = useMemo(
    () =>
      [...fragility].sort(
        (a, b) => toNumber(b.fragility_index) - toNumber(a.fragility_index),
      ),
    [fragility],
  );
  const fragilityValues = useMemo(
    () => fragility.map((row) => toNumber(row.fragility_index)),
    [fragility],
  );
  const fragilityStats = useMemo(() => {
    if (!fragilityValues.length) {
      return null;
    }
    const sorted = [...fragilityValues].sort((a, b) => a - b);
    const pick = (ratio: number) => {
      const index = Math.floor((sorted.length - 1) * ratio);
      return sorted[index] ?? 0;
    };
    return {
      total: sorted.length,
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      median: pick(0.5),
      p90: pick(0.9),
    };
  }, [fragilityValues]);
  const fragilityBands = useMemo(() => {
    if (!fragilityValues.length) {
      return [];
    }
    const total = fragilityValues.length;
    const bands = [
      { label: "Low (0-0.25)", min: 0, max: 0.25, color: "var(--signal)" },
      {
        label: "Guarded (0.25-0.5)",
        min: 0.25,
        max: 0.5,
        color: "var(--accent)",
      },
      { label: "High (0.5-0.75)", min: 0.5, max: 0.75, color: "var(--warning)" },
      { label: "Severe (0.75-1.0)", min: 0.75, max: 1.01, color: "var(--risk)" },
    ];

    return bands.map((band) => {
      const count = fragilityValues.filter(
        (value) => value >= band.min && value < band.max,
      ).length;
      const percent = total ? (count / total) * 100 : 0;
      return { ...band, count, percent };
    });
  }, [fragilityValues]);
  const barData = useMemo(
    () =>
      indexSorted.slice(0, 12).map((row) => ({
        label: row.file_path.split("/").slice(-1)[0] ?? row.file_path,
        value: toNumber(row.fragility_index),
        title: row.file_path,
      })),
    [indexSorted],
  );
  const filteredFragility = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const base = normalized
      ? indexSorted.filter((row) =>
          row.file_path.toLowerCase().includes(normalized),
        )
      : indexSorted;

    return [...base].sort((a, b) => {
      if (sortBy === "touches") {
        return b.touches - a.touches;
      }
      if (sortBy === "churn") {
        return b.churn - a.churn;
      }
      if (sortBy === "file") {
        return a.file_path.localeCompare(b.file_path);
      }
      return toNumber(b.fragility_index) - toNumber(a.fragility_index);
    });
  }, [indexSorted, query, sortBy]);
  const displayedFragility = useMemo(
    () => filteredFragility.slice(0, limit),
    [filteredFragility, limit],
  );

  useEffect(() => {
    if (!state.repoId) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGet<Fragility[]>(
          `/api/repositories/${state.repoId}/fragility?limit=50`,
        );
        setFragility(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load fragility.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [state.repoId]);

  if (!state.repoId) {
    return (
      <section className="soft-panel rounded-3xl p-8">
        <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">
          Fragility report
        </h2>
        <p className="mt-3 text-sm text-[color:var(--muted)]">
          Run an analysis to surface files that have unstable recent behavior.
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
          Fragility report
        </h1>
        <p className="max-w-2xl text-sm text-[color:var(--muted)]">
          Files with high fragility show a concentration of recent churn and
          bug-fix activity. Use this list to prioritize stabilizing work.
        </p>
      </header>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Fragility index spread
            </h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Index normalized from 0 (stable) to 1 (fragile).
            </p>
          </div>
          <span className="text-xs text-[color:var(--muted)]">Top 12</span>
        </div>
        {barData.length ? (
          <div className="mt-5 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="h-56">
              <BarChart
                data={barData}
                color="var(--warning)"
                formatValue={(value) => formatScore(value)}
              />
            </div>
            <div className="panel-muted rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em]">
                  Risk bands
                </span>
                <span className="text-xs text-[color:var(--muted)]">
                  {formatNumber(fragilityStats?.total ?? 0)} files
                </span>
              </div>
              <div className="mt-4 metric-list">
                {fragilityBands.map((band) => (
                  <div className="metric-row" key={band.label}>
                    <div className="metric-label">{band.label}</div>
                    <div className="metric-bar">
                      <span
                        className="metric-bar-fill"
                        style={{
                          width: `${band.percent}%`,
                          background: band.color,
                        }}
                      />
                    </div>
                    <div
                      className="metric-value"
                      title={`${formatNumber(band.count)} files`}
                    >
                      {Math.round(band.percent)}%
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2 text-xs text-[color:var(--muted)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.2em]">
                    Median
                  </span>
                  <span className="text-[color:var(--foreground)]">
                    {formatScore(fragilityStats?.median ?? null)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.2em]">
                    90th percentile
                  </span>
                  <span className="text-[color:var(--foreground)]">
                    {formatScore(fragilityStats?.p90 ?? null)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.2em]">
                    Range
                  </span>
                  <span className="text-[color:var(--foreground)]">
                    {formatScore(fragilityStats?.min ?? null)} -{" "}
                    {formatScore(fragilityStats?.max ?? null)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[color:var(--muted)]">
            {loading ? "Loading fragility data..." : "No fragility data yet."}
          </p>
        )}
      </section>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.2s" }}
      >
        <div className="toolbar">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Fragile files
            </h2>
            <span className="toolbar-meta">
              {formatNumber(filteredFragility.length)} files
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
              <option value="index">Sort: Index</option>
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
                  "fragility.csv",
                  filteredFragility.map((row) => ({
                    file_path: row.file_path,
                    fragility_index: toNumber(row.fragility_index),
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
                <th className="px-3 py-2">Index</th>
                <th className="px-3 py-2">Touches</th>
                <th className="px-3 py-2">Churn</th>
              </tr>
            </thead>
            <tbody>
              {displayedFragility.length ? (
                displayedFragility.map((row) => (
                  <tr
                    key={row.file_path}
                    className="border-b border-[color:var(--border)]/60"
                  >
                    <td className="px-3 py-3 font-mono text-xs text-[color:var(--foreground)]">
                      <span
                        className="table-cell-truncate truncate-1"
                        title={row.file_path}
                      >
                        {row.file_path}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {formatScore(row.fragility_index)}
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
                    {loading
                      ? "Loading fragility data..."
                      : "No fragility data available."}
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
