export type OcrType = "odometer" | "number_plate" | "bill" | "vin" | "document";
export type ModelRole = "detection" | "recognition";
export type ArtifactStatus =
  | "uploaded"
  | "verified"
  | "active_eligible"
  | "retired"
  | "missing_file"
  | "digest_mismatch";

export interface EvaluationMetrics {
  model_ref: string | null;
  evaluation_count_completed: number | null;
  total_images_evaluated: number | null;
  detection_success_rate: number | null;
  recognition_exact_match_accuracy: number | null;
  end_to_end_accuracy: number | null;
  end_to_end_success_rate: number | null;
  latency_p50_ms: number | null;
  latency_p95_ms: number | null;
  last_evaluated_at: string | null;
  latest_metrics?: Record<string, Record<string, number>> | null;
}

export interface ModelArtifact {
  id: string;
  ocr_type: OcrType | string;
  role: ModelRole | string;
  name: string;
  version: string;
  runtime: string;
  framework: string | null;
  filename: string;
  storage_path: string;
  artifact_digest: string;
  size_bytes: number;
  status: ArtifactStatus | string;
  metadata: Record<string, unknown> | null;
  training_accuracy: number | null;
  ground_accuracy?: number | null;
  training_base_artifact_id?: string | null;
  training_run_id?: string | null;
  created_at: string | null;
  created_by: string | null;
  retired_at: string | null;
  evaluation_metrics?: EvaluationMetrics | null;
}

export interface ListArtifactsParams {
  ocr_type?: string;
  role?: string;
  status?: string;
  exclude_status?: string;
  runtime?: string;
  search?: string;
  limit?: number;
  offset?: number;
  include_metrics?: boolean;
  include_cycle_hidden?: boolean;
}

export interface ListArtifactsResponse {
  artifacts: ModelArtifact[];
  total: number;
  limit: number | null;
  offset: number;
}

export interface UploadArtifactPayload {
  file: File;
  ocr_type: string;
  role: string;
  name: string;
  version?: string;
  runtime: string;
  framework?: string;
  metadata?: string;
  training_accuracy?: number;
}

export type PipelineRefStatus = "draft" | "active" | "disabled";

export interface BoundArtifactInfo {
  name: string;
  version: string;
  runtime: string;
  digest: string;
  status: string;
}

export interface PipelineRefMetrics {
  evaluation_count_completed: number | null;
  total_images_evaluated: number | null;
  total_datasets_evaluated: number | null;
  detection_success_rate: number | null;
  recognition_exact_match_accuracy: number | null;
  end_to_end_accuracy: number | null;
  end_to_end_success_rate: number | null;
  latency_p50_ms: number | null;
  latency_p95_ms: number | null;
  last_evaluated_at: string | null;
  latest_metrics?: Record<string, unknown> | null;
  metrics?: Record<string, number> | null;
  failure_types?: Array<{
    key: string;
    name: string;
    rawKey?: string;
    count: number;
    percentage: number;
    stage: string;
    stageColor?: string;
    description?: string;
  }> | null;
  fail_stages?: Array<{
    stage: string;
    count: number;
    percentage: number;
    color: string;
    desc: string;
  }> | null;
  evaluated_datasets?: Array<{
    dataset_id: string;
    dataset_name: string;
    dataset_version?: string | null;
    sample_count: number;
    processed_samples?: number;
    successful_samples?: number;
    failed_samples?: number;
    accuracy?: number;
    evaluation_id?: string;
    completed_at?: string | null;
  }> | null;
  total_samples?: number | null;
  processed_samples?: number | null;
  successful_samples?: number | null;
  failed_samples?: number | null;
}

export interface PipelineRef {
  id: string;
  ocr_type: string;
  model_ref: string;
  status: PipelineRefStatus | string;
  is_default: boolean;
  notes: string | null;
  detection_artifact_id: string;
  recognition_artifact_id: string;
  is_llm?: boolean;
  llm?: {
    name: string;
    version: string;
    runtime: string;
    framework?: string | null;
  } | null;
  detection: BoundArtifactInfo | null;
  recognition: BoundArtifactInfo | null;
  created_at: string | null;
  updated_at: string | null;
  evaluation_metrics?: PipelineRefMetrics | null;
}

export interface ListPipelineRefsParams {
  ocr_type?: string;
  status?: string;
  search?: string;
  include_metrics?: boolean;
}

export interface ListPipelineRefsResponse {
  refs: PipelineRef[];
  total: number;
}

export interface CreatePipelineRefPayload {
  ocr_type: string;
  model_ref?: string;
  detection_artifact_id: string;
  recognition_artifact_id: string;
  notes?: string;
  activate?: boolean;
  set_default?: boolean;
}
