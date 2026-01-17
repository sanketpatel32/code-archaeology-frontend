"use client";

import { useMemo, useState } from "react";

type GlossaryItem = {
  term: string;
  definition: string;
};

type Section = {
  title: string;
  description: string;
  icon: string;
  items: GlossaryItem[];
};

const SECTIONS: Section[] = [
  {
    title: "Core",
    description: "Base terms used across the product.",
    icon: "◆",
    items: [
      { term: "Repository", definition: "The Git repository being analyzed." },
      { term: "Analysis run", definition: "A single scan of a repository at a point in time." },
      { term: "Run status", definition: "Current state of the scan: queued, running, succeeded, or failed." },
      { term: "Repository URL", definition: "The Git remote address used to clone or fetch the repo." },
      { term: "Branch", definition: "The branch used as the main source of commit history." },
      { term: "Max commits", definition: "Upper limit on how many commits are ingested per run." },
    ],
  },
  {
    title: "Activity",
    description: "Timeline and cadence metrics.",
    icon: "◈",
    items: [
      { term: "Timeline bucket", definition: "A weekly time window that groups commits for charts." },
      { term: "Commits", definition: "Number of Git commits in a time window or branch." },
      { term: "Additions", definition: "Lines added in the selected window." },
      { term: "Deletions", definition: "Lines removed in the selected window." },
      { term: "Churn", definition: "Additions plus deletions. A proxy for change volume." },
      { term: "Churn per commit", definition: "Average line change volume per commit." },
      { term: "Momentum", definition: "Recent activity change versus the prior window." },
      { term: "Branch activity", definition: "Weekly commit volume per branch to compare focus areas." },
    ],
  },
  {
    title: "Hotspots",
    description: "Where change is concentrated and risk signals appear.",
    icon: "◉",
    items: [
      { term: "Touches", definition: "Count of commits that modified a file." },
      { term: "Hotspot score", definition: "Weighted score from touches and churn (0 to 1)." },
      { term: "Hotspot map", definition: "Treemap view of files sized by change concentration." },
      { term: "Risk index", definition: "Top hotspot score scaled to a 0 to 100 index." },
      { term: "Risk watchlist", definition: "Most change-heavy files with elevated scores." },
      { term: "Fragility index", definition: "Normalized blend of recent activity and bugfix ratio (0 to 1)." },
      { term: "Bugfix ratio", definition: "Share of touches that were classified as fixes." },
    ],
  },
  {
    title: "Ownership",
    description: "Who owns the knowledge and how concentrated it is.",
    icon: "◎",
    items: [
      { term: "Ownership share", definition: "Percent of touches attributed to the top contributor." },
      { term: "Bus factor", definition: "Risk signal when a small group owns most changes." },
    ],
  },
  {
    title: "Complexity",
    description: "Structural signals derived from static analysis.",
    icon: "◇",
    items: [
      { term: "Functions", definition: "Function or method count in a file snapshot." },
      { term: "Conditionals", definition: "If, switch, or ternary branching count." },
      { term: "Max nesting", definition: "Deepest control flow nesting depth." },
      { term: "Lines", definition: "Total line count recorded in the snapshot." },
    ],
  },
  {
    title: "Taxonomy",
    description: "Conventional Commit types used for classification.",
    icon: "◌",
    items: [
      { term: "feat", definition: "A new feature." },
      { term: "fix", definition: "A bug fix." },
      { term: "docs", definition: "Documentation only changes." },
      { term: "style", definition: "Formatting or linting changes." },
      { term: "refactor", definition: "Code change without behavior change." },
      { term: "perf", definition: "Performance improvement." },
      { term: "test", definition: "Adding or adjusting tests." },
      { term: "build", definition: "Build system or dependency updates." },
      { term: "ci", definition: "CI pipeline or workflow changes." },
      { term: "revert", definition: "Reverting a previous commit." },
      { term: "chore", definition: "Maintenance tasks or tooling." },
      { term: "unknown", definition: "No clear classification detected." },
    ],
  },
];

export default function HelpPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredSections = useMemo(() => {
    let sections = SECTIONS;

    if (activeCategory) {
      sections = sections.filter((s) => s.title === activeCategory);
    }

    const query = search.toLowerCase().trim();
    if (!query) {
      return sections;
    }

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.term.toLowerCase().includes(query) ||
            item.definition.toLowerCase().includes(query),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [search, activeCategory]);

  const totalTerms = SECTIONS.reduce((sum, s) => sum + s.items.length, 0);
  const totalMatches = filteredSections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <>
      <header className="reveal">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-[color:var(--foreground)]">
              Glossary
            </h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {totalTerms} terms across {SECTIONS.length} categories
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              className="input-field w-56 rounded-full px-4 py-2 text-sm outline-none"
              placeholder="Search terms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                onClick={() => setSearch("")}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={`toggle-button ${!activeCategory ? "toggle-active" : ""}`}
            onClick={() => setActiveCategory(null)}
          >
            All
          </button>
          {SECTIONS.map((section) => (
            <button
              key={section.title}
              type="button"
              className={`toggle-button ${activeCategory === section.title ? "toggle-active" : ""}`}
              onClick={() =>
                setActiveCategory(activeCategory === section.title ? null : section.title)
              }
            >
              <span className="mr-1 opacity-60">{section.icon}</span>
              {section.title}
            </button>
          ))}
        </div>
      </header>

      {search && (
        <div className="text-xs text-[color:var(--muted)]">
          Showing {totalMatches} {totalMatches === 1 ? "result" : "results"}
          {activeCategory ? ` in ${activeCategory}` : ""}
        </div>
      )}

      {filteredSections.length === 0 ? (
        <div className="soft-panel reveal rounded-2xl p-8 text-center">
          <div className="text-2xl">🔍</div>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            No terms match "{search}"
          </p>
          <button
            type="button"
            className="mt-3 text-xs text-[color:var(--accent)] hover:underline"
            onClick={() => {
              setSearch("");
              setActiveCategory(null);
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="reveal grid gap-4" style={{ animationDelay: "0.1s" }}>
          {filteredSections.map((section) => (
            <section key={section.title} className="soft-panel rounded-2xl p-5">
              <div className="flex items-center gap-3 border-b border-[color:var(--border)] pb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--accent)] text-sm text-white">
                  {section.icon}
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-[color:var(--foreground)]">
                    {section.title}
                  </h2>
                  <p className="text-xs text-[color:var(--muted)]">
                    {section.description}
                  </p>
                </div>
                <span className="ml-auto text-xs text-[color:var(--muted)]">
                  {section.items.length} terms
                </span>
              </div>
              <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.map((item) => (
                  <div
                    key={item.term}
                    className="group rounded-lg p-2 transition-colors hover:bg-[color:var(--panel-soft)]"
                  >
                    <div className="text-sm font-medium text-[color:var(--foreground)]">
                      {item.term}
                    </div>
                    <div className="mt-0.5 text-xs text-[color:var(--muted)]">
                      {item.definition}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
