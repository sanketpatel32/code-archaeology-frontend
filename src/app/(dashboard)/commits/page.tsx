"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import { useAnalysisState } from "@/lib/useAnalysisState";

type CommitRow = {
  sha: string;
  author_name: string | null;
  author_email: string | null;
  committed_at: string;
  message: string;
  classification: string;
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  feat: "Feat",
  fix: "Fix",
  docs: "Docs",
  style: "Style",
  refactor: "Refactor",
  perf: "Perf",
  test: "Test",
  build: "Build",
  ci: "CI",
  revert: "Revert",
  chore: "Chore",
  unknown: "Other",
};

const CLASSIFICATION_COLORS: Record<string, string> = {
  feat: "var(--signal)",
  fix: "var(--risk)",
  docs: "#38bdf8",
  style: "#fbbf24",
  refactor: "var(--warning)",
  perf: "#fb7185",
  test: "#a3e635",
  build: "#14b8a6",
  ci: "#0ea5e9",
  revert: "#f97316",
  chore: "#94a3b8",
  unknown: "#64748b",
};

const CLASSIFICATION_NORMALIZE: Record<string, string> = {
  bugfix: "fix",
  feature: "feat",
  maintenance: "build",
};

const PREFIX_CLASSIFICATION: Record<string, string> = {
  feat: "feat",
  feature: "feat",
  fix: "fix",
  bugfix: "fix",
  docs: "docs",
  doc: "docs",
  style: "style",
  styles: "style",
  refactor: "refactor",
  perf: "perf",
  test: "test",
  tests: "test",
  build: "build",
  ci: "ci",
  revert: "revert",
  chore: "chore",
};

const CONVENTIONAL_PREFIX = /^(\w+)(?:\([^)]+\))?(?:!)?:/;

const deriveClassification = (commit: CommitRow) => {
  const stored = commit.classification?.toLowerCase() ?? "unknown";
  const normalized = CLASSIFICATION_NORMALIZE[stored] ?? stored;
  if (normalized !== "unknown") {
    return normalized;
  }

  const match = commit.message.toLowerCase().match(CONVENTIONAL_PREFIX);
  if (match) {
    const mapped = PREFIX_CLASSIFICATION[match[1]];
    if (mapped) {
      return mapped;
    }
  }

  return normalized;
};

const CLASSIFICATION_OPTIONS = [
  "all",
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "revert",
  "chore",
  "unknown",
] as const;

export default function CommitsPage() {
  const { state } = useAnalysisState();
  const [commits, setCommits] = useState<CommitRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] =
    useState<(typeof CLASSIFICATION_OPTIONS)[number]>("all");
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    if (!state.repoId) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGet<CommitRow[]>(
          `/api/repositories/${state.repoId}/commits?limit=${limit}`,
        );
        setCommits(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load commits.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [state.repoId, limit]);

  const filteredCommits = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return commits.filter((commit) => {
      const normalizedType = deriveClassification(commit);
      if (typeFilter !== "all" && normalizedType !== typeFilter) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return (
        commit.message.toLowerCase().includes(normalized) ||
        commit.sha.toLowerCase().includes(normalized) ||
        (commit.author_name ?? "").toLowerCase().includes(normalized) ||
        (commit.author_email ?? "").toLowerCase().includes(normalized)
      );
    });
  }, [commits, query, typeFilter]);

  if (!state.repoId) {
    return (
      <section className="soft-panel rounded-3xl p-8">
        <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">
          Commit history
        </h2>
        <p className="mt-3 text-sm text-[color:var(--muted)]">
          Run an analysis to load the repository commit stream.
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
          Commit history
        </h1>
        <p className="max-w-2xl text-sm text-[color:var(--muted)]">
          Review the latest commits with author context and classification
          signals.
        </p>
      </header>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="toolbar">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Latest commits
            </h2>
            <span className="toolbar-meta">
              Showing {formatNumber(filteredCommits.length)} /{" "}
              {formatNumber(commits.length)}
            </span>
          </div>
          <div className="toolbar-group">
            <input
              className="input-field rounded-full px-3 py-2 text-xs"
              placeholder="Search message, author, or SHA"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="input-field rounded-full px-3 py-2 text-xs"
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target.value as (typeof CLASSIFICATION_OPTIONS)[number],
                )
              }
            >
              {CLASSIFICATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "Type: All" : CLASSIFICATION_LABELS[option]}
                </option>
              ))}
            </select>
            <select
              className="input-field rounded-full px-3 py-2 text-xs"
              value={limit}
              onChange={(event) =>
                setLimit(Number.parseInt(event.target.value, 10))
              }
            >
              <option value={50}>Show 50</option>
              <option value={100}>Show 100</option>
              <option value={200}>Show 200</option>
            </select>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {filteredCommits.length ? (
            filteredCommits.map((commit) => {
              const normalizedType = deriveClassification(commit);
              const classification =
                CLASSIFICATION_LABELS[normalizedType] ?? "Other";
              const color =
                CLASSIFICATION_COLORS[normalizedType] ??
                CLASSIFICATION_COLORS.unknown;
              return (
                <div
                  key={commit.sha}
                  className="panel-muted rounded-2xl p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div
                        className="clamp-2 text-sm font-semibold text-[color:var(--foreground)]"
                        title={commit.message}
                      >
                        {commit.message}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[color:var(--muted)]">
                        <span className="chip rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                          {commit.sha.slice(0, 8)}
                        </span>
                        <span className="truncate-1">
                          {commit.author_name ?? "Unknown author"}
                        </span>
                        <span className="truncate-1">
                          {commit.author_email ?? ""}
                        </span>
                        <span>{formatDate(commit.committed_at)}</span>
                      </div>
                    </div>
                    <span
                      className="chip rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
                      style={{ color, borderColor: "var(--border)" }}
                    >
                      {classification}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-[color:var(--muted)]">
              {loading ? "Loading commits..." : "No commits found."}
            </p>
          )}
          {error ? (
            <div className="alert-error rounded-xl px-3 py-2 text-xs">
              {error}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
