import { apiClient } from "@/api/client";
import type {
  DatabankBBox,
  DatabankDataset,
  DatabankSample,
  ListDatabankSamplesResponse,
} from "@/types/databank";

export async function getDatabank(
  ocrType: string,
  datasetType?: "raw" | "label" | string,
): Promise<DatabankDataset> {
  const { data } = await apiClient.get<DatabankDataset>("/v1/databank/bank", {
    params: { ocr_type: ocrType, dataset_type: datasetType },
  });
  return data;
}

export async function uploadToDatabank(
  ocrType: string,
  file: File,
  datasetId?: string,
): Promise<DatabankDataset & { added_samples?: number }> {
  const form = new FormData();
  form.append("file", file);
  const q = new URLSearchParams({ ocr_type: ocrType });
  if (datasetId) q.set("dataset_id", datasetId);
  const url = datasetId
    ? `/v1/databank/datasets/${encodeURIComponent(datasetId)}/upload`
    : `/v1/databank/upload?${q.toString()}`;
  const { data } = await apiClient.post<
    DatabankDataset & { added_samples?: number }
  >(url, form, {
    timeout: 300_000,
  });
  return data;
}

export async function uploadRawToDatabank(
  ocrType: string,
  file: File,
  datasetId?: string,
): Promise<DatabankDataset & { added_samples?: number; message?: string | null }> {
  const form = new FormData();
  form.append("file", file);
  const q = new URLSearchParams({ ocr_type: ocrType });
  if (datasetId) q.set("dataset_id", datasetId);
  const url = datasetId
    ? `/v1/databank/datasets/${encodeURIComponent(datasetId)}/upload-raw?${q.toString()}`
    : `/v1/databank/upload-raw?${q.toString()}`;
  const { data } = await apiClient.post<
    DatabankDataset & { added_samples?: number; message?: string | null }
  >(url, form, {
    timeout: 300_000,
  });
  return data;
}

export async function importDatabankRawCsv(
  ocrType: string,
  file: File,
  odometerCol: string,
  s3UrlCol: string,
  datasetId?: string,
): Promise<
  DatabankDataset & {
    accepted?: boolean;
    job_id?: string;
    message?: string | null;
  }
> {
  const form = new FormData();
  form.append("file", file);
  form.append("odometer_col", odometerCol);
  form.append("s3_url_col", s3UrlCol);
  const q = new URLSearchParams({ ocr_type: ocrType });
  if (datasetId) q.set("dataset_id", datasetId);
  const url = datasetId
    ? `/v1/databank/datasets/${encodeURIComponent(datasetId)}/import-csv-s3?${q.toString()}`
    : `/v1/databank/import-csv-s3?${q.toString()}`;
  const { data } = await apiClient.post<
    DatabankDataset & {
      accepted?: boolean;
      job_id?: string;
      message?: string | null;
    }
  >(url, form, {
    timeout: 300_000,
  });
  return data;
}

export async function getDatabankDataset(id: string): Promise<DatabankDataset> {
  const { data } = await apiClient.get<DatabankDataset>(
    `/v1/databank/datasets/${id}`,
  );
  return data;
}

export async function separateDatabankDuplicates(
  datasetId: string,
): Promise<
  DatabankDataset & {
    accepted?: boolean;
    job_id?: string;
    message?: string | null;
  }
> {
  const { data } = await apiClient.post<
    DatabankDataset & {
      accepted?: boolean;
      job_id?: string;
      message?: string | null;
    }
  >(`/v1/databank/datasets/${encodeURIComponent(datasetId)}/separate-duplicates`);
  return data;
}

export async function evaluateRawDataset(
  datasetId: string,
  body: {
    mode: "detection_and_recognition" | "recognition_only";
    category?: string;
    model_ref?: string;
  },
): Promise<
  DatabankDataset & {
    accepted?: boolean;
    job_id?: string;
    mode?: "detection_and_recognition" | "recognition_only";
    message?: string | null;
  }
> {
  const { data } = await apiClient.post<
    DatabankDataset & {
      accepted?: boolean;
      job_id?: string;
      mode?: "detection_and_recognition" | "recognition_only";
      message?: string | null;
    }
  >(`/v1/databank/datasets/${encodeURIComponent(datasetId)}/evaluate`, body);
  return data;
}

export async function listDatabankSamples(
  datasetId: string,
  params: {
    review_status?: string;
    category?: string;
    within_review_status?: "all" | "reviewed" | "unreviewed";
    search?: string;
    has_filename_gt?: boolean;
    has_prediction?: "has" | "missing" | "error";
    upload_match?: "yes" | "no" | "none";
    has_final_gt?: boolean;
    has_rerun?: "has" | "missing" | "ok" | "miss";
    has_bbox?: boolean;
    limit?: number;
    offset?: number;
  } = {},
): Promise<ListDatabankSamplesResponse> {
  const { data } = await apiClient.get<ListDatabankSamplesResponse>(
    `/v1/databank/datasets/${datasetId}/samples`,
    { params },
  );
  return data;
}

export async function getDatabankCategoryCounts(
  datasetId: string,
  params: {
    within_review_status?: "all" | "reviewed" | "unreviewed";
    search?: string;
    has_filename_gt?: boolean;
    has_prediction?: "has" | "missing" | "error";
    upload_match?: "yes" | "no" | "none";
    has_final_gt?: boolean;
    has_rerun?: "has" | "missing" | "ok" | "miss";
    has_bbox?: boolean;
  } = {},
): Promise<Record<string, number>> {
  const { data } = await apiClient.get<Record<string, number>>(
    `/v1/databank/datasets/${datasetId}/category-counts`,
    { params },
  );
  return data;
}

export type DatabankSyncMirrorResult = {
  id?: string;
  name?: string;
  version?: string;
  sample_count?: number;
  chunk_index?: number;
  chunk_count?: number;
};

export type DatabankSyncResponse = Record<
  string,
  | DatabankSyncMirrorResult
  | {
      chunk_count?: number;
      sample_count?: number;
      chunks?: DatabankSyncMirrorResult[];
    }
>;

export async function syncDatabankReviewedEval(
  datasetId: string,
  options?: { category?: string; reviewed_chunk_count?: number },
): Promise<DatabankSyncResponse> {
  const body: { category?: string; reviewed_chunk_count?: number } = {};
  if (options?.category) {
    body.category = options.category;
  } else {
    body.reviewed_chunk_count = options?.reviewed_chunk_count ?? 1;
  }
  const { data } = await apiClient.post<DatabankSyncResponse>(
    `/v1/databank/datasets/${datasetId}/sync-reviewed-eval`,
    body,
  );
  return data;
}

export async function fetchDatabankSampleImageUrl(
  datasetId: string,
  sampleId: string,
): Promise<string> {
  const { data } = await apiClient.get<Blob>(
    `/v1/databank/datasets/${datasetId}/samples/${sampleId}/image`,
    { responseType: "blob" },
  );
  return URL.createObjectURL(data);
}

export async function reviewDatabankSample(
  datasetId: string,
  sampleId: string,
  body: {
    corrected_gt?: string;
    accept_prediction?: boolean;
    corrected_bbox?: Record<string, unknown> | null;
    clear_bbox?: boolean;
    review_notes?: string | null;
    /** Move raw sample into General ("") / blurry / dead / custom after saving GT */
    target_category?: string | null;
  },
): Promise<DatabankSample> {
  const { data } = await apiClient.post<DatabankSample>(
    `/v1/databank/datasets/${datasetId}/samples/${sampleId}/review`,
    body,
  );
  return data;
}

export async function clearDatabankSampleBbox(
  datasetId: string,
  sampleId: string,
): Promise<DatabankSample> {
  const { data } = await apiClient.post<DatabankSample>(
    `/v1/databank/datasets/${datasetId}/samples/${sampleId}/clear-bbox`,
  );
  return data;
}

export async function setDatabankSampleBlurry(
  datasetId: string,
  sampleId: string,
  is_blurry: boolean = true,
): Promise<DatabankSample> {
  const { data } = await apiClient.post<DatabankSample>(
    `/v1/databank/datasets/${datasetId}/samples/${sampleId}/blurry`,
    { is_blurry },
  );
  return data;
}

export async function setDatabankSampleCategory(
  datasetId: string,
  sampleId: string,
  category: string,
): Promise<DatabankSample> {
  const { data } = await apiClient.post<DatabankSample>(
    `/v1/databank/datasets/${datasetId}/samples/${sampleId}/category`,
    { category },
  );
  return data;
}

export async function moveDatabankSampleToReviewed(
  datasetId: string,
  sampleId: string,
): Promise<DatabankSample> {
  const { data } = await apiClient.post<DatabankSample>(
    `/v1/databank/datasets/${datasetId}/samples/${sampleId}/move-to-reviewed`,
  );
  return data;
}

export async function addDatabankCategory(
  datasetId: string,
  name: string,
): Promise<DatabankDataset> {
  const { data } = await apiClient.post<DatabankDataset>(
    `/v1/databank/datasets/${datasetId}/categories`,
    { name },
  );
  return data;
}

export async function reanalyzeDatabankUnreviewed(
  datasetId: string,
  options?: { category?: string },
): Promise<DatabankDataset> {
  const { data } = await apiClient.post<DatabankDataset>(
    `/v1/databank/datasets/${datasetId}/reanalyze-unreviewed`,
    { category: options?.category ?? "" },
  );
  return data;
}

export async function deleteDatabankSample(
  datasetId: string,
  sampleId: string,
): Promise<{ deleted: boolean; filename: string }> {
  const { data } = await apiClient.delete<{
    deleted: boolean;
    filename: string;
  }>(`/v1/databank/datasets/${datasetId}/samples/${sampleId}`);
  return data;
}

export async function rerunDatabankReviewed(
  datasetId: string,
  options?: { category?: string },
): Promise<DatabankDataset> {
  const { data } = await apiClient.post<DatabankDataset>(
    `/v1/databank/datasets/${datasetId}/rerun`,
    { category: options?.category ?? "" },
  );
  return data;
}

export async function downloadDatabankCsv(
  datasetId: string,
): Promise<{ blob: Blob; filename: string }> {
  const response = await apiClient.get(
    `/v1/databank/datasets/${datasetId}/export.csv`,
    { responseType: "blob" },
  );
  const blob = response.data as Blob;
  const disposition = response.headers["content-disposition"] as
    | string
    | undefined;
  let filename = `databank.csv`;
  const match = disposition?.match(/filename="?([^"]+)"?/);
  if (match?.[1]) filename = match[1];
  return { blob, filename };
}

export async function extractDatabankSampleWithGemini(
  datasetId: string,
  sampleId: string,
  params: { prompt: string; api_key?: string; model?: string },
): Promise<{
  extracted_value: string;
  bbox?: DatabankBBox | null;
  model: string;
  prompt: string;
}> {
  const { data } = await apiClient.post<{
    extracted_value: string;
    bbox?: DatabankBBox | null;
    model: string;
    prompt: string;
  }>(
    `/v1/databank/datasets/${datasetId}/samples/${sampleId}/extract-gemini`,
    params,
  );
  return data;
}

export async function batchSetDatabankSampleCategory(
  datasetId: string,
  sampleIds: string[],
  category: string,
): Promise<{ dataset_id: string; count: number; category: string }> {
  const { data } = await apiClient.post<{
    dataset_id: string;
    count: number;
    category: string;
  }>(`/v1/databank/datasets/${datasetId}/batch-category`, {
    sample_ids: sampleIds,
    category,
  });
  return data;
}

export async function batchMoveDatabankSamples(
  datasetId: string,
  payload: {
    sample_ids: string[];
    target_dataset_id: string;
    target_category: string;
  },
): Promise<{
  moved_count: number;
  source_dataset_id: string;
  target_dataset_id: string;
  target_category: string;
}> {
  const { data } = await apiClient.post<{
    moved_count: number;
    source_dataset_id: string;
    target_dataset_id: string;
    target_category: string;
  }>(`/v1/databank/datasets/${datasetId}/batch-move`, payload);
  return data;
}

export async function moveAllDatabankSamples(
  datasetId: string,
  payload: {
    target_dataset_id: string;
    target_category?: string;
  },
): Promise<{
  moved_count: number;
  source_dataset_id: string;
  target_dataset_id: string;
  target_category: string;
}> {
  const { data } = await apiClient.post<{
    moved_count: number;
    source_dataset_id: string;
    target_dataset_id: string;
    target_category: string;
  }>(`/v1/databank/datasets/${datasetId}/move-all`, payload);
  return data;
}

export async function listDatabankDatasets(
  ocrType?: string,
  params: {
    status?: string;
    search?: string;
    dataset_type?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ total: number; datasets: DatabankDataset[] }> {
  const { data } = await apiClient.get<{ total: number; datasets: DatabankDataset[] }>(
    "/v1/databank/datasets",
    { params: { ocr_type: ocrType, ...params } },
  );
  return data;
}

export async function createDatabankDataset(body: {
  ocr_type?: string;
  name: string;
  version?: string;
  description?: string;
  dataset_type?: string;
}): Promise<DatabankDataset> {
  const { data } = await apiClient.post<DatabankDataset>(
    "/v1/databank/datasets",
    body,
  );
  return data;
}

export async function deleteDatabankDataset(datasetId: string): Promise<void> {
  await apiClient.delete(`/v1/databank/datasets/${datasetId}`);
}


