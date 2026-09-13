/**
 * Honest capability map for Bill Dataset Management.
 * Only list capabilities with real backend endpoints.
 */

export type BillDatasetCapability =
  | "list_datasets"
  | "create_dataset"
  | "upload_dataset_zip"
  | "archive_dataset"
  | "delete_dataset"
  | "list_samples"
  | "update_sample_gt"
  | "sample_image"
  | "list_evaluations"
  | "start_evaluation"
  | "cancel_evaluation"
  | "evaluation_metrics"
  | "evaluation_compare"
  | "hard_failures"
  | "platform_jobs"
  | "cancel_platform_job"
  | "bill_process_sync"
  | "bill_job_get"
  | "bill_document_by_id"
  | "bill_review_correction"
  | "bill_feedback_list"
  | "bill_feedback_export"
  | "bill_profiles"
  | "bill_failure_taxonomy"
  | "explorer_samples"
  | "import_validate"
  | "canonical_datasets";

export type CapabilityStatus = "available" | "partial" | "unavailable";

export const BILL_DATASET_CAPABILITIES: Record<
  BillDatasetCapability,
  {
    status: CapabilityStatus;
    endpoint: string;
    notes: string;
    tabs: string[];
  }
> = {
  list_datasets: {
    status: "available",
    endpoint: "GET /v1/evaluation/datasets?ocr_type=bill",
    notes: "Shared evaluation datasets filtered to bill",
    tabs: ["Datasets", "Versions"],
  },
  create_dataset: {
    status: "available",
    endpoint: "POST /v1/evaluation/datasets",
    notes: "Creates dataset row; ZIP layout is odometer-oriented",
    tabs: ["Datasets"],
  },
  upload_dataset_zip: {
    status: "available",
    endpoint: "POST /v1/bill/datasets/import (+ validate)",
    notes: "Bill package: manifest.jsonl + documents/ + annotations/",
    tabs: ["Datasets"],
  },
  archive_dataset: {
    status: "available",
    endpoint: "POST /v1/evaluation/datasets/{id}/archive",
    notes: "Soft delete",
    tabs: ["Datasets"],
  },
  delete_dataset: {
    status: "available",
    endpoint: "DELETE /v1/evaluation/datasets/{id}",
    notes: "Hard delete when allowed",
    tabs: ["Datasets"],
  },
  list_samples: {
    status: "available",
    endpoint: "GET /v1/evaluation/datasets/{id}/samples",
    notes: "Server-paginated samples",
    tabs: ["Data List", "Annotations", "Versions"],
  },
  update_sample_gt: {
    status: "partial",
    endpoint: "PATCH /v1/evaluation/datasets/{id}/samples/{sid}",
    notes: "String ground_truth + bbox only — not bill field schema",
    tabs: ["Annotations"],
  },
  sample_image: {
    status: "available",
    endpoint: "GET /v1/evaluation/datasets/{id}/samples/{sid}/image",
    notes: "Raster preview",
    tabs: ["Data List", "Annotations"],
  },
  list_evaluations: {
    status: "partial",
    endpoint: "GET /v1/evaluations?ocr_type=bill",
    notes: "Runner is det/rec string-GT oriented",
    tabs: ["Evaluation"],
  },
  start_evaluation: {
    status: "partial",
    endpoint: "POST /v1/evaluations",
    notes: "Requires detection+recognition artifacts",
    tabs: ["Evaluation"],
  },
  cancel_evaluation: {
    status: "available",
    endpoint: "POST /v1/evaluations/{id}/cancel",
    notes: "Cancel running evaluation",
    tabs: ["Evaluation", "Jobs"],
  },
  evaluation_metrics: {
    status: "partial",
    endpoint: "GET /v1/evaluations/{id}/metrics",
    notes: "Odometer-style exact/CER metrics",
    tabs: ["Evaluation"],
  },
  evaluation_compare: {
    status: "available",
    endpoint: "GET /v1/evaluations/compare",
    notes: "Compare two runs",
    tabs: ["Evaluation"],
  },
  hard_failures: {
    status: "partial",
    endpoint: "GET /v1/evaluations/hard-failures",
    notes: "Evaluation hard failures for bill ocr_type",
    tabs: ["Issues"],
  },
  platform_jobs: {
    status: "partial",
    endpoint: "GET /v1/jobs?task_key=bill",
    notes: "Generic async OCR/batch — not full multipage bill pipeline",
    tabs: ["Jobs"],
  },
  cancel_platform_job: {
    status: "available",
    endpoint: "POST /v1/jobs/{id}/cancel",
    notes: "Cancel async platform job",
    tabs: ["Jobs"],
  },
  bill_process_sync: {
    status: "available",
    endpoint: "POST /v1/documents/process",
    notes: "Synchronous bill document intelligence",
    tabs: ["Jobs", "Data List"],
  },
  bill_job_get: {
    status: "available",
    endpoint: "GET /v1/bill/jobs/{id}",
    notes: "Lookup by process job_id",
    tabs: ["Jobs"],
  },
  bill_document_by_id: {
    status: "available",
    endpoint: "GET /v1/documents/{id}/result",
    notes: "No list-documents API — by-id only",
    tabs: ["Data List", "Review"],
  },
  bill_review_correction: {
    status: "available",
    endpoint: "POST /v1/documents/{id}/review",
    notes: "Single-field correction → feedback store",
    tabs: ["Review", "Annotations"],
  },
  bill_feedback_list: {
    status: "available",
    endpoint: "GET /v1/bill/feedback",
    notes: "Human corrections list",
    tabs: ["Review", "Annotations"],
  },
  bill_feedback_export: {
    status: "available",
    endpoint: "POST /v1/bill/feedback/export",
    notes: "Export JSONL path on server",
    tabs: ["Datasets"],
  },
  bill_profiles: {
    status: "available",
    endpoint: "GET /v1/bill/profiles",
    notes: "Schema/profile catalog",
    tabs: ["Versions", "Annotations"],
  },
  bill_failure_taxonomy: {
    status: "available",
    endpoint: "GET /v1/bill/failures/taxonomy",
    notes: "Failure codes — not per-doc issue workflow",
    tabs: ["Issues"],
  },
  explorer_samples: {
    status: "available",
    endpoint: "GET /v1/explorer/samples?task_key=bill",
    notes: "Cross-source sample search",
    tabs: ["Data List", "Annotations"],
  },
  import_validate: {
    status: "available",
    endpoint: "POST /v1/bill/datasets/import/validate",
    notes: "Full Bill package validation with issue report",
    tabs: ["Datasets"],
  },
  canonical_datasets: {
    status: "available",
    endpoint: "GET /v1/canonical-datasets?task_key=bill",
    notes: "Canonical version registry",
    tabs: ["Versions"],
  },
};

/** Gaps with no suitable Bill endpoint today */
export const BILL_DATASET_GAPS = [
  "GET /v1/documents (list/search/paginate processed bill documents)",
  "Async multipage bill process job API for dataset batches",
  "Bill field-level evaluation runner (det/rec string metrics only today)",
  "Bulk bill review corrections API",
  "Per-document issue resolve/ignore workflow CRUD",
] as const;
