export type DatasetStatus =
  | "uploading"
  | "processing"
  | "ready"
  | "failed"
  | "archived"
  | "consumed";

export type EvaluationRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type EvaluationType = "test" | "benchmark" | "regression";

export interface EvaluationDataset {
  id: string;
  name: string;
  ocr_type: string;
  version: string;
  description: string | null;
  source_type: string;
  source_reference: string | null;
  /** upload | curated_hard_case | merged_training | system | … */
  origin?: string | null;
  /** evaluation | training */
  scope?: string | null;
  /** false for curated/merged until explicitly allowed */
  evaluation_eligible?: boolean;
  /** Parent datasets when this row is a merge */
  merged_from?: Array<{
    id: string;
    name: string;
    version: string;
    ocr_type?: string;
    origin?: string;
    sample_count?: number;
    manifest_digest?: string | null;
    pack?: string | null;
  }> | null;
  image_mode: string | null;
  sample_count: number;
  status: DatasetStatus | string;
  storage_path: string | null;
  manifest_digest: string | null;
  metadata: Record<string, unknown> | null;
  /** recognition_crops | detection_full | … */
  pack?: string | null;
  /** train / val / test counts for recognition packs */
  split_counts?: {
    train?: number;
    val?: number;
    test?: number;
  } | null;
  created_at: string | null;
  created_by: string | null;
  archived_at: string | null;
  locked_at: string | null;
  /** True when an evaluation is queued/running against this dataset */
  has_active_evaluation?: boolean;
  can_soft_delete?: boolean;
  can_hard_delete?: boolean;
  soft_delete_blocked_reason?: string | null;
  hard_delete_blocked_reason?: string | null;
}

export interface DatasetSample {
  id: string;
  dataset_id: string;
  relative_path: string;
  filename: string;
  ground_truth: string;
  ground_truth_normalized: string;
  image_format: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  status: string;
  split?: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

export interface EvaluationRun {
  id: string;
  dataset_id: string;
  dataset_name?: string | null;
  dataset_version?: string | null;
  ocr_type: string;
  model_ref: string | null;
  detection_artifact_id: string;
  recognition_artifact_id: string;
  evaluation_type: EvaluationType | string;
  evaluator_version: string;
  evaluation_config: Record<string, unknown> | null;
  status: EvaluationRunStatus | string;
  total_samples: number;
  processed_samples: number;
  successful_samples: number;
  failed_samples: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  created_by: string | null;
  error_message: string | null;
  dataset_manifest_digest?: string | null;
  dataset_sample_count_snapshot?: number | null;
  metrics?: Record<string, number> | null;
}

export interface EvaluationResult {
  id: string;
  evaluation_id: string;
  dataset_id: string | null;
  dataset_sample_id: string;
  filename: string | null;
  relative_path: string | null;
  predicted_value: string | null;
  predicted_normalized: string | null;
  ground_truth: string | null;
  ground_truth_normalized: string | null;
  is_correct: boolean | null;
  confidence: number | null;
  processing_time_ms: number | null;
  detection_success: boolean | null;
  recognition_success: boolean | null;
  detection_confidence: number | null;
  recognition_confidence: number | null;
  error_type: string | null;
  error_message: string | null;
  fail_stage: string | null;
  failure_type?: string | null;
  quality_flags?: string[];
  review_status?: string | null;
  corrected_gt?: string | null;
  corrected_bbox?: Record<string, unknown> | null;
  review_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  selected_detection: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    confidence: number;
    label: string | null;
  } | null;
  detections: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    confidence: number;
    label: string | null;
  }>;
  image_size: { width: number; height: number } | null;
  image_available: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

export interface EvaluationMetric {
  metric_group: string;
  metric_name: string;
  metric_value: number;
  metric_unit: string | null;
  sample_count: number;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

export interface ListDatasetsParams {
  ocr_type?: string;
  status?: string;
  search?: string;
  /** evaluation = main Datasets tab; training = curated/merged tab */
  scope?: "evaluation" | "training";
  include_archived?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListDatasetsResponse {
  datasets: EvaluationDataset[];
  total: number;
  limit: number | null;
  offset: number;
}

export interface ListSamplesResponse {
  samples: DatasetSample[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListEvaluationsParams {
  ocr_type?: string;
  model_ref?: string;
  dataset_id?: string;
  detection_artifact_id?: string;
  recognition_artifact_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
  include_metrics?: boolean;
}

export interface ListEvaluationsResponse {
  evaluations: EvaluationRun[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListResultsResponse {
  results: EvaluationResult[];
  total: number;
  limit: number;
  offset: number;
  dataset_id?: string;
}

export interface EvaluationMetricsResponse {
  evaluation_id: string;
  status: string;
  metrics: EvaluationMetric[];
}

export interface CreateDatasetPayload {
  ocr_type: string;
  name?: string;
  version?: string;
  description?: string;
  origin?: string;
}

export interface StartEvaluationPayload {
  dataset_id: string;
  ocr_type?: string;
  model_ref?: string;
  detection_artifact_id?: string;
  recognition_artifact_id?: string;
  evaluation_type?: EvaluationType | string;
}
