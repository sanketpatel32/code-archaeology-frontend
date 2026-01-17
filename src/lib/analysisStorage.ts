export type AnalysisState = {
  repoId: string | null;
  runId: string | null;
  repoUrl: string | null;
  branch: string | null;
};

const STORAGE_KEY = "code-archaeology-state";
const EVENT_NAME = "analysis-state";

const defaultState: AnalysisState = {
  repoId: null,
  runId: null,
  repoUrl: null,
  branch: null,
};

export function loadAnalysisState(): AnalysisState {
  if (typeof window === "undefined") {
    return { ...defaultState };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { ...defaultState };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AnalysisState>;
    return { ...defaultState, ...parsed };
  } catch {
    return { ...defaultState };
  }
}

export function saveAnalysisState(
  update: Partial<AnalysisState>,
): AnalysisState {
  if (typeof window === "undefined") {
    return { ...defaultState, ...update };
  }

  const current = loadAnalysisState();
  const next = { ...current, ...update };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT_NAME));
  return next;
}

export function clearAnalysisState() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function subscribeAnalysisState(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => callback();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
}

export function formatRepoLabel(repoUrl: string | null) {
  if (!repoUrl) {
    return null;
  }

  try {
    const url = new URL(repoUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
  } catch {
    // fallback for non-url input
  }

  const trimmed = repoUrl.replace(/\.git$/, "");
  const pieces = trimmed.split("/").filter(Boolean);
  if (pieces.length >= 2) {
    return `${pieces[pieces.length - 2]}/${pieces[pieces.length - 1]}`;
  }

  return trimmed || null;
}
