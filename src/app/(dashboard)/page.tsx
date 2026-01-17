"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import TimelineChart from "@/components/charts/TimelineChart";
import TreemapChart, {
  type TreemapNode,
} from "@/components/charts/TreemapChart";
import { formatRepoLabel } from "@/lib/analysisStorage";
import { apiGet, apiPost } from "@/lib/api";
import { formatDate, formatNumber, formatScore } from "@/lib/format";
import { useAnalysisRun } from "@/lib/useAnalysisRun";
import { useAnalysisState } from "@/lib/useAnalysisState";

type Hotspot = {
  file_path: string;
  touches: number | string;
  churn: number | string;
  hotspot_score: number | string;
};

type TimelineBucket = {
  bucket: string;
  commit_count: number;
  additions: number;
  deletions: number;
};

type AnalysisResponse = {
  runId: string;
  repositoryId: string;
};

type SummaryResponse = {
  repository: {
    name: string;
    url: string;
    default_branch: string;
    last_analyzed_at: string | null;
  };
  counts: {
    commit_count: number;
    file_count: number;
    last_commit_at: string | null;
  };
  latestRun: {
    status: string;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
  } | null;
};

const toMetricValue = (value: number | string | null | undefined) => {
  const numeric =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : 0;
};

const buildTreemapData = (rows: Hotspot[]): TreemapNode => {
  const root: TreemapNode = { name: "root", children: [] };

  for (const row of rows) {
    const parts = row.file_path.split("/").filter(Boolean);
    if (!parts.length) {
      continue;
    }

    const touches = toMetricValue(row.touches);
    const churn = toMetricValue(row.churn);
    const value = Math.max(1, touches + churn);

    let current = root;
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      if (!current.children) {
        current.children = [];
      }
      let child = current.children.find((node) => node.name === part);
      if (!child) {
        child = { name: part };
        current.children.push(child);
      }
      if (index === parts.length - 1) {
        child.value = (child.value ?? 0) + value;
      }
      current = child;
    }
  }

  return root;
};

export default function OverviewPage() {
  const { state, update } = useAnalysisState();
  const { run, error: runError, statusTone } = useAnalysisRun(state.runId);

  const [repoUrl, setRepoUrl] = useState(state.repoUrl ?? "");
  const [branch, setBranch] = useState(state.branch ?? "");
  const [maxCommits, setMaxCommits] = useState("");
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [timeline, setTimeline] = useState<TimelineBucket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metricsLoaded, setMetricsLoaded] = useState(false);

  const repoLabel = formatRepoLabel(state.repoUrl);
  const sortedHotspots = useMemo(
    () =>
      [...hotspots].sort(
        (a, b) =>
          toMetricValue(b.hotspot_score) - toMetricValue(a.hotspot_score),
      ),
    [hotspots],
  );
  const topHotspot = sortedHotspots[0];
  const treemapData = useMemo(
    () => buildTreemapData(sortedHotspots.slice(0, 70)),
    [sortedHotspots],
  );

  useEffect(() => {
    if (state.repoUrl && !repoUrl) {
      setRepoUrl(state.repoUrl);
    }
  }, [state.repoUrl, repoUrl]);

  useEffect(() => {
    if (state.branch && !branch) {
      setBranch(state.branch);
    }
  }, [state.branch, branch]);

  useEffect(() => {
    if (runError) {
      setError(runError);
    }
  }, [runError]);

  useEffect(() => {
    if (state.repoId) {
      setMetricsLoaded(false);
    }
  }, [state.repoId]);

  const timelineStats = useMemo(() => {
    if (!timeline.length) {
      return null;
    }
    const totalAdditions = timeline.reduce(
      (sum, row) => sum + (row.additions || 0),
      0,
    );
    const totalDeletions = timeline.reduce(
      (sum, row) => sum + (row.deletions || 0),
      0,
    );
    const totalChurn = totalAdditions + totalDeletions;
    const firstBucket = timeline[0]?.bucket ?? null;
    const lastBucket = timeline[timeline.length - 1]?.bucket ?? null;

    return {
      totalAdditions,
      totalDeletions,
      totalChurn,
      firstBucket,
      lastBucket,
    };
  }, [timeline]);

  useEffect(() => {
    if (!state.repoId || !run || run.status !== "succeeded" || metricsLoaded) {
      return;
    }

    const loadMetrics = async () => {
      try {
        const [summaryData, hotspotsData, timelineData] = await Promise.all([
          apiGet<SummaryResponse>(`/api/repositories/${state.repoId}/summary`),
          apiGet<Hotspot[]>(
            `/api/repositories/${state.repoId}/hotspots?limit=70`,
          ),
          apiGet<TimelineBucket[]>(
            `/api/repositories/${state.repoId}/timeline`,
          ),
        ]);

        setSummary(summaryData);
        setHotspots(hotspotsData);
        setTimeline(timelineData);
        setMetricsLoaded(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load metrics.",
        );
      }
    };

    loadMetrics();
  }, [state.repoId, run, metricsLoaded]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    setMetricsLoaded(false);
    setSummary(null);
    setHotspots([]);
    setTimeline([]);

    try {
      const payload: { repoUrl: string; branch?: string; maxCommits?: number } =
        {
          repoUrl,
        };

      if (branch.trim()) {
        payload.branch = branch.trim();
      }

      const maxValue = Number.parseInt(maxCommits, 10);
      if (!Number.isNaN(maxValue) && maxValue > 0) {
        payload.maxCommits = maxValue;
      }

      const response = await apiPost<AnalysisResponse>(
        "/api/analysis",
        payload,
      );

      update({
        repoId: response.repositoryId,
        runId: response.runId,
        repoUrl,
        branch: branch.trim() || null,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to start analysis.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="reveal flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            <span className="chip rounded-full px-3 py-1">Overview</span>
            <span className="chip rounded-full px-3 py-1">
              {repoLabel ?? "No repo selected"}
            </span>
            <span
              className={`status-chip inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusTone.className}`}
            >
              {statusTone.label}
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-[color:var(--foreground)] sm:text-5xl">
              Repository overview
            </h1>
            <div className="grid gap-3 border-l border-[color:var(--border)] pl-4">
              <p className="max-w-xl text-sm text-[color:var(--muted)]">
                Scan a repo to surface change pressure, ownership risk, and
                structural drift.
              </p>
              <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                <span className="chip rounded-full px-3 py-1">Churn</span>
                <span className="chip rounded-full px-3 py-1">Ownership</span>
                <span className="chip rounded-full px-3 py-1">Complexity</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="stat-card">
              <span className="stat-label">Commits</span>
              <span className="stat-value">
                {summary ? formatNumber(summary.counts.commit_count) : "--"}
              </span>
              <span className="stat-meta">
                Last {formatDate(summary?.counts.last_commit_at)}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Files</span>
              <span className="stat-value">
                {summary ? formatNumber(summary.counts.file_count) : "--"}
              </span>
              <span className="stat-meta">
                Branch {summary?.repository.default_branch ?? "--"}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Last run</span>
              <span className="stat-value">
                {formatDate(summary?.repository.last_analyzed_at)}
              </span>
              <span className="stat-meta">
                Status {summary?.latestRun?.status ?? "--"}
              </span>
            </div>
          </div>
        </div>

        <section
          className="soft-panel reveal rounded-3xl p-8"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
                New analysis
              </h2>
              <p className="mt-2 text-xs text-[color:var(--muted)]">
                Add a repository URL and launch a scan.
              </p>
            </div>
            <span className="chip rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {repoLabel ? "Repo loaded" : "No repo"}
            </span>
          </div>
          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-medium text-[color:var(--muted)]">
              Repository URL
              <input
                className="input-field rounded-2xl px-4 py-3 text-base outline-none"
                placeholder="https://github.com/org/repo"
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                required
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-[color:var(--muted)]">
                Branch
                <input
                  className="input-field rounded-2xl px-4 py-3 text-base outline-none"
                  placeholder="main (optional)"
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-[color:var(--muted)]">
                Max commits
                <input
                  className="input-field rounded-2xl px-4 py-3 text-base outline-none"
                  placeholder="5000 (optional)"
                  value={maxCommits}
                  onChange={(event) => setMaxCommits(event.target.value)}
                  inputMode="numeric"
                />
              </label>
            </div>
            <button
              className="button-primary mt-2 inline-flex items-center justify-center rounded-2xl px-6 py-3 text-base font-semibold"
              style={{
                animation: loading
                  ? undefined
                  : "glow-pulse 3s ease-in-out infinite",
              }}
              type="submit"
              disabled={loading}
            >
              {loading ? "Submitting..." : "Run analysis"}
            </button>
          </form>

          <div className="panel-dashed mt-6 grid gap-3 rounded-2xl p-4 text-sm text-[color:var(--muted)]">
            <div className="flex items-center justify-between">
              <span>Run status</span>
              <span
                className={`status-chip inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusTone.className}`}
              >
                {statusTone.label}
              </span>
            </div>
            <div className="grid gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span>Run ID</span>
                <span className="truncate font-mono text-[color:var(--foreground)]">
                  {state.runId ?? "--"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Repo ID</span>
                <span className="truncate font-mono text-[color:var(--foreground)]">
                  {state.repoId ?? "--"}
                </span>
              </div>
            </div>
            {error ? (
              <div className="alert-error rounded-xl px-3 py-2 text-xs">
                {error}
              </div>
            ) : null}
          </div>
        </section>
      </header>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.2s" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Activity lens
            </h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Commit intensity and churn flow over time.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            <span className="chip rounded-full px-3 py-1">
              Commits {formatNumber(summary?.counts.commit_count ?? 0)}
            </span>
            <span className="chip rounded-full px-3 py-1">
              Churn {formatNumber(timelineStats?.totalChurn ?? 0)}
            </span>
          </div>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_0.8fr]">
          <div className="panel-muted rounded-2xl p-4">
            {timeline.length ? (
              <div className="h-64">
                <TimelineChart data={timeline} />
              </div>
            ) : (
              <p className="text-sm text-[color:var(--muted)]">
                Timeline data will appear after analysis completes.
              </p>
            )}
          </div>
          <div className="panel-muted grid gap-3 rounded-2xl p-4 text-sm text-[color:var(--muted)]">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">Range</span>
              <span className="text-[color:var(--foreground)]">
                {formatDate(timelineStats?.firstBucket ?? null)} -{" "}
                {formatDate(timelineStats?.lastBucket ?? null)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">
                Additions
              </span>
              <span className="text-[color:var(--foreground)]">
                {formatNumber(timelineStats?.totalAdditions ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">
                Deletions
              </span>
              <span className="text-[color:var(--foreground)]">
                {formatNumber(timelineStats?.totalDeletions ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">
                Latest run
              </span>
              <span className="text-[color:var(--foreground)]">
                {summary?.latestRun?.status ?? "--"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.25s" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Hotspot map
            </h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Treemap of change concentration across the repository.
            </p>
          </div>
          <span className="chip rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Files mapped {formatNumber(sortedHotspots.length)}
          </span>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="panel-muted rounded-2xl p-4">
            {sortedHotspots.length ? (
              <div className="h-72">
                <TreemapChart data={treemapData} />
              </div>
            ) : (
              <p className="text-sm text-[color:var(--muted)]">
                Run an analysis to build the hotspot map.
              </p>
            )}
          </div>
          <div className="panel-muted grid gap-3 rounded-2xl p-4 text-sm text-[color:var(--muted)]">
            <div>
              <span className="text-xs uppercase tracking-[0.2em]">
                Focus file
              </span>
              <div className="mt-2 font-mono text-xs text-[color:var(--foreground)]">
                {topHotspot?.file_path ?? "--"}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">Score</span>
              <span className="text-[color:var(--foreground)]">
                {formatScore(topHotspot?.hotspot_score ?? null)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">
                Touches
              </span>
              <span className="text-[color:var(--foreground)]">
                {formatNumber(topHotspot?.touches ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">Churn</span>
              <span className="text-[color:var(--foreground)]">
                {formatNumber(topHotspot?.churn ?? 0)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.3s" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
            Explore reports
          </h2>
          <Link
            href="/insights"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]"
          >
            View insights
          </Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/hotspots"
            className="soft-panel report-card rounded-3xl p-5"
          >
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Hotspots
            </span>
            <h3 className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
              Churn pressure
            </h3>
            <p className="mt-2 text-xs text-[color:var(--muted)]">
              Find files absorbing the most change energy.
            </p>
          </Link>
          <Link
            href="/fragility"
            className="soft-panel report-card rounded-3xl p-5"
          >
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Fragility
            </span>
            <h3 className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
              Stability risk
            </h3>
            <p className="mt-2 text-xs text-[color:var(--muted)]">
              Spot unstable files and bug-prone zones.
            </p>
          </Link>
          <Link
            href="/ownership"
            className="soft-panel report-card rounded-3xl p-5"
          >
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Ownership
            </span>
            <h3 className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
              Knowledge map
            </h3>
            <p className="mt-2 text-xs text-[color:var(--muted)]">
              Understand concentration and bus factor risk.
            </p>
          </Link>
          <Link
            href="/complexity"
            className="soft-panel report-card rounded-3xl p-5"
          >
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Complexity
            </span>
            <h3 className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
              Structural drift
            </h3>
            <p className="mt-2 text-xs text-[color:var(--muted)]">
              Track nesting depth and code growth.
            </p>
          </Link>
        </div>
      </section>
    </>
  );
}
