import { http, HttpResponse } from "msw";

import type { EvaluationDataset, EvaluationRun } from "@/types/evaluation";
import type { ModelArtifact, PipelineRef } from "@/types/models";
import type { TaskDefinition } from "@/api/platform/tasks";

export const mockTasks: TaskDefinition[] = [
  {
    id: "task-odometer",
    key: "odometer",
    display_name: "Odometer",
    description: "Dashboard odometer OCR",
    status: "active",
    current_version: "1.0.0",
    capabilities: [
      "supports_live_ocr",
      "api_serving",
      "databank",
      "evaluation",
      "training",
    ],
    ui_config: {},
  },
  {
    id: "task-bill",
    key: "bill",
    display_name: "Bill / Invoice OCR",
    description: "Document intelligence for bills and receipts",
    status: "active",
    current_version: "1.1.0",
    capabilities: [
      "supports_live_ocr",
      "supports_extraction",
      "api_serving",
      "configurable_profiles",
    ],
    ui_config: {},
  },
];

export const mockArtifacts: ModelArtifact[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    ocr_type: "odometer",
    role: "detection",
    name: "odometer-detector",
    version: "1.0.0",
    runtime: "pytorch",
    framework: "ultralytics",
    filename: "detection.pt",
    storage_path:
      "./models/odometer/detection/odometer-detector/1.0.0/model.pt",
    artifact_digest: "sha256:abcdef0123456789",
    size_bytes: 2048,
    status: "verified",
    metadata: null,
    training_accuracy: 0.95,
    created_at: "2026-01-01T12:00:00+00:00",
    created_by: "dev-key-1",
    retired_at: null,
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    ocr_type: "odometer",
    role: "recognition",
    name: "odometer-recognizer",
    version: "1.0.0",
    runtime: "paddle",
    framework: null,
    filename: "paddle.json",
    storage_path:
      "./models/odometer/recognition/odometer-recognizer/1.0.0/model.json",
    artifact_digest: "sha256:fedcba9876543210",
    size_bytes: 128,
    status: "verified",
    metadata: null,
    training_accuracy: null,
    created_at: "2026-01-01T13:00:00+00:00",
    created_by: "dev-key-1",
    retired_at: null,
  },
];

export const mockRefs: PipelineRef[] = [
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    ocr_type: "odometer",
    model_ref: "v1",
    status: "active",
    is_default: true,
    notes: "Primary serving pipeline",
    detection_artifact_id: "11111111-1111-1111-1111-111111111111",
    recognition_artifact_id: "22222222-2222-2222-2222-222222222222",
    detection: {
      name: "odometer-detector",
      version: "1.0.0",
      runtime: "pytorch",
      digest: "sha256:abcdef0123456789",
      status: "verified",
    },
    recognition: {
      name: "odometer-recognizer",
      version: "1.0.0",
      runtime: "paddle",
      digest: "sha256:fedcba9876543210",
      status: "verified",
    },
    created_at: "2026-01-01T14:00:00+00:00",
    updated_at: "2026-01-02T10:00:00+00:00",
    evaluation_metrics: {
      evaluation_count_completed: 2,
      total_images_evaluated: 100,
      total_datasets_evaluated: 1,
      total_samples: 100,
      processed_samples: 100,
      successful_samples: 90,
      failed_samples: 10,
      detection_success_rate: 0.98,
      recognition_exact_match_accuracy: 0.91,
      end_to_end_accuracy: 0.9,
      end_to_end_success_rate: 0.93,
      latency_p50_ms: 45,
      latency_p95_ms: 120,
      last_evaluated_at: "2026-01-02T00:00:00+00:00",
      latest_metrics: null,
      metrics: {
        exact_match_accuracy: 0.9,
        end_to_end_accuracy: 0.9,
        end_to_end_success_rate: 0.93,
        low_confidence_rate: 0.05,
        detection_success_rate: 0.98,
        detection_miss_rate: 0.02,
        avg_detection_confidence: 0.91,
        detection_failure_rate: 0.02,
        wrong_detection_rate: 0.0,
        partial_detection_rate: 0.0,
        multiple_detection_rate: 0.02,
        duplicate_detection_rate: 0.0,
        detection_ok_outcome_rate: 0.96,
        vertical_orientation_diagnostic_rate: 0.1,
        unusual_aspect_diagnostic_rate: 0.0,
        low_gt_coverage_diagnostic_rate: 0.0,
        low_iou_diagnostic_rate: 0.05,
        recognition_success_rate: 0.95,
      },
      failure_types: [
        {
          key: "OK",
          name: "OK / Clean Match",
          count: 90,
          percentage: 90.0,
          stage: "Success / Passed",
          stageColor: "green",
        },
        {
          key: "MISMATCH",
          name: "Mismatch",
          count: 8,
          percentage: 8.0,
          stage: "Recognition",
          stageColor: "orange",
        },
        {
          key: "DETECTION_FAILURE",
          name: "Detection Failure",
          count: 2,
          percentage: 2.0,
          stage: "Detection",
          stageColor: "volcano",
        },
      ],
      evaluated_datasets: [
        {
          dataset_id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
          dataset_name: "dashboard-eval",
          dataset_version: "1.0.0",
          sample_count: 100,
          accuracy: 90.0,
          completed_at: "2026-01-02T00:00:00+00:00",
        },
      ],
    },
  },
];

export const mockDatasets: EvaluationDataset[] = [
  {
    id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    name: "dashboard-eval",
    ocr_type: "odometer",
    version: "1.0.0",
    description: "Test set",
    source_type: "zip_upload",
    source_reference: "samples.zip",
    origin: "upload",
    image_mode: "full_dashboard",
    sample_count: 2,
    status: "ready",
    storage_path: "./evaluation_datasets/odometer/dashboard-eval/1.0.0",
    manifest_digest: "sha256:1111222233334444",
    metadata: null,
    created_at: "2026-01-03T10:00:00+00:00",
    created_by: "dev-key-1",
    archived_at: null,
    locked_at: null,
  },
  {
    id: "cat-dataset-1",
    name: "data-bank-reviewed",
    ocr_type: "odometer",
    version: "1.0.0",
    description: "Category slice",
    source_type: "system",
    source_reference: null,
    origin: "databank_reviewed",
    image_mode: "full_dashboard",
    sample_count: 5,
    status: "ready",
    storage_path: null,
    manifest_digest: null,
    metadata: { origin: "databank_reviewed", purpose: "databank_reviewed_mirror" },
    created_at: "2026-01-03T10:00:00+00:00",
    created_by: "system",
    archived_at: null,
    locked_at: null,
  },
  {
    id: "raw-dataset-1",
    name: "raw-data-bank",
    ocr_type: "odometer",
    version: "1.0.0",
    description: "Raw layer",
    source_type: "system",
    source_reference: null,
    origin: "databank_raw_dataset",
    image_mode: "full_dashboard",
    sample_count: 10,
    status: "ready",
    storage_path: null,
    manifest_digest: null,
    metadata: { dataset_type: "raw" },
    created_at: "2026-01-03T10:00:00+00:00",
    created_by: "system",
    archived_at: null,
    locked_at: null,
  },
];

export const mockRuns: EvaluationRun[] = [
  {
    id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    dataset_id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    dataset_name: "dashboard-eval",
    dataset_version: "1.0.0",
    ocr_type: "odometer",
    model_ref: "v1",
    detection_artifact_id: "11111111-1111-1111-1111-111111111111",
    recognition_artifact_id: "22222222-2222-2222-2222-222222222222",
    evaluation_type: "test",
    evaluator_version: "eval-v1.0.0",
    evaluation_config: null,
    status: "completed",
    total_samples: 2,
    processed_samples: 2,
    successful_samples: 2,
    failed_samples: 0,
    started_at: "2026-01-03T11:00:00+00:00",
    completed_at: "2026-01-03T11:01:00+00:00",
    created_at: "2026-01-03T10:59:00+00:00",
    created_by: "dev-key-1",
    error_message: null,
  },
  {
    id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
    dataset_id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    dataset_name: "dashboard-eval",
    dataset_version: "1.0.0",
    ocr_type: "odometer",
    model_ref: "v2",
    detection_artifact_id: "11111111-1111-1111-1111-111111111111",
    recognition_artifact_id: "22222222-2222-2222-2222-222222222222",
    evaluation_type: "test",
    evaluator_version: "eval-v1.0.0",
    evaluation_config: null,
    status: "completed",
    total_samples: 2,
    processed_samples: 2,
    successful_samples: 2,
    failed_samples: 0,
    started_at: "2026-01-03T11:05:00+00:00",
    completed_at: "2026-01-03T11:06:00+00:00",
    created_at: "2026-01-03T11:04:00+00:00",
    created_by: "dev-key-1",
    error_message: null,
  },
];

export const handlers = [
  http.get("*/v1/models/artifacts", ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.toLowerCase();
    const role = url.searchParams.get("role");
    const limit = Number(url.searchParams.get("limit") || mockArtifacts.length);
    const offset = Number(url.searchParams.get("offset") || 0);

    let filtered = [...mockArtifacts];
    if (search) {
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(search) ||
          a.version.toLowerCase().includes(search) ||
          a.filename.toLowerCase().includes(search),
      );
    }
    if (role) {
      filtered = filtered.filter((a) => a.role === role);
    }

    return HttpResponse.json({
      artifacts: filtered.slice(offset, offset + limit),
      total: filtered.length,
      limit,
      offset,
    });
  }),

  http.get("*/v1/models/refs", ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.toLowerCase();
    const status = url.searchParams.get("status");
    let filtered = [...mockRefs];
    if (search) {
      filtered = filtered.filter(
        (r) =>
          r.model_ref.toLowerCase().includes(search) ||
          (r.notes ?? "").toLowerCase().includes(search),
      );
    }
    if (status) {
      filtered = filtered.filter((r) => r.status === status);
    }
    return HttpResponse.json({ refs: filtered, total: filtered.length });
  }),

  http.get("*/v1/models/refs/suggest", () => {
    return HttpResponse.json({ suggested_model_ref: "v2" });
  }),

  http.post("*/v1/models/artifacts", async () => {
    return HttpResponse.json(
      {
        ...mockArtifacts[0],
        id: "33333333-3333-3333-3333-333333333333",
        version: "2.0.0",
      },
      { status: 201 },
    );
  }),

  http.post("*/v1/models/refs", async ({ request }) => {
    const body = (await request.json()) as {
      ocr_type: string;
      model_ref: string;
      detection_artifact_id: string;
      recognition_artifact_id: string;
      notes?: string;
    };
    return HttpResponse.json(
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        ocr_type: body.ocr_type,
        model_ref: body.model_ref,
        status: "draft",
        is_default: false,
        notes: body.notes ?? null,
        detection_artifact_id: body.detection_artifact_id,
        recognition_artifact_id: body.recognition_artifact_id,
        detection: mockRefs[0]!.detection,
        recognition: mockRefs[0]!.recognition,
        created_at: "2026-01-04T10:00:00+00:00",
        updated_at: "2026-01-04T10:00:00+00:00",
        evaluation_metrics: null,
      },
      { status: 201 },
    );
  }),

  http.post(
    "*/v1/models/refs/:ocrType/:modelRef/activate",
    async ({ params, request }) => {
      const body = (await request.json().catch(() => ({}))) as {
        set_default?: boolean;
      };
      return HttpResponse.json({
        ...mockRefs[0],
        model_ref: String(params.modelRef),
        ocr_type: String(params.ocrType),
        status: "active",
        is_default: Boolean(body.set_default) || mockRefs[0]!.is_default,
      });
    },
  ),

  http.post(
    "*/v1/models/refs/:ocrType/:modelRef/disable",
    async ({ params }) => {
      return HttpResponse.json({
        ...mockRefs[0],
        model_ref: String(params.modelRef),
        ocr_type: String(params.ocrType),
        status: "disabled",
        is_default: false,
      });
    },
  ),

  http.post(
    "*/v1/models/refs/:ocrType/:modelRef/set-default",
    async ({ params }) => {
      return HttpResponse.json({
        ...mockRefs[0],
        model_ref: String(params.modelRef),
        ocr_type: String(params.ocrType),
        status: "active",
        is_default: true,
      });
    },
  ),

  http.get("*/v1/evaluation/datasets", () => {
    return HttpResponse.json({
      datasets: mockDatasets,
      total: mockDatasets.length,
      limit: null,
      offset: 0,
    });
  }),

  http.get("*/v1/evaluation/datasets/:id/samples", () => {
    return HttpResponse.json({
      samples: [
        {
          id: "s1",
          dataset_id: mockDatasets[0]!.id,
          relative_path: "samples/1-887512.png",
          filename: "1-887512.png",
          ground_truth: "887512",
          ground_truth_normalized: "887512",
          image_format: "png",
          size_bytes: 1200,
          width: 100,
          height: 80,
          status: "active",
          metadata: null,
          created_at: "2026-01-03T10:00:00+00:00",
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    });
  }),

  http.get("*/v1/evaluations", () => {
    return HttpResponse.json({
      evaluations: mockRuns.map((run, idx) => ({
        ...run,
        metrics: {
          detection_success_rate: idx === 1 ? 0.99 : 0.98,
          detection_miss_rate: 0.02,
          avg_detection_confidence: 0.91,
          recognition_success_rate: 0.95,
          exact_match_accuracy: idx === 1 ? 0.96 : 0.9,
          end_to_end_accuracy: idx === 1 ? 0.95 : 0.9,
          end_to_end_success_rate: idx === 1 ? 0.96 : 0.93,
          low_confidence_rate: 0.05,
          latency_p50_ms: idx === 1 ? 38 : 45,
          latency_p95_ms: idx === 1 ? 95 : 120,
        },
      })),
      total: mockRuns.length,
      limit: 50,
      offset: 0,
    });
  }),

  http.get("*/v1/evaluations/hard-failures", () => {
    return HttpResponse.json({
      dataset_id: mockDatasets[0]!.id,
      evaluation_id: mockRuns[0]!.id,
      model_ref: "v1",
      total: 2,
      limit: 20,
      offset: 0,
      failure_type_counts: {
        MISMATCH: 1,
        DETECTION_FAILURE: 1,
      },
      results: [
        {
          id: "res-1",
          evaluation_id: mockRuns[0]!.id,
          dataset_id: mockDatasets[0]!.id,
          dataset_sample_id: "s1",
          filename: "1-887512.png",
          relative_path: "samples/1-887512.png",
          predicted_value: "887510",
          predicted_normalized: "887510",
          ground_truth: "887512",
          ground_truth_normalized: "887512",
          is_correct: false,
          confidence: 0.92,
          processing_time_ms: 45,
          detection_success: true,
          recognition_success: false,
          detection_confidence: 0.98,
          recognition_confidence: 0.92,
          error_type: "MISMATCH",
          error_message: null,
          failure_type: "MISMATCH",
          image_available: true,
          image_size: { width: 100, height: 80 },
        },
        {
          id: "res-2",
          evaluation_id: mockRuns[0]!.id,
          dataset_id: mockDatasets[0]!.id,
          dataset_sample_id: "s2",
          filename: "2-123456.png",
          relative_path: "samples/2-123456.png",
          predicted_value: "12345",
          predicted_normalized: "12345",
          ground_truth: "123456",
          ground_truth_normalized: "123456",
          is_correct: false,
          confidence: 0.88,
          processing_time_ms: 50,
          detection_success: false,
          recognition_success: false,
          detection_confidence: 0.45,
          recognition_confidence: 0.88,
          error_type: "DETECTION_FAILURE",
          error_message: null,
          failure_type: "DETECTION_FAILURE",
          image_available: true,
          image_size: { width: 120, height: 90 },
        },
      ],
    });
  }),

  http.patch(
    "*/v1/evaluation/datasets/:datasetId/samples/:sampleId",
    async ({ request, params }) => {
      const body = (await request.json()) as { ground_truth?: string };
      return HttpResponse.json({
        id: String(params.sampleId),
        dataset_id: String(params.datasetId),
        ground_truth: body.ground_truth ?? "887512",
        ground_truth_normalized: body.ground_truth ?? "887512",
      });
    },
  ),

  http.post(
    "*/v1/evaluations/:evaluationId/results/:resultId/review",
    async ({ request, params }) => {
      const body = (await request.json()) as {
        review_status: string;
        corrected_gt?: string;
      };
      return HttpResponse.json({
        id: String(params.resultId),
        evaluation_id: String(params.evaluationId),
        review_status: body.review_status,
        corrected_gt: body.corrected_gt,
      });
    },
  ),

  http.post(
    "*/v1/evaluation/datasets/:datasetId/samples/:sampleId/move",
    async ({ request, params }) => {
      const body = (await request.json()) as { target_dataset_id: string; category?: string };
      return HttpResponse.json({
        moved: true,
        sample_id: String(params.sampleId),
        source_dataset_id: String(params.datasetId),
        target_dataset_id: body.target_dataset_id,
        target_dataset_name: "target-dataset",
        category: body.category || "General",
        filename: "sample.png",
      });
    },
  ),

  http.post(
    "*/v1/evaluation/datasets/:datasetId/batch-move",
    async ({ request, params }) => {
      const body = (await request.json()) as {
        sample_ids: string[];
        target_dataset_id: string;
        category?: string;
      };
      return HttpResponse.json({
        moved: true,
        moved_count: body.sample_ids.length,
        source_dataset_id: String(params.datasetId),
        target_dataset_id: body.target_dataset_id,
        target_dataset_name: "target-dataset",
        category: body.category || "General",
      });
    },
  ),

  http.get("*/v1/evaluation/datasets/:datasetId/samples/:sampleId/image", () => {
    return new HttpResponse(new Blob(["mock-image-data"], { type: "image/png" }), {
      headers: { "Content-Type": "image/png" },
    });
  }),

  http.get("*/v1/evaluations/:evaluationId/results/:resultId/image", () => {
    return new HttpResponse(new Blob(["mock-image-data"], { type: "image/png" }), {
      headers: { "Content-Type": "image/png" },
    });
  }),

  http.get("*/v1/evaluations/compare", ({ request }) => {
    const url = new URL(request.url);
    const leftId = url.searchParams.get("left");
    const rightId = url.searchParams.get("right");
    const left = mockRuns.find((r) => r.id === leftId) || mockRuns[0];
    const right = mockRuns.find((r) => r.id === rightId) || mockRuns[1] || mockRuns[0];

    return HttpResponse.json({
      benchmark_compatible: true,
      warning: null,
      left: {
        ...left,
        metrics: {
          end_to_end_accuracy: 0.9,
          detection_success_rate: 0.98,
          exact_match_accuracy: 0.92,
          recognition_char_accuracy: 0.96,
          latency_p50_ms: 50,
          latency_p95_ms: 120,
        },
      },
      right: {
        ...right,
        metrics: {
          end_to_end_accuracy: 0.95,
          detection_success_rate: 0.99,
          exact_match_accuracy: 0.96,
          recognition_char_accuracy: 0.98,
          latency_p50_ms: 38,
          latency_p95_ms: 95,
        },
      },
      champion: "left",
      candidate: "right",
      matrix: {
        CC: 90,
        CW: 2,
        WC: 7,
        WW: 1,
        definitions: {
          CC: "champion correct, candidate correct",
          CW: "champion correct, candidate wrong (regression)",
          WC: "champion wrong, candidate correct (improvement)",
          WW: "both wrong",
        },
      },
      aggregates: {
        left_end_to_end_accuracy: 0.9,
        right_end_to_end_accuracy: 0.95,
        improved: 7,
        regressed: 2,
        unchanged: 90,
        still_failing: 1,
        left_failure_type_counts: {
          OK: 90,
          MISMATCH: 6,
          DETECTION_FAILURE: 3,
          INVALID_IMAGE: 1,
        },
        right_failure_type_counts: {
          OK: 95,
          MISMATCH: 3,
          DETECTION_FAILURE: 1,
          INVALID_IMAGE: 1,
        },
      },
      samples: [
        {
          dataset_sample_id: "s1",
          status: "improved",
          matrix: "WC",
          left_correct: false,
          right_correct: true,
          left_failure_type: "MISMATCH",
          right_failure_type: null,
          left_predicted: "123450",
          right_predicted: "123456",
          ground_truth: "123456",
        },
        {
          dataset_sample_id: "s2",
          status: "regressed",
          matrix: "CW",
          left_correct: true,
          right_correct: false,
          left_failure_type: null,
          right_failure_type: "MISMATCH",
          left_predicted: "789012",
          right_predicted: "789019",
          ground_truth: "789012",
        },
      ],
    });
  }),

  http.get("*/v1/evaluations/:id", ({ params }) => {
    return HttpResponse.json({
      ...mockRuns[0],
      id: String(params.id),
    });
  }),

  http.get("*/v1/evaluations/:id/metrics", ({ params }) => {
    return HttpResponse.json({
      evaluation_id: String(params.id),
      status: "completed",
      metrics: [
        {
          metric_group: "overall",
          metric_name: "end_to_end_accuracy",
          metric_value: 0.9,
          metric_unit: "ratio",
          sample_count: 2,
          metadata: null,
          created_at: "2026-01-03T11:01:00+00:00",
        },
      ],
    });
  }),

  http.get("*/v1/evaluations/:id/slices", ({ params }) => {
    return HttpResponse.json({
      evaluation_id: String(params.id),
      dimension: "failure_type",
      min_samples: 1,
      slices: [
        {
          key: "OK",
          sample_count: 2,
          correct: 2,
          incorrect: 0,
          accuracy: 1.0,
          latency_p50_ms: 45,
          meaningful: true,
        },
      ],
      insufficient_sample_slices: [],
      note: "",
    });
  }),

  http.get("*/v1/evaluations/:id/results", () => {
    return HttpResponse.json({
      results: [],
      total: 0,
      limit: 50,
      offset: 0,
    });
  }),

  http.get("*/v1/explorer/samples", ({ request }) => {
    const url = new URL(request.url);
    const taskKey = url.searchParams.get("task_key");
    const lifecycle = url.searchParams.get("lifecycle_state");
    const reviewStatus = url.searchParams.get("review_status");

    const item = {
      source: "databank",
      id: "sample-1",
      dataset_id: "ds-1",
      dataset_name: "data-bank",
      task_key: taskKey ?? "odometer",
      filename: "1-887512.jpg",
      ground_truth: "887512",
      prediction: "887511",
      review_status: reviewStatus ?? "unreviewed",
      lifecycle_state: lifecycle ?? "review_required",
      quality_tag: "good",
      annotation_purpose: "end_to_end",
      match: false,
      image_url: "/v1/databank/datasets/ds-1/samples/sample-1/image",
      created_at: "2026-01-05T10:00:00+00:00",
    };

    return HttpResponse.json({
      items: [item],
      total_estimate: 1,
      limit: Number(url.searchParams.get("limit") || 50),
      offset: Number(url.searchParams.get("offset") || 0),
      filters: {},
      lifecycle_states: ["raw", "review_required", "verified"],
      quality_tags: ["good", "blur"],
    });
  }),

  http.get("*/v1/explorer/samples/:source/:id", ({ params }) => {
    return HttpResponse.json({
      source: String(params.source),
      id: String(params.id),
      dataset_id: "ds-1",
      dataset_name: "data-bank",
      task_key: "odometer",
      filename: "1-887512.jpg",
      ground_truth: "887512",
      ground_truth_normalized: "887512",
      corrected_gt: null,
      final_gt: "887512",
      predictions: [
        {
          kind: "upload",
          value: "887511",
          confidence: 0.92,
          match: false,
        },
      ],
      bbox: null,
      lifecycle_state: "review_required",
      quality_tag: "good",
      annotation_purpose: "end_to_end",
      review_status: "unreviewed",
      review_notes: null,
      image_url: "/v1/databank/datasets/ds-1/samples/sample-1/image",
      provenance: { width: 100, height: 80 },
    });
  }),

  http.patch(
    "*/v1/databank/datasets/:datasetId/samples/:sampleId/lifecycle",
    async ({ request }) => {
      const body = (await request.json()) as { lifecycle_state: string };
      return HttpResponse.json({
        id: "sample-1",
        dataset_id: "ds-1",
        filename: "1-887512.jpg",
        lifecycle_state: body.lifecycle_state,
        review_status: "reviewed",
      });
    },
  ),

  http.get("*/v1/databank/bank", ({ request }) => {
    const url = new URL(request.url);
    const ocrType = url.searchParams.get("ocr_type") || "odometer";
    const datasetType = url.searchParams.get("dataset_type");

    if (datasetType === "raw") {
      return HttpResponse.json({
        id: "raw-bank-1",
        ocr_type: ocrType,
        name: "raw-data-bank",
        version: "1.0.0",
        description: "Default Raw Data repository",
        status: "ready",
        sample_count: 25,
        reviewed_count: 0,
        unreviewed_count: 0,
        has_gt_count: 0,
        no_gt_count: 25,
        raw_pending_count: 25,
        category_counts: {
          raw: { total: 25, reviewed: 0, unreviewed: 25, has_gt: 0, no_gt: 25 },
        },
        custom_categories: [],
        metadata: { dataset_type: "raw" },
      });
    }

    return HttpResponse.json({
      id: ocrType === "bill" ? "bill-bank-1" : "odo-bank-1",
      ocr_type: ocrType,
      name: "data-bank",
      version: "1.0.0",
      description: "Default databank",
      status: "ready",
      sample_count: 50,
      reviewed_count: 20,
      unreviewed_count: 30,
      has_gt_count: 35,
      no_gt_count: 15,
      raw_pending_count: 0,
      category_counts: {
        general: { total: 40, reviewed: 15, unreviewed: 25, has_gt: 30, no_gt: 10 },
        blurry: { total: 5, reviewed: 2, unreviewed: 3, has_gt: 3, no_gt: 2 },
        dead: { total: 5, reviewed: 3, unreviewed: 2, has_gt: 2, no_gt: 3 },
      },
      custom_categories: [],
      metadata: { dataset_type: "label" },
    });
  }),

  http.get("*/v1/databank/raw-bank", ({ request }) => {
    const url = new URL(request.url);
    const ocrType = url.searchParams.get("ocr_type") || "odometer";
    return HttpResponse.json({
      id: "raw-bank-1",
      ocr_type: ocrType,
      name: "raw-data-bank",
      version: "1.0.0",
      description: "Default Raw Data repository",
      status: "ready",
      sample_count: 25,
      reviewed_count: 0,
      unreviewed_count: 0,
      has_gt_count: 0,
      no_gt_count: 25,
      raw_pending_count: 25,
      category_counts: {
        raw: { total: 25, reviewed: 0, unreviewed: 25, has_gt: 0, no_gt: 25 },
      },
      custom_categories: [],
      metadata: { dataset_type: "raw" },
    });
  }),

  http.get("*/v1/databank/datasets", ({ request }) => {
    const url = new URL(request.url);
    const ocrType = url.searchParams.get("ocr_type") || "odometer";
    const datasetType = url.searchParams.get("dataset_type");
    const search = (url.searchParams.get("search") || "").toLowerCase().trim();
    let datasets = [
        {
          id: ocrType === "bill" ? "bill-bank-1" : "odo-bank-1",
          ocr_type: ocrType,
          name: "data-bank",
          version: "1.0.0",
          description: "Default databank",
          status: "ready",
          sample_count: 50,
          reviewed_count: 20,
          unreviewed_count: 30,
          has_gt_count: 35,
          no_gt_count: 15,
          raw_pending_count: 0,
          category_counts: {
            general: { total: 40, reviewed: 15, unreviewed: 25, has_gt: 30, no_gt: 10 },
            blurry: { total: 5, reviewed: 2, unreviewed: 3, has_gt: 3, no_gt: 2 },
            dead: { total: 5, reviewed: 3, unreviewed: 2, has_gt: 2, no_gt: 3 },
          },
          custom_categories: [],
          metadata: { dataset_type: "label" },
        },
        {
          id: "raw-ds-1",
          ocr_type: ocrType,
          name: "raw-batch-2026",
          version: "1.0.0",
          description: "Raw batch upload",
          status: "ready",
          sample_count: 25,
          reviewed_count: 0,
          unreviewed_count: 0,
          has_gt_count: 0,
          no_gt_count: 25,
          raw_pending_count: 25,
          category_counts: {
            raw: { total: 25, reviewed: 0, unreviewed: 25, has_gt: 0, no_gt: 25 },
          },
          custom_categories: [],
          metadata: { dataset_type: "raw" },
        },
        {
          id: "label-ds-1",
          ocr_type: ocrType,
          name: "curated-meters-v1",
          version: "1.0.0",
          description: "Curated meters dataset",
          status: "ready",
          sample_count: 15,
          reviewed_count: 10,
          unreviewed_count: 5,
          has_gt_count: 12,
          no_gt_count: 3,
          raw_pending_count: 0,
          category_counts: {
            general: { total: 10, reviewed: 8, unreviewed: 2, has_gt: 10, no_gt: 0 },
            high_glare: { total: 5, reviewed: 2, unreviewed: 3, has_gt: 2, no_gt: 3 },
          },
          custom_categories: ["high_glare"],
          metadata: { dataset_type: "label" },
        },
    ];

    if (datasetType && datasetType !== "all") {
      datasets = datasets.filter((d) => d.metadata.dataset_type === datasetType);
    }

    if (search) {
      datasets = datasets.filter((d) => d.name.toLowerCase().includes(search) || (d.description || "").toLowerCase().includes(search));
    }

    return HttpResponse.json({
      total: datasets.length,
      datasets,
    });
  }),

  http.get("*/v1/databank/datasets/:datasetId/category-counts", ({ request }) => {
    const url = new URL(request.url);
    const within = url.searchParams.get("within_review_status");
    const hasGt = url.searchParams.get("has_filename_gt");

    if (within === "reviewed") {
      return HttpResponse.json({ general: 15, blurry: 2, dead: 3 });
    }
    if (within === "unreviewed") {
      return HttpResponse.json({ general: 25, blurry: 3, dead: 2 });
    }
    if (hasGt === "true") {
      return HttpResponse.json({ general: 30, blurry: 3, dead: 2 });
    }
    if (hasGt === "false") {
      return HttpResponse.json({ general: 10, blurry: 2, dead: 3 });
    }
    return HttpResponse.json({ general: 40, blurry: 5, dead: 5 });
  }),

  http.get("*/v1/databank/datasets/:datasetId", ({ params }) => {
    return HttpResponse.json({
      id: String(params.datasetId),
      ocr_type: "odometer",
      name: "data-bank",
      version: "1.0.0",
      status: "ready",
      sample_count: 50,
      reviewed_count: 20,
      unreviewed_count: 30,
      has_gt_count: 35,
      no_gt_count: 15,
      category_counts: {
        general: { total: 40, reviewed: 15, unreviewed: 25, has_gt: 30, no_gt: 10 },
        blurry: { total: 5, reviewed: 2, unreviewed: 3, has_gt: 3, no_gt: 2 },
        dead: { total: 5, reviewed: 3, unreviewed: 2, has_gt: 2, no_gt: 3 },
      },
      custom_categories: [],
    });
  }),

  http.post("*/v1/databank/datasets", async ({ request }) => {
    const body = (await request.json()) as { name?: string; ocr_type?: string };
    return HttpResponse.json(
      {
        id: "new-ds-1",
        ocr_type: body.ocr_type || "odometer",
        name: body.name || "new-dataset",
        version: "1.0.0",
        status: "ready",
        sample_count: 0,
        reviewed_count: 0,
        unreviewed_count: 0,
        category_counts: {},
        custom_categories: [],
      },
      { status: 201 },
    );
  }),

  http.delete("*/v1/databank/datasets/:datasetId", () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/v1/databank/datasets/:datasetId/export.csv", () => {
    return new HttpResponse("filename,gt\nsample1.jpg,12345\n", {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="databank.csv"',
      },
    });
  }),

  http.post("*/v1/databank/upload-raw", () => {
    return HttpResponse.json({
      id: "odo-bank-1",
      status: "ready",
      accepted: true,
      message: "Uploaded 1 raw sample",
      added_samples: 1,
    });
  }),

  http.post("*/v1/databank/datasets/:datasetId/upload-raw", ({ params }) => {
    return HttpResponse.json({
      id: String(params.datasetId),
      status: "ready",
      accepted: true,
      message: "Uploaded 1 raw sample",
      added_samples: 1,
    });
  }),

  http.post("*/v1/databank/import-csv-s3", () => {
    return HttpResponse.json({
      id: "odo-bank-1",
      status: "processing",
      accepted: true,
      job_id: "job-csv-1",
      message: "CSV import accepted — downloading images in background",
    });
  }),

  http.post("*/v1/databank/datasets/:datasetId/import-csv-s3", ({ params }) => {
    return HttpResponse.json({
      id: String(params.datasetId),
      status: "processing",
      accepted: true,
      job_id: "job-csv-1",
      message: "CSV import accepted — downloading images in background",
    });
  }),

  http.post("*/v1/databank/datasets/:datasetId/batch-category", async ({ request, params }) => {
    const body = (await request.json()) as { sample_ids: string[]; category: string };
    return HttpResponse.json({
      dataset_id: String(params.datasetId),
      count: body.sample_ids.length,
      category: body.category,
    });
  }),

  http.post("*/v1/databank/datasets/:datasetId/batch-move", async ({ request, params }) => {
    const body = (await request.json()) as {
      sample_ids: string[];
      target_dataset_id: string;
      target_category: string;
    };
    return HttpResponse.json({
      moved_count: body.sample_ids.length,
      source_dataset_id: String(params.datasetId),
      target_dataset_id: body.target_dataset_id,
      target_category: body.target_category,
    });
  }),

  http.get("*/v1/databank/datasets/:datasetId/samples", () => {
    return HttpResponse.json({
      total: 1,
      limit: 25,
      offset: 0,
      samples: [
        {
          id: "sample-1",
          dataset_id: "odo-bank-1",
          filename: "1-887512.jpg",
          relative_path: "samples/1-887512.jpg",
          has_ground_truth: true,
          ground_truth: "887512",
          review_status: "reviewed",
          category: "",
          is_blurry: false,
          display_bbox: { x1: 20, y1: 15, x2: 80, y2: 65, confidence: 0.95, label: "gemini" },
          bbox: { x1: 20, y1: 15, x2: 80, y2: 65, confidence: 0.95, label: "gemini" },
          created_at: "2026-01-05T10:00:00+00:00",
        },
      ],
    });
  }),

  http.get("*/v1/databank/datasets/:datasetId/samples/:sampleId/image", () => {
    return new HttpResponse(new Blob(["mock-image"], { type: "image/jpeg" }));
  }),

  http.patch(
    "*/v1/databank/datasets/:datasetId/samples/:sampleId/quality-tag",
    async ({ request }) => {
      const body = (await request.json()) as { quality_tag: string };
      return HttpResponse.json({
        id: "sample-1",
        dataset_id: "ds-1",
        filename: "1-887512.jpg",
        quality_tag: body.quality_tag,
        review_status: "unreviewed",
      });
    },
  ),

  http.get("*/v1/scraper/prompts", () => {
    return HttpResponse.json({
      prompts: [
        {
          id: "odometer_reading",
          name: "Odometer Digits & Bounding Box",
          prompt:
            "1. Does this image relate to a car dashboard?\n2. Does this image relate to an odometer?\n3. Is this image natural (a real-world photograph, not an artificially generated or edited image)?\n\nIf all 3 conditions are true, perform the following:\n\n- Read the numeric odometer value displayed in the image.\n- Detect the **tightest possible 2D bounding box around ONLY the visible odometer digits/value**.\n- The bounding box must tightly enclose all digits representing the odometer reading.\n- Do NOT include the complete display area, screen boundaries, display frame, dashboard panel, surrounding labels, icons, or other elements.\n- Exclude units, symbols, and unrelated text unless they are visually part of the numeric odometer reading.\n- Keep the bounding box as close to the outer edges of the first and last digits as possible, with minimal padding.\n- If the odometer value contains multiple digits, include all digits in a single bounding box.\n\nReturn JSON ONLY in this format:\n\n{\n  \"ground_truth\": \"<numeric digits>\",\n  \"box_2d\": [ymin, xmin, ymax, xmax]\n}\n\nWhere:\n- `ground_truth`: The numeric odometer reading exactly as displayed, without spaces or separators.\n- `box_2d`: Bounding box coordinates around ONLY the odometer digits, in [ymin, xmin, ymax, xmax] order.\n- Coordinates must be normalized to a range of 0–1000 relative to the original image dimensions.\n\nIf any of the 3 conditions fail, or the odometer digits are missing, unclear, partially unreadable, or impossible to localize accurately, return:\n\n{\"ground_truth\": null, \"box_2d\": null}",
        },
      ],
    });
  }),

  http.get("*/v1/scraper/gemini-config", () => {
    return HttpResponse.json({
      has_api_key: true,
      default_model: "gemini-3.5-flash-lite",
      available_models: [
        { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite (Fastest & Stable)" },
      ],
    });
  }),

  http.put("*/v1/scraper/images/:id/ground-truth", async ({ request, params }) => {
    const body = (await request.json()) as {
      ground_truth: string | null;
      bbox?: { x1: number; y1: number; x2: number; y2: number } | null;
    };
    return HttpResponse.json({
      id: String(params.id),
      session_id: "sess-1",
      category_id: "cat-1",
      category_name: "Odometers",
      source_url: "https://example.com/x.jpg",
      file_path: "/data/x.jpg",
      content_hash: "hash",
      alt_text: null,
      context: null,
      file_size_bytes: 1000,
      width: 100,
      height: 80,
      page_url: "https://example.com",
      ground_truth: body.ground_truth,
      gt_bbox: body.bbox ?? null,
      created_at: "2026-01-05T10:00:00+00:00",
    });
  }),

  http.post("*/v1/scraper/promote-to-databank", async ({ request }) => {
    const body = (await request.json()) as {
      image_ids: string[];
      ocr_type?: string;
      dataset_id?: string;
    };
    const ids = body.image_ids ?? [];
    return HttpResponse.json({
      dataset_id: body.dataset_id ?? "cat-dataset-1",
      promoted: ids.length,
      skipped: [],
      sample_ids: ids.map((id) => `sample-${id}`),
    });
  }),

  http.post("*/v1/scraper/label-jobs", async ({ request }) => {
    const body = (await request.json()) as { category_id?: string };
    return HttpResponse.json({
      job: {
        id: "label-job-1",
        category_id: body.category_id ?? null,
        session_id: null,
        status: "pending",
        total: 10,
        processed: 0,
        saved: 0,
        failed: 0,
        error: null,
        created_at: "2026-01-06T10:00:00+00:00",
        completed_at: null,
      },
    });
  }),

  http.get("*/v1/scraper/label-jobs/:id", ({ params }) => {
    return HttpResponse.json({
      job: {
        id: String(params.id),
        category_id: "cat-1",
        session_id: null,
        status: "running",
        total: 10,
        processed: 4,
        saved: 3,
        failed: 1,
        error: null,
        created_at: "2026-01-06T10:00:00+00:00",
        completed_at: null,
      },
    });
  }),

  http.post("*/v1/scraper/label-jobs/:id/stop", ({ params }) => {
    return HttpResponse.json({
      job: {
        id: String(params.id),
        category_id: "cat-1",
        session_id: null,
        status: "stopped",
        total: 10,
        processed: 4,
        saved: 3,
        failed: 1,
        error: null,
        created_at: "2026-01-06T10:00:00+00:00",
        completed_at: "2026-01-06T10:05:00+00:00",
      },
    });
  }),

  http.get("*/v1/scraper/label-jobs", ({ request }) => {
    const url = new URL(request.url);
    const categoryId = url.searchParams.get("category_id");
    return HttpResponse.json({
      jobs: [
        {
          id: "label-job-1",
          category_id: categoryId ?? "cat-1",
          session_id: null,
          status: "completed",
          total: 10,
          processed: 10,
          saved: 9,
          failed: 1,
          error: null,
          created_at: "2026-01-06T10:00:00+00:00",
          completed_at: "2026-01-06T10:10:00+00:00",
        },
      ],
    });
  }),

  http.get("*/v1/models/recognition-configs", () => {
    return HttpResponse.json({
      configs: [
        {
          id: "rec-cfg-1",
          name: "odometer-recognition",
          version: "1.0.0",
          status: "verified",
          artifact_digest: "sha256:1234567890abcdef",
          pipeline_impl_version: "odometer_rec_v1",
          selection_strategy: "best_digit_confidence",
          is_linked: false,
          linked_pipeline_refs: [],
          config: {
            candidate_selection: {
              strategy: "best_digit_confidence",
              candidates: ["identity", "clahe", "adaptive_threshold", "otsu_threshold"],
            },
            image_preprocessing: {
              adaptive_block_size: 15,
              adaptive_c: 5,
              clahe_clip: 2,
              denoise_strength: 3,
            },
          },
          created_at: "2026-01-01T12:00:00Z",
        },
      ],
      defaults: {
        candidate_selection: {
          strategy: "best_digit_confidence",
          candidates: ["identity", "clahe", "adaptive_threshold", "otsu_threshold"],
        },
        image_preprocessing: {
          adaptive_block_size: 15,
          adaptive_c: 5,
          clahe_clip: 2,
          denoise_strength: 3,
        },
      },
      total: 1,
    });
  }),

  http.post("*/v1/models/recognition-configs", async ({ request }) => {
    const body = (await request.json()) as {
      name: string;
      version?: string;
      bump?: string;
      config: Record<string, unknown>;
    };
    return HttpResponse.json({
      id: "rec-cfg-new",
      name: body.name || "odometer-recognition",
      version: body.version || "1.0.1",
      status: "verified",
      artifact_digest: "sha256:fedcba0987654321",
      pipeline_impl_version: "odometer_rec_v1",
      selection_strategy: "best_digit_confidence",
      is_linked: false,
      linked_pipeline_refs: [],
      config: body.config,
      created_at: new Date().toISOString(),
    });
  }),

  http.put("*/v1/models/recognition-configs/:id", async ({ request, params }) => {
    const body = (await request.json()) as {
      name?: string;
      config?: Record<string, unknown>;
    };
    return HttpResponse.json({
      id: String(params.id),
      name: body.name || "odometer-recognition",
      version: "1.0.0",
      status: "verified",
      artifact_digest: "sha256:updateddigest1234",
      pipeline_impl_version: "odometer_rec_v1",
      selection_strategy: "best_digit_confidence",
      is_linked: false,
      linked_pipeline_refs: [],
      config: body.config,
      updated_at: new Date().toISOString(),
    });
  }),

  http.delete("*/v1/models/recognition-configs/:id", ({ params }) => {
    return HttpResponse.json({
      deleted: true,
      retired: false,
      message: `Deleted config ${params.id}`,
      id: String(params.id),
      name: "odometer-recognition",
      version: "1.0.0",
    });
  }),

  http.get("*/v1/models/recognition-configs/preview-cases", ({ request }) => {
    const url = new URL(request.url);
    const failureType = url.searchParams.get("failure_type");
    const failuresOnly = url.searchParams.get("failures_only") === "true";

    let cases = [
      {
        result_id: "res-1",
        filename: "sample1.png",
        ground_truth: "887512",
        predicted: "887510",
        is_correct: false,
        failure_type: "MISMATCH",
        bbox_source: "corrected",
      },
      {
        result_id: "res-2",
        filename: "sample2.png",
        ground_truth: "123456",
        predicted: "123456",
        is_correct: true,
        failure_type: "OK",
        bbox_source: "detected",
      },
    ];

    if (failureType === "failures" || failuresOnly) {
      cases = cases.filter((c) => !c.is_correct);
    } else if (failureType === "correct") {
      cases = cases.filter((c) => c.is_correct);
    } else if (failureType && failureType !== "all") {
      cases = cases.filter((c) => c.failure_type === failureType);
    }

    return HttpResponse.json({
      evaluation_id: "eval-1",
      dataset_id: "ds-1",
      total: cases.length,
      cases,
      failure_type_counts: {
        MISMATCH: 1,
        OK: 1,
      },
    });
  }),

  http.post("*/v1/models/recognition-configs/preview", () => {
    return HttpResponse.json({
      summary: {
        attempted: 2,
        matches_gt: 2,
        match_rate: 1.0,
      },
      previews: [
        {
          result_id: "res-1",
          filename: "sample1.png",
          ground_truth: "887512",
          prior_predicted: "887510",
          prior_correct: false,
          ok: true,
          predicted: "887512",
          matches_gt: true,
          improved: true,
          selected_candidate: "otsu_threshold",
          confidence: 0.98,
          visuals: {
            crop_image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            candidate_images: [
              {
                name: "identity",
                image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
              },
              {
                name: "otsu_threshold",
                image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
              },
            ],
          },
        },
        {
          result_id: "res-2",
          filename: "sample2.png",
          ground_truth: "123456",
          prior_predicted: "123456",
          prior_correct: true,
          ok: true,
          predicted: "123456",
          matches_gt: true,
          improved: false,
          selected_candidate: "adaptive_threshold",
          confidence: 0.99,
          visuals: {
            crop_image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            candidate_images: [
              {
                name: "identity",
                image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
              },
              {
                name: "adaptive_threshold",
                image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
              },
            ],
          },
        },
      ],
    });
  }),

  http.post("*/v1/databank/datasets/:datasetId/samples/:sampleId/extract-gemini", () => {
    return HttpResponse.json({
      extracted_value: "887512",
      bbox: { x1: 20, y1: 15, x2: 80, y2: 65, confidence: 0.95, label: "gemini" },
      model: "gemini-3.5-flash-lite",
      prompt: "Extract odometer digits and box_2d",
    });
  }),

  http.post("*/v1/evaluation/datasets/:datasetId/samples/:sampleId/extract-gemini", () => {
    return HttpResponse.json({
      extracted_value: "887512",
      bbox: { x1: 20, y1: 15, x2: 80, y2: 65, confidence: 0.95, label: "gemini" },
      model: "gemini-3.5-flash-lite",
      prompt: "Extract odometer digits and box_2d",
    });
  }),

  http.post("*/v1/databank/datasets/:datasetId/samples/:sampleId/review", async ({ request }) => {
    const body = (await request.json()) as { corrected_gt?: string; corrected_bbox?: Record<string, unknown> };
    return HttpResponse.json({
      id: "sample-1",
      dataset_id: "odo-bank-1",
      filename: "1-887512.jpg",
      corrected_gt: body.corrected_gt,
      corrected_bbox: body.corrected_bbox,
      review_status: "reviewed",
    });
  }),

  http.get("*/v1/training/augmentation/strategies", () => {
    return HttpResponse.json({
      strategies: [
        { key: "rotate_small", label: "Small Rotation", category: "geometric", description: "Random tilt", has_bbox_transform: true },
        { key: "rotate_90", label: "Rotate 90°", category: "geometric", description: "Clockwise 90", has_bbox_transform: true },
        { key: "flip_h", label: "Flip Horizontal", category: "geometric", description: "Mirror", has_bbox_transform: true },
        { key: "brightness", label: "Brightness High", category: "photometric", description: "Increase exposure", has_bbox_transform: false },
        { key: "sun_glare", label: "Sun Glare", category: "photometric", description: "Glare flare", has_bbox_transform: false },
        { key: "motion_blur", label: "Motion Blur", category: "noise_blur", description: "Vibration blur", has_bbox_transform: false },
        { key: "noise", label: "Noise", category: "noise_blur", description: "Sensor grain", has_bbox_transform: false },
        { key: "cutout", label: "Cutout", category: "occlusion", description: "Obstruction patch", has_bbox_transform: false },
      ],
    });
  }),

  http.post("*/v1/training/augmentation/preview", () => {
    return HttpResponse.json({
      original: {
        data_url: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
        width: 640,
        height: 480,
        bbox: { x1: 100, y1: 120, x2: 300, y2: 240 },
      },
      augmented: {
        data_url: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
        width: 640,
        height: 480,
        bbox: { x1: 340, y1: 120, x2: 540, y2: 240 },
      },
      strategies_applied: ["rotate_small", "sun_glare"],
    });
  }),

  http.post("*/v1/training/suggest-version", () => {
    return HttpResponse.json({
      name: "odometer-detector-v8s",
      parent_version: "1.0.0",
      suggested_version: "1.1.0",
      bump_level: "minor",
    });
  }),

  http.post("*/v1/training/runs", () => {
    return HttpResponse.json({
      id: "run-test-123",
      name: "odometer-detector-v8s",
      version: "1.1.0",
      role: "detection",
      status: "queued",
      progress_pct: 0,
    });
  }),

  http.get("*/v1/training/adapters", () => {
    return HttpResponse.json({
      adapters: [
        {
          id: "ultralytics_detection",
          name: "Ultralytics YOLO Detection",
          roles: ["detection"],
          default_hyperparameters: {},
        },
      ],
    });
  }),

  http.get("*/v1/settings", () => {
    return HttpResponse.json({
      inference: {
        request_timeout_seconds: 30,
        max_image_bytes: 10_000_000,
      },
      workers: {
        training_worker_enabled: true,
        evaluation_worker_enabled: true,
        training_max_concurrency: 1,
        evaluation_max_concurrency: 2,
      },
      training_gates: {
        auto_promote: false,
        auto_retrain_enabled: false,
        min_exact_match: 0.95,
        max_cer_regression: 0.02,
      },
      observability: {
        metrics_enabled: true,
      },
      note: "Operator settings are env-driven; mutate via deployment config, not this API.",
    });
  }),

  http.get("*/v1/tasks", () => {
    return HttpResponse.json({ tasks: mockTasks });
  }),

  http.get("*/v1/tasks/:taskKey", ({ params }) => {
    const task =
      mockTasks.find((t) => t.key === params.taskKey) ?? mockTasks[0]!;
    return HttpResponse.json(task);
  }),

  // Bill OCR APIs — test doubles only (never used in production UI paths)
  http.get("*/v1/bill/profiles", () => {
    return HttpResponse.json({
      profiles: [
        {
          profile_id: "generic_invoice",
          name: "Generic Invoice",
          version: "1",
          status: "ACTIVE",
          field_count: 8,
        },
      ],
    });
  }),

  http.get("*/v1/bill/profiles/generated", () => {
    return HttpResponse.json({ drafts: [] });
  }),

  http.get("*/v1/bill/profiles/:profileId", ({ params }) => {
    return HttpResponse.json({
      profile_id: params.profileId,
      name: "Generic Invoice",
      version: "1",
      status: "ACTIVE",
      fields: [
        { field_name: "invoice_number", type: "IDENTIFIER", required: true },
        { field_name: "grand_total", type: "CURRENCY", required: true },
      ],
    });
  }),

  http.get("*/v1/bill/providers", () => {
    return HttpResponse.json({
      providers: [
        { type: "ocr", name: "paddle_ocr", production: true },
        { type: "layout", name: "paddle_layout", production: true },
      ],
      readiness: { ready: true, components: {} },
      forbidden_in_production: ["fixture_ocr", "scripted_vlm_test"],
    });
  }),

  http.get("*/v1/bill/models", () => {
    return HttpResponse.json({
      vlm_enabled: false,
      vlm_provider: "disabled",
      ocr_provider: "paddle_ocr",
      pipeline_version: "bill-ocr-production-v3.0.0",
    });
  }),

  http.get("*/v1/bill/failures/taxonomy", () => {
    return HttpResponse.json({
      codes: ["OCR_FAILURE", "FIELD_AMBIGUOUS", "VALIDATION_FAILURE"],
      retryable: ["OCR_FAILURE"],
      review_required: ["FIELD_AMBIGUOUS"],
    });
  }),

  http.get("*/v1/bill/feedback", () => {
    return HttpResponse.json({ feedback: [] });
  }),

  http.post("*/v1/documents/process", async () => {
    return HttpResponse.json({
      job_id: "job-test-1",
      document_id: "DOC-test-1",
      status: "COMPLETED",
      result: {
        document_id: "DOC-test-1",
        document_type: "INVOICE",
        status: "COMPLETED",
        fields: {
          invoice_number: {
            value: "INV-1",
            confidence: 0.9,
            status: "EXTRACTED",
            strategy: "RULE",
          },
        },
        line_items: [],
        tables: [],
        validation: { status: "PASSED", results: [], failed_count: 0 },
        confidence: { overall: 0.9, level: "HIGH" },
        review: { required: false, fields: [] },
        processing: {
          pipeline_version: "bill-ocr-production-v3.0.0",
          profile_id: "generic_invoice",
          stage_metrics: { ocr_ms: 12 },
        },
        failures: [],
        evidence_refs: {
          ocr_blocks: [
            {
              id: "tb-1",
              text: "INV-1",
              bbox: [10, 10, 80, 30],
              confidence: 0.95,
              page_id: "page-1",
            },
          ],
        },
      },
      pipeline_version: "bill-ocr-production-v3.0.0",
    });
  }),

  http.get("*/v1/documents/:documentId/result", ({ params }) => {
    return HttpResponse.json({
      document_id: params.documentId,
      status: "COMPLETED",
      fields: {
        invoice_number: {
          value: "INV-1",
          confidence: 0.9,
          status: "EXTRACTED",
        },
      },
      validation: { status: "PASSED", results: [] },
      confidence: { overall: 0.9, level: "HIGH" },
      processing: { pipeline_version: "bill-ocr-production-v3.0.0" },
      failures: [],
      page_previews: [],
    });
  }),

  http.get("*/v1/documents/:documentId/pages", ({ params }) => {
    return HttpResponse.json({
      document_id: params.documentId,
      pages: [],
      page_count: 0,
    });
  }),

  http.get("*/v1/documents/:documentId/pages/:pageNumber/image", () => {
    return new HttpResponse(null, { status: 404 });
  }),

  http.get("*/v1/documents/:documentId/evidence", () => {
    return HttpResponse.json({
      document_id: "DOC-test-1",
      evidence_refs: { ocr_blocks: [] },
      conflicts: [],
      vlm: null,
    });
  }),

  http.get("*/v1/documents/:documentId/review", () => {
    return HttpResponse.json({
      document_id: "DOC-test-1",
      review_required: false,
      fields: [],
    });
  }),

  http.post("*/v1/documents/:documentId/review", async () => {
    return HttpResponse.json({
      status: "recorded",
      feedback_id: "fb-1",
      auto_retrain: false,
      message: "Correction recorded",
    });
  }),

  http.post("*/v1/bill/datasets/import/validate", async () => {
    return HttpResponse.json({
      valid: true,
      documents_found: 3,
      labeled: 1,
      partial: 1,
      unlabeled: 1,
      invalid: 0,
      valid_documents: 3,
      invalid_documents: 0,
      missing_documents: 0,
      orphan_annotations: 0,
      duplicate_ids: 0,
      invalid_annotations: 0,
      unsupported_files: 0,
      issues: [],
    });
  }),

  http.get("*/v1/bill/datasets/:datasetId/issues", () => {
    return HttpResponse.json({ dataset_id: "ds-1", issues: [] });
  }),

  http.get("*/v1/bill/datasets/:datasetId/summary", () => {
    return HttpResponse.json({
      dataset_id: "ds-1",
      labeled_count: 0,
      partial_count: 0,
      unlabeled_count: 0,
    });
  }),
];
