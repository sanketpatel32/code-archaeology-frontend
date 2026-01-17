"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [run, setRun] = useState<AnalysisRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setRun(null);
      setError(null);
      return;
    }

    let timer: ReturnType<typeof setInterval> | null = null;
    let active = true;

    const poll = async () => {
      try {
        const data = await apiGet<AnalysisRun>(`/api/analysis/${runId}`);
        if (!active) {
          return;
        }
        setRun(data);
        if (data.status === "failed") {
          setError(data.error_message || "Analysis failed.");
        }
        if (data.status === "succeeded" || data.status === "failed") {
          if (timer) {
            clearInterval(timer);
          }
        }
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to poll status.");
      }
    };

    poll();
    timer = setInterval(poll, pollMs);

    return () => {
      active = false;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [runId, pollMs]);

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

  return { run, error, statusTone };
}
