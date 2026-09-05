export type TrainingRunStatus =
  | "queued"
  | "starting"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface TrainingAdapter {
  id: string;
  label: string;
  roles: string[];
}

export interface TrainingRunDataset {
  dataset_id: string;
  role: string;
  manifest_digest: string | null;
  sample_count: number | null;
}

export interface TrainingDataCounts {
  parent_sample_count: number;
  new_sample_count: number;
  total_sample_count: number;
  base_dataset_sample_count?: number;
  by_role?: Record<string, number>;
  formula?: string;
}

export interface TrainingRun {
  id: string;
  ocr_type: string;
  role: string;
  name: string;
  version: string;
  training_base_artifact_id: string | null;
  adapter_id: string;
  status: TrainingRunStatus | string;
  progress_pct: number;
  current_epoch: number | null;
  total_epochs: number | null;
  config: Record<string, unknown> | null;
  hyperparameters: Record<string, unknown> | null;
  framework: string | null;
  training_metrics: Record<string, unknown> | null;
  validation_metrics: Record<string, unknown> | null;
  logs_tail: string | null;
  output_artifact_id: string | null;
  output_artifact_digest: string | null;
  post_train_eval_ids: string[];
  auto_evaluate: boolean;
  evaluate_dataset_ids: string[];
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  created_by: string | null;
  datasets: TrainingRunDataset[];
  data_counts?: TrainingDataCounts;
  metadata?: Record<string, unknown> | null;
}

export interface StartTrainingPayload {
  ocr_type?: string;
  role: string;
  name: string;
  version?: string;
  adapter_id: string;
  dataset_ids: Array<{ dataset_id: string; role?: string }>;
  training_base_artifact_id?: string;
  hyperparameters?: Record<string, unknown>;
  config?: Record<string, unknown>;
  auto_evaluate?: boolean;
  evaluate_dataset_ids?: string[];
  auto_version?: boolean;
}

export interface SuggestVersionPayload {
  ocr_type?: string;
  role: string;
  name: string;
  training_base_artifact_id?: string;
  dataset_ids?: Array<{ dataset_id: string; role?: string }>;
  new_sample_count?: number;
}

export interface SuggestVersionResponse {
  name: string;
  parent_version: string;
  suggested_version: string;
  bump_level: "major" | "minor" | "patch" | string;
  new_sample_count: number;
  parent_sample_count: number | null;
  data_counts: TrainingDataCounts;
  rules: Record<string, string>;
}

export interface TrainingDashboardStats {
  runs_total: number;
  runs_by_status: Record<string, number>;
  candidate_artifacts: number;
  ready_datasets: number;
  ready_dataset_samples: number;
}
