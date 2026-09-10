import type { EvaluationRun } from "@/types/evaluation";

export type EvaluationSortKey =
  | "created_desc"
  | "created_asc"
  | "model_ref_asc"
  | "model_ref_desc"
  | "overall_rank"
  | "e2e_accuracy"
  | "detection_success"
  | "recognition_exact_match"
  | "latency_p50";

export const EVALUATION_SORT_OPTIONS: Array<{
  value: EvaluationSortKey;
  label: string;
}> = [
  { value: "created_desc", label: "Created (newest)" },
  { value: "created_asc", label: "Created (oldest)" },
  { value: "model_ref_asc", label: "Model ref (A–Z)" },
  { value: "model_ref_desc", label: "Model ref (Z–A)" },
  { value: "overall_rank", label: "Overall rank" },
  { value: "e2e_accuracy", label: "E2E accuracy" },
  { value: "detection_success", label: "Detection success" },
  { value: "recognition_exact_match", label: "Recognition exact match" },
  { value: "latency_p50", label: "Latency p50 (fastest)" },
];

function metricValue(run: EvaluationRun, name: string): number {
  const value = run.metrics?.[name];
  return typeof value === "number" && !Number.isNaN(value) ? value : -Infinity;
}

/** Same weighting as Model refs overall score. Higher is better. */
export function evaluationOverallScore(run: EvaluationRun): number {
  const m = run.metrics;
  if (!m) return -Infinity;
  const e2e = Number(m.end_to_end_accuracy ?? 0);
  const det = Number(m.detection_success_rate ?? 0);
  const rec = Number(m.exact_match_accuracy ?? 0);
  const success = Number(m.end_to_end_success_rate ?? 0);
  const lat = Number(m.latency_p50_ms ?? 0);
  const latScore = lat > 0 ? 1 / (1 + lat / 1000) : 0;
  return e2e * 0.4 + det * 0.2 + rec * 0.2 + success * 0.1 + latScore * 0.1;
}

export function sortEvaluations(
  runs: EvaluationRun[],
  sortKey: EvaluationSortKey,
): EvaluationRun[] {
  const sorted = [...runs];
  sorted.sort((a, b) => {
    switch (sortKey) {
      case "created_desc":
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      case "created_asc":
        return (a.created_at ?? "").localeCompare(b.created_at ?? "");
      case "model_ref_asc":
        return (a.model_ref ?? "").localeCompare(b.model_ref ?? "");
      case "model_ref_desc":
        return (b.model_ref ?? "").localeCompare(a.model_ref ?? "");
      case "overall_rank":
        return evaluationOverallScore(b) - evaluationOverallScore(a);
      case "e2e_accuracy":
        return (
          metricValue(b, "end_to_end_accuracy") -
          metricValue(a, "end_to_end_accuracy")
        );
      case "detection_success":
        return (
          metricValue(b, "detection_success_rate") -
          metricValue(a, "detection_success_rate")
        );
      case "recognition_exact_match":
        return (
          metricValue(b, "exact_match_accuracy") -
          metricValue(a, "exact_match_accuracy")
        );
      case "latency_p50": {
        const av = metricValue(a, "latency_p50_ms");
        const bv = metricValue(b, "latency_p50_ms");
        if (av === bv) return 0;
        if (av === -Infinity) return 1;
        if (bv === -Infinity) return -1;
        return av - bv;
      }
      default:
        return 0;
    }
  });
  return sorted;
}

export function canReEvaluateRun(run: EvaluationRun): boolean {
  return run.status === "completed" || run.status === "failed";
}
