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
      detection_success_rate: 0.98,
      recognition_exact_match_accuracy: 0.91,
      end_to_end_accuracy: 0.9,
      end_to_end_success_rate: 0.93,
      latency_p50_ms: 45,
      latency_p95_ms: 120,
      last_evaluated_at: "2026-01-02T00:00:00+00:00",
      latest_metrics: null,
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
      evaluations: mockRuns.map((run) => ({
        ...run,
        metrics: {
          detection_success_rate: 0.98,
          detection_miss_rate: 0.02,
          avg_detection_confidence: 0.91,
          recognition_success_rate: 0.95,
          exact_match_accuracy: 0.9,
          end_to_end_accuracy: 0.9,
          end_to_end_success_rate: 0.93,
          low_confidence_rate: 0.05,
          latency_p50_ms: 45,
          latency_p95_ms: 120,
        },
      })),
      total: mockRuns.length,
      limit: 50,
      offset: 0,
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
    return HttpResponse.json({
      id: ocrType === "bill" ? "bill-bank-1" : "odo-bank-1",
      ocr_type: ocrType,
      name: "data-bank",
      version: "1.0.0",
      status: "ready",
      sample_count: 0,
      reviewed_count: 0,
      unreviewed_count: 0,
      category_counts: {},
      custom_categories: [],
    });
  }),

  http.get("*/v1/databank/datasets/:datasetId/samples", () => {
    return HttpResponse.json({
      total: 0,
      limit: 25,
      offset: 0,
      samples: [],
    });
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
