import type { EvaluationComparisonResponse, EvaluationRun } from "@/types/evaluation";
import { formatMs, formatPercent } from "@/utils/format";

export type MetricDirection = "higher" | "lower";

export interface ComparisonMetricRow {
  key: string;
  label: string;
  left: number | null;
  right: number | null;
  direction: MetricDirection;
  format: (v: number | null) => string;
}

const FAILURE_TYPES = [
  "INVALID_IMAGE",
  "DETECTION_FAILURE",
  "MULTIPLE_DETECTIONS",
  "PARTIAL_DETECTION",
  "RECOGNITION_FAILURE",
  "MISMATCH",
] as const;

function runMetric(run: EvaluationRun | undefined, name: string): number | null {
  const value = run?.metrics?.[name];
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

function failureRate(
  counts: Record<string, number> | undefined,
  type: string,
  total: number,
): number | null {
  if (!counts || total <= 0) return null;
  const count = counts[type] ?? 0;
  return count / total;
}

function pickRunMetrics(
  side: EvaluationRun | undefined,
  fromList: EvaluationRun | undefined,
): EvaluationRun | undefined {
  if (fromList?.metrics) return fromList;
  return side;
}

export function buildComparisonMetricRows(
  compare: EvaluationComparisonResponse,
  leftFromList?: EvaluationRun,
  rightFromList?: EvaluationRun,
): ComparisonMetricRow[] {
  const left = pickRunMetrics(compare.left, leftFromList);
  const right = pickRunMetrics(compare.right, rightFromList);
  const leftTotal = left?.total_samples ?? compare.left.total_samples ?? 0;
  const rightTotal = right?.total_samples ?? compare.right.total_samples ?? 0;
  const leftFt = compare.aggregates.left_failure_type_counts;
  const rightFt = compare.aggregates.right_failure_type_counts;

  const pct = (v: number | null) => formatPercent(v);
  const ms = (v: number | null) => formatMs(v);

  const rows: ComparisonMetricRow[] = [
    {
      key: "end_to_end_success_rate",
      label: "E2E success rate",
      left: runMetric(left, "end_to_end_success_rate"),
      right: runMetric(right, "end_to_end_success_rate"),
      direction: "higher",
      format: pct,
    },
    {
      key: "detection_success_rate",
      label: "Detection success rate",
      left: runMetric(left, "detection_success_rate"),
      right: runMetric(right, "detection_success_rate"),
      direction: "higher",
      format: pct,
    },
    {
      key: "exact_match_accuracy",
      label: "Recognition exact match rate",
      left: runMetric(left, "exact_match_accuracy"),
      right: runMetric(right, "exact_match_accuracy"),
      direction: "higher",
      format: pct,
    },
    {
      key: "end_to_end_accuracy",
      label: "E2E accuracy",
      left:
        runMetric(left, "end_to_end_accuracy") ??
        compare.aggregates.left_end_to_end_accuracy,
      right:
        runMetric(right, "end_to_end_accuracy") ??
        compare.aggregates.right_end_to_end_accuracy,
      direction: "higher",
      format: pct,
    },
    {
      key: "latency_p50_ms",
      label: "Latency p50",
      left: runMetric(left, "latency_p50_ms"),
      right: runMetric(right, "latency_p50_ms"),
      direction: "lower",
      format: ms,
    },
    {
      key: "latency_p95_ms",
      label: "Latency p95",
      left: runMetric(left, "latency_p95_ms"),
      right: runMetric(right, "latency_p95_ms"),
      direction: "lower",
      format: ms,
    },
    {
      key: "low_confidence_rate",
      label: "Low confidence rate",
      left: runMetric(left, "low_confidence_rate"),
      right: runMetric(right, "low_confidence_rate"),
      direction: "lower",
      format: pct,
    },
    {
      key: "detection_miss_rate",
      label: "Detection miss rate",
      left: runMetric(left, "detection_miss_rate"),
      right: runMetric(right, "detection_miss_rate"),
      direction: "lower",
      format: pct,
    },
  ];

  const failureLabels: Record<(typeof FAILURE_TYPES)[number], string> = {
    INVALID_IMAGE: "Invalid image rate",
    DETECTION_FAILURE: "Detection failure rate",
    MULTIPLE_DETECTIONS: "Multiple detection rate",
    PARTIAL_DETECTION: "Partial detection rate",
    RECOGNITION_FAILURE: "Recognition failure rate",
    MISMATCH: "Mismatch rate",
  };

  for (const ft of FAILURE_TYPES) {
    rows.push({
      key: `failure_${ft}`,
      label: failureLabels[ft],
      left: failureRate(leftFt, ft, leftTotal),
      right: failureRate(rightFt, ft, rightTotal),
      direction: "lower",
      format: pct,
    });
  }

  return rows;
}

export type DeltaIndicator = "better" | "worse" | "equal" | "na";

export function compareMetricDelta(
  left: number | null,
  right: number | null,
  direction: MetricDirection,
): { delta: number | null; indicator: DeltaIndicator } {
  if (left == null || right == null) {
    return { delta: null, indicator: "na" };
  }
  const delta = right - left;
  if (Math.abs(delta) < 1e-9) {
    return { delta: 0, indicator: "equal" };
  }
  const rightBetter =
    direction === "higher" ? right > left : right < left;
  return { delta, indicator: rightBetter ? "better" : "worse" };
}

export function formatMetricDelta(
  left: number | null,
  right: number | null,
  format: (v: number | null) => string,
): string {
  if (left == null || right == null) return "—";
  const delta = right - left;
  if (Math.abs(delta) < 1e-9) return "0";
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${format(Math.abs(delta))}`;
}

export function deltaIndicatorLabel(indicator: DeltaIndicator): string {
  switch (indicator) {
    case "better":
      return "↑";
    case "worse":
      return "↓";
    case "equal":
      return "=";
    default:
      return "—";
  }
}
