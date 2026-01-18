"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();

  const [repoUrl, setRepoUrl] = useState(state.repoUrl ?? "");
  const [branch, setBranch] = useState(state.branch ?? "");
  const [maxCommits, setMaxCommits] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityFocus, setActivityFocus] =
    useState<ActivityFocus>("commits");
  const [focusPath, setFocusPath] = useState<string | null>(null);

  const repoLabel = formatRepoLabel(state.repoUrl);

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
    if (state.repoId) {
      setFocusPath(null);
    }
  }, [state.repoId]);

  const metricsEnabled = Boolean(state.repoId && run?.status === "succeeded");
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useQuery({
    queryKey: ["summary", state.repoId],
    queryFn: () =>
      apiGet<SummaryResponse>(`/api/repositories/${state.repoId}/summary`),
    enabled: metricsEnabled,
    placeholderData: (previous) => previous ?? null,
  });

  const {
    data: hotspots = [],
    isLoading: hotspotsLoading,
    error: hotspotsError,
  } = useQuery({
    queryKey: ["hotspots", state.repoId, 70],
    queryFn: () =>
      apiGet<Hotspot[]>(`/api/repositories/${state.repoId}/hotspots?limit=70`),
    enabled: metricsEnabled,
    placeholderData: (previous) => previous ?? [],
  });

  const {
    data: timeline = [],
    isLoading: timelineLoading,
    error: timelineError,
  } = useQuery({
    queryKey: ["timeline", state.repoId],
    queryFn: () =>
      apiGet<TimelineBucket[]>(`/api/repositories/${state.repoId}/timeline`),
    enabled: metricsEnabled,
    placeholderData: (previous) => previous ?? [],
  });

  const metricsError =
    summaryError || hotspotsError || timelineError || runError;
  const metricsLoading = summaryLoading || hotspotsLoading || timelineLoading;
  const metricsErrorMessage =
    metricsError instanceof Error
      ? metricsError.message
      : metricsError
        ? "Unable to load metrics."
        : null;
  const sortedHotspots = useMemo(
    () =>
      [...hotspots].sort(
        (a, b) =>
          toMetricValue(b.hotspot_score) - toMetricValue(a.hotspot_score),
      ),
    [hotspots],
  );
  const topHotspot = sortedHotspots[0];
  const focusedHotspot = useMemo(() => {
    if (focusPath) {
      return sortedHotspots.find((row) => row.file_path === focusPath) ?? null;
    }
    return topHotspot ?? null;
  }, [focusPath, sortedHotspots, topHotspot]);
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    if (state.repoId) {
      queryClient.removeQueries({ queryKey: ["summary", state.repoId] });
      queryClient.removeQueries({ queryKey: ["hotspots", state.repoId] });
      queryClient.removeQueries({ queryKey: ["timeline", state.repoId] });
    }

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
      <header className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="reveal flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            <span className="chip rounded-full px-3 py-1">
              {repoLabel ?? "No repo selected"}
            </span>
            <span
              className={`status-chip inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusTone.className}`}
            >
              {statusTone.label}
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-[color:var(--foreground)] sm:text-4xl">
              Repository overview
            </h1>
            <p className="text-sm text-[color:var(--muted)]">
              Track delivery tempo, risk exposure, and structural drift.
            </p>
          </div>

          <div className="panel-muted rounded-2xl p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  <span>Delivery tempo</span>
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
                <div className="text-2xl font-semibold text-[color:var(--foreground)]">
                  {timelineStats?.averageCommits
                    ? formatNumber(Math.round(timelineStats.averageCommits))
                    : "--"}
                </div>
                <div className="text-xs text-[color:var(--muted)]">
                  Avg commits / week
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Change load
                </div>
                <div className="text-2xl font-semibold text-[color:var(--foreground)]">
                  {timelineStats ? formatNumber(timelineStats.totalChurn) : "--"}
                </div>
                <div className="text-xs text-[color:var(--muted)]">
                  {churnPerCommit !== null
                    ? `${formatNumber(Math.round(churnPerCommit))} churn/commit`
                    : "Churn per commit"}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  <span>Risk index</span>
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
                <div className="text-2xl font-semibold text-[color:var(--foreground)]">
                  {topHotspot ? formatNumber(riskIndex) : "--"}
                </div>
                <div className="text-xs text-[color:var(--muted)]">
                  Top hotspot score{" "}
                  {topHotspot ? formatScore(topHotspot.hotspot_score) : "--"}
                </div>
              </div>
            </div>
          </div>

          <div className="panel-muted rounded-2xl px-4 py-3 text-xs text-[color:var(--muted)]">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">
                Run status
              </span>
              <span
                className={`status-chip inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusTone.className}`}
              >
                {statusTone.label}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.2em]">
              <span className="chip rounded-full px-3 py-1">
                Run {state.runId ? state.runId.slice(0, 8) : "--"}
              </span>
              <span className="chip rounded-full px-3 py-1">
                Repo {state.repoId ? state.repoId.slice(0, 8) : "--"}
              </span>
            </div>
          </div>
        </div>

        <section
          className="soft-panel reveal rounded-3xl p-5"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
                Action center
              </h2>
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                Launch a fresh scan and refresh the signal.
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
            <details className="panel-muted rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]">
              <summary className="cursor-pointer text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Advanced options
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
            </details>
            <button
              className="button-primary mt-1 inline-flex items-center justify-center rounded-2xl px-6 py-3 text-base font-semibold"
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

          {metricsErrorMessage || error ? (
            <div className="alert-error mt-4 rounded-xl px-3 py-2 text-xs">
              {metricsErrorMessage ?? error}
            </div>
          ) : null}
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
                className={`toggle-button ${activityFocus === "commits" ? "toggle-active" : ""
                  }`}
                type="button"
                aria-pressed={activityFocus === "commits"}
                onClick={() => setActivityFocus("commits")}
              >
                Commits
              </button>
              <button
                className={`toggle-button ${activityFocus === "churn" ? "toggle-active" : ""
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
                  className={`h-64 ${activityFocus === "churn"
                    ? "activity-focus-churn"
                    : "activity-focus-commits"
                    }`}
                >
                  <TimelineChart data={timeline} focus={activityFocus} />
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {activityFocus !== "churn" ? (
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: "var(--accent)" }}
                      />
                      Commits
                    </span>
                  ) : null}
                  {activityFocus !== "commits" ? (
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: "var(--signal)" }}
                      />
                      Churn
                    </span>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-sm text-[color:var(--muted)]">
                {metricsLoading
                  ? "Loading timeline..."
                  : "Timeline data will appear after analysis completes."}
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
                  <TreemapChart
                    data={treemapData}
                    selectedPath={focusPath}
                    onSelect={(path) =>
                      setFocusPath((prev) => (prev === path ? null : path))
                    }
                  />
                </div>
              ) : (
                <p className="text-sm text-[color:var(--muted)]">
                  {metricsLoading
                    ? "Loading hotspot map..."
                    : "Run an analysis to build the hotspot map."}
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
                  title={focusedHotspot?.file_path ?? ""}
                >
                  {focusedHotspot?.file_path ?? "--"}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em]">Score</span>
                <span className="text-[color:var(--foreground)]">
                  {formatScore(focusedHotspot?.hotspot_score ?? null)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em]">
                  Touches
                </span>
                <span className="text-[color:var(--foreground)]">
                  {formatNumber(focusedHotspot?.touches ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em]">Churn</span>
                <span className="text-[color:var(--foreground)]">
                  {formatNumber(focusedHotspot?.churn ?? 0)}
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
