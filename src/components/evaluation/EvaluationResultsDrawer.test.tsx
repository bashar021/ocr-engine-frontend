import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  EvaluationResultsDrawer,
  eligibleCopyTargets,
} from "@/components/evaluation/EvaluationResultsDrawer";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/test-utils";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const EVALUATION_ID = "eval-1";
const SOURCE_DATASET_ID = "ds-source";

const linkedResult = {
  id: "res-1",
  evaluation_id: EVALUATION_ID,
  dataset_id: SOURCE_DATASET_ID,
  dataset_sample_id: "samp-1",
  filename: "linked.png",
  relative_path: "linked.png",
  predicted_value: "123",
  predicted_normalized: "123",
  ground_truth: "124",
  ground_truth_normalized: "124",
  is_correct: false,
  confidence: 0.5,
  processing_time_ms: 10,
  detection_success: true,
  recognition_success: false,
  detection_confidence: 0.9,
  recognition_confidence: 0.5,
  error_type: null,
  error_message: null,
  fail_stage: "recognition",
  failure_type: "WRONG_DIGITS",
  quality_flags: [],
  detection_outcome: "ok",
  detection_diagnostics: [],
  selected_detection: null,
  detections: [],
  image_size: null,
  image_available: true,
  metadata: { databank_category: "blurry" },
  created_at: null,
};

const datasets = [
  {
    id: SOURCE_DATASET_ID,
    name: "Source",
    ocr_type: "odometer",
    version: "1",
    description: null,
    source_type: "upload",
    source_reference: null,
    accepts_samples: true,
    image_mode: null,
    sample_count: 5,
    status: "ready",
    storage_path: null,
    manifest_digest: null,
    metadata: null,
    created_at: null,
    created_by: null,
    archived_at: null,
    locked_at: null,
  },
  {
    id: "ds-eligible",
    name: "Eligible",
    ocr_type: "odometer",
    version: "2",
    description: null,
    source_type: "upload",
    source_reference: null,
    accepts_samples: true,
    image_mode: null,
    sample_count: 3,
    status: "ready",
    storage_path: null,
    manifest_digest: null,
    metadata: null,
    created_at: null,
    created_by: null,
    archived_at: null,
    locked_at: null,
  },
  {
    id: "ds-locked",
    name: "Locked",
    ocr_type: "odometer",
    version: "1",
    description: null,
    source_type: "upload",
    source_reference: null,
    accepts_samples: false,
    image_mode: null,
    sample_count: 1,
    status: "ready",
    storage_path: null,
    manifest_digest: null,
    metadata: null,
    created_at: null,
    created_by: null,
    archived_at: null,
    locked_at: null,
  },
];

describe("eligibleCopyTargets", () => {
  it("excludes the source dataset and accepts_samples:false, matches ocr_type", () => {
    const targets = eligibleCopyTargets(datasets, linkedResult);
    const ids = targets.map((d) => d.id);
    expect(ids).toContain("ds-eligible");
    expect(ids).not.toContain(SOURCE_DATASET_ID);
    expect(ids).not.toContain("ds-locked");
  });
});

describe("EvaluationResultsDrawer", () => {
  it("shows reassign controls for a linked result", async () => {
    server.use(
      http.get("*/v1/evaluations/:id/results", () =>
        HttpResponse.json({
          results: [linkedResult],
          total: 1,
          limit: 500,
          offset: 0,
        }),
      ),
      http.get("*/v1/evaluation/datasets", () =>
        HttpResponse.json({
          datasets,
          total: datasets.length,
          limit: null,
          offset: 0,
        }),
      ),
    );

    renderWithProviders(
      <EvaluationResultsDrawer
        evaluationId={EVALUATION_ID}
        open
        onClose={() => undefined}
      />,
    );

    const viewBtn = await screen.findByRole("button", { name: /view/i });
    fireEvent.click(viewBtn);

    await waitFor(() => {
      expect(screen.getByText(/reassign image/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/databank category/i)).toBeInTheDocument();
    expect(screen.getByText(/copy to dataset/i)).toBeInTheDocument();

    // Open the copy-to-dataset select and check its options.
    const copySelect = document.querySelector(
      '[data-testid="copy-target-select"]',
    ) as HTMLElement | null;
    expect(copySelect).not.toBeNull();
    const combobox = copySelect!.querySelector(".ant-select-selector");
    fireEvent.mouseDown(combobox!);

    await waitFor(() => {
      expect(screen.getByText(/Eligible@2/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Locked@1/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Source@1/i)).not.toBeInTheDocument();
  });
});
