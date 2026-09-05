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
