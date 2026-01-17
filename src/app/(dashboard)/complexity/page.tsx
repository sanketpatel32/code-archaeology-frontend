"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BarChart from "@/components/charts/BarChart";
import { apiGet } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/format";
import { useAnalysisState } from "@/lib/useAnalysisState";

type Complexity = {
  file_path: string;
  commit_sha: string;
  functions: number;
  conditionals: number;
  max_nesting: number;
  lines: number;
};

export default function ComplexityPage() {
  const { state } = useAnalysisState();
  const [complexity, setComplexity] = useState<Complexity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("nesting");
  const [limit, setLimit] = useState(25);

  useEffect(() => {
    if (!state.repoId) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGet<Complexity[]>(
          `/api/repositories/${state.repoId}/complexity?limit=40`,
        );
        setComplexity(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load complexity.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [state.repoId]);

  const totalLines = useMemo(
    () => complexity.reduce((sum, row) => sum + (row.lines || 0), 0),
    [complexity],
  );
  const avgNesting = useMemo(() => {
    if (!complexity.length) {
      return 0;
    }
    const total = complexity.reduce(
      (sum, row) => sum + (row.max_nesting || 0),
      0,
    );
    return Math.round(total / complexity.length);
  }, [complexity]);
  const complexityBars = useMemo(
    () =>
      [...complexity]
        .sort((a, b) => b.max_nesting - a.max_nesting)
        .slice(0, 12)
        .map((row) => ({
          label: row.file_path.split("/").slice(-1)[0] ?? row.file_path,
          value: row.max_nesting,
          title: row.file_path,
        })),
    [complexity],
  );
  const filteredComplexity = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const base = normalized
      ? complexity.filter((row) =>
          row.file_path.toLowerCase().includes(normalized),
        )
      : complexity;

    return [...base].sort((a, b) => {
      if (sortBy === "lines") {
        return b.lines - a.lines;
      }
      if (sortBy === "functions") {
        return b.functions - a.functions;
      }
      if (sortBy === "file") {
        return a.file_path.localeCompare(b.file_path);
      }
      return b.max_nesting - a.max_nesting;
    });
  }, [complexity, query, sortBy]);
  const displayedComplexity = useMemo(
    () => filteredComplexity.slice(0, limit),
    [filteredComplexity, limit],
  );

  if (!state.repoId) {
    return (
      <section className="soft-panel rounded-3xl p-8">
        <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">
          Complexity growth analysis
        </h2>
        <p className="mt-3 text-sm text-[color:var(--muted)]">
          Run an analysis to see the latest complexity snapshots across your
          codebase.
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
          Complexity growth analysis
        </h1>
        <p className="max-w-2xl text-sm text-[color:var(--muted)]">
          Track structural drift with AST snapshots. The latest checkpoint for
          each file is summarized below to guide refactoring priorities.
        </p>
      </header>

      <section
        className="reveal grid gap-6 lg:grid-cols-3"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="stat-card">
          <span className="stat-label">Files sampled</span>
          <span className="stat-value">{formatNumber(complexity.length)}</span>
          <span className="stat-meta">Latest snapshot set</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total lines</span>
          <span className="stat-value">{formatNumber(totalLines)}</span>
          <span className="stat-meta">Sampled JavaScript and TypeScript</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Avg nesting</span>
          <span className="stat-value">{formatNumber(avgNesting)}</span>
          <span className="stat-meta">Control flow depth</span>
        </div>
      </section>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.2s" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
            Nesting hotspots
          </h2>
          <span className="text-xs text-[color:var(--muted)]">Top 12</span>
        </div>
        {complexityBars.length ? (
          <div className="mt-4 h-52">
            <BarChart data={complexityBars} color="var(--accent)" />
          </div>
        ) : (
          <p className="mt-4 text-sm text-[color:var(--muted)]">
            {loading ? "Loading complexity data..." : "No complexity data yet."}
          </p>
        )}
      </section>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.3s" }}
      >
        <div className="toolbar">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Latest complexity snapshot
            </h2>
            <span className="toolbar-meta">
              {formatNumber(filteredComplexity.length)} files
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
              <option value="nesting">Sort: Nesting</option>
              <option value="lines">Sort: Lines</option>
              <option value="functions">Sort: Functions</option>
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
                  "complexity.csv",
                  filteredComplexity.map((row) => ({
                    file_path: row.file_path,
                    functions: row.functions,
                    conditionals: row.conditionals,
                    max_nesting: row.max_nesting,
                    lines: row.lines,
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
                <th className="px-3 py-2">Functions</th>
                <th className="px-3 py-2">Conditionals</th>
                <th className="px-3 py-2">Max nesting</th>
                <th className="px-3 py-2">Lines</th>
              </tr>
            </thead>
            <tbody>
              {displayedComplexity.length ? (
                displayedComplexity.map((row) => (
                  <tr
                    key={`${row.file_path}-${row.commit_sha}`}
                    className="border-b border-[color:var(--border)]/60"
                  >
                    <td className="px-3 py-3 font-mono text-xs text-[color:var(--foreground)]">
                      {row.file_path}
                    </td>
                    <td className="px-3 py-3">{formatNumber(row.functions)}</td>
                    <td className="px-3 py-3">
                      {formatNumber(row.conditionals)}
                    </td>
                    <td className="px-3 py-3">
                      {formatNumber(row.max_nesting)}
                    </td>
                    <td className="px-3 py-3">{formatNumber(row.lines)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-3 py-6 text-sm text-[color:var(--muted)]"
                    colSpan={5}
                  >
                    {loading
                      ? "Loading complexity snapshots..."
                      : "No complexity data available."}
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
