/** Derive annotation status from real sample fields (no invented semantics). */

export type SampleAnnotationStatus =
  | "LABELED"
  | "UNLABELED"
  | "PARTIAL"
  | "INVALID";

export function annotationStatusFromSample(sample: {
  ground_truth?: string | null;
  ground_truth_normalized?: string | null;
  status?: string;
  metadata?: Record<string, unknown> | null;
}): SampleAnnotationStatus {
  const metaStatus = String(sample.metadata?.annotation_status ?? "")
    .trim()
    .toUpperCase();
  if (
    metaStatus === "LABELED" ||
    metaStatus === "PARTIAL" ||
    metaStatus === "UNLABELED" ||
    metaStatus === "INVALID"
  ) {
    return metaStatus;
  }
  const raw = (sample.ground_truth ?? "").trim();
  const sampleStatus = String(sample.status ?? "").toLowerCase();
  if (sampleStatus === "invalid" || sampleStatus === "failed") return "INVALID";
  if (!raw) return "UNLABELED";
  const coverage = sample.metadata?.annotation_coverage;
  if (typeof coverage === "number" && coverage > 0 && coverage < 1) {
    return "PARTIAL";
  }
  if (sample.metadata?.annotation_status === "PARTIAL") return "PARTIAL";
  return "LABELED";
}

export function coveragePct(samples: Array<{ ground_truth?: string | null }>) {
  if (!samples.length) return null;
  const labeled = samples.filter((s) => (s.ground_truth ?? "").trim()).length;
  return {
    labeled,
    unlabeled: samples.length - labeled,
    pct: (labeled / samples.length) * 100,
  };
}
