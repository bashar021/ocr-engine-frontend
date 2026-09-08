import { apiClient } from "@/api/client";
import type {
  DatabankDataset,
  DatabankSample,
  ListDatabankSamplesResponse,
} from "@/types/databank";

export async function getDatabank(ocrType: string): Promise<DatabankDataset> {
  const { data } = await apiClient.get<DatabankDataset>("/v1/databank/bank", {
    params: { ocr_type: ocrType },
  });
  return data;
}

export async function uploadToDatabank(
  ocrType: string,
  file: File,
): Promise<DatabankDataset & { added_samples?: number }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<
    DatabankDataset & { added_samples?: number }
  >(`/v1/databank/upload?ocr_type=${encodeURIComponent(ocrType)}`, form, {
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

export async function listDatabankSamples(
  datasetId: string,
  params: {
    review_status?: string;
    category?: string;
    search?: string;
    has_filename_gt?: boolean;
    has_prediction?: "has" | "missing" | "error";
    upload_match?: "yes" | "no" | "none";
    has_final_gt?: boolean;
    has_rerun?: "has" | "missing" | "ok" | "miss";
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
  options?: { reviewed_chunk_count?: number },
): Promise<DatabankSyncResponse> {
  const { data } = await apiClient.post<DatabankSyncResponse>(
    `/v1/databank/datasets/${datasetId}/sync-reviewed-eval`,
    {
      reviewed_chunk_count: options?.reviewed_chunk_count ?? 1,
    },
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
): Promise<DatabankDataset> {
  const { data } = await apiClient.post<DatabankDataset>(
    `/v1/databank/datasets/${datasetId}/reanalyze-unreviewed`,
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
): Promise<DatabankDataset> {
  const { data } = await apiClient.post<DatabankDataset>(
    `/v1/databank/datasets/${datasetId}/rerun`,
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
