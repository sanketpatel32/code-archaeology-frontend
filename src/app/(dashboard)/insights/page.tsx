"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DonutChart from "@/components/charts/DonutChart";
import { apiGet } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { useAnalysisState } from "@/lib/useAnalysisState";

type Insight = {
  category: string;
  severity: "info" | "warning" | "risk";
  message: string;
  created_at: string;
};

type Severity = "info" | "warning" | "risk";
type Tone = { label: string; bg: string; color: string };

const CATEGORY_FILTERS = ["all", "hotspot", "fragility", "bus_factor"];
const SEVERITY_FILTERS = ["all", "risk", "warning", "info"];
const SEVERITY_ORDER: Record<Severity, number> = {
  risk: 0,
  warning: 1,
  info: 2,
};

const formatCategory = (value: string) => {
  if (value === "bus_factor") {
    return "Bus factor";
  }
  return value ? `${value[0]?.toUpperCase()}${value.slice(1)}` : value;
};

const getSeverityTone = (severity: Severity): Tone => {
  if (severity === "risk") {
    return { label: "Risk", bg: "var(--risk-soft)", color: "var(--risk)" };
  }
  if (severity === "warning") {
    return {
      label: "Warning",
      bg: "var(--warning-soft)",
      color: "var(--warning)",
    };
  }
  return { label: "Info", bg: "var(--panel-soft)", color: "var(--accent)" };
};

const getCategoryTone = (category: string): Tone => {
  if (category === "hotspot") {
    return { label: "Hotspot", bg: "var(--panel-soft)", color: "var(--accent)" };
  }
  if (category === "fragility") {
    return {
      label: "Fragility",
      bg: "var(--warning-soft)",
      color: "var(--warning)",
    };
  }
  if (category === "bus_factor") {
    return {
      label: "Bus factor",
      bg: "var(--risk-soft)",
      color: "var(--risk)",
    };
  }
  return { label: "Other", bg: "var(--panel-soft)", color: "var(--muted)" };
};

export default function InsightsPage() {
  const { state } = useAnalysisState();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!state.repoId) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGet<Insight[]>(
          `/api/repositories/${state.repoId}/insights?limit=50`,
        );
        setInsights(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load insights.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [state.repoId]);

  const filteredInsights = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const base = insights.filter((insight) => {
      if (filter !== "all" && insight.category !== filter) {
        return false;
      }
      if (severityFilter !== "all" && insight.severity !== severityFilter) {
        return false;
      }
      return true;
    });
    if (!normalized) {
      return base;
    }
    return base.filter(
      (insight) =>
        insight.message.toLowerCase().includes(normalized) ||
        insight.category.toLowerCase().includes(normalized) ||
        insight.severity.toLowerCase().includes(normalized),
    );
  }, [filter, insights, query]);
  const severitySummary = useMemo(() => {
    const summary = insights.reduce(
      (acc, insight) => {
        acc[insight.severity] += 1;
        return acc;
      },
      { info: 0, warning: 0, risk: 0 },
    );
    return [
      { label: "risk", value: summary.risk, color: "var(--risk)" },
      { label: "warning", value: summary.warning, color: "var(--warning)" },
      { label: "info", value: summary.info, color: "var(--accent)" },
    ];
  }, [insights]);
  const riskShare = useMemo(() => {
    const riskCount =
      severitySummary.find((segment) => segment.label === "risk")?.value ?? 0;
    return insights.length ? Math.round((riskCount / insights.length) * 100) : 0;
  }, [insights.length, severitySummary]);
  const latestInsightDate = useMemo(() => {
    if (!insights.length) {
      return null;
    }
    const latest = insights.reduce((current, insight) =>
      new Date(insight.created_at) > new Date(current.created_at)
        ? insight
        : current,
    );
    return latest.created_at;
  }, [insights]);
  const categorySummary = useMemo(() => {
    const categories = ["hotspot", "fragility", "bus_factor"];
    const total = insights.length || 1;
    return categories.map((category) => {
      const count = insights.filter((insight) => insight.category === category)
        .length;
      const percent = (count / total) * 100;
      return { category, count, percent };
    });
  }, [insights]);
  const priorityInsights = useMemo(() => {
    const sorted = [...insights].sort((a, b) => {
      const severityDelta =
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
    return sorted.slice(0, 3);
  }, [insights]);

  if (!state.repoId) {
    return (
      <section className="soft-panel rounded-3xl p-8">
        <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">
          Insight feed
        </h2>
        <p className="mt-3 text-sm text-[color:var(--muted)]">
          Run an analysis to generate insight summaries from repository metrics.
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
          Insight feed
        </h1>
        <p className="max-w-2xl text-sm text-[color:var(--muted)]">
          Narrative summaries pulled from churn, fragility, and ownership data.
          Use these callouts as a quick briefing before diving deeper.
        </p>
      </header>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Insight control room
            </h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Prioritize by severity and focus areas before reviewing details.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            <span className="chip rounded-full px-3 py-1">
              {insights.length} insights
            </span>
            <span className="chip rounded-full px-3 py-1">
              Last update {formatDate(latestInsightDate)}
            </span>
            <span className="chip rounded-full px-3 py-1">
              Risk share {riskShare}%
            </span>
          </div>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="panel-muted rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">
                Severity mix
              </span>
              <span className="text-xs text-[color:var(--muted)]">
                Risk share {riskShare}%
              </span>
            </div>
            <div className="mt-4 grid gap-6 sm:grid-cols-[220px_1fr]">
              <DonutChart segments={severitySummary} />
              <div className="grid gap-3 text-sm text-[color:var(--muted)]">
                {severitySummary.map((segment) => {
                  const tone = getSeverityTone(segment.label as Severity);
                  return (
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
                          {tone.label}
                        </span>
                      </div>
                      <span className="text-[color:var(--foreground)]">
                        {segment.value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="panel-muted rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">
                Priority queue
              </span>
              <span className="text-xs text-[color:var(--muted)]">Top 3</span>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-[color:var(--muted)]">
              {priorityInsights.length ? (
                priorityInsights.map((insight) => {
                  const severityTone = getSeverityTone(insight.severity);
                  const categoryTone = getCategoryTone(insight.category);
                  return (
                    <div
                      key={`${insight.category}-${insight.message}`}
                      className="panel-muted rounded-2xl px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.2em]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="rounded-full px-2 py-1"
                            style={{
                              background: severityTone.bg,
                              color: severityTone.color,
                            }}
                          >
                            {severityTone.label}
                          </span>
                          <span
                            className="rounded-full px-2 py-1"
                            style={{
                              background: categoryTone.bg,
                              color: categoryTone.color,
                            }}
                          >
                            {categoryTone.label}
                          </span>
                        </div>
                        <span>{formatDate(insight.created_at)}</span>
                      </div>
                      <p className="clamp-2 mt-3 text-[color:var(--foreground)]">
                        {insight.message}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-[color:var(--muted)]">
                  No insight priorities yet.
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="panel-muted mt-6 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.2em]">
              Category coverage
            </span>
            <span className="text-xs text-[color:var(--muted)]">
              {insights.length} insights
            </span>
          </div>
          <div className="mt-4 metric-list">
            {categorySummary.map((item) => {
              const tone = getCategoryTone(item.category);
              return (
                <div className="metric-row" key={item.category}>
                  <div className="metric-label">{tone.label}</div>
                  <div className="metric-bar">
                    <span
                      className="metric-bar-fill"
                      style={{
                        width: `${item.percent}%`,
                        background: tone.color,
                      }}
                    />
                  </div>
                  <div
                    className="metric-value"
                    title={`${item.count} insights`}
                  >
                    {Math.round(item.percent)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section
        className="soft-panel reveal rounded-3xl p-6"
        style={{ animationDelay: "0.2s" }}
      >
        <div className="toolbar">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              Latest insights
            </h2>
            <span className="toolbar-meta">
              {filteredInsights.length} results
            </span>
          </div>
          <div className="toolbar-group">
            <div className="toggle-group">
              {SEVERITY_FILTERS.map((level) => (
                <button
                  key={level}
                  className={`toggle-button ${
                    severityFilter === level ? "toggle-active" : ""
                  }`}
                  type="button"
                  onClick={() => setSeverityFilter(level)}
                >
                  {level === "all" ? "All" : level}
                </button>
              ))}
            </div>
            <input
              className="input-field rounded-full px-3 py-2 text-xs"
              placeholder="Search insights"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="input-field rounded-full px-3 py-2 text-xs"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              {CATEGORY_FILTERS.map((label) => (
                <option key={label} value={label}>
                  {label === "all" ? "All categories" : formatCategory(label)}
                </option>
              ))}
            </select>
            <button
              className="toolbar-button"
              type="button"
              onClick={() =>
                downloadCsv(
                  "insights.csv",
                  filteredInsights.map((insight) => ({
                    category: insight.category,
                    severity: insight.severity,
                    message: insight.message,
                    created_at: insight.created_at,
                  })),
                )
              }
            >
              Export CSV
            </button>
          </div>
        </div>

        {error ? (
          <div className="alert-error mt-4 rounded-xl px-3 py-2 text-xs">
            {error}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {filteredInsights.length ? (
            filteredInsights.map((insight) => {
              const severityTone = getSeverityTone(insight.severity);
              const categoryTone = getCategoryTone(insight.category);
              return (
                <div
                  key={`${insight.category}-${insight.message}`}
                  className="panel-muted rounded-2xl p-4 text-sm text-[color:var(--muted)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full px-2 py-1"
                        style={{
                          background: severityTone.bg,
                          color: severityTone.color,
                        }}
                      >
                        {severityTone.label}
                      </span>
                      <span
                        className="rounded-full px-2 py-1"
                        style={{
                          background: categoryTone.bg,
                          color: categoryTone.color,
                        }}
                      >
                        {categoryTone.label}
                      </span>
                    </div>
                    <span>{formatDate(insight.created_at)}</span>
                  </div>
                  <p className="clamp-2 mt-3 text-[color:var(--foreground)]">
                    {insight.message}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-[color:var(--muted)]">
              {loading ? "Loading insights..." : "No insights available."}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
