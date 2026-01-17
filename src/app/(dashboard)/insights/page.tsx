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

const CATEGORY_LABELS = ["all", "hotspot", "fragility", "bus_factor"];

export default function InsightsPage() {
  const { state } = useAnalysisState();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
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
    const base =
      filter === "all"
        ? insights
        : insights.filter((insight) => insight.category === filter);
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
      { label: "info", value: summary.info, color: "var(--accent)" },
      { label: "warning", value: summary.warning, color: "var(--warning)" },
      { label: "risk", value: summary.risk, color: "var(--risk)" },
    ];
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
          <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
            Signal mix
          </h2>
          <span className="text-xs text-[color:var(--muted)]">
            {insights.length} insights
          </span>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-[220px_1fr]">
          <DonutChart segments={severitySummary} />
          <div className="grid gap-3 text-sm text-[color:var(--muted)]">
            {severitySummary.map((segment) => (
              <div
                key={segment.label}
                className="panel-muted flex items-center justify-between rounded-2xl px-4 py-3"
              >
                <span className="text-xs uppercase tracking-[0.2em]">
                  {segment.label}
                </span>
                <span className="text-[color:var(--foreground)]">
                  {segment.value}
                </span>
              </div>
            ))}
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
              {CATEGORY_LABELS.map((label) => (
                <option key={label} value={label}>
                  {label}
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
            filteredInsights.map((insight) => (
              <div
                key={`${insight.category}-${insight.message}`}
                className="panel-muted rounded-2xl p-4 text-sm text-[color:var(--muted)]"
              >
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  <span>
                    {insight.category} - {insight.severity}
                  </span>
                  <span>{formatDate(insight.created_at)}</span>
                </div>
                <p className="mt-3 text-[color:var(--foreground)]">
                  {insight.message}
                </p>
              </div>
            ))
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
