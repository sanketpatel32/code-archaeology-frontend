"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";

export type AnalysisRun = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
};

export type StatusTone = {
  label: string;
  className: string;
};

export function useAnalysisRun(runId: string | null, pollMs = 3000) {
  const { data: run, error } = useQuery({
    queryKey: ["analysis-run", runId],
    queryFn: () => apiGet<AnalysisRun>(`/api/analysis/${runId}`),
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "succeeded" || status === "failed") {
        return false;
      }
      return pollMs;
    },
  });

  const errorMessage = useMemo(() => {
    if (run?.status === "failed") {
      return run.error_message || "Analysis failed.";
    }
    if (error instanceof Error) {
      return error.message;
    }
    if (error) {
      return "Unable to poll status.";
    }
    return null;
  }, [error, run]);

  const statusTone = useMemo<StatusTone>(() => {
    if (!run) {
      return {
        label: "idle",
        className: "status-idle",
      };
    }
    if (run.status === "queued") {
      return {
        label: "queued",
        className: "status-queued",
      };
    }
    if (run.status === "running") {
      return {
        label: "analyzing",
        className: "status-running",
      };
    }
    if (run.status === "succeeded") {
      return {
        label: "complete",
        className: "status-succeeded",
      };
    }
    return {
      label: "failed",
      className: "status-failed",
    };
  }, [run]);

  return { run: run ?? null, error: errorMessage, statusTone };
}
