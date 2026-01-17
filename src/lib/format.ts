export function formatNumber(value: number | string | null | undefined) {
  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(value ?? "");

  if (!Number.isFinite(numericValue)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US").format(numericValue);
}

export function formatScore(value: number | string | null | undefined) {
  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(value ?? "");

  if (!Number.isFinite(numericValue)) {
    return "--";
  }

  return numericValue.toFixed(2);
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "--";
  }
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}
