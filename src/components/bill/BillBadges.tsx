import { Tag, Tooltip } from "antd";

const LEVEL_COLOR: Record<string, string> = {
  HIGH: "green",
  MEDIUM: "gold",
  LOW: "orange",
  REVIEW_REQUIRED: "red",
};

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: "green",
  REVIEW_REQUIRED: "orange",
  PARTIAL: "gold",
  FAILED: "red",
  EXTRACTED: "green",
  MISSING: "default",
  AMBIGUOUS: "orange",
  LOW_CONFIDENCE: "gold",
  PASSED: "green",
  WARNING: "gold",
  SKIPPED: "default",
  DRAFT: "gold",
  VALIDATED: "cyan",
  APPROVED: "blue",
  ACTIVE: "green",
  DEPRECATED: "default",
};

export function BillStatusBadge({
  status,
  label,
}: {
  status?: string | null;
  label?: string;
}) {
  if (!status) return <Tag>—</Tag>;
  const color = STATUS_COLOR[status] ?? LEVEL_COLOR[status] ?? "default";
  return (
    <Tag color={color} aria-label={label ?? status}>
      {status}
    </Tag>
  );
}

export function ConfidenceBadge({
  level,
  score,
  calibrated,
}: {
  level?: string | null;
  score?: number | null;
  calibrated?: boolean;
}) {
  if (level == null && score == null) return <Tag>No confidence</Tag>;
  const pct =
    score != null && Number.isFinite(score)
      ? `${Math.round(Number(score) * 100)}%`
      : null;
  const color = LEVEL_COLOR[level ?? ""] ?? "default";
  return (
    <Tooltip
      title={
        calibrated === false
          ? "Raw engineered confidence (not calibrated)"
          : calibrated
            ? "Calibrated confidence"
            : undefined
      }
    >
      <Tag color={color}>
        {[level, pct].filter(Boolean).join(" · ")}
      </Tag>
    </Tooltip>
  );
}
