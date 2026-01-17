"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BarChart from "@/components/charts/BarChart";
import TimelineChart from "@/components/charts/TimelineChart";
import { apiGet } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import { useAnalysisState } from "@/lib/useAnalysisState";

type TimelineBucket = {
  bucket: string;
  commit_count: number;
  additions: number;
  deletions: number;
};

type ClassificationBucket = {
  bucket: string;
  feat: number;
  fix: number;
  docs: number;
  style: number;
  refactor: number;
  perf: number;
  test: number;
  build: number;
  ci: number;
  revert: number;
  chore: number;
  unknown: number;
};

type BranchTimeline = {
  name: string;
  totalCommits: number;
  weeks: Array<{ bucket: string; commit_count: number }>;
};

type BranchTimelineResponse = {
  range: { start: string; end: string };
  branches: BranchTimeline[];
};

type PulseMetric = "commits" | "churn" | "additions" | "deletions";
type ClassificationMetric =
  | "feat"
  | "fix"
  | "docs"
  | "style"
  | "refactor"
  | "perf"
  | "test"
  | "build"
  | "ci"
  | "revert"
  | "chore"
  | "unknown";
type Tone = { label: string; bg: string; color: string };

const CLASSIFICATION_LABELS: Record<ClassificationMetric, string> = {
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

const CLASSIFICATION_COLORS: Record<ClassificationMetric, string> = {
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

const getMomentumTone = (delta: number | null): Tone => {
  if (delta === null) {
    return { label: "New", bg: "var(--panel-soft)", color: "var(--muted)" };
  }
  if (delta >= 0.15) {
    return { label: "Accelerating", bg: "var(--signal-soft)", color: "var(--signal)" };
  }
  if (delta <= -0.15) {
    return { label: "Cooling", bg: "var(--warning-soft)", color: "var(--warning)" };
  }
  return { label: "Steady", bg: "var(--panel-soft)", color: "var(--accent)" };
};

export default function TimelinePage() {
  const { state } = useAnalysisState();
  const [timeline, setTimeline] = useState<TimelineBucket[]>([]);
  const [classification, setClassification] = useState<ClassificationBucket[]>(
    [],
  );
  const [branchTimeline, setBranchTimeline] = useState<BranchTimeline[]>([]);
  const [branchRange, setBranchRange] = useState<BranchTimelineResponse["range"] | null>(null);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pulseMetric, setPulseMetric] = useState<PulseMetric>("commits");
  const [classificationMetric, setClassificationMetric] =
    useState<ClassificationMetric>("feat");
  const [branchFocus, setBranchFocus] = useState<string>("");

  useEffect(() => {
    if (!branchTimeline.length) {
      return;
    }
    if (!branchTimeline.find((branch) => branch.name === branchFocus)) {
      setBranchFocus(branchTimeline[0]?.name ?? "");
    }
  }, [branchTimeline, branchFocus]);

  useEffect(() => {
    if (!state.repoId) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [timelineData, classificationData] = await Promise.all([
          apiGet<TimelineBucket[]>(
            `/api/repositories/${state.repoId}/timeline`,
          ),
          apiGet<ClassificationBucket[]>(
            `/api/repositories/${state.repoId}/timeline-classification`,
          ),
        ]);
        setTimeline(timelineData);
        setClassification(classificationData);
        try {
          const branchData = await apiGet<BranchTimelineResponse>(
            `/api/repositories/${state.repoId}/timeline-branches?weeks=24&limit=6`,
          );
          setBranchTimeline(branchData.branches);
          setBranchRange(branchData.range);
          setBranchFocus((current) => current || branchData.branches[0]?.name || "");
          setBranchError(null);
        } catch (branchErr) {
          setBranchTimeline([]);
          setBranchRange(null);
          setBranchError(
            branchErr instanceof Error
              ? branchErr.message
              : "Unable to load branch activity.",
          );
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load timeline.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
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
    const quietWeek = timeline.reduce(
      (quiet, row) =>
        row.commit_count < quiet.value
          ? { bucket: row.bucket, value: row.commit_count }
          : quiet,
      {
        bucket: timeline[0]?.bucket ?? "",
        value: timeline[0]?.commit_count ?? 0,
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
      quietWeek,
      firstBucket,
      lastBucket,
    };
  }, [timeline]);

  const momentum = useMemo(() => {
    if (timeline.length < 2) {
      return { delta: null, recentAvg: 0, prevAvg: 0 };
    }
    const recent = timeline.slice(-6);
    const previous = timeline.slice(-12, -6);
    const recentAvg =
      recent.reduce((sum, row) => sum + row.commit_count, 0) /
      Math.max(recent.length, 1);
    const prevAvg =
      previous.reduce((sum, row) => sum + row.commit_count, 0) /
      Math.max(previous.length, 1);
    if (prevAvg === 0) {
      return { delta: null, recentAvg, prevAvg };
    }
    return { delta: (recentAvg - prevAvg) / prevAvg, recentAvg, prevAvg };
  }, [timeline]);

  const momentumTone = useMemo(
    () => getMomentumTone(momentum.delta),
    [momentum.delta],
  );

  const pulseData = useMemo(() => {
    return timeline.slice(-12).map((row) => ({
      label: formatDate(row.bucket),
      value:
        pulseMetric === "churn"
          ? (row.additions || 0) + (row.deletions || 0)
          : pulseMetric === "additions"
            ? row.additions || 0
            : pulseMetric === "deletions"
              ? row.deletions || 0
              : row.commit_count,
      title: formatDate(row.bucket),
    }));
  }, [timeline, pulseMetric]);

  const classificationSummary = useMemo(() => {
    if (!classification.length) {
      return [];
    }
    const totals = classification.reduce(
      (acc, row) => ({
        feat: acc.feat + row.feat,
        fix: acc.fix + row.fix,
        docs: acc.docs + row.docs,
        style: acc.style + row.style,
        refactor: acc.refactor + row.refactor,
        perf: acc.perf + row.perf,
        test: acc.test + row.test,
        build: acc.build + row.build,
        ci: acc.ci + row.ci,
        revert: acc.revert + row.revert,
        chore: acc.chore + row.chore,
        unknown: acc.unknown + row.unknown,
      }),
      {
        feat: 0,
        fix: 0,
        docs: 0,
        style: 0,
        refactor: 0,
        perf: 0,
        test: 0,
        build: 0,
        ci: 0,
        revert: 0,
        chore: 0,
        unknown: 0,
      },
    );
    const totalCount = Object.values(totals).reduce(
      (sum, value) => sum + value,
      0,
    );
    return (Object.keys(totals) as ClassificationMetric[])
      .map((key) => {
        const count = totals[key];
        const percent = totalCount ? (count / totalCount) * 100 : 0;
        return { key, count, percent };
      })
      .sort((a, b) => b.count - a.count);
  }, [classification]);

  const classificationTrend = useMemo(() => {
    return classification.slice(-12).map((row) => ({
      label: formatDate(row.bucket),
      value: row[classificationMetric] ?? 0,
      title: formatDate(row.bucket),
    }));
  }, [classification, classificationMetric]);

  const activeClassification = useMemo(
    () =>
      classificationSummary.find((item) => item.key === classificationMetric) ??
      null,
    [classificationSummary, classificationMetric],
  );

  const latestClassification = useMemo(() => {
    if (!classification.length) {
      return null;
    }
    const last = classification[classification.length - 1];
    return last ? last[classificationMetric] ?? 0 : null;
  }, [classification, classificationMetric]);

  const averageClassification = useMemo(() => {
    if (!classificationTrend.length) {
      return null;
    }
    const total = classificationTrend.reduce(
      (sum, row) => sum + row.value,
      0,
    );
    return total / classificationTrend.length;
  }, [classificationTrend]);

  const activeBranch = useMemo(() => {
    if (!branchTimeline.length) {
      return null;
    }
    return (
      branchTimeline.find((branch) => branch.name === branchFocus) ??
      branchTimeline[0]
    );
  }, [branchTimeline, branchFocus]);

  const branchChartData = useMemo(() => {
    if (!activeBranch) {
      return [];
    }
    return activeBranch.weeks.map((row) => ({
      label: formatDate(row.bucket),
      value: row.commit_count,
      title: formatDate(row.bucket),
    }));
  }, [activeBranch]);

  const branchStats = useMemo(() => {
    if (!activeBranch) {
      return null;
    }
    const total = activeBranch.totalCommits;
    const weeks = activeBranch.weeks.length || 1;
    const average = total / weeks;
    const peak = activeBranch.weeks.reduce(
      (best, row) =>
        row.commit_count > best.value
          ? { bucket: row.bucket, value: row.commit_count }
          : best,
      {
        bucket: activeBranch.weeks[0]?.bucket ?? "",
        value: activeBranch.weeks[0]?.commit_count ?? 0,
      },
    );
    return { total, average, peak };
  }, [activeBranch]);

  if (!state.repoId) {
    return (
      <section className="soft-panel rounded-3xl p-8">
        <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">
          Timeline lens
        </h2>
        <p className="mt-3 text-sm text-[color:var(--muted)]">
          Run an analysis to build a weekly timeline of commits and churn.
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
          Timeline lens
        </h1>
        <p className="max-w-2xl text-sm text-[color:var(--muted)]">
          Visualize delivery tempo and churn cycles across weekly buckets. Use
          the momentum view to spot acceleration or slowdowns.
        </p>
      </header>

      <section
        className="reveal grid gap-6 lg:grid-cols-4"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="stat-card">
          <span className="stat-label">Total commits</span>
          <span className="stat-value">
            {timelineStats ? formatNumber(timelineStats.totalCommits) : "--"}
          </span>
          <span className="stat-meta">
            Avg{" "}
            {timelineStats
              ? formatNumber(Math.round(timelineStats.averageCommits))
              : "--"}{" "}
            per week
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total churn</span>
          <span className="stat-value">
            {timelineStats ? formatNumber(timelineStats.totalChurn) : "--"}
          </span>
          <span className="stat-meta">
            Avg{" "}
            {timelineStats
              ? formatNumber(Math.round(timelineStats.averageChurn))
              : "--"}{" "}
            per week
          </span>
          <span className="stat-meta">
            Adds {formatNumber(timelineStats?.totalAdditions ?? 0)} / Deletes{" "}
            {formatNumber(timelineStats?.totalDeletions ?? 0)}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active weeks</span>
          <span className="stat-value">{formatNumber(timeline.length)}</span>
          <span className="stat-meta">
            {formatDate(timelineStats?.firstBucket ?? null)} -{" "}
            {formatDate(timelineStats?.lastBucket ?? null)}
          </span>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Momentum</span>
            <span
              className="rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.2em]"
              style={{ background: momentumTone.bg, color: momentumTone.color }}
            >
              {momentumTone.label}
            </span>
          </div>
          <span className="stat-value">
            {momentum.delta === null
              ? "--"
              : `${Math.round(momentum.delta * 100)}%`}
          </span>
          <span className="stat-meta">Recent vs prior 6 weeks</span>
        </div>
      </section>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.2s" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Weekly rhythm
            </h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Hover the chart to see exact commit and churn volumes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            <span className="chip rounded-full px-3 py-1">
              Peak commits {formatNumber(timelineStats?.peakCommit.value ?? 0)}
            </span>
            <span className="chip rounded-full px-3 py-1">
              Peak churn {formatNumber(timelineStats?.peakChurn.value ?? 0)}
            </span>
          </div>
        </div>
        {timeline.length ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_0.7fr]">
            <div className="panel-muted rounded-2xl p-4">
              <div className="h-72">
                <TimelineChart data={timeline} />
              </div>
            </div>
            <div className="grid gap-4">
              <div className="panel-muted rounded-2xl p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Peak week
                </div>
                <div className="mt-2 text-sm text-[color:var(--foreground)]">
                  {formatDate(timelineStats?.peakCommit.bucket ?? null)}
                </div>
                <div className="mt-3 grid gap-2 text-xs text-[color:var(--muted)]">
                  <div className="flex items-center justify-between">
                    <span>Commits</span>
                    <span className="text-[color:var(--foreground)]">
                      {formatNumber(timelineStats?.peakCommit.value ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Churn</span>
                    <span className="text-[color:var(--foreground)]">
                      {formatNumber(timelineStats?.peakChurn.value ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="panel-muted rounded-2xl p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Quiet week
                </div>
                <div className="mt-2 text-sm text-[color:var(--foreground)]">
                  {formatDate(timelineStats?.quietWeek.bucket ?? null)}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-[color:var(--muted)]">
                  <span>Commits</span>
                  <span className="text-[color:var(--foreground)]">
                    {formatNumber(timelineStats?.quietWeek.value ?? 0)}
                  </span>
                </div>
              </div>
              {error ? (
                <div className="alert-error rounded-xl px-3 py-2 text-xs">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[color:var(--muted)]">
            {loading ? "Loading timeline..." : "No timeline data yet."}
          </p>
        )}
      </section>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.25s" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Branch activity
            </h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Compare weekly commit volume across the most active branches.
            </p>
          </div>
          <div className="toggle-group">
            {branchTimeline.map((branch) => (
              <button
                key={branch.name}
                className={`toggle-button max-w-[160px] truncate-1 ${
                  branchFocus === branch.name ? "toggle-active" : ""
                }`}
                type="button"
                onClick={() => setBranchFocus(branch.name)}
                title={branch.name}
              >
                {branch.name}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="panel-muted rounded-2xl p-4">
            {branchChartData.length ? (
              <div className="h-56">
                <BarChart
                  data={branchChartData}
                  color="var(--accent)"
                  formatValue={(value) => formatNumber(value)}
                />
              </div>
            ) : (
              <p className="text-sm text-[color:var(--muted)]">
                {loading
                  ? "Loading branch activity..."
                  : "No branch activity available."}
              </p>
            )}
          </div>
          <div className="panel-muted rounded-2xl p-4 text-sm text-[color:var(--muted)]">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">Range</span>
              <span className="text-[color:var(--foreground)]">
                {formatDate(branchRange?.start ?? null)} -{" "}
                {formatDate(branchRange?.end ?? null)}
              </span>
            </div>
            <div className="mt-4 grid gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span>Total commits</span>
                <span className="text-[color:var(--foreground)]">
                  {branchStats ? formatNumber(branchStats.total) : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Avg per week</span>
                <span className="text-[color:var(--foreground)]">
                  {branchStats
                    ? formatNumber(Math.round(branchStats.average))
                    : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Peak week</span>
                <span
                  className="text-[color:var(--foreground)]"
                  title={branchStats ? formatDate(branchStats.peak.bucket) : undefined}
                >
                  {branchStats ? formatNumber(branchStats.peak.value) : "--"}
                </span>
              </div>
              {branchError ? (
                <div className="alert-error rounded-xl px-3 py-2 text-xs">
                  {branchError}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.3s" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Pulse explorer
            </h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Focus on commits, churn, or line movement for the latest pulse.
            </p>
          </div>
          <div className="toggle-group">
            <button
              className={`toggle-button ${
                pulseMetric === "commits" ? "toggle-active" : ""
              }`}
              type="button"
              onClick={() => setPulseMetric("commits")}
            >
              Commits
            </button>
            <button
              className={`toggle-button ${
                pulseMetric === "churn" ? "toggle-active" : ""
              }`}
              type="button"
              onClick={() => setPulseMetric("churn")}
            >
              Churn
            </button>
            <button
              className={`toggle-button ${
                pulseMetric === "additions" ? "toggle-active" : ""
              }`}
              type="button"
              onClick={() => setPulseMetric("additions")}
            >
              Additions
            </button>
            <button
              className={`toggle-button ${
                pulseMetric === "deletions" ? "toggle-active" : ""
              }`}
              type="button"
              onClick={() => setPulseMetric("deletions")}
            >
              Deletions
            </button>
          </div>
        </div>
        {pulseData.length ? (
          <div className="mt-4 h-56">
            <BarChart
              data={pulseData}
              color="var(--accent)"
              formatValue={(value) => formatNumber(value)}
            />
          </div>
        ) : (
          <p className="mt-4 text-sm text-[color:var(--muted)]">
            {loading ? "Loading pulse data..." : "No pulse data available."}
          </p>
        )}
      </section>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.35s" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Change taxonomy
            </h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Track Conventional Commit types across the weekly timeline.
            </p>
          </div>
          <div className="toggle-group">
            {(Object.keys(CLASSIFICATION_LABELS) as ClassificationMetric[]).map(
              (key) => (
                <button
                  key={key}
                  className={`toggle-button ${
                    classificationMetric === key ? "toggle-active" : ""
                  }`}
                  type="button"
                  onClick={() => setClassificationMetric(key)}
                >
                  {CLASSIFICATION_LABELS[key]}
                </button>
              ),
            )}
          </div>
        </div>
        <div className="mt-5 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="panel-muted rounded-2xl p-4 flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] pb-3 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              <span>Type trend</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip rounded-full px-3 py-1">
                  {CLASSIFICATION_LABELS[classificationMetric]}
                </span>
                <span className="chip rounded-full px-3 py-1">
                  Latest {formatNumber(latestClassification ?? 0)}
                </span>
                <span className="chip rounded-full px-3 py-1">
                  Avg{" "}
                  {averageClassification !== null
                    ? formatNumber(Math.round(averageClassification))
                    : "--"}
                </span>
              </div>
            </div>
            {classificationTrend.length ? (
              <div className="flex flex-1 pt-4 min-h-[220px]">
                <div className="h-full w-full">
                  <BarChart
                    data={classificationTrend}
                    color={CLASSIFICATION_COLORS[classificationMetric]}
                    formatValue={(value) => formatNumber(value)}
                  />
                </div>
              </div>
            ) : (
              <p className="pt-4 text-sm text-[color:var(--muted)]">
                {loading
                  ? "Loading classification timeline..."
                  : "No classification data yet."}
              </p>
            )}
          </div>
          <div className="panel-muted rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">
                Distribution
              </span>
              <span className="text-xs text-[color:var(--muted)]">
                {classificationSummary.length} types
              </span>
            </div>
            <div className="mt-3 text-xs text-[color:var(--muted)]">
              {activeClassification
                ? `${CLASSIFICATION_LABELS[activeClassification.key]} holds ${Math.round(
                    activeClassification.percent,
                  )}% (${formatNumber(activeClassification.count)} commits)`
                : "Select a type to see its distribution share."}
            </div>
            <div className="mt-4 metric-list">
              {classificationSummary.map((item) => (
                <div className="metric-row" key={item.key}>
                  <div className="metric-label">
                    {CLASSIFICATION_LABELS[item.key]}
                  </div>
                  <div className="metric-bar">
                    <span
                      className="metric-bar-fill"
                      style={{
                        width: `${item.percent}%`,
                        background: CLASSIFICATION_COLORS[item.key],
                      }}
                    />
                  </div>
                  <div
                    className="metric-value"
                    title={`${item.count} commits`}
                  >
                    {Math.round(item.percent)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
