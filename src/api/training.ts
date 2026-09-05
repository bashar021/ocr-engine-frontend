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
