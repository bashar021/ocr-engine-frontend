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
    },
  };
}
