import type { EvaluationDataset } from "@/types/evaluation";

export interface DatasetDeleteAvailability {
  canSoftDelete: boolean;
  canHardDelete: boolean;
  softReason: string | null;
  hardReason: string | null;
}

/**
 * Prefer API capability flags; fall back to local status/lock checks.
 */
export function getDatasetDeleteAvailability(
  dataset: EvaluationDataset,
  opts?: { mutating?: boolean },
): DatasetDeleteAvailability {
  if (opts?.mutating) {
    return {
      canSoftDelete: false,
      canHardDelete: false,
      softReason: "Delete in progress…",
      hardReason: "Delete in progress…",
    };
  }

  if (
    typeof dataset.can_soft_delete === "boolean" ||
    typeof dataset.can_hard_delete === "boolean"
  ) {
    return {
      canSoftDelete: dataset.can_soft_delete !== false,
      canHardDelete: dataset.can_hard_delete !== false,
      softReason: dataset.soft_delete_blocked_reason ?? null,
      hardReason: dataset.hard_delete_blocked_reason ?? null,
    };
  }

  const archived = dataset.status === "archived";
  const busy =
    dataset.status === "uploading" || dataset.status === "processing";
  const activeEval = dataset.has_active_evaluation === true;

  let softReason: string | null = null;
  if (activeEval)
    softReason = "An evaluation is queued or running on this dataset.";
  else if (dataset.locked_at)
    softReason = "Dataset is locked while an evaluation is running.";
  else if (archived) softReason = "Dataset is already archived.";
  else if (busy) softReason = "Wait until upload/processing finishes.";

  // Hard delete only blocked by an in-flight evaluation (matches API).
  let hardReason: string | null = null;
  if (activeEval)
    hardReason = "An evaluation is queued or running on this dataset.";

  return {
    canSoftDelete: softReason == null,
    canHardDelete: hardReason == null,
    softReason,
    hardReason,
  };
}
