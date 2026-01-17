"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatRepoLabel } from "@/lib/analysisStorage";
import { useAnalysisRun } from "@/lib/useAnalysisRun";
import { useAnalysisState } from "@/lib/useAnalysisState";

const NAV_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/structure", label: "Structure" },
  { href: "/timeline", label: "Timeline" },
  { href: "/commits", label: "Commits" },
  { href: "/hotspots", label: "Hotspots" },
  { href: "/fragility", label: "Fragility" },
  { href: "/ownership", label: "Ownership" },
  { href: "/complexity", label: "Complexity" },
  { href: "/insights", label: "Insights" },
  { href: "/help", label: "Help" },
];

export default function DashboardNav() {
  const pathname = usePathname();
  const { state } = useAnalysisState();
  const { statusTone } = useAnalysisRun(state.runId);
  const repoLabel = formatRepoLabel(state.repoUrl);
  const runLabel = state.runId ? state.runId.slice(0, 10) : "--";

  return (
    <nav className="nav-shell">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="brand-mark flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold">
            CA
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-[color:var(--muted)]">
              Code Archaeology
            </div>
            <div className="text-sm text-[color:var(--foreground)]">
              Git history risk atlas
            </div>
          </div>
        </Link>
        {repoLabel ? (
          <span className="chip rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
            Repo: {repoLabel}
          </span>
        ) : null}
      </div>
      <div className="nav-links">
        {NAV_LINKS.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${isActive ? "nav-link-active" : ""}`}
            >
              {link.label}
            </Link>
          );
        })}
        <Tooltip.Provider delayDuration={150}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <span
                className={`status-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusTone.className}`}
              >
                {statusTone.label}
              </span>
            </Tooltip.Trigger>
            <Tooltip.Content className="tooltip-content" sideOffset={8}>
              <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Analysis status
              </div>
              <div className="mt-2 flex items-center justify-between gap-6 text-xs">
                <span className="text-[color:var(--muted)]">Run</span>
                <span className="font-mono text-[color:var(--foreground)]">
                  {runLabel}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-6 text-xs">
                <span className="text-[color:var(--muted)]">Repo</span>
                <span className="text-[color:var(--foreground)]">
                  {repoLabel ?? "--"}
                </span>
              </div>
              <Tooltip.Arrow className="tooltip-arrow" />
            </Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>
    </nav>
  );
}
