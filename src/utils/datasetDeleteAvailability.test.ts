import { describe, expect, it } from "vitest";

import type { EvaluationDataset } from "@/types/evaluation";
import { getDatasetDeleteAvailability } from "@/utils/datasetDeleteAvailability";

function base(partial: Partial<EvaluationDataset> = {}): EvaluationDataset {
  return {
    id: "ds-1",
    name: "demo",
    ocr_type: "odometer",
    version: "1.0.0",
    description: null,
    source_type: "zip_upload",
    source_reference: null,
    origin: "upload",
    scope: "evaluation",
    evaluation_eligible: true,
    merged_from: null,
    image_mode: "full_dashboard",
    sample_count: 1,
    status: "ready",
    storage_path: "/tmp",
    manifest_digest: null,
    metadata: null,
    created_at: null,
    created_by: null,
    archived_at: null,
    locked_at: null,
    has_active_evaluation: false,
    ...partial,
  };
}

describe("getDatasetDeleteAvailability", () => {
  it("allows hard delete for ready datasets", () => {
    const del = getDatasetDeleteAvailability(base());
    expect(del.canHardDelete).toBe(true);
    expect(del.canSoftDelete).toBe(true);
  });

  it("allows hard delete while processing (stuck sync) but blocks soft delete", () => {
    const del = getDatasetDeleteAvailability(base({ status: "processing" }));
    expect(del.canHardDelete).toBe(true);
    expect(del.canSoftDelete).toBe(false);
    expect(del.softReason).toMatch(/upload\/processing/i);
  });

  it("allows hard delete with stale lock when no active evaluation", () => {
    const del = getDatasetDeleteAvailability(
      base({ locked_at: "2026-01-01T00:00:00Z" }),
    );
    expect(del.canHardDelete).toBe(true);
    expect(del.canSoftDelete).toBe(false);
  });

  it("blocks hard delete only when evaluation is active", () => {
    const del = getDatasetDeleteAvailability(
      base({ has_active_evaluation: true, locked_at: "2026-01-01T00:00:00Z" }),
    );
    expect(del.canHardDelete).toBe(false);
    expect(del.canSoftDelete).toBe(false);
    expect(del.hardReason).toMatch(/evaluation/i);
  });

  it("respects API capability flags for every origin", () => {
    for (const origin of [
      "upload",
      "curated_hard_case",
      "merged_training",
      "databank_reviewed",
      "system",
    ] as const) {
      const del = getDatasetDeleteAvailability(
        base({
          origin,
          can_hard_delete: true,
          can_soft_delete: true,
          hard_delete_blocked_reason: null,
          soft_delete_blocked_reason: null,
        }),
      );
      expect(del.canHardDelete).toBe(true);
    }
  });

  it("disables both while a delete mutation is in flight", () => {
    const del = getDatasetDeleteAvailability(base(), { mutating: true });
    expect(del.canHardDelete).toBe(false);
    expect(del.canSoftDelete).toBe(false);
  });

  it("honors API hard-delete false even if status looks ready", () => {
    const del = getDatasetDeleteAvailability(
      base({
        can_hard_delete: false,
        hard_delete_blocked_reason:
          "An evaluation is queued or running on this dataset.",
      }),
    );
    expect(del.canHardDelete).toBe(false);
    expect(del.hardReason).toMatch(/evaluation/i);
  });
});
