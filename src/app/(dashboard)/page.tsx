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

type ActivityFocus = "commits" | "churn";

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

type Tone = { label: string; bg: string; color: string };

const toMetricValue = (value: number | string | null | undefined) => {
  const numeric =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatFileName = (path: string | null | undefined) => {
  if (!path) {
    return "--";
  }
  const name = path.split("/").slice(-1)[0];
  return name || path;
};

const getRiskTone = (score: number): Tone => {
  if (score >= 85) {
    return { label: "Critical", bg: "var(--risk-soft)", color: "var(--risk)" };
  }
  if (score >= 70) {
    return {
      label: "High",
      bg: "var(--warning-soft)",
      color: "var(--warning)",
    };
  }
  if (score >= 50) {
    return { label: "Guarded", bg: "var(--panel-soft)", color: "var(--muted)" };
  }
  return { label: "Stable", bg: "var(--signal-soft)", color: "var(--signal)" };
};

const getTempoTone = (value: number): Tone => {
  if (value >= 20) {
    return { label: "High", bg: "var(--signal-soft)", color: "var(--signal)" };
  }
  if (value >= 8) {
    return { label: "Steady", bg: "var(--panel-soft)", color: "var(--accent)" };
  }
  return { label: "Low", bg: "var(--warning-soft)", color: "var(--warning)" };
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
  const [activityFocus, setActivityFocus] =
    useState<ActivityFocus>("commits");

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
  const riskIndex = useMemo(
    () => Math.round(toMetricValue(topHotspot?.hotspot_score ?? 0) * 100),
    [topHotspot],
  );
  const riskTone = useMemo(
    () =>
      topHotspot
        ? getRiskTone(riskIndex)
        : { label: "Pending", bg: "var(--panel-soft)", color: "var(--muted)" },
    [riskIndex, topHotspot],
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
    const totalCommits = timeline.reduce(
      (sum, row) => sum + (row.commit_count || 0),
      0,
    );
    const averageCommits = totalCommits / timeline.length;
    const averageChurn = totalChurn / timeline.length;
    const peakCommit = timeline.reduce(
      (peak, row) =>
        row.commit_count > peak.value
          ? { bucket: row.bucket, value: row.commit_count }
          : peak,
      {
        bucket: timeline[0]?.bucket ?? "",
        value: timeline[0]?.commit_count ?? 0,
      },
    );
    const peakChurn = timeline.reduce(
      (peak, row) => {
        const churn = (row.additions || 0) + (row.deletions || 0);
        return churn > peak.value ? { bucket: row.bucket, value: churn } : peak;
      },
      {
        bucket: timeline[0]?.bucket ?? "",
        value:
          (timeline[0]?.additions || 0) + (timeline[0]?.deletions || 0) || 0,
      },
    );
    const firstBucket = timeline[0]?.bucket ?? null;
    const lastBucket = timeline[timeline.length - 1]?.bucket ?? null;

    return {
      totalAdditions,
      totalDeletions,
      totalChurn,
      totalCommits,
      averageCommits,
      averageChurn,
      peakCommit,
      peakChurn,
      firstBucket,
      lastBucket,
    };
  }, [timeline]);

  const activityPulse = useMemo(() => {
    const window = timeline.slice(-6);
    return window.map((row) => ({
      label: formatDate(row.bucket),
      value:
        activityFocus === "churn"
          ? (row.additions || 0) + (row.deletions || 0)
          : row.commit_count,
    }));
  }, [timeline, activityFocus]);

  const activityPulseMax = useMemo(
    () => activityPulse.reduce((max, row) => Math.max(max, row.value), 0),
    [activityPulse],
  );

  const latestActivity = useMemo(() => {
    const latest = timeline[timeline.length - 1];
    if (!latest) {
      return null;
    }
    return activityFocus === "churn"
      ? (latest.additions || 0) + (latest.deletions || 0)
      : latest.commit_count;
  }, [timeline, activityFocus]);

  const focusAverage =
    activityFocus === "churn"
      ? timelineStats?.averageChurn ?? null
      : timelineStats?.averageCommits ?? null;
  const focusPeak =
    activityFocus === "churn"
      ? timelineStats?.peakChurn ?? null
      : timelineStats?.peakCommit ?? null;
  const focusLabel = activityFocus === "churn" ? "Churn" : "Commits";
  const tempoTone = useMemo(() => {
    if (!timelineStats?.averageCommits) {
      return null;
    }
    return getTempoTone(timelineStats.averageCommits);
  }, [timelineStats?.averageCommits]);
  const churnPerCommit =
    summary?.counts.commit_count && timelineStats?.totalChurn
      ? timelineStats.totalChurn / summary.counts.commit_count
      : null;
  const executiveHighlights = useMemo(
    () => [
      {
        label: "Repository scale",
        value: summary
          ? `${formatNumber(summary.counts.file_count)} files`
          : "--",
        meta: summary?.repository.default_branch
          ? `Branch ${summary.repository.default_branch}`
          : "Branch --",
      },
      {
        label: "Change activity",
        value: timelineStats
          ? `${formatNumber(timelineStats.totalChurn)} churn`
          : "--",
        meta: summary
          ? `${formatNumber(summary.counts.commit_count)} commits`
          : "--",
      },
      {
        label: "Primary hotspot",
        value: topHotspot ? formatFileName(topHotspot.file_path) : "--",
        meta: topHotspot
          ? `Score ${formatScore(topHotspot.hotspot_score)}`
          : "No hotspot data",
        title: topHotspot?.file_path ?? undefined,
      },
    ],
    [summary, timelineStats, topHotspot],
  );
  const riskWatchlist = useMemo(
    () =>
      sortedHotspots.slice(0, 3).map((row) => {
        const score = Math.round(toMetricValue(row.hotspot_score) * 100);
        return {
          file: row.file_path,
          name: formatFileName(row.file_path),
          score,
          tone: getRiskTone(score),
        };
      }),
    [sortedHotspots],
  );

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
            <span className="chip rounded-full px-3 py-1">Executive</span>
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
              Executive repository overview
            </h1>
            <div className="grid gap-3 border-l border-[color:var(--border)] pl-4">
              <p className="max-w-xl text-sm text-[color:var(--muted)]">
                Track delivery tempo, risk exposure, and structural drift with
                a decision-ready summary.
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
              <div className="flex items-center justify-between">
                <span className="stat-label">Delivery tempo</span>
                {tempoTone ? (
                  <span
                    className="rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.2em]"
                    style={{
                      background: tempoTone.bg,
                      color: tempoTone.color,
                    }}
                  >
                    {tempoTone.label}
                  </span>
                ) : null}
              </div>
              <span className="stat-value">
                {timelineStats?.averageCommits
                  ? formatNumber(Math.round(timelineStats.averageCommits))
                  : "--"}
              </span>
              <span className="stat-meta">Avg commits per week</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Change load</span>
              <span className="stat-value">
                {timelineStats ? formatNumber(timelineStats.totalChurn) : "--"}
              </span>
              <span className="stat-meta">
                {churnPerCommit !== null
                  ? `${formatNumber(Math.round(churnPerCommit))} churn/commit`
                  : "Churn per commit"}
              </span>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <span className="stat-label">Risk index</span>
                <span
                  className="rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.2em]"
                  style={{
                    background: riskTone.bg,
                    color: riskTone.color,
                  }}
                >
                  {riskTone.label}
                </span>
              </div>
              <span className="stat-value">
                {topHotspot ? formatNumber(riskIndex) : "--"}
              </span>
              <span className="stat-meta">
                Top hotspot score{" "}
                {topHotspot ? formatScore(topHotspot.hotspot_score) : "--"}
              </span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="panel-muted rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em]">
                  Executive brief
                </span>
                <span className="text-xs text-[color:var(--muted)]">
                  Latest snapshot
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-[color:var(--muted)]">
                {executiveHighlights.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                        {item.label}
                      </div>
                      <div
                        className="truncate-1 mt-1 text-sm text-[color:var(--foreground)]"
                        title={item.title}
                      >
                        {item.value}
                      </div>
                    </div>
                    <div className="text-xs text-[color:var(--muted)]">
                      {item.meta}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel-muted rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em]">
                  Risk watchlist
                </span>
                <span className="text-xs text-[color:var(--muted)]">Top 3</span>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-[color:var(--muted)]">
                {riskWatchlist.length ? (
                  riskWatchlist.map((item) => (
                    <div
                      key={item.file}
                      className="flex items-center justify-between gap-3"
                    >
                      <div>
                        <div
                          className="truncate-1 text-sm text-[color:var(--foreground)]"
                          title={item.file}
                        >
                          {item.name}
                        </div>
                        <div className="text-xs text-[color:var(--muted)]">
                          Score {item.score}
                        </div>
                      </div>
                      <span
                        className="rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.2em]"
                        style={{
                          background: item.tone.bg,
                          color: item.tone.color,
                        }}
                      >
                        {item.tone.label}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[color:var(--muted)]">
                    Run an analysis to build a risk list.
                  </p>
                )}
              </div>
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
                Action center
              </h2>
              <p className="mt-2 text-xs text-[color:var(--muted)]">
                Launch a fresh scan and record the latest signal.
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
          <div className="flex flex-wrap items-center gap-3">
            <div className="toggle-group">
              <button
                className={`toggle-button ${
                  activityFocus === "commits" ? "toggle-active" : ""
                }`}
                type="button"
                aria-pressed={activityFocus === "commits"}
                onClick={() => setActivityFocus("commits")}
              >
                Commits
              </button>
              <button
                className={`toggle-button ${
                  activityFocus === "churn" ? "toggle-active" : ""
                }`}
                type="button"
                aria-pressed={activityFocus === "churn"}
                onClick={() => setActivityFocus("churn")}
              >
                Churn
              </button>
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
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_0.8fr]">
          <div className="panel-muted rounded-2xl p-4">
            {timeline.length ? (
              <>
                <div
                  className={`h-64 ${
                    activityFocus === "churn"
                      ? "activity-focus-churn"
                      : "activity-focus-commits"
                  }`}
                >
                  <TimelineChart data={timeline} />
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: "var(--accent)" }}
                    />
                    Commits
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: "var(--signal)" }}
                    />
                    Churn
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-[color:var(--muted)]">
                Timeline data will appear after analysis completes.
              </p>
            )}
          </div>
          <div className="panel-muted grid gap-4 rounded-2xl p-4 text-sm text-[color:var(--muted)]">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">Range</span>
              <span className="text-[color:var(--foreground)]">
                {formatDate(timelineStats?.firstBucket ?? null)} -{" "}
                {formatDate(timelineStats?.lastBucket ?? null)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">
                Latest week
              </span>
              <span className="text-[color:var(--foreground)]">
                {latestActivity === null
                  ? "--"
                  : formatNumber(latestActivity)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">
                Avg weekly {focusLabel.toLowerCase()}
              </span>
              <span className="text-[color:var(--foreground)]">
                {focusAverage === null ? "--" : formatNumber(focusAverage)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">
                Peak {focusLabel.toLowerCase()}
              </span>
              <span
                className="text-[color:var(--foreground)]"
                title={focusPeak ? formatDate(focusPeak.bucket) : undefined}
              >
                {focusPeak ? formatNumber(focusPeak.value) : "--"}
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
            <div>
              <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Recent pulse
              </span>
              <div className="mt-3 metric-list">
                {activityPulse.length ? (
                  activityPulse.map((row) => {
                    const width = activityPulseMax
                      ? Math.min((row.value / activityPulseMax) * 100, 100)
                      : 0;
                    return (
                      <div className="metric-row" key={row.label}>
                        <div className="metric-label">{row.label}</div>
                        <div className="metric-bar">
                          <span
                            className="metric-bar-fill"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <div className="metric-value">
                          {formatNumber(row.value)}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-[color:var(--muted)]">
                    No recent activity yet.
                  </p>
                )}
              </div>
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
              <div
                className="truncate-1 mt-2 font-mono text-xs text-[color:var(--foreground)]"
                title={topHotspot?.file_path ?? ""}
              >
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
