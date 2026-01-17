"use client";

import { useEffect, useState } from "react";
import {
  type AnalysisState,
  loadAnalysisState,
  saveAnalysisState,
  subscribeAnalysisState,
} from "./analysisStorage";

export function useAnalysisState() {
  const [state, setState] = useState<AnalysisState>({
    repoId: null,
    runId: null,
    repoUrl: null,
    branch: null,
  });

  useEffect(() => {
    setState(loadAnalysisState());
    const unsubscribe = subscribeAnalysisState(() => {
      setState(loadAnalysisState());
    });
    return unsubscribe;
  }, []);

  const update = (next: Partial<AnalysisState>) => {
    setState(saveAnalysisState(next));
  };

  return { state, update };
}
