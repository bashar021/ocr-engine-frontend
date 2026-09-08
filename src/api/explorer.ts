import { apiClient } from "@/api/client";
import type { DatabankSample } from "@/types/databank";

export type ExplorerSampleSummary = {
  source: "databank" | "evaluation";
  id: string;
  dataset_id: string;
  dataset_name?: string | null;
  task_key?: string | null;
  filename: string;
  ground_truth?: string | null;
  prediction?: string | null;
  review_status?: string | null;
  lifecycle_state?: string;
  quality_tag?: string;
  annotation_purpose?: string;
  match?: boolean | null;
  split?: string;
  image_url?: string;
  created_at?: string | null;
};

export type ExplorerPrediction = {
  kind: string;
  value?: string | null;
  confidence?: number | null;
  match?: boolean | null;
  is_correct?: boolean | null;
  failure_type?: string | null;
  model_ref?: string | null;
  evaluation_id?: string | null;
};

export type ExplorerSampleDetail = {
  source: "databank" | "evaluation";
  id: string;
  dataset_id: string;
  dataset_name?: string | null;
  task_key?: string | null;
  filename: string;
  ground_truth?: string | null;
  ground_truth_normalized?: string | null;
  corrected_gt?: string | null;
  final_gt?: string | null;
  predictions: ExplorerPrediction[];
  bbox?: Record<string, unknown> | null;
  lifecycle_state?: string;
  quality_tag?: string;
  annotation_purpose?: string;
  review_status?: string | null;
  review_notes?: string | null;
  split?: string;
  image_url?: string;
  provenance?: Record<string, unknown>;
};

export type ExploreSamplesParams = {
  task_key?: string;
  source?: string;
  lifecycle_state?: string;
  quality_tag?: string;
  review_status?: string;
  has_ground_truth?: boolean;
  q?: string;
  dataset_id?: string;
  limit?: number;
  offset?: number;
};

export type ExploreSamplesResponse = {
  items: ExplorerSampleSummary[];
  total_estimate: number;
  limit: number;
  offset: number;
  filters: Record<string, unknown>;
  lifecycle_states: string[];
  quality_tags: string[];
};

export type PlatformSettings = {
  inference: {
    request_timeout_seconds?: number | null;
    max_image_bytes?: number | null;
  };
  workers: {
    training_worker_enabled: boolean;
    evaluation_worker_enabled: boolean;
    training_max_concurrency: number;
    evaluation_max_concurrency: number;
  };
  training_gates: {
    auto_promote: boolean;
    auto_retrain_enabled: boolean;
    min_exact_match: number;
    max_cer_regression: number;
  };
  observability: {
    metrics_enabled: boolean;
  };
  note: string;
};

export async function exploreSamples(
  params: ExploreSamplesParams = {},
): Promise<ExploreSamplesResponse> {
  const { data } = await apiClient.get<ExploreSamplesResponse>(
    "/v1/explorer/samples",
    { params },
  );
  return data;
}

export async function getExplorerSample(
  source: string,
  id: string,
): Promise<ExplorerSampleDetail> {
  const { data } = await apiClient.get<ExplorerSampleDetail>(
    `/v1/explorer/samples/${encodeURIComponent(source)}/${encodeURIComponent(id)}`,
  );
  return data;
}

export async function setLifecycle(
  datasetId: string,
  sampleId: string,
  lifecycle_state: string,
): Promise<DatabankSample> {
  const { data } = await apiClient.patch<DatabankSample>(
    `/v1/databank/datasets/${datasetId}/samples/${sampleId}/lifecycle`,
    { lifecycle_state },
  );
  return data;
}

export async function setQualityTag(
  datasetId: string,
  sampleId: string,
  quality_tag: string,
): Promise<DatabankSample> {
  const { data } = await apiClient.patch<DatabankSample>(
    `/v1/databank/datasets/${datasetId}/samples/${sampleId}/quality-tag`,
    { quality_tag },
  );
  return data;
}

export async function bulkSetLifecycle(
  datasetId: string,
  sampleIds: string[],
  lifecycle_state: string,
): Promise<{ updated: number }> {
  const { data } = await apiClient.post<{ updated: number }>(
    `/v1/databank/datasets/${datasetId}/samples/bulk-lifecycle`,
    { sample_ids: sampleIds, lifecycle_state },
  );
  return data;
}

export async function getSettings(): Promise<PlatformSettings> {
  const { data } = await apiClient.get<PlatformSettings>("/v1/settings");
  return data;
}

/** Fetch an authenticated sample image and return a blob object URL. */
export async function fetchExplorerImageUrl(
  imagePath: string,
): Promise<string> {
  const { data } = await apiClient.get<Blob>(imagePath, {
    responseType: "blob",
  });
  return URL.createObjectURL(data);
}
