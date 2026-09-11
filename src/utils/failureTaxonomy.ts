/** Detection / evaluation failure taxonomy (detection-taxonomy-v2). */

export const FAILURE_TYPES = [
  "OK",
  "INVALID_IMAGE",
  "DETECTION_FAILURE",
  "WRONG_DETECTION",
  "PARTIAL_DETECTION",
  "MULTIPLE_DETECTIONS",
  "DUPLICATE_DETECTION",
  "RECOGNITION_FAILURE",
  "MISMATCH",
] as const;

export type FailureType = (typeof FAILURE_TYPES)[number];

/** Primary detection outcomes (separate from overall failure_type). */
export const DETECTION_OUTCOMES = [
  "DETECTION_OK",
  "DETECTION_FAILURE",
  "WRONG_DETECTION",
  "PARTIAL_DETECTION",
  "MULTIPLE_DETECTIONS",
  "DUPLICATE_DETECTION",
  "DETECTION_UNVERIFIED",
  "NOT_APPLICABLE",
] as const;

export type DetectionOutcome = (typeof DETECTION_OUTCOMES)[number];

export const DETECTION_DIAGNOSTICS = [
  "LOW_CONFIDENCE",
  "UNUSUAL_ASPECT",
  "VERTICAL_ORIENTATION",
  "UNDERSIZED",
  "OVERSIZED",
  "MISALIGNED",
  "OUT_OF_IMAGE",
  "INVALID_BOX",
  "DUPLICATE_CANDIDATE",
  "LOW_GT_COVERAGE",
  "LOW_PREDICTION_COVERAGE",
  "LOW_IOU",
] as const;

export type DetectionDiagnostic = (typeof DETECTION_DIAGNOSTICS)[number];

export const FAILURE_TYPE_LABELS: Record<string, string> = {
  OK: "OK",
  INVALID_IMAGE: "Invalid image",
  DETECTION_FAILURE: "Detection failure",
  WRONG_DETECTION: "Wrong detection",
  PARTIAL_DETECTION: "Partial detection",
  MULTIPLE_DETECTIONS: "Multiple detections",
  DUPLICATE_DETECTION: "Duplicate detection",
  RECOGNITION_FAILURE: "Recognition failure",
  MISMATCH: "Mismatch",
};

export const FAILURE_TYPE_DESCRIPTIONS: Record<string, string> = {
  OK: "Detection usable and recognition matches ground truth.",
  INVALID_IMAGE: "Image failed quality/decode checks before OCR.",
  DETECTION_FAILURE: "No usable prediction for the expected object.",
  WRONG_DETECTION:
    "A prediction exists but does not sufficiently match the GT object (GT bbox required).",
  PARTIAL_DETECTION:
    "Prediction matches the GT object but captures insufficient GT coverage. Not based on aspect ratio.",
  MULTIPLE_DETECTIONS:
    "Multiple distinct candidate objects when the task expects one.",
  DUPLICATE_DETECTION:
    "Multiple highly overlapping predictions for the same object.",
  RECOGNITION_FAILURE: "Detection usable but recognition failed.",
  MISMATCH: "Recognition produced a value that does not match ground truth.",
};

export const DETECTION_OUTCOME_LABELS: Record<string, string> = {
  DETECTION_OK: "Detection OK",
  DETECTION_FAILURE: "Detection failure",
  WRONG_DETECTION: "Wrong detection",
  PARTIAL_DETECTION: "Partial detection",
  MULTIPLE_DETECTIONS: "Multiple detections",
  DUPLICATE_DETECTION: "Duplicate detection",
  DETECTION_UNVERIFIED: "Detection unverified (no GT bbox)",
  NOT_APPLICABLE: "N/A",
};

export const DIAGNOSTIC_LABELS: Record<string, string> = {
  LOW_CONFIDENCE: "Low confidence",
  UNUSUAL_ASPECT: "Unusual aspect",
  VERTICAL_ORIENTATION: "Vertical orientation",
  UNDERSIZED: "Undersized",
  OVERSIZED: "Oversized",
  MISALIGNED: "Misaligned",
  OUT_OF_IMAGE: "Out of image",
  INVALID_BOX: "Invalid box",
  DUPLICATE_CANDIDATE: "Duplicate candidate",
  LOW_GT_COVERAGE: "Low GT coverage",
  LOW_PREDICTION_COVERAGE: "Low prediction coverage",
  LOW_IOU: "Low IoU",
};

/** Hard-case filters exclude successful OK. */
export const HARD_FAILURE_TYPES = FAILURE_TYPES.filter((t) => t !== "OK");

export function formatFailureType(value: string | null | undefined): string {
  if (!value) return "—";
  return FAILURE_TYPE_LABELS[value] ?? value;
}

export function formatDetectionOutcome(value: string | null | undefined): string {
  if (!value) return "—";
  return DETECTION_OUTCOME_LABELS[value] ?? value;
}

export function formatDiagnostic(value: string): string {
  return DIAGNOSTIC_LABELS[value] ?? value;
}
