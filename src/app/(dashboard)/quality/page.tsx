"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import BarChart from "@/components/charts/BarChart";
import DonutChart from "@/components/charts/DonutChart";
import { apiGet, apiPost } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatNumber } from "@/lib/format";
import { useAnalysisState } from "@/lib/useAnalysisState";

type QualityRun = {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed";
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  files_analyzed: number | null;
  lines_analyzed: number | null;
  quality_grade: string | null;
  error_message?: string | null;
  duration_seconds?: number | null;
};

type QualityCounts = {
  total?: number;
  bugs?: number;
  security_issues?: number;
  code_smells?: number;
  performance?: number;
  info?: number;
  warning?: number;
  error?: number;
};

type QualitySummary = {
  run?: QualityRun | null;
  counts?: QualityCounts;
  languages?: string[];
  severity_matrix?: QualitySeverityMatrix[];
  top_rules?: QualityRuleSummary[];
  top_files?: QualityFileStat[];
};

type QualityFinding = {
  file_path: string;
  line_start: number;
  line_end: number | null;
  rule_id: string;
  severity: "info" | "warning" | "error";
  category: "bug" | "security" | "code_smell" | "performance";
  message: string;
  language?: string | null;
};

type QualityFileStat = {
  file_path: string;
  language?: string | null;
  lines_of_code?: number | null;
  findings_count: number;
  bugs: number;
  security_issues: number;
  code_smells: number;
};

type QualitySeverityMatrix = {
  category: "bug" | "security" | "code_smell" | "performance";
  error: number;
  warning: number;
  info: number;
};

type QualityRuleSummary = {
  rule_id: string;
  count: number;
};

type SummaryResponse = QualitySummary | { summary: QualitySummary };
type FindingsResponse = QualityFinding[] | { findings: QualityFinding[] };
type FilesResponse = QualityFileStat[] | { files: QualityFileStat[] };

const CATEGORY_FILTERS = ["all", "security", "bug", "code_smell", "performance"];
const SEVERITY_FILTERS = ["all", "error", "warning", "info"];

const formatCategory = (value: string) => {
  if (value === "code_smell") return "Code smell";
  if (value === "security") return "Security";
  if (value === "performance") return "Performance";
  if (value === "bug") return "Bug";
  return value;
};

const formatSeverity = (value: string) => {
  if (value === "error") return "Error";
  if (value === "warning") return "Warning";
  if (value === "info") return "Info";
  return value;
};

const getGradeTone = (grade: string | null | undefined) => {
  const upper = (grade ?? "").toUpperCase();
  if (upper === "A") {
    return { bg: "var(--signal-soft)", color: "var(--signal)" };
  }
  if (upper === "B") {
    return { bg: "var(--panel-soft)", color: "var(--accent)" };
  }
  if (upper === "C") {
    return { bg: "var(--warning-soft)", color: "var(--warning)" };
  }
  return { bg: "var(--risk-soft)", color: "var(--risk)" };
};

const getStatusTone = (status: string | null | undefined) => {
  if (!status || status === "pending") {
    return { label: "idle", className: "status-idle" };
  }
  if (status === "running") {
    return { label: "running", className: "status-running" };
  }
  if (status === "succeeded") {
    return { label: "complete", className: "status-succeeded" };
  }
  return { label: "failed", className: "status-failed" };
};

const SEVERITY_COLORS: Record<string, string> = {
  error: "var(--risk)",
  warning: "var(--warning)",
  info: "var(--accent)",
};

export default function QualityPage() {
  const { state } = useAnalysisState();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [limit, setLimit] = useState(50);
  const [triggering, setTriggering] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: summaryPayload,
    error: summaryError,
  } = useQuery({
    queryKey: ["quality-summary", state.repoId],
    queryFn: () =>
      apiGet<SummaryResponse>(`/api/repositories/${state.repoId}/quality`),
    enabled: Boolean(state.repoId),
    placeholderData: (previous) => previous,
  });

  const {
    data: findingsPayload,
    isLoading: findingsLoading,
    isFetching: findingsFetching,
    error: findingsError,
  } = useQuery({
    queryKey: ["quality-findings", state.repoId, 120],
    queryFn: () =>
      apiGet<FindingsResponse>(
        `/api/repositories/${state.repoId}/quality/findings?limit=120`,
      ),
    enabled: Boolean(state.repoId),
    placeholderData: (previous) => previous ?? [],
  });

  const {
    data: filesPayload,
    isLoading: filesLoading,
    isFetching: filesFetching,
    error: filesError,
  } = useQuery({
    queryKey: ["quality-files", state.repoId, 20],
    queryFn: () =>
      apiGet<FilesResponse>(
        `/api/repositories/${state.repoId}/quality/files?limit=20`,
      ),
    enabled: Boolean(state.repoId),
    placeholderData: (previous) => previous ?? [],
  });

  const summary: QualitySummary | undefined =
    summaryPayload && typeof summaryPayload === "object" && "summary" in summaryPayload
      ? (summaryPayload as { summary: QualitySummary }).summary
      : (summaryPayload as QualitySummary | undefined);

  const findings = useMemo(() => {
    if (Array.isArray(findingsPayload)) {
      return findingsPayload;
    }
    return findingsPayload?.findings ?? [];
  }, [findingsPayload]);

  const fileStats = useMemo(() => {
    if (Array.isArray(filesPayload)) {
      return filesPayload;
    }
    return filesPayload?.files ?? [];
  }, [filesPayload]);

  const filteredFindings = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return findings.filter((finding) => {
      if (categoryFilter !== "all" && finding.category !== categoryFilter) {
        return false;
      }
      if (severityFilter !== "all" && finding.severity !== severityFilter) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return (
        finding.file_path.toLowerCase().includes(normalized) ||
        finding.message.toLowerCase().includes(normalized) ||
        finding.rule_id.toLowerCase().includes(normalized)
      );
    });
  }, [categoryFilter, findings, query, severityFilter]);

  const displayedFindings = useMemo(
    () => filteredFindings.slice(0, limit),
    [filteredFindings, limit],
  );

  const counts = useMemo((): QualityCounts => {
    if (summary?.counts) {
      return summary.counts;
    }
    const totals: Required<QualityCounts> = {
      total: findings.length,
      bugs: 0,
      security_issues: 0,
      code_smells: 0,
      performance: 0,
      info: 0,
      warning: 0,
      error: 0,
    };
    for (const finding of findings) {
      if (finding.category === "bug") totals.bugs += 1;
      if (finding.category === "security") totals.security_issues += 1;
      if (finding.category === "code_smell") totals.code_smells += 1;
      if (finding.category === "performance") totals.performance += 1;
      if (finding.severity === "info") totals.info += 1;
      if (finding.severity === "warning") totals.warning += 1;
      if (finding.severity === "error") totals.error += 1;
    }
    return totals;
  }, [findings, summary?.counts]);

  const severityMatrix = useMemo(() => {
    if (summary?.severity_matrix?.length) {
      return summary.severity_matrix;
    }
    const matrix = new Map<
      string,
      {
        category: "bug" | "security" | "code_smell" | "performance";
        error: number;
        warning: number;
        info: number;
      }
    >();
    for (const finding of findings) {
      const entry = matrix.get(finding.category) ?? {
        category: finding.category,
        error: 0,
        warning: 0,
        info: 0,
      };
      if (finding.severity === "error") entry.error += 1;
      if (finding.severity === "warning") entry.warning += 1;
      if (finding.severity === "info") entry.info += 1;
      matrix.set(finding.category, entry);
    }
    return Array.from(matrix.values());
  }, [findings, summary?.severity_matrix]);

  const topRules = useMemo(() => {
    if (summary?.top_rules?.length) {
      return summary.top_rules;
    }
    const ruleMap = new Map<string, number>();
    for (const finding of findings) {
      ruleMap.set(finding.rule_id, (ruleMap.get(finding.rule_id) ?? 0) + 1);
    }
    return Array.from(ruleMap.entries())
      .map(([rule_id, count]) => ({ rule_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [findings, summary?.top_rules]);

  const categorySegments = useMemo(
    () => [
      {
        label: "security",
        value: counts.security_issues ?? 0,
        color: "var(--warning)",
      },
      { label: "bug", value: counts.bugs ?? 0, color: "var(--risk)" },
      {
        label: "code smell",
        value: counts.code_smells ?? 0,
        color: "var(--accent)",
      },
      {
        label: "performance",
        value: counts.performance ?? 0,
        color: "var(--signal)",
      },
    ],
    [counts],
  );

  const severityBars = useMemo(
    () => [
      { label: "Error", value: counts.error ?? 0, title: "Errors" },
      { label: "Warning", value: counts.warning ?? 0, title: "Warnings" },
      { label: "Info", value: counts.info ?? 0, title: "Info" },
    ],
    [counts],
  );

  const totalFindings = counts.total ?? findings.length;
  const rankedFiles = useMemo(
    () =>
      [...fileStats].sort((a, b) => b.findings_count - a.findings_count),
    [fileStats],
  );
  const maxFileFindings = rankedFiles[0]?.findings_count ?? 0;
  const run = summary?.run ?? null;
  const languages = summary?.languages ?? [];
  const findingsPerKloc = useMemo(() => {
    const lines = run?.lines_analyzed ?? 0;
    if (!lines) {
      return null;
    }
    const kloc = lines / 1000;
    return kloc > 0 ? Math.round((totalFindings / kloc) * 10) / 10 : null;
  }, [run?.lines_analyzed, totalFindings]);
  const statusTone = getStatusTone(run?.status ?? null);
  const gradeTone = getGradeTone(run?.quality_grade);

  const summaryErrorMessage =
    summaryError instanceof Error
      ? summaryError.message
      : summaryError
        ? "Unable to load quality summary."
        : null;
  const findingsErrorMessage =
    findingsError instanceof Error
      ? findingsError.message
      : findingsError
        ? "Unable to load findings."
        : null;
  const filesErrorMessage =
    filesError instanceof Error
      ? filesError.message
      : filesError
        ? "Unable to load file stats."
        : null;

  const handleRunQuality = async () => {
    if (!state.repoId) {
      return;
    }
    setTriggering(true);
    setActionError(null);
    try {
      await apiPost(`/api/repositories/${state.repoId}/quality/run`, {});
      queryClient.invalidateQueries({
        queryKey: ["quality-summary", state.repoId],
      });
      queryClient.invalidateQueries({
        queryKey: ["quality-findings", state.repoId],
      });
      queryClient.invalidateQueries({
        queryKey: ["quality-files", state.repoId],
      });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to start quality scan.",
      );
    } finally {
      setTriggering(false);
    }
  };

  if (!state.repoId) {
    return (
      <section className="soft-panel rounded-3xl p-8">
        <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">
          Code quality analysis
        </h2>
        <p className="mt-3 text-sm text-[color:var(--muted)]">
          Run an analysis to scan for bugs, security issues, and code smells.
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
          Code quality analysis
        </h1>
        <p className="max-w-2xl text-sm text-[color:var(--muted)]">
          Static checks grouped by severity and category. Use this page to
          prioritize high-risk findings and track quality grade drift over
          time.
        </p>
      </header>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Quality baseline
            </h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Latest scan snapshot and grade.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`status-chip inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusTone.className}`}
            >
              {statusTone.label}
            </span>
            <button
              className="toolbar-button"
              type="button"
              onClick={handleRunQuality}
              disabled={triggering}
            >
              {triggering ? "Starting..." : "Run quality scan"}
            </button>
          </div>
        </div>

        {(summaryErrorMessage || actionError) && (
          <div className="alert-error mt-4 rounded-xl px-3 py-2 text-xs">
            {summaryErrorMessage ?? actionError}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="panel-muted rounded-2xl p-5">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              <span>Quality grade</span>
              <span className="chip rounded-full px-3 py-1">
                {run?.completed_at ? formatDate(run.completed_at) : "--"}
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-3">
              <span
                className="text-5xl font-semibold"
                style={{ color: gradeTone.color }}
              >
                {run?.quality_grade ?? "--"}
              </span>
              <span
                className="rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]"
                style={{ background: gradeTone.bg, color: gradeTone.color }}
              >
                {run?.quality_grade ? "Grade" : "Pending"}
              </span>
            </div>
            <div className="mt-5 grid gap-2 text-xs text-[color:var(--muted)]">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <span className="text-[color:var(--foreground)]">
                  {run?.status ?? "idle"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Created</span>
                <span className="text-[color:var(--foreground)]">
                  {formatDate(run?.created_at ?? null)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Started</span>
                <span className="text-[color:var(--foreground)]">
                  {formatDate(run?.started_at ?? null)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Completed</span>
                <span className="text-[color:var(--foreground)]">
                  {formatDate(run?.completed_at ?? null)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Duration</span>
                <span className="text-[color:var(--foreground)]">
                  {run?.duration_seconds
                    ? `${run.duration_seconds}s`
                    : "--"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="stat-card">
              <span className="stat-label">Total findings</span>
              <span className="stat-value">
                {formatNumber(totalFindings)}
              </span>
              <span className="stat-meta">Signals in this scan</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Error findings</span>
              <span className="stat-value">
                {formatNumber(counts.error ?? 0)}
              </span>
              <span className="stat-meta">Highest priority fixes</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Warning findings</span>
              <span className="stat-value">
                {formatNumber(counts.warning ?? 0)}
              </span>
              <span className="stat-meta">Important follow-ups</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Files analyzed</span>
              <span className="stat-value">
                {formatNumber(run?.files_analyzed ?? rankedFiles.length)}
              </span>
              <span className="stat-meta">Unique files flagged</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Lines analyzed</span>
              <span className="stat-value">
                {formatNumber(run?.lines_analyzed ?? 0)}
              </span>
              <span className="stat-meta">Total lines scanned</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Findings / KLOC</span>
              <span className="stat-value">
                {findingsPerKloc === null ? "--" : findingsPerKloc}
              </span>
              <span className="stat-meta">Normalized density</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {(languages.length ? languages : ["No languages detected"]).map(
            (language: string) => (
              <span key={language} className="chip rounded-full px-3 py-1">
                {language}
              </span>
            ),
          )}
        </div>
      </section>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.2s" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Findings distribution
            </h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Category mix and severity pressure.
            </p>
          </div>
          <span className="text-xs text-[color:var(--muted)]">
            {formatNumber(totalFindings)} findings
          </span>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="panel-muted rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">
                Category mix
              </span>
              <span className="text-xs text-[color:var(--muted)]">
                {formatNumber(totalFindings)} items
              </span>
            </div>
            <div className="mt-4 grid gap-6 sm:grid-cols-[220px_1fr]">
              <DonutChart segments={categorySegments} />
              <div className="grid gap-3 text-sm text-[color:var(--muted)]">
                {categorySegments.map((segment) => (
                  <div
                    key={segment.label}
                    className="panel-muted flex items-center justify-between rounded-2xl px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: segment.color }}
                      />
                      <span className="text-xs uppercase tracking-[0.2em]">
                        {formatCategory(segment.label)}
                      </span>
                    </div>
                    <span className="text-[color:var(--foreground)]">
                      {formatNumber(segment.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="panel-muted rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">
                Severity pressure
              </span>
              <span className="text-xs text-[color:var(--muted)]">
                {formatNumber(counts.error ?? 0)} critical
              </span>
            </div>
            <div className="mt-4 h-56">
              <BarChart data={severityBars} color="var(--accent)" />
            </div>
            <div className="mt-4 metric-list">
              {severityBars.map((bar) => (
                <div className="metric-row" key={bar.label}>
                  <div className="metric-label">{bar.label}</div>
                  <div className="metric-bar">
                    <span
                      className="metric-bar-fill"
                      style={{
                        width: `${totalFindings
                            ? Math.min((bar.value / totalFindings) * 100, 100)
                            : 0
                          }%`,
                      }}
                    />
                  </div>
                  <div className="metric-value">{formatNumber(bar.value)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {filesErrorMessage ? (
          <div className="alert-error mt-4 rounded-xl px-3 py-2 text-xs">
            {filesErrorMessage}
          </div>
        ) : null}
      </section>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.25s" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Detailed signals
            </h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Severity mix by category and recurring rules.
            </p>
          </div>
          <span className="text-xs text-[color:var(--muted)]">
            {formatNumber(totalFindings)} total
          </span>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="panel-muted rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">
                Severity by category
              </span>
              <span className="text-xs text-[color:var(--muted)]">
                {formatNumber(severityMatrix.length)} groups
              </span>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-[color:var(--muted)]">
              {severityMatrix.length ? (
                severityMatrix.map((row) => {
                  const total = row.error + row.warning + row.info;
                  const errorShare = total ? (row.error / total) * 100 : 0;
                  const warningShare = total ? (row.warning / total) * 100 : 0;
                  const infoShare = total ? (row.info / total) * 100 : 0;
                  return (
                    <div
                      key={row.category}
                      className="panel-muted rounded-2xl px-4 py-3"
                    >
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em]">
                        <span>{formatCategory(row.category)}</span>
                        <span className="text-[color:var(--foreground)]">
                          {formatNumber(total)}
                        </span>
                      </div>
                      <div className="mt-3 flex h-2 overflow-hidden rounded-full border border-[color:var(--border)]">
                        <span
                          style={{
                            width: `${errorShare}%`,
                            background: SEVERITY_COLORS.error,
                          }}
                        />
                        <span
                          style={{
                            width: `${warningShare}%`,
                            background: SEVERITY_COLORS.warning,
                          }}
                        />
                        <span
                          style={{
                            width: `${infoShare}%`,
                            background: SEVERITY_COLORS.info,
                          }}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                        <span className="chip rounded-full px-3 py-1">
                          Error {formatNumber(row.error)}
                        </span>
                        <span className="chip rounded-full px-3 py-1">
                          Warning {formatNumber(row.warning)}
                        </span>
                        <span className="chip rounded-full px-3 py-1">
                          Info {formatNumber(row.info)}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-[color:var(--muted)]">
                  No category breakdown yet.
                </p>
              )}
            </div>
          </div>
          <div className="panel-muted rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">
                Top recurring rules
              </span>
              <span className="text-xs text-[color:var(--muted)]">
                Top {formatNumber(topRules.length)}
              </span>
            </div>
            <div className="mt-4 metric-list">
              {topRules.length ? (
                topRules.map((rule) => {
                  const width = topRules[0]?.count
                    ? Math.min((rule.count / topRules[0].count) * 100, 100)
                    : 0;
                  return (
                    <div className="metric-row" key={rule.rule_id}>
                      <div className="metric-label" title={rule.rule_id}>
                        {rule.rule_id}
                      </div>
                      <div className="metric-bar">
                        <span
                          className="metric-bar-fill"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <div className="metric-value">
                        {formatNumber(rule.count)}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-[color:var(--muted)]">
                  No rules detected yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.3s" }}
      >
        <div className="toolbar">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Top problem files
            </h2>
            <span className="toolbar-meta">
              {formatNumber(rankedFiles.length)} files
            </span>
          </div>
          <div className="toolbar-group">
            <button
              className="toolbar-button"
              type="button"
              onClick={() =>
                downloadCsv(
                  "quality-files.csv",
                  rankedFiles.map((file) => ({
                    file_path: file.file_path,
                    findings_count: file.findings_count,
                    bugs: file.bugs,
                    security_issues: file.security_issues,
                    code_smells: file.code_smells,
                    lines_of_code: file.lines_of_code ?? "",
                    language: file.language ?? "",
                  })),
                )
              }
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          {rankedFiles.length ? (
            rankedFiles.map((file) => {
              const riskWidth = maxFileFindings
                ? Math.min(
                    (file.findings_count / maxFileFindings) * 100,
                    100,
                  )
                : 0;
              const kloc = file.lines_of_code
                ? file.lines_of_code / 1000
                : null;
              const density =
                kloc && kloc > 0
                  ? Math.round((file.findings_count / kloc) * 10) / 10
                  : null;
              return (
                <div
                  key={file.file_path}
                  className="panel-muted rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-[180px]">
                      <div
                        className="truncate-1 font-mono text-xs text-[color:var(--foreground)]"
                        title={file.file_path}
                      >
                        {file.file_path}
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-[0.2em]">
                        {file.language ?? "Unknown language"}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em]">
                      <span className="chip rounded-full px-3 py-1">
                        Total {formatNumber(file.findings_count)}
                      </span>
                      <span className="chip rounded-full px-3 py-1">
                        Bugs {formatNumber(file.bugs)}
                      </span>
                      <span className="chip rounded-full px-3 py-1">
                        Security {formatNumber(file.security_issues)}
                      </span>
                      <span className="chip rounded-full px-3 py-1">
                        LOC {formatNumber(file.lines_of_code ?? 0)}
                      </span>
                      <span className="chip rounded-full px-3 py-1">
                        {density === null ? "Density --" : `Density ${density}`}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 metric-bar">
                    <span
                      className="metric-bar-fill"
                      style={{ width: `${riskWidth}%`, background: "var(--risk)" }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-[color:var(--muted)]">
              {filesLoading || filesFetching
                ? "Loading file stats..."
                : "No file stats yet."}
            </p>
          )}
        </div>
      </section>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.35s" }}
      >
        <div className="toolbar">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Findings log
            </h2>
            <span className="toolbar-meta">
              {formatNumber(filteredFindings.length)} signals
            </span>
          </div>
          <div className="toolbar-group">
            <div className="toggle-group">
              {SEVERITY_FILTERS.map((level) => (
                <button
                  key={level}
                  className={`toggle-button ${severityFilter === level ? "toggle-active" : ""
                    }`}
                  type="button"
                  onClick={() => setSeverityFilter(level)}
                >
                  {level === "all" ? "All" : formatSeverity(level)}
                </button>
              ))}
            </div>
            <select
              className="input-field rounded-full px-3 py-2 text-xs"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              {CATEGORY_FILTERS.map((label) => (
                <option key={label} value={label}>
                  {label === "all" ? "All categories" : formatCategory(label)}
                </option>
              ))}
            </select>
            <input
              className="input-field rounded-full px-3 py-2 text-xs"
              placeholder="Search file or rule"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="input-field rounded-full px-3 py-2 text-xs"
              value={limit}
              onChange={(event) =>
                setLimit(Number.parseInt(event.target.value, 10))
              }
            >
              <option value={25}>Show 25</option>
              <option value={50}>Show 50</option>
              <option value={100}>Show 100</option>
            </select>
            <button
              className="toolbar-button"
              type="button"
              onClick={() =>
                downloadCsv(
                  "quality-findings.csv",
                  filteredFindings.map((finding) => ({
                    file_path: finding.file_path,
                    line_start: finding.line_start,
                    line_end: finding.line_end,
                    rule_id: finding.rule_id,
                    severity: finding.severity,
                    category: finding.category,
                    message: finding.message,
                    language: finding.language ?? "",
                  })),
                )
              }
            >
              Export CSV
            </button>
          </div>
        </div>

        {findingsErrorMessage ? (
          <div className="alert-error mt-4 rounded-xl px-3 py-2 text-xs">
            {findingsErrorMessage}
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-[color:var(--muted)]">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-[0.2em]">
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Line</th>
                <th className="px-3 py-2">Rule</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Language</th>
                <th className="px-3 py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {displayedFindings.length ? (
                displayedFindings.map((finding) => (
                  <tr
                    key={`${finding.file_path}-${finding.rule_id}-${finding.line_start}`}
                    className="border-b border-[color:var(--border)]/60"
                  >
                    <td className="px-3 py-3 font-mono text-xs text-[color:var(--foreground)]">
                      <span
                        className="table-cell-truncate truncate-1"
                        title={finding.file_path}
                      >
                        {finding.file_path}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {finding.line_start}
                      {finding.line_end ? `-${finding.line_end}` : ""}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">
                      {finding.rule_id}
                    </td>
                    <td className="px-3 py-3">
                      {formatSeverity(finding.severity)}
                    </td>
                    <td className="px-3 py-3">
                      {formatCategory(finding.category)}
                    </td>
                    <td className="px-3 py-3">
                      {finding.language ?? "--"}
                    </td>
                    <td className="px-3 py-3">
                      <span className="truncate-1" title={finding.message}>
                        {finding.message}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-3 py-6 text-sm text-[color:var(--muted)]"
                    colSpan={7}
                  >
                    {findingsLoading || findingsFetching
                      ? "Loading findings..."
                      : "No findings available."}
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
