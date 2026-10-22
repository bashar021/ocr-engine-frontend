import axios from "axios";

import { apiClient } from "@/api/client";
import type {
  CreateDatasetPayload,
  DatasetSample,
  EvaluationDataset,
  EvaluationMetricsResponse,
  EvaluationSlicesResponse,
  EvaluationRun,
  ListDatasetsParams,
  ListDatasetsResponse,
  ListEvaluationsParams,
  ListEvaluationsResponse,
  ListResultsResponse,
  ListSamplesParams,
  ListSamplesResponse,
  StartEvaluationPayload,
  EvaluationResult,
  HardFailuresParams,
  HardFailuresResponse,
  EvaluationComparisonResponse,
} from "@/types/evaluation";

export async function listDatasets(
  params: ListDatasetsParams = {},
): Promise<ListDatasetsResponse> {
  const { data } = await apiClient.get<ListDatasetsResponse>(
    "/v1/evaluation/datasets",
    { params },
  );
  return data;
}

export async function getDataset(id: string): Promise<EvaluationDataset> {
  const { data } = await apiClient.get<EvaluationDataset>(
    `/v1/evaluation/datasets/${id}`,
  );
  return data;
}

export async function createDataset(
  payload: CreateDatasetPayload,
): Promise<EvaluationDataset> {
  const { data } = await apiClient.post<EvaluationDataset>(
    "/v1/evaluation/datasets",
    payload,
  );
  return data;
}

export async function uploadDatasetZip(
  datasetId: string,
  file: File,
): Promise<EvaluationDataset> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<EvaluationDataset>(
    `/v1/evaluation/datasets/${datasetId}/upload`,
    form,
  );
  return data;
}

export async function listDatasetSamples(
  datasetId: string,
  params: ListSamplesParams = {},
): Promise<ListSamplesResponse> {
  const { data } = await apiClient.get<ListSamplesResponse>(
    `/v1/evaluation/datasets/${datasetId}/samples`,
    {
      params: {
        ...params,
        include_eval_metrics: params.include_eval_metrics ?? true,
      },
    },
  );
  return data;
}

export async function moveSampleToDatabankCategory(
  datasetId: string,
  sampleId: string,
  category: string,
): Promise<{ moved: boolean; category: string }> {
  const { data } = await apiClient.post(
    `/v1/evaluation/datasets/${datasetId}/samples/${sampleId}/move-to-databank-category`,
    { category },
  );
  return data;
}

export async function getDatasetSample(
  datasetId: string,
  sampleId: string,
): Promise<DatasetSample> {
  const { data } = await apiClient.get<DatasetSample>(
    `/v1/evaluation/datasets/${datasetId}/samples/${sampleId}`,
  );
  return data;
}

export async function updateDatasetSample(
  datasetId: string,
  sampleId: string,
  payload: {
    bbox?: { x1: number; y1: number; x2: number; y2: number } | null;
    clear_bbox?: boolean;
    ground_truth?: string | null;
  },
): Promise<DatasetSample> {
  const { data } = await apiClient.patch<DatasetSample>(
    `/v1/evaluation/datasets/${datasetId}/samples/${sampleId}`,
    {
      bbox: payload.bbox ?? undefined,
      clear_bbox: payload.clear_bbox ?? false,
      ground_truth: payload.ground_truth ?? undefined,
    },
  );
  return data;
}

export async function deleteDatasetSample(
  datasetId: string,
  sampleId: string,
): Promise<{ deleted: boolean; sample_count: number }> {
  const { data } = await apiClient.delete<{
    deleted: boolean;
    sample_count: number;
  }>(`/v1/evaluation/datasets/${datasetId}/samples/${sampleId}`);
  return data;
}

export async function archiveDataset(
  datasetId: string,
): Promise<EvaluationDataset> {
  const { data } = await apiClient.post<EvaluationDataset>(
    `/v1/evaluation/datasets/${datasetId}/archive`,
  );
  return data;
}

export async function mergeTrainingDatasets(payload: {
  dataset_ids: string[];
  name?: string;
  version?: string;
  description?: string;
}): Promise<EvaluationDataset> {
  const { data } = await apiClient.post<EvaluationDataset>(
    "/v1/evaluation/datasets/merge",
    payload,
  );
  return data;
}

export async function setDatasetEvaluationEligibility(
  datasetId: string,
  eligible: boolean,
): Promise<EvaluationDataset> {
  const { data } = await apiClient.post<EvaluationDataset>(
    `/v1/evaluation/datasets/${datasetId}/evaluation-eligibility`,
    { eligible },
  );
  return data;
}

export async function hardDeleteDataset(datasetId: string): Promise<void> {
  await apiClient.delete(`/v1/evaluation/datasets/${datasetId}`);
}

export function datasetSampleImagePath(
  datasetId: string,
  sampleId: string,
): string {
  return `/v1/evaluation/datasets/${datasetId}/samples/${sampleId}/image`;
}

export function evaluationResultImagePath(
  evaluationId: string,
  resultId: string,
): string {
  return `/v1/evaluations/${evaluationId}/results/${resultId}/image`;
}

/** Fetch sample image as an object URL (revokes previous if provided). */
export async function fetchSampleImageObjectUrl(
  datasetId: string,
  sampleId: string,
): Promise<string> {
  const { data } = await apiClient.get<Blob>(
    datasetSampleImagePath(datasetId, sampleId),
    { responseType: "blob" },
  );
  return URL.createObjectURL(data);
}

/** Prefer result-scoped image endpoint (handles unlinked samples). */
export async function fetchEvaluationResultImageObjectUrl(
  evaluationId: string,
  resultId: string,
): Promise<string> {
  const { data } = await apiClient.get<Blob>(
    evaluationResultImagePath(evaluationId, resultId),
    { responseType: "blob" },
  );
  return URL.createObjectURL(data);
}

export async function listEvaluations(
  params: ListEvaluationsParams = {},
): Promise<ListEvaluationsResponse> {
  const { data } = await apiClient.get<ListEvaluationsResponse>(
    "/v1/evaluations",
    {
      params: {
        ...params,
        include_metrics: params.include_metrics ?? true,
      },
    },
  );
  return data;
}

export async function getEvaluation(id: string): Promise<EvaluationRun> {
  const { data } = await apiClient.get<EvaluationRun>(`/v1/evaluations/${id}`);
  return data;
}

export async function startEvaluation(
  payload: StartEvaluationPayload,
): Promise<EvaluationRun> {
  const { data } = await apiClient.post<EvaluationRun>(
    "/v1/evaluations",
    payload,
  );
  return data;
}

export async function cancelEvaluation(id: string): Promise<EvaluationRun> {
  const { data } = await apiClient.post<EvaluationRun>(
    `/v1/evaluations/${id}/cancel`,
  );
  return data;
}

export async function deleteEvaluation(id: string): Promise<void> {
  await apiClient.delete(`/v1/evaluations/${id}`);
}

export async function deleteAllEvaluations(
  ocr_type?: string,
): Promise<{ deleted: number }> {
  const { data } = await apiClient.delete<{ deleted: number }>(
    "/v1/evaluations",
    { params: ocr_type ? { ocr_type } : undefined },
  );
  return data;
}

export async function reEvaluate(run: EvaluationRun): Promise<EvaluationRun> {
  return startEvaluation({
    dataset_id: run.dataset_id,
    ocr_type: run.ocr_type,
    model_ref: run.model_ref ?? undefined,
    detection_artifact_id: run.detection_artifact_id,
    recognition_artifact_id: run.recognition_artifact_id,
    evaluation_type: run.evaluation_type,
    force: true,
  });
}

export async function listEvaluationHardFailures(
  params: HardFailuresParams,
): Promise<HardFailuresResponse> {
  const { data } = await apiClient.get<HardFailuresResponse>(
    "/v1/evaluations/hard-failures",
    { params },
  );
  return data;
}

export async function listEvaluationResults(
  evaluationId: string,
  params: { limit?: number; offset?: number } = {},
): Promise<ListResultsResponse> {
  const { data } = await apiClient.get<ListResultsResponse>(
    `/v1/evaluations/${evaluationId}/results`,
    { params },
  );
  return data;
}

export async function getEvaluationMetrics(
  evaluationId: string,
): Promise<EvaluationMetricsResponse> {
  const { data } = await apiClient.get<EvaluationMetricsResponse>(
    `/v1/evaluations/${evaluationId}/metrics`,
  );
  return data;
}

export async function getEvaluationSlices(
  evaluationId: string,
  dimension: string = "failure_type",
  minSamples: number = 1,
): Promise<EvaluationSlicesResponse> {
  const { data } = await apiClient.get<EvaluationSlicesResponse>(
    `/v1/evaluations/${evaluationId}/slices`,
    {
      params: { dimension, min_samples: minSamples },
    },
  );
  return data;
}

export async function reviewEvaluationResult(
  evaluationId: string,
  resultId: string,
  payload: {
    review_status: string;
    corrected_gt?: string | null;
    corrected_bbox?: Record<string, unknown> | null;
    review_notes?: string | null;
  },
) {
  const { data } = await apiClient.post(
    `/v1/evaluations/${evaluationId}/results/${resultId}/review`,
    payload,
  );
  return data;
}

export async function bulkReviewEvaluationResults(
  evaluationId: string,
  items: Array<{
    result_id: string;
    review_status: string;
    corrected_gt?: string | null;
    corrected_bbox?: Record<string, unknown> | null;
    review_notes?: string | null;
  }>,
) {
  const { data } = await apiClient.post(
    `/v1/evaluations/${evaluationId}/results/bulk-review`,
    { items },
  );
  return data;
}

export async function exportHardCases(
  evaluationId: string,
  payload: {
    name?: string;
    version?: string;
    pack?: string;
    failure_types?: string[];
    review_statuses?: string[];
    include_correct?: boolean;
    result_ids?: string[];
    require_corrected_bbox?: boolean;
  },
) {
  const { data } = await apiClient.post(
    `/v1/evaluations/${evaluationId}/exports`,
    payload,
  );
  return data;
}

/** Download ZIP of detection crops for the currently filtered result IDs. */
export async function downloadFilteredCropsZip(
  evaluationId: string,
  payload: { result_ids: string[]; filter_label?: string },
): Promise<{ blob: Blob; filename: string; imageCount: number | null }> {
  try {
    const response = await apiClient.post(
      `/v1/evaluations/${evaluationId}/downloads/crops`,
      payload,
      { responseType: "blob", timeout: 300_000 },
    );
    const blob = response.data as Blob;
    const disposition = String(response.headers["content-disposition"] || "");
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    const filename =
      match?.[1] || `evaluation-${evaluationId.slice(0, 8)}-crops.zip`;
    const countHeader = response.headers["x-crop-image-count"];
    const imageCount =
      countHeader != null && countHeader !== "" ? Number(countHeader) : null;
    return {
      blob,
      filename,
      imageCount: Number.isFinite(imageCount) ? imageCount : null,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      const text = await error.response.data.text();
      try {
        const parsed = JSON.parse(text) as {
          detail?: string;
          message?: string;
          error_code?: string;
        };
        throw new Error(
          parsed.detail || parsed.message || parsed.error_code || text,
        );
      } catch (inner) {
        if (
          inner instanceof Error &&
          inner.message &&
          !inner.message.startsWith("{")
        ) {
          throw inner;
        }
        throw new Error(text || "Failed to download crops");
      }
    }
    throw error;
  }
}

/** @deprecated Prefer downloadFilteredCropsZip with table filter result_ids */
export async function downloadCorrectCropsZip(
  evaluationId: string,
): Promise<{ blob: Blob; filename: string; imageCount: number | null }> {
  try {
    const response = await apiClient.get(
      `/v1/evaluations/${evaluationId}/downloads/correct-crops`,
      { responseType: "blob", timeout: 300_000 },
    );
    const blob = response.data as Blob;
    const disposition = String(response.headers["content-disposition"] || "");
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    const filename =
      match?.[1] || `evaluation-${evaluationId.slice(0, 8)}-correct-crops.zip`;
    const countHeader = response.headers["x-crop-image-count"];
    const imageCount =
      countHeader != null && countHeader !== "" ? Number(countHeader) : null;
    return {
      blob,
      filename,
      imageCount: Number.isFinite(imageCount) ? imageCount : null,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      const text = await error.response.data.text();
      try {
        const parsed = JSON.parse(text) as {
          detail?: string;
          message?: string;
          error_code?: string;
        };
        throw new Error(
          parsed.detail || parsed.message || parsed.error_code || text,
        );
      } catch (inner) {
        if (
          inner instanceof Error &&
          inner.message &&
          !inner.message.startsWith("{")
        ) {
          throw inner;
        }
        throw new Error(text || "Failed to download correct crops");
      }
    }
    throw error;
  }
}

export async function exportTrainingDataset(
  evaluationId: string,
  payload: {
    result_ids: string[];
    pack: "recognition_crops" | "detection_full" | "eval_zip";
    name?: string;
    version?: string;
  },
) {
  const { data } = await apiClient.post(
    `/v1/evaluations/${evaluationId}/exports/training-dataset`,
    payload,
  );
  return data;
}

/** Paginate through all evaluation results for an evaluation run. */
export async function listAllEvaluationResults(
  evaluationId: string,
): Promise<EvaluationResult[]> {
  const pageSize = 500;
  let offset = 0;
  let total = Infinity;
  const all: EvaluationResult[] = [];
  while (offset < total) {
    const page = await listEvaluationResults(evaluationId, {
      limit: pageSize,
      offset,
    });
    all.push(...page.results);
    total = page.total;
    offset += pageSize;
    if (page.results.length === 0) break;
  }
  return all;
}

export async function compareEvaluations(
  left: string,
  right: string,
): Promise<EvaluationComparisonResponse> {
  const { data } = await apiClient.get<EvaluationComparisonResponse>(
    "/v1/evaluations/compare",
    {
      params: { left, right },
    },
  );
  return data;
}
