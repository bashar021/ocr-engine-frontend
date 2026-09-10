import { apiClient } from "@/api/client";
import type {
  StartTrainingPayload,
  SuggestVersionPayload,
  SuggestVersionResponse,
  TrainingAdapter,
  TrainingDashboardStats,
  TrainingRun,
} from "@/types/training";

export async function listTrainingAdapters(): Promise<{
  adapters: TrainingAdapter[];
}> {
  const { data } = await apiClient.get("/v1/training/adapters");
  return data;
}

export async function getTrainingDashboard(): Promise<TrainingDashboardStats> {
  const { data } = await apiClient.get("/v1/training/dashboard");
  return data;
}

export async function suggestTrainingVersion(
  payload: SuggestVersionPayload,
): Promise<SuggestVersionResponse> {
  const { data } = await apiClient.post(
    "/v1/training/suggest-version",
    payload,
  );
  return data;
}

export async function listTrainingRuns(
  params: { status?: string; limit?: number; offset?: number } = {},
) {
  const { data } = await apiClient.get<{ runs: TrainingRun[]; total: number }>(
    "/v1/training/runs",
    {
      params,
    },
  );
  return data;
}

export async function getTrainingRun(id: string): Promise<TrainingRun> {
  const { data } = await apiClient.get<TrainingRun>(`/v1/training/runs/${id}`);
  return data;
}

export async function startTrainingRun(
  payload: StartTrainingPayload,
): Promise<TrainingRun> {
  const { data } = await apiClient.post<TrainingRun>("/v1/training/runs", {
    auto_version: true,
    ...payload,
  });
  return data;
}

export async function cancelTrainingRun(id: string): Promise<TrainingRun> {
  const { data } = await apiClient.post<TrainingRun>(
    `/v1/training/runs/${id}/cancel`,
  );
  return data;
}

export interface RecognitionBuildPayload {
  ocr_type?: string;
  databank_dataset_id?: string;
  dataset_ids?: string[];
  name?: string;
  version?: string;
  include_blurry?: boolean;
  include_categories?: string[];
  exclude_dead?: boolean;
  train_ratio?: number;
  val_ratio?: number;
  test_ratio?: number;
  seed?: number;
  dry_run?: boolean;
}

export interface RecognitionBuildJob {
  id?: string;
  status: string;
  progress_pct?: number;
  message?: string | null;
  logs_tail?: string | null;
  error?: string | null;
  dataset_id?: string | null;
  dry_run?: boolean;
  preview?: {
    accepted_count?: number;
    quarantine_count?: number;
    quarantine_reasons?: Record<string, number>;
    splits?: { train?: number; val?: number; test?: number };
    ready_for_train?: boolean;
  };
  result?: {
    id?: string;
    name?: string;
    version?: string;
    sample_count?: number;
    split_counts?: { train?: number; val?: number; test?: number };
  };
}

export async function buildRecognitionDataset(
  payload: RecognitionBuildPayload,
): Promise<RecognitionBuildJob> {
  const { data } = await apiClient.post<RecognitionBuildJob>(
    "/v1/training/recognition-datasets/build",
    payload,
  );
  return data;
}

export async function getRecognitionBuildJob(
  jobId: string,
): Promise<RecognitionBuildJob> {
  const { data } = await apiClient.get<RecognitionBuildJob>(
    `/v1/training/recognition-datasets/build/${jobId}`,
  );
  return data;
}

export interface PaddleTrainingReadiness {
  ready: boolean;
  message: string;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
}

export async function getPaddleTrainingReadiness(): Promise<PaddleTrainingReadiness> {
  const { data } = await apiClient.get<PaddleTrainingReadiness>(
    "/v1/training/paddle-readiness",
  );
  return data;
}

export interface TrainingCycle {
  id: string;
  ocr_type: string;
  name: string;
  status: string;
  stage: string;
  trigger: string;
  progress_pct: number;
  message?: string | null;
  error?: string | null;
  stopping_reason?: string | null;
  recognition_dataset_id?: string | null;
  protected_test_dataset_id?: string | null;
  baseline_model_ref?: string | null;
  baseline_detection_artifact_id?: string | null;
  baseline_recognition_artifact_id?: string | null;
  candidate_recognition_artifact_id?: string | null;
  candidate_detection_artifact_id?: string | null;
  best_experiment_id?: string | null;
  baseline_metrics?: Record<string, unknown> | null;
  candidate_metrics?: Record<string, unknown> | null;
  comparison?: Record<string, unknown> | null;
  gate_result?: {
    status?: string;
    reasons?: string[];
    delta_exact?: number;
    baseline_exact?: number;
    candidate_exact?: number;
    require_e2e?: boolean;
  } | null;
  mark_for_main_list?: boolean;
  candidate_improved?: boolean;
  promotion_decision?: string | null;
  max_experiments: number;
  skip_detection: boolean;
  auto_promote: boolean;
  experiments?: TrainingExperiment[];
  metadata?: Record<string, unknown> | null;
  config?: Record<string, unknown> | null;
  created_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface TrainingExperiment {
  id: string;
  cycle_id: string;
  experiment_index: number;
  name: string;
  stage: string;
  status: string;
  config?: Record<string, unknown> | null;
  config_hash?: string | null;
  seed?: number | null;
  ranking_score?: number | null;
  rank?: number | null;
  metrics?: Record<string, unknown> | null;
  training_run_id?: string | null;
  output_artifact_id?: string | null;
  workspace_path?: string | null;
  error?: string | null;
}

export async function createTrainingCycle(payload: {
  ocr_type?: string;
  name?: string;
  description?: string;
  training_type?: string;
  recognition_dataset_id?: string;
  protected_test_dataset_id?: string;
  databank_dataset_id?: string;
  baseline_recognition_artifact_id?: string;
  baseline_detection_artifact_id?: string;
  baseline_model_ref?: string;
  max_experiments?: number;
  skip_detection?: boolean;
  auto_promote?: boolean;
  config?: Record<string, unknown>;
}): Promise<TrainingCycle> {
  const { data } = await apiClient.post<TrainingCycle>(
    "/v1/training/cycles",
    payload,
  );
  return data;
}

export interface CycleDatasetOption {
  id: string;
  name: string;
  version: string;
  status: string;
  sample_count: number;
  verified_sample_count: number;
  dataset_type: string;
  training_eligible: boolean;
  protected_test: boolean;
  protected_test_excluded: boolean;
  train_count: number;
  validation_count: number;
  readiness_code: string;
  readiness_message: string;
  ready: boolean;
  issues: { code: string; message: string; next_step?: string }[];
  updated_at?: string | null;
}

export interface CycleCreationOptions {
  ocr_type: string;
  training_types: {
    id: string;
    label: string;
    description: string;
    available: boolean;
  }[];
  datasets: CycleDatasetOption[];
  eligible_datasets: CycleDatasetOption[];
  production: {
    model_ref?: string | null;
    detection_artifact_id?: string | null;
    recognition_artifact_id?: string | null;
    will_change_automatically: boolean;
    auto_promote_default: boolean;
    auto_retrain_default: boolean;
  };
  protected_test?: {
    id: string;
    name: string;
    version: string;
    sample_count: number;
  } | null;
  system_defaults: Record<string, unknown>;
}

export interface CyclePreflightResult {
  can_start: boolean;
  dataset: CycleDatasetOption;
  protected_test_ok: boolean;
  protected_test_error?: { code: string; message: string } | null;
  summary: {
    dataset: {
      id: string;
      name: string;
      version: string;
      verified_sample_count: number;
    };
    training: { type: string; label: string; description: string };
    name: string;
    description?: string | null;
    initialization: string;
    evaluation: string;
    protected_test?: Record<string, unknown> | null;
    experiments: string;
    hard_cases: string;
    production_model: string;
  };
  blockers: { code: string; message: string; next_step?: string }[];
}

export async function getCycleCreationOptions(
  ocrType: string,
): Promise<CycleCreationOptions> {
  const { data } = await apiClient.get<CycleCreationOptions>(
    "/v1/training/cycle-options",
    { params: { ocr_type: ocrType } },
  );
  return data;
}

export async function preflightTrainingCycle(payload: {
  recognition_dataset_id: string;
  training_type?: string;
  name?: string;
  description?: string;
  protected_test_dataset_id?: string;
  ocr_type?: string;
}): Promise<CyclePreflightResult> {
  const { data } = await apiClient.post<CyclePreflightResult>(
    "/v1/training/cycles/preflight",
    payload,
  );
  return data;
}

export async function listTrainingCycles(params?: {
  status?: string;
  limit?: number;
}): Promise<{ cycles: TrainingCycle[]; total: number }> {
  const { data } = await apiClient.get("/v1/training/cycles", { params });
  return data;
}

export async function getTrainingCycle(id: string): Promise<TrainingCycle> {
  const { data } = await apiClient.get<TrainingCycle>(
    `/v1/training/cycles/${id}`,
  );
  return data;
}

export async function advanceTrainingCycle(id: string): Promise<TrainingCycle> {
  const { data } = await apiClient.post<TrainingCycle>(
    `/v1/training/cycles/${id}/advance`,
  );
  return data;
}

export async function cancelTrainingCycle(id: string): Promise<TrainingCycle> {
  const { data } = await apiClient.post<TrainingCycle>(
    `/v1/training/cycles/${id}/cancel`,
  );
  return data;
}

export async function promoteTrainingCycle(
  id: string,
  payload?: { model_ref?: string; set_default?: boolean },
): Promise<{ cycle: TrainingCycle; pipeline_ref: unknown }> {
  const { data } = await apiClient.post(`/v1/training/cycles/${id}/promote`, {
    set_default: true,
    ...payload,
  });
  return data;
}

export async function rollbackTrainingPromotion(
  ocrType: string,
): Promise<unknown> {
  const { data } = await apiClient.post("/v1/training/rollback", null, {
    params: { ocr_type: ocrType },
  });
  return data;
}

export async function listTrainingExperiments(params?: {
  cycle_id?: string;
  limit?: number;
}): Promise<{ experiments: TrainingExperiment[]; total: number }> {
  const { data } = await apiClient.get("/v1/training/experiments", { params });
  return data;
}

export type AugmentationStrategy = {
  key: string;
  label: string;
  description: string;
};

export async function listAugmentationStrategies(): Promise<
  AugmentationStrategy[]
> {
  const { data } = await apiClient.get<{ strategies: AugmentationStrategy[] }>(
    "/v1/training/augmentation/strategies",
  );
  return data.strategies;
}

export async function createAugmentedDataset(payload: {
  source_dataset_id: string;
  strategy: string;
  name?: string;
}) {
  const { data } = await apiClient.post(
    "/v1/training/augmentation/datasets",
    payload,
  );
  return data as import("@/types/evaluation").EvaluationDataset;
}
