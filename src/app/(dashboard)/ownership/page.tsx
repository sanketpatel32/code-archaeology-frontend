"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BarChart from "@/components/charts/BarChart";
import DonutChart, { type DonutSegment } from "@/components/charts/DonutChart";
import { apiGet } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatNumber, formatScore } from "@/lib/format";
import { useAnalysisState } from "@/lib/useAnalysisState";

type Ownership = {
  file_path: string;
  contributor_name: string;
  touches: number;
  churn: number;
  contribution_share: number | string;
};

type BusFactor = {
  file_path: string;
  contributor_name: string;
  contribution_share: number | string;
  touches: number;
  churn: number;
};

type OwnerCoverage = {
  name: string;
  files: number;
  touches: number;
  churn: number;
  shareTotal: number;
};

const toNumber = (value: number | string) => {
  const numeric = Number.parseFloat(String(value));
  return Number.isFinite(numeric) ? numeric : 0;
};

const OWNER_COLORS = [
  "var(--accent)",
  "var(--signal)",
  "var(--warning)",
  "var(--risk)",
  "#0ea5e9",
];

const getRiskTone = (share: number) => {
  if (share >= 0.85) {
    return { label: "Critical", bg: "var(--risk-soft)", color: "var(--risk)" };
  }
  if (share >= 0.7) {
    return {
      label: "High",
      bg: "var(--warning-soft)",
      color: "var(--warning)",
    };
  }
  return {
    label: "Guarded",
    bg: "var(--signal-soft)",
    color: "var(--signal)",
  };
};

export default function OwnershipPage() {
  const { state } = useAnalysisState();
  const [ownership, setOwnership] = useState<Ownership[]>([]);
  const [busFactor, setBusFactor] = useState<BusFactor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("share");
  const [limit, setLimit] = useState(25);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);

  useEffect(() => {
    if (!state.repoId) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [ownershipData, busFactorData] = await Promise.all([
          apiGet<Ownership[]>(
            `/api/repositories/${state.repoId}/ownership?limit=30`,
          ),
          apiGet<BusFactor[]>(
            `/api/repositories/${state.repoId}/bus-factor?limit=10`,
          ),
        ]);
        setOwnership(ownershipData);
        setBusFactor(busFactorData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load ownership.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [state.repoId]);

  const shareSorted = useMemo(
    () =>
      [...ownership].sort(
        (a, b) =>
          toNumber(b.contribution_share) - toNumber(a.contribution_share),
      ),
    [ownership],
  );
  const topOwner = useMemo(() => shareSorted[0], [shareSorted]);
  const focusedOwner = useMemo(() => {
    if (focusedPath) {
      return shareSorted.find((row) => row.file_path === focusedPath) ?? topOwner;
    }
    return topOwner;
  }, [focusedPath, shareSorted, topOwner]);
  const concentrationBars = useMemo(
    () =>
      shareSorted.slice(0, 10).map((row) => ({
        label: row.file_path.split("/").slice(-1)[0] ?? row.file_path,
        value: toNumber(row.contribution_share) * 100,
        title: row.file_path,
      })),
    [shareSorted],
  );
  const shareValues = useMemo(
    () => ownership.map((row) => toNumber(row.contribution_share)),
    [ownership],
  );
  const shareStats = useMemo(() => {
    if (!shareValues.length) {
      return null;
    }
    const sorted = [...shareValues].sort((a, b) => a - b);
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
  }, [shareValues]);
  const shareBands = useMemo(() => {
    if (!shareValues.length) {
      return [];
    }
    const total = shareValues.length;
    const bands = [
      {
        label: "Balanced 0-40%",
        min: 0,
        max: 0.4,
        color: "var(--signal)",
      },
      {
        label: "Concentrated 40-60%",
        min: 0.4,
        max: 0.6,
        color: "var(--accent)",
      },
      {
        label: "High 60-80%",
        min: 0.6,
        max: 0.8,
        color: "var(--warning)",
      },
      {
        label: "Critical 80-100%",
        min: 0.8,
        max: 1.01,
        color: "var(--risk)",
      },
    ];

    return bands.map((band) => {
      const count = shareValues.filter(
        (value) => value >= band.min && value < band.max,
      ).length;
      const percent = total ? (count / total) * 100 : 0;
      return { ...band, count, percent };
    });
  }, [shareValues]);
  const ownerCoverage = useMemo(() => {
    const map = new Map<string, OwnerCoverage>();
    for (const row of ownership) {
      const entry = map.get(row.contributor_name) ?? {
        name: row.contributor_name,
        files: 0,
        touches: 0,
        churn: 0,
        shareTotal: 0,
      };
      entry.files += 1;
      entry.touches += row.touches;
      entry.churn += row.churn;
      entry.shareTotal += toNumber(row.contribution_share);
      map.set(row.contributor_name, entry);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (b.files !== a.files) {
        return b.files - a.files;
      }
      return b.shareTotal - a.shareTotal;
    });
  }, [ownership]);
  const ownerSegments = useMemo<DonutSegment[]>(() => {
    if (!ownerCoverage.length) {
      return [];
    }
    const top = ownerCoverage.slice(0, 4);
    const otherCount = ownerCoverage
      .slice(4)
      .reduce((sum, row) => sum + row.files, 0);
    const segments = top.map((row, index) => ({
      label: row.name,
      value: row.files,
      color: OWNER_COLORS[index % OWNER_COLORS.length],
    }));
    if (otherCount > 0) {
      segments.push({
        label: "Other",
        value: otherCount,
        color: "#475569",
      });
    }
    return segments;
  }, [ownerCoverage]);
  const ownerTotalFiles = useMemo(
    () => ownerCoverage.reduce((sum, row) => sum + row.files, 0),
    [ownerCoverage],
  );
  const busFactorStats = useMemo(() => {
    if (!busFactor.length) {
      return null;
    }
    const shares = busFactor.map((row) => toNumber(row.contribution_share));
    const avgShare =
      shares.reduce((sum, value) => sum + value, 0) / shares.length;
    const maxShare = Math.max(...shares);
    const criticalCount = shares.filter((value) => value >= 0.85).length;
    const highCount = shares.filter((value) => value >= 0.7).length;
    const topRisk = busFactor.reduce((top, row) =>
      toNumber(row.contribution_share) >
        toNumber(top.contribution_share)
        ? row
        : top,
    );
    return { avgShare, maxShare, criticalCount, highCount, topRisk };
  }, [busFactor]);
  const filteredOwnership = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const base = normalized
      ? shareSorted.filter(
        (row) =>
          row.file_path.toLowerCase().includes(normalized) ||
          row.contributor_name.toLowerCase().includes(normalized),
      )
      : shareSorted;

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
      return toNumber(b.contribution_share) - toNumber(a.contribution_share);
    });
  }, [query, shareSorted, sortBy]);
  const displayedOwnership = useMemo(
    () => filteredOwnership.slice(0, limit),
    [filteredOwnership, limit],
  );
  const filteredBusFactor = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return busFactor;
    }
    return busFactor.filter(
      (row) =>
        row.file_path.toLowerCase().includes(normalized) ||
        row.contributor_name.toLowerCase().includes(normalized),
    );
  }, [busFactor, query]);

  if (!state.repoId) {
    return (
      <section className="soft-panel rounded-3xl p-8">
        <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">
          Ownership and risk analysis
        </h2>
        <p className="mt-3 text-sm text-[color:var(--muted)]">
          Run an analysis to see who owns the most critical parts of your
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
          Ownership and risk analysis
        </h1>
        <p className="max-w-2xl text-sm text-[color:var(--muted)]">
          Track who owns the most change volume and where knowledge is
          concentrated. Use bus factor warnings to identify fragile areas.
        </p>
      </header>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Ownership concentration
            </h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Dominant ownership share per file (top owners only).
            </p>
          </div>
          <span className="text-xs text-[color:var(--muted)]">
            Top 10 files
          </span>
        </div>
        {concentrationBars.length ? (
          <div className="mt-5 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="h-56">
              <BarChart
                data={concentrationBars}
                color="var(--signal)"
                formatValue={(value) => `${formatScore(value)}%`}
              />
            </div>
            <div className="panel-muted rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em]">
                  Share bands
                </span>
                <span className="text-xs text-[color:var(--muted)]">
                  {formatNumber(shareStats?.total ?? 0)} files
                </span>
              </div>
              <div className="mt-4 metric-list">
                {shareBands.map((band) => (
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
                    Median share
                  </span>
                  <span className="text-[color:var(--foreground)]">
                    {formatScore((shareStats?.median ?? 0) * 100)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.2em]">
                    90th percentile
                  </span>
                  <span className="text-[color:var(--foreground)]">
                    {formatScore((shareStats?.p90 ?? 0) * 100)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.2em]">
                    Range
                  </span>
                  <span className="text-[color:var(--foreground)]">
                    {formatScore((shareStats?.min ?? 0) * 100)}% -{" "}
                    {formatScore((shareStats?.max ?? 0) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[color:var(--muted)]">
            {loading ? "Loading ownership data..." : "No ownership data yet."}
          </p>
        )}
      </section>

      <section
        className="reveal grid gap-6 lg:grid-cols-[1.2fr_1fr]"
        style={{ animationDelay: "0.2s" }}
      >
        <div className="soft-panel rounded-3xl p-6">
          <div className="toolbar">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
                Top file owners
              </h2>
              <span className="toolbar-meta">
                {formatNumber(filteredOwnership.length)} files
              </span>
            </div>
            <div className="toolbar-group">
              <input
                className="input-field rounded-full px-3 py-2 text-xs"
                placeholder="Search file or owner"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <select
                className="input-field rounded-full px-3 py-2 text-xs"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                <option value="share">Sort: Share</option>
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
                    "ownership.csv",
                    filteredOwnership.map((row) => ({
                      file_path: row.file_path,
                      contributor: row.contributor_name,
                      share: toNumber(row.contribution_share) * 100,
                      touches: row.touches,
                      churn: row.churn,
                    })),
                  )
                }
              >
                Export CSV
              </button>
              {error ? (
                <span className="text-xs text-[color:var(--risk)]">
                  {error}
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-4 max-h-[400px] overflow-y-auto overflow-x-auto scroll-smooth" style={{ scrollbarWidth: 'thin' }}>
            <table className="min-w-full text-left text-sm text-[color:var(--muted)]">
              <thead className="sticky top-0 bg-[color:var(--background)] z-10">
                <tr className="border-b border-[color:var(--border)] text-[10px] uppercase tracking-[0.15em]">
                  <th className="px-2 py-1.5">File</th>
                  <th className="px-2 py-1.5">Owner</th>
                  <th className="px-2 py-1.5">Share</th>
                  <th className="px-2 py-1.5">Touches</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border)]/20">
                {displayedOwnership.length ? (
                  displayedOwnership.map((row) => (
                    <tr
                      key={row.file_path}
                      className={`cursor-pointer transition-colors ${focusedPath === row.file_path
                        ? "bg-[color:var(--accent)]/10"
                        : "hover:bg-white/5"
                        }`}
                      onClick={() => setFocusedPath(row.file_path)}
                    >
                      <td className="px-2 py-1 font-mono text-xs text-[color:var(--foreground)]">
                        <span
                          className="table-cell-truncate truncate-1"
                          title={row.file_path}
                        >
                          {row.file_path}
                        </span>
                      </td>
                      <td className="px-2 py-1">{row.contributor_name}</td>
                      <td className="px-2 py-1">
                        {formatScore(toNumber(row.contribution_share) * 100)}%
                      </td>
                      <td className="px-2 py-1">{formatNumber(row.touches)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      className="px-3 py-6 text-sm text-[color:var(--muted)]"
                      colSpan={4}
                    >
                      {loading
                        ? "Loading ownership data..."
                        : "No ownership data available."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="soft-panel rounded-3xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
                  Owner coverage
                </h2>
                <p className="mt-1 text-xs text-[color:var(--muted)]">
                  Share of files dominated by each owner.
                </p>
              </div>
              <span className="chip rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                {formatNumber(ownerTotalFiles)} files
              </span>
            </div>
            {ownerSegments.length ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="flex items-center justify-center">
                  <DonutChart segments={ownerSegments} size={200} />
                </div>
                <div className="metric-list">
                  {ownerCoverage.slice(0, 5).map((owner) => {
                    const percent = ownerTotalFiles
                      ? (owner.files / ownerTotalFiles) * 100
                      : 0;
                    return (
                      <div className="metric-row" key={owner.name}>
                        <div className="metric-label" title={owner.name}>
                          {owner.name}
                        </div>
                        <div className="metric-bar">
                          <span
                            className="metric-bar-fill"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="metric-value">
                          {Math.round(percent)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[color:var(--muted)]">
                {loading
                  ? "Loading ownership coverage..."
                  : "No ownership coverage available."}
              </p>
            )}
          </div>

          <div className="soft-panel rounded-3xl p-6">
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Ownership focus
            </h2>
            {focusedOwner ? (
              <div className="mt-4 grid gap-4 text-sm text-[color:var(--muted)]">
                <div className="panel-muted rounded-2xl px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    File
                  </div>
                  <div
                    className="truncate-1 mt-2 font-mono text-xs text-[color:var(--foreground)]"
                    title={focusedOwner.file_path}
                  >
                    {focusedOwner.file_path}
                  </div>
                </div>
                <div className="panel-muted rounded-2xl px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Dominant owner
                  </div>
                  <div className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
                    {focusedOwner.contributor_name}
                  </div>
                  <div className="mt-2 text-xs text-[color:var(--muted)]">
                    {formatScore(toNumber(focusedOwner.contribution_share) * 100)}%
                    share of changes
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[color:var(--muted)]">
                {loading ? "Loading focus..." : "No ownership focus available."}
              </p>
            )}
          </div>
        </div>
      </section>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.3s" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Bus factor warnings
            </h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Files where ownership is concentrated in a single contributor.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            <span className="chip rounded-full px-3 py-1">
              Signals {formatNumber(filteredBusFactor.length)}
            </span>
            <span className="chip rounded-full px-3 py-1">
              Critical {formatNumber(busFactorStats?.criticalCount ?? 0)}
            </span>
            <span className="chip rounded-full px-3 py-1">
              Avg share{" "}
              {busFactorStats
                ? `${formatScore(busFactorStats.avgShare * 100)}%`
                : "--"}
            </span>
          </div>
        </div>
        {busFactorStats?.topRisk ? (
          <div className="panel-muted mt-4 grid gap-2 rounded-2xl p-4 text-sm text-[color:var(--muted)]">
            <div className="text-xs uppercase tracking-[0.2em]">
              Highest exposure
            </div>
            <div
              className="truncate-1 font-mono text-xs text-[color:var(--foreground)]"
              title={busFactorStats.topRisk.file_path}
            >
              {busFactorStats.topRisk.file_path}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span>{busFactorStats.topRisk.contributor_name}</span>
              <span>
                {formatScore(
                  toNumber(busFactorStats.topRisk.contribution_share) * 100,
                )}
                % share
              </span>
            </div>
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {filteredBusFactor.length ? (
            filteredBusFactor.map((row) => {
              const shareValue = toNumber(row.contribution_share);
              const tone = getRiskTone(shareValue);
              return (
                <div
                  key={row.file_path}
                  className="panel-muted rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      {row.contributor_name}
                    </div>
                    <span
                      className="rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.2em]"
                      style={{ background: tone.bg, color: tone.color }}
                    >
                      {tone.label}
                    </span>
                  </div>
                  <div
                    className="truncate-1 mt-2 font-mono text-xs text-[color:var(--foreground)]"
                    title={row.file_path}
                  >
                    {row.file_path}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-[color:var(--muted)]">
                    <span>{formatScore(shareValue * 100)}% share</span>
                    <span>{formatNumber(row.touches)} touches</span>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-[color:var(--muted)]">
              {loading
                ? "Loading bus factor warnings..."
                : "No bus factor risks flagged."}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
