import type { EvaluationComparisonResponse, EvaluationRun } from "@/types/evaluation";
import { formatMs, formatPercent } from "@/utils/format";

export type MetricDirection = "higher" | "lower";
export type MetricCategory = "core" | "failure" | "latency";

export interface ComparisonMetricRow {
  key: string;
  label: string;
  category: MetricCategory;
  description?: string;
  left: number | null;
  right: number | null;
  direction: MetricDirection;
  format: (v: number | null) => string;
  delta: number | null;
  indicator: DeltaIndicator;
  winner: "left" | "right" | "tie" | "na";
  winnerLabel: string;
}

export type DeltaIndicator = "better" | "worse" | "equal" | "na";

export type DecisionCriteriaKey =
  | "client_value"
  | "e2e_accuracy"
  | "net_improvement"
  | "detection_success"
  | "recognition_match"
  | "latency"
  | "failure_rate";

export interface DecisionCriteriaOption {
  key: DecisionCriteriaKey;
  label: string;
  badge: string;
  description: string;
  clientBenefit: string;
}

export const DECISION_CRITERIA_OPTIONS: DecisionCriteriaOption[] = [
  {
    key: "client_value",
    label: "Balanced Client Value Score",
    badge: "🏆 Recommended",
    description: "Composite metric weighting E2E accuracy (50%), net sample fixes (25%), detection reliability (15%), and latency (10%).",
    clientBenefit: "Best overall production readiness and customer satisfaction.",
  },
  {
    key: "e2e_accuracy",
    label: "End-to-End Accuracy (Client Top Priority)",
    badge: "🎯 Client Priority",
    description: "Evaluates the overall exact correct reading rate across all full-image samples.",
    clientBenefit: "Directly minimizes manual review workload and failed automated transactions.",
  },
  {
    key: "net_improvement",
    label: "Net Sample Improvement (Fixes vs Regressions)",
    badge: "📈 Net Gain",
    description: "Measures net sample swing (Improved fixed cases minus Regressed broken cases).",
    clientBenefit: "Guarantees the candidate fixes more real-world edge cases than it breaks.",
  },
  {
    key: "detection_success",
    label: "Detection Success Rate",
    badge: "📦 Detection",
    description: "Ability to locate and crop the target odometer or license plate without missing.",
    clientBenefit: "Prevents complete pipeline dropouts and unread image errors.",
  },
  {
    key: "recognition_match",
    label: "Recognition Exact Match Rate",
    badge: "🔤 Recognition",
    description: "Precision of the text recognition model on cropped regions.",
    clientBenefit: "Ensures clean, typo-free transcription of digits and characters.",
  },
  {
    key: "latency",
    label: "Production Latency & Speed",
    badge: "⚡ Speed",
    description: "Median P50 inference and processing latency per image.",
    clientBenefit: "Faster user-facing response times and higher API throughput on client infrastructure.",
  },
  {
    key: "failure_rate",
    label: "Lowest Critical Failure Rate",
    badge: "🛡️ Reliability",
    description: "Total rate of critical failures including mismatches, misses, and invalid crops.",
    clientBenefit: "Maximizes system dependability and data integrity.",
  },
];

export interface ModelVerdict {
  winner: "left" | "right" | "tie";
  winnerModelRef: string;
  loserModelRef: string;
  winnerMargin: string;
  verdictTitle: string;
  verdictDescription: string;
  clientRecommendation: string;
  scoreLeft: number;
  scoreRight: number;
  criteriaLabel: string;
  deltaNetImprovement: number;
  leftAccuracy: number | null;
  rightAccuracy: number | null;
}

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
  const rightBetter = direction === "higher" ? right > left : right < left;
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

export function buildComparisonMetricRows(
  compare: EvaluationComparisonResponse,
  leftFromList?: EvaluationRun,
  rightFromList?: EvaluationRun,
): ComparisonMetricRow[] {
  const left = pickRunMetrics(compare.left, leftFromList);
  const right = pickRunMetrics(compare.right, rightFromList);
  const leftTotal = left?.total_samples ?? compare.left.total_samples ?? 0;
  const rightTotal = right?.total_samples ?? compare.right.total_samples ?? 0;
  const leftFt = compare?.aggregates?.left_failure_type_counts;
  const rightFt = compare?.aggregates?.right_failure_type_counts;

  const leftRef = left?.model_ref ?? compare.left.model_ref ?? "Baseline";
  const rightRef = right?.model_ref ?? compare.right.model_ref ?? "Candidate";

  const pct = (v: number | null) => formatPercent(v);
  const ms = (v: number | null) => formatMs(v);

  const rawRows: Array<{
    key: string;
    label: string;
    category: MetricCategory;
    description: string;
    left: number | null;
    right: number | null;
    direction: MetricDirection;
    format: (v: number | null) => string;
  }> = [
    // 1. Client Core Performance
    {
      key: "end_to_end_accuracy",
      label: "End-to-End Accuracy",
      category: "core",
      description: "Fraction of images where entire OCR transcription matches ground truth exactly.",
      left: runMetric(left, "end_to_end_accuracy") ?? compare.aggregates.left_end_to_end_accuracy,
      right: runMetric(right, "end_to_end_accuracy") ?? compare.aggregates.right_end_to_end_accuracy,
      direction: "higher",
      format: pct,
    },
    {
      key: "passed_samples_count",
      label: "Passed Samples Count",
      category: "core",
      description: "Total successful predictions without errors out of evaluated images.",
      left: left?.successful_samples ?? null,
      right: right?.successful_samples ?? null,
      direction: "higher",
      format: (v) => (v != null ? `${v.toLocaleString()} samples` : "—"),
    },
    {
      key: "detection_success_rate",
      label: "Detection Success Rate",
      category: "core",
      description: "Percentage of images where the region detector found a valid bounding box.",
      left: runMetric(left, "detection_success_rate"),
      right: runMetric(right, "detection_success_rate"),
      direction: "higher",
      format: pct,
    },
    {
      key: "exact_match_accuracy",
      label: "Recognition Exact Match Rate",
      category: "core",
      description: "Crop-level character recognition accuracy with zero character errors.",
      left: runMetric(left, "exact_match_accuracy"),
      right: runMetric(right, "exact_match_accuracy"),
      direction: "higher",
      format: pct,
    },
    {
      key: "recognition_char_accuracy",
      label: "Character-Level Similarity",
      category: "core",
      description: "Normalized character similarity score (1 - CER), measuring partial correctness.",
      left:
        runMetric(left, "recognition_char_accuracy") ??
        runMetric(left, "normalized_levenshtein_similarity"),
      right:
        runMetric(right, "recognition_char_accuracy") ??
        runMetric(right, "normalized_levenshtein_similarity"),
      direction: "higher",
      format: pct,
    },
    // 2. Latency & Operational Speed
    {
      key: "latency_p50_ms",
      label: "Median Latency (P50)",
      category: "latency",
      description: "Median time to process one full image from decoding to postprocessing.",
      left: runMetric(left, "latency_p50_ms"),
      right: runMetric(right, "latency_p50_ms"),
      direction: "lower",
      format: ms,
    },
    {
      key: "latency_p95_ms",
      label: "Tail Latency (P95)",
      category: "latency",
      description: "95th percentile latency representing difficult or worst-case images.",
      left: runMetric(left, "latency_p95_ms"),
      right: runMetric(right, "latency_p95_ms"),
      direction: "lower",
      format: ms,
    },
  ];

  // 3. Client Failure Taxonomy (Only real, canonical failure types)
  const failureDefinitions: Array<{ type: string; label: string; desc: string }> = [
    {
      type: "MISMATCH",
      label: "Text Mismatch Rate",
      desc: "Region detected, but OCR text failed to match ground truth digits.",
    },
    {
      type: "DETECTION_FAILURE",
      label: "Detection Miss Rate",
      desc: "Detector failed to find any bounding box in the input image.",
    },
    {
      type: "WRONG_DETECTION",
      label: "Wrong Bounding Box Rate",
      desc: "Detected bounding box was outside the true target odometer area.",
    },
    {
      type: "PARTIAL_DETECTION",
      label: "Partial Crop Rate",
      desc: "Bounding box only partially covered the digits or truncated the region.",
    },
    {
      type: "MULTIPLE_DETECTIONS",
      label: "Multiple Boxes Ambiguity Rate",
      desc: "Multiple high-confidence boxes detected causing cluster conflict.",
    },
    {
      type: "INVALID_IMAGE",
      label: "Invalid / Degraded Image Rate",
      desc: "Severe blur, corrupt payload, or unreadable camera resolution.",
    },
  ];

  for (const item of failureDefinitions) {
    const lVal = failureRate(leftFt, item.type, leftTotal);
    const rVal = failureRate(rightFt, item.type, rightTotal);
    rawRows.push({
      key: `failure_${item.type}`,
      label: item.label,
      category: "failure",
      description: item.desc,
      left: lVal,
      right: rVal,
      direction: "lower",
      format: pct,
    });
  }

  return rawRows.map((row) => {
    const { delta, indicator } = compareMetricDelta(row.left, row.right, row.direction);
    let winner: "left" | "right" | "tie" | "na" = "na";
    let winnerLabel = "Equal / No Delta";

    if (row.left != null && row.right != null) {
      if (Math.abs(row.left - row.right) < 1e-9) {
        winner = "tie";
        winnerLabel = "Tied";
      } else if (indicator === "better") {
        winner = "right";
        winnerLabel = `${rightRef} wins`;
      } else if (indicator === "worse") {
        winner = "left";
        winnerLabel = `${leftRef} wins`;
      }
    }

    return {
      ...row,
      delta,
      indicator,
      winner,
      winnerLabel,
    };
  });
}

/**
 * Computes which model wins based on the selected decision criteria.
 */
export function computeModelVerdict(
  compare: EvaluationComparisonResponse,
  leftRun?: EvaluationRun,
  rightRun?: EvaluationRun,
  criteriaKey: DecisionCriteriaKey = "client_value",
): ModelVerdict {
  const left = pickRunMetrics(compare.left, leftRun);
  const right = pickRunMetrics(compare.right, rightRun);

  const leftRef = left?.model_ref ?? compare.left.model_ref ?? "Baseline (Left)";
  const rightRef = right?.model_ref ?? compare.right.model_ref ?? "Candidate (Right)";

  const leftAcc = runMetric(left, "end_to_end_accuracy") ?? compare?.aggregates?.left_end_to_end_accuracy ?? 0;
  const rightAcc = runMetric(right, "end_to_end_accuracy") ?? compare?.aggregates?.right_end_to_end_accuracy ?? 0;

  const improved = compare?.aggregates?.improved ?? 0;
  const regressed = compare?.aggregates?.regressed ?? 0;
  const deltaNetImprovement = improved - regressed;

  const leftDet = runMetric(left, "detection_success_rate") ?? 0;
  const rightDet = runMetric(right, "detection_success_rate") ?? 0;

  const leftRec = runMetric(left, "exact_match_accuracy") ?? 0;
  const rightRec = runMetric(right, "exact_match_accuracy") ?? 0;

  const leftLat = runMetric(left, "latency_p50_ms") ?? 100;
  const rightLat = runMetric(right, "latency_p50_ms") ?? 100;

  let winner: "left" | "right" | "tie" = "tie";
  let winnerMargin = "";
  let verdictTitle = "";
  let verdictDescription = "";
  let clientRecommendation = "";
  let scoreLeft = 0;
  let scoreRight = 0;

  const criteria = DECISION_CRITERIA_OPTIONS.find((c) => c.key === criteriaKey) ?? DECISION_CRITERIA_OPTIONS[0];

  switch (criteriaKey) {
    case "e2e_accuracy": {
      const diff = rightAcc - leftAcc;
      scoreLeft = Math.round(leftAcc * 1000) / 10;
      scoreRight = Math.round(rightAcc * 1000) / 10;
      if (Math.abs(diff) < 0.0001) {
        winner = "tie";
        verdictTitle = "Models Tied on End-to-End Accuracy";
        winnerMargin = `Identical accuracy (${formatPercent(leftAcc)})`;
        verdictDescription = "Both models achieved the exact same end-to-end accuracy on this dataset.";
        clientRecommendation = "Consider comparing latency or net sample improvements to break the tie.";
      } else if (diff > 0) {
        winner = "right";
        verdictTitle = `Candidate (${rightRef}) Wins on E2E Accuracy`;
        winnerMargin = `+${formatPercent(diff)} higher accuracy (${formatPercent(rightAcc)} vs ${formatPercent(leftAcc)})`;
        verdictDescription = `${rightRef} delivers higher overall transaction success with ${improved} fixed images vs ${regressed} regressions.`;
        clientRecommendation = `Client Recommendation: Upgrade to ${rightRef} for optimal end-user accuracy.`;
      } else {
        winner = "left";
        verdictTitle = `Baseline (${leftRef}) Wins on E2E Accuracy`;
        winnerMargin = `+${formatPercent(Math.abs(diff))} higher accuracy (${formatPercent(leftAcc)} vs ${formatPercent(rightAcc)})`;
        verdictDescription = `${leftRef} maintained higher accuracy. The candidate regressed on ${regressed} samples.`;
        clientRecommendation = `Client Recommendation: Retain ${leftRef} as default. Candidate does not meet accuracy threshold.`;
      }
      break;
    }

    case "net_improvement": {
      scoreLeft = regressed;
      scoreRight = improved;
      if (deltaNetImprovement === 0) {
        winner = "tie";
        verdictTitle = "Zero Net Sample Improvement";
        winnerMargin = `${improved} improved, ${regressed} regressed (Net: 0)`;
        verdictDescription = "The candidate model fixed as many samples as it broke compared to the baseline.";
        clientRecommendation = "No net benefit from candidate model on this dataset.";
      } else if (deltaNetImprovement > 0) {
        winner = "right";
        verdictTitle = `Candidate (${rightRef}) Fixes ${deltaNetImprovement} Net Images`;
        winnerMargin = `+${deltaNetImprovement} net fixed samples (${improved} fixed vs ${regressed} broken)`;
        verdictDescription = `${rightRef} solved ${improved} failed images while only regressing on ${regressed} cases.`;
        clientRecommendation = `Client Recommendation: Candidate solves key client failure cases with strong net gain.`;
      } else {
        winner = "left";
        verdictTitle = `Baseline (${leftRef}) Outperforms on Net Samples`;
        winnerMargin = `${Math.abs(deltaNetImprovement)} net regressions (${regressed} broken vs ${improved} fixed)`;
        verdictDescription = `${rightRef} introduced more regressions (${regressed}) than improvements (${improved}).`;
        clientRecommendation = `Client Recommendation: Do not deploy candidate. It causes more regressions than fixes.`;
      }
      break;
    }

    case "detection_success": {
      const diff = rightDet - leftDet;
      scoreLeft = Math.round(leftDet * 1000) / 10;
      scoreRight = Math.round(rightDet * 1000) / 10;
      if (Math.abs(diff) < 0.0001) {
        winner = "tie";
        verdictTitle = "Equal Detection Success Rate";
        winnerMargin = `Both achieved ${formatPercent(leftDet)}`;
        verdictDescription = "Both models localized the odometer region with identical reliability.";
        clientRecommendation = "Both models have equally reliable detection.";
      } else if (diff > 0) {
        winner = "right";
        verdictTitle = `Candidate (${rightRef}) Has Superior Detection`;
        winnerMargin = `+${formatPercent(diff)} higher detection (${formatPercent(rightDet)} vs ${formatPercent(leftDet)})`;
        verdictDescription = `${rightRef} provides better crop proposals and avoids missed detections.`;
        clientRecommendation = `Recommended for noisy environments where missing odometer boxes is a client risk.`;
      } else {
        winner = "left";
        verdictTitle = `Baseline (${leftRef}) Has Superior Detection`;
        winnerMargin = `+${formatPercent(Math.abs(diff))} higher detection (${formatPercent(leftDet)} vs ${formatPercent(rightDet)})`;
        verdictDescription = `${leftRef} misses fewer odometer boxes than ${rightRef}.`;
        clientRecommendation = `Client Recommendation: Keep ${leftRef} for robust bounding box proposals.`;
      }
      break;
    }

    case "recognition_match": {
      const diff = rightRec - leftRec;
      scoreLeft = Math.round(leftRec * 1000) / 10;
      scoreRight = Math.round(rightRec * 1000) / 10;
      if (Math.abs(diff) < 0.0001) {
        winner = "tie";
        verdictTitle = "Equal Recognition Precision";
        winnerMargin = `Both achieved ${formatPercent(leftRec)}`;
        verdictDescription = "Text recognition precision on cropped odometer regions is identical.";
        clientRecommendation = "No recognition difference between models.";
      } else if (diff > 0) {
        winner = "right";
        verdictTitle = `Candidate (${rightRef}) Wins on Recognition Match`;
        winnerMargin = `+${formatPercent(diff)} exact match rate (${formatPercent(rightRec)} vs ${formatPercent(leftRec)})`;
        verdictDescription = `${rightRef} recognizes digits with fewer character-level substitutions.`;
        clientRecommendation = `Recommended for clean digit extraction without digit misreads.`;
      } else {
        winner = "left";
        verdictTitle = `Baseline (${leftRef}) Wins on Recognition Match`;
        winnerMargin = `+${formatPercent(Math.abs(diff))} exact match rate (${formatPercent(leftRec)} vs ${formatPercent(rightRec)})`;
        verdictDescription = `${leftRef} provides cleaner OCR text recognition than candidate.`;
        clientRecommendation = `Keep ${leftRef} to avoid OCR misreads.`;
      }
      break;
    }

    case "latency": {
      const diffMs = leftLat - rightLat; // positive means right is faster
      scoreLeft = Math.round(leftLat);
      scoreRight = Math.round(rightLat);
      if (Math.abs(diffMs) < 1) {
        winner = "tie";
        verdictTitle = "Similar Inference Latency";
        winnerMargin = `Both ~${formatMs(leftLat)}`;
        verdictDescription = "Both models have practically identical execution speeds.";
        clientRecommendation = "Speed is a tie; decide based on accuracy.";
      } else if (diffMs > 0) {
        const pctFaster = Math.round((diffMs / leftLat) * 100);
        winner = "right";
        verdictTitle = `Candidate (${rightRef}) is Faster`;
        winnerMargin = `${formatMs(diffMs)} faster per image (${pctFaster}% speedup: ${formatMs(rightLat)} vs ${formatMs(leftLat)})`;
        verdictDescription = `${rightRef} runs significantly faster on production inference.`;
        clientRecommendation = `Optimal choice if client requires high throughput and minimal API delay.`;
      } else {
        const pctFaster = Math.round((Math.abs(diffMs) / rightLat) * 100);
        winner = "left";
        verdictTitle = `Baseline (${leftRef}) is Faster`;
        winnerMargin = `${formatMs(Math.abs(diffMs))} faster per image (${pctFaster}% speedup: ${formatMs(leftLat)} vs ${formatMs(rightLat)})`;
        verdictDescription = `${leftRef} finishes inference faster than candidate ${rightRef}.`;
        clientRecommendation = `Retain ${leftRef} for faster real-time client responses.`;
      }
      break;
    }

    case "failure_rate": {
      const leftFailures = 1 - leftAcc;
      const rightFailures = 1 - rightAcc;
      scoreLeft = Math.round(leftFailures * 1000) / 10;
      scoreRight = Math.round(rightFailures * 1000) / 10;
      const diff = leftFailures - rightFailures; // positive means right has fewer failures
      if (Math.abs(diff) < 0.0001) {
        winner = "tie";
        verdictTitle = "Equal Failure Rate";
        winnerMargin = `Identical error rate (${formatPercent(leftFailures)})`;
        verdictDescription = "Both models fail on the exact same percentage of images.";
        clientRecommendation = "Both models present identical reliability risks.";
      } else if (diff > 0) {
        winner = "right";
        verdictTitle = `Candidate (${rightRef}) Has Lowest Failure Rate`;
        winnerMargin = `−${formatPercent(diff)} fewer errors (${formatPercent(rightFailures)} vs ${formatPercent(leftFailures)})`;
        verdictDescription = `${rightRef} minimizes client-facing failures and mismatches.`;
        clientRecommendation = `Recommended for client reliability and reduced exception handling.`;
      } else {
        winner = "left";
        verdictTitle = `Baseline (${leftRef}) Has Lowest Failure Rate`;
        winnerMargin = `−${formatPercent(Math.abs(diff))} fewer errors (${formatPercent(leftFailures)} vs ${formatPercent(rightFailures)})`;
        verdictDescription = `${leftRef} experiences fewer critical failures than candidate.`;
        clientRecommendation = `Keep ${leftRef} to prevent customer-facing OCR failures.`;
      }
      break;
    }

    case "client_value":
    default: {
      const calcComposite = (acc: number, det: number, rec: number, latMs: number) => {
        const speedScore = Math.max(0, Math.min(1, 150 / Math.max(latMs, 10)));
        return (acc * 0.5 + det * 0.2 + rec * 0.15 + speedScore * 0.15) * 100;
      };

      scoreLeft = Math.round(calcComposite(leftAcc, leftDet, leftRec, leftLat) * 10) / 10;
      scoreRight = Math.round(calcComposite(rightAcc, rightDet, rightRec, rightLat) * 10) / 10;

      const accDiff = rightAcc - leftAcc;
      if (accDiff > 0.005 && deltaNetImprovement > 0) {
        winner = "right";
        verdictTitle = `Candidate (${rightRef}) Wins Decisively for Client Value`;
        winnerMargin = `+${formatPercent(accDiff)} accuracy with +${deltaNetImprovement} net fixed samples`;
        verdictDescription = `${rightRef} substantially outperforms ${leftRef} on real-world accuracy (${formatPercent(rightAcc)} vs ${formatPercent(leftAcc)}) with ${improved} fixed images.`;
        clientRecommendation = `🚀 Recommended Deployment: Promote ${rightRef} to Production Default. It provides major accuracy and reliability benefits for the client.`;
      } else if (accDiff < -0.005 || deltaNetImprovement < -5) {
        winner = "left";
        verdictTitle = `Baseline (${leftRef}) Outperforms Candidate on Client Value`;
        winnerMargin = `+${formatPercent(Math.abs(accDiff))} higher accuracy with fewer regressions`;
        verdictDescription = `${leftRef} protects client accuracy. Candidate ${rightRef} caused ${regressed} regressions and falls short of promotion threshold.`;
        clientRecommendation = `🛡️ Retain Current Default: Keep ${leftRef} active in production. Candidate model requires further fine-tuning.`;
      } else if (rightLat < leftLat * 0.7 && Math.abs(accDiff) <= 0.005) {
        winner = "right";
        verdictTitle = `Candidate (${rightRef}) Wins on Speed & Equal Accuracy`;
        winnerMargin = `${formatMs(leftLat - rightLat)} faster inference with matching accuracy`;
        verdictDescription = `${rightRef} matches baseline accuracy while cutting execution latency by ${Math.round(((leftLat - rightLat) / leftLat) * 100)}%.`;
        clientRecommendation = `⚡ Recommended Deployment: Promote ${rightRef} for substantial infrastructure cost and latency savings.`;
      } else if (accDiff > 0) {
        winner = "right";
        verdictTitle = `Candidate (${rightRef}) Wins on Client Value`;
        winnerMargin = `+${formatPercent(accDiff)} accuracy gain (+${deltaNetImprovement} net fixed samples)`;
        verdictDescription = `${rightRef} provides measurable improvement across client evaluation metrics.`;
        clientRecommendation = `Candidate ${rightRef} is safe to deploy or stage for A/B rollout.`;
      } else if (accDiff < 0) {
        winner = "left";
        verdictTitle = `Baseline (${leftRef}) Defends Lead`;
        winnerMargin = `+${formatPercent(Math.abs(accDiff))} higher accuracy`;
        verdictDescription = `Baseline ${leftRef} remains superior for client accuracy goals.`;
        clientRecommendation = `Do not replace baseline with candidate.`;
      } else {
        winner = "tie";
        verdictTitle = "Models Tied on Overall Client Value";
        winnerMargin = "Equivalent performance across accuracy, detection, and speed";
        verdictDescription = "Both models provide nearly identical client value on this dataset.";
        clientRecommendation = "Both models perform identically; choose based on model weight size or memory footprint.";
      }
      break;
    }
  }

  const winnerModelRef = winner === "right" ? rightRef : winner === "left" ? leftRef : "Tied";
  const loserModelRef = winner === "right" ? leftRef : winner === "left" ? rightRef : "Tied";

  return {
    winner,
    winnerModelRef,
    loserModelRef,
    winnerMargin,
    verdictTitle,
    verdictDescription,
    clientRecommendation,
    scoreLeft,
    scoreRight,
    criteriaLabel: criteria.label,
    deltaNetImprovement,
    leftAccuracy: leftAcc,
    rightAccuracy: rightAcc,
  };
}
