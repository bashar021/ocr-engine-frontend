/** Bill dataset API wrappers — real endpoints only, ocr_type/task_key fixed to bill. */

import { apiClient } from "@/api/client";
import {
  archiveDataset,
  createDataset,
  getDataset,
  hardDeleteDataset,
  listDatasetSamples,
  listDatasets,
  listEvaluations,
  listEvaluationHardFailures,
  startEvaluation,
  cancelEvaluation,
  getEvaluation,
  getEvaluationMetrics,
  compareEvaluations,
  uploadDatasetZip,
  updateDatasetSample,
  deleteDatasetSample,
  fetchSampleImageObjectUrl,
  setDatasetEvaluationEligibility,
} from "@/api/evaluation";
import { exploreSamples } from "@/api/explorer";
import { getBillJob, listBillFeedback, exportBillFeedback } from "@/api/bill";
import type {
  CreateDatasetPayload,
  ListDatasetsParams,
  ListEvaluationsParams,
  ListSamplesParams,
  StartEvaluationPayload,
} from "@/types/evaluation";

const BILL = "bill" as const;

export function listBillDatasets(
  params: Omit<ListDatasetsParams, "ocr_type"> = {},
) {
  return listDatasets({ ...params, ocr_type: BILL });
}

export function createBillDataset(
  payload: Omit<CreateDatasetPayload, "ocr_type"> & { ocr_type?: string },
) {
  return createDataset({ ...payload, ocr_type: BILL });
}

export {
  getDataset as getBillDataset,
  archiveDataset as archiveBillDataset,
  hardDeleteDataset as hardDeleteBillDataset,
  listDatasetSamples as listBillDatasetSamples,
  updateDatasetSample as updateBillDatasetSample,
  deleteDatasetSample as deleteBillDatasetSample,
  fetchSampleImageObjectUrl as fetchBillSampleImageObjectUrl,
  uploadDatasetZip as uploadBillDatasetZip,
  setDatasetEvaluationEligibility as setBillDatasetEvalEligibility,
  getEvaluation as getBillEvaluation,
  getEvaluationMetrics as getBillEvaluationMetrics,
  compareEvaluations as compareBillEvaluations,
  cancelEvaluation as cancelBillEvaluation,
  getBillJob,
  listBillFeedback,
  exportBillFeedback,
};

export function listBillEvaluations(
  params: Omit<ListEvaluationsParams, "ocr_type"> = {},
) {
  return listEvaluations({ ...params, ocr_type: BILL });
}

export function startBillEvaluation(
  payload: Omit<StartEvaluationPayload, "ocr_type"> & { ocr_type?: string },
) {
  return startEvaluation({ ...payload, ocr_type: BILL });
}

export function listBillHardFailures(params: {
  dataset_id: string;
  evaluation_id?: string;
  limit?: number;
  offset?: number;
  failure_type?: string;
  search?: string;
}) {
  return listEvaluationHardFailures(params);
}

export function exploreBillSamples(
  params: Parameters<typeof exploreSamples>[0] = {},
) {
  return exploreSamples({ ...params, task_key: BILL });
}

export type PlatformJobRow = {
  id: string;
  job_type?: string;
  status: string;
  task_key?: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string | null;
  progress_pct?: number | null;
};

export async function listBillPlatformJobs(
  limit = 100,
): Promise<PlatformJobRow[]> {
  const { data } = await apiClient.get<{
    jobs?: PlatformJobRow[];
    items?: PlatformJobRow[];
  }>("/v1/jobs", { params: { task_key: BILL, limit } });
  return data.jobs ?? data.items ?? [];
}

export async function cancelBillPlatformJob(jobId: string) {
  const { data } = await apiClient.post(`/v1/jobs/${jobId}/cancel`);
  return data;
}

export async function validateImportManifest(manifest: unknown) {
  const { data } = await apiClient.post<{
    valid?: boolean;
    errors?: unknown[];
    warnings?: unknown[];
    [key: string]: unknown;
  }>("/v1/import/validate", { manifest });
  return data;
}

export async function listCanonicalBillDatasets() {
  const { data } = await apiClient.get<{
    datasets?: Array<{
      id?: string;
      name?: string;
      task_key?: string;
      versions?: Array<Record<string, unknown>>;
      [key: string]: unknown;
    }>;
  }>("/v1/canonical-datasets", { params: { task_key: BILL } });
  return data;
}

export function billSampleListParams(
  datasetId: string,
  opts: {
    page?: number;
    pageSize?: number;
    split?: string | null;
    search?: string;
    hasGt?: boolean;
    annotationStatus?: string;
  } = {},
): { datasetId: string; params: ListSamplesParams } {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 25;
  return {
    datasetId,
    params: {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      split: opts.split && opts.split !== "all" ? opts.split : undefined,
      search: opts.search || undefined,
      has_gt: opts.hasGt,
      annotation_status: opts.annotationStatus,
    },
  };
}

export type BillImportValidationSummary = {
  valid: boolean;
  documents_found: number;
  labeled: number;
  partial: number;
  unlabeled: number;
  invalid: number;
  valid_documents: number;
  invalid_documents: number;
  missing_documents: number;
  orphan_annotations: number;
  duplicate_ids: number;
  invalid_annotations: number;
  unsupported_files: number;
  manifest_hash?: string | null;
  issue_count?: number;
  issues?: Array<{
    code: string;
    severity: string;
    message: string;
    document_id?: string | null;
    path?: string | null;
    stage?: string;
  }>;
  issues_truncated?: boolean;
};

export async function validateBillDatasetZip(
  file: File,
): Promise<BillImportValidationSummary> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<BillImportValidationSummary>(
    "/v1/bill/datasets/import/validate",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 300_000,
    },
  );
  return data;
}

export async function importBillDatasetZip(
  file: File,
  opts: {
    name?: string;
    version?: string;
    description?: string;
    chunkSize?: number;
    proceedWithValidOnly?: boolean;
  } = {},
) {
  const form = new FormData();
  form.append("file", file);
  if (opts.name) form.append("name", opts.name);
  if (opts.version) form.append("version", opts.version);
  if (opts.description) form.append("description", opts.description);
  if (opts.chunkSize != null) form.append("chunk_size", String(opts.chunkSize));
  form.append(
    "proceed_with_valid_only",
    opts.proceedWithValidOnly === false ? "false" : "true",
  );
  const { data } = await apiClient.post(
    "/v1/bill/datasets/import",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 600_000,
    },
  );
  return data as {
    id: string;
    name: string;
    version: string;
    sample_count: number;
    status: string;
    labeled_count?: number;
    partial_count?: number;
    unlabeled_count?: number;
    invalid_count?: number;
    import_status?: string;
    [key: string]: unknown;
  };
}

export async function getBillDatasetSummary(datasetId: string) {
  const { data } = await apiClient.get<{
    dataset_id: string;
    [key: string]: unknown;
  }>(`/v1/bill/datasets/${datasetId}/summary`);
  return data;
}

export async function getBillDatasetIssues(datasetId: string) {
  const { data } = await apiClient.get<{
    dataset_id: string;
    issues?: unknown[];
    [key: string]: unknown;
  }>(`/v1/bill/datasets/${datasetId}/issues`);
  return data;
}
