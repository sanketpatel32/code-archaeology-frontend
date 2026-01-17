"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BarChart from "@/components/charts/BarChart";
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

const toNumber = (value: number | string) => {
  const numeric = Number.parseFloat(String(value));
  return Number.isFinite(numeric) ? numeric : 0;
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
  const busFactorBars = useMemo(
    () =>
      [...busFactor]
        .sort(
          (a, b) =>
            toNumber(b.contribution_share) - toNumber(a.contribution_share),
        )
        .slice(0, 10)
        .map((row) => ({
          label: row.file_path.split("/").slice(-1)[0] ?? row.file_path,
          value: toNumber(row.contribution_share) * 100,
          title: row.file_path,
        })),
    [busFactor],
  );
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
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
            Ownership concentration
          </h2>
          <span className="text-xs text-[color:var(--muted)]">
            Top 10 files
          </span>
        </div>
        {busFactorBars.length ? (
          <div className="mt-4 h-52">
            <BarChart data={busFactorBars} color="var(--signal)" />
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
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-[color:var(--muted)]">
              <thead>
                <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-[0.2em]">
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2">Share</th>
                  <th className="px-3 py-2">Touches</th>
                </tr>
              </thead>
              <tbody>
                {displayedOwnership.length ? (
                  displayedOwnership.map((row) => (
                    <tr
                      key={row.file_path}
                      className="border-b border-[color:var(--border)]/60"
                    >
                      <td className="px-3 py-3 font-mono text-xs text-[color:var(--foreground)]">
                        {row.file_path}
                      </td>
                      <td className="px-3 py-3">{row.contributor_name}</td>
                      <td className="px-3 py-3">
                        {formatScore(toNumber(row.contribution_share) * 100)}%
                      </td>
                      <td className="px-3 py-3">{formatNumber(row.touches)}</td>
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

        <div className="soft-panel rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
            Ownership focus
          </h2>
          {topOwner ? (
            <div className="mt-4 grid gap-4 text-sm text-[color:var(--muted)]">
              <div className="panel-muted rounded-2xl px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  File
                </div>
                <div className="mt-2 font-mono text-xs text-[color:var(--foreground)]">
                  {topOwner.file_path}
                </div>
              </div>
              <div className="panel-muted rounded-2xl px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Dominant owner
                </div>
                <div className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
                  {topOwner.contributor_name}
                </div>
                <div className="mt-2 text-xs text-[color:var(--muted)]">
                  {formatScore(toNumber(topOwner.contribution_share) * 100)}%
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
      </section>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.3s" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
            Bus factor warnings
          </h2>
          <span className="text-xs text-[color:var(--muted)]">
            {filteredBusFactor.length} risk signals
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {filteredBusFactor.length ? (
            filteredBusFactor.map((row) => (
              <div
                key={row.file_path}
                className="panel-muted rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]"
              >
                <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {row.contributor_name}
                </div>
                <div className="mt-2 font-mono text-xs text-[color:var(--foreground)]">
                  {row.file_path}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-[color:var(--muted)]">
                  <span>
                    {formatScore(toNumber(row.contribution_share) * 100)}% share
                  </span>
                  <span>{formatNumber(row.touches)} touches</span>
                </div>
              </div>
            ))
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
