import { http, HttpResponse } from "msw";

import type { EvaluationDataset, EvaluationRun } from "@/types/evaluation";
import type { ModelArtifact, PipelineRef } from "@/types/models";

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
];
