import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  listBillDatasets,
  getBillDataset,
  listBillDatasetSamples,
  listBillEvaluations,
  listBillPlatformJobs,
  exploreBillSamples,
  listBillHardFailures,
  listCanonicalBillDatasets,
  archiveBillDataset,
  hardDeleteBillDataset,
  cancelBillPlatformJob,
  exportBillFeedback,
} from "@/api/billDataset";
import { listBillProfiles, getBillFailureTaxonomy } from "@/api/bill";
import { EVALUATION_POLL_INTERVAL_MS } from "@/constants/polling";
import type { ListDatasetsParams, ListSamplesParams } from "@/types/evaluation";

export const billDatasetKeys = {
  all: ["bill", "dataset"] as const,
  datasets: (params: ListDatasetsParams) =>
    ["bill", "dataset", "list", params] as const,
  dataset: (id: string) => ["bill", "dataset", "one", id] as const,
  samples: (id: string, params: ListSamplesParams) =>
    ["bill", "dataset", "samples", id, params] as const,
  evaluations: (params: unknown) =>
    ["bill", "dataset", "evaluations", params] as const,
  jobs: ["bill", "dataset", "jobs"] as const,
  explorer: (params: unknown) =>
    ["bill", "dataset", "explorer", params] as const,
  hardFailures: (params: unknown) =>
    ["bill", "dataset", "hard-failures", params] as const,
  canonical: ["bill", "dataset", "canonical"] as const,
  profiles: ["bill", "dataset", "profiles"] as const,
  taxonomy: ["bill", "dataset", "taxonomy"] as const,
};

const ACTIVE_DS = new Set(["uploading", "processing"]);
const ACTIVE_EVAL = new Set(["queued", "running"]);
const ACTIVE_JOB = new Set(["queued", "pending", "running", "processing"]);

export function useBillDatasetsQuery(
  params: Omit<ListDatasetsParams, "ocr_type">,
  enabled = true,
) {
  const full = { ...params, ocr_type: "bill" };
  return useQuery({
    queryKey: billDatasetKeys.datasets(full),
    queryFn: () => listBillDatasets(params),
    enabled,
    placeholderData: (p) => p,
    refetchInterval: (q) => {
      const rows = q.state.data?.datasets ?? [];
      return rows.some((d) => ACTIVE_DS.has(String(d.status)))
        ? EVALUATION_POLL_INTERVAL_MS
        : false;
    },
  });
}

export function useBillDatasetQuery(datasetId: string | null | undefined) {
  return useQuery({
    queryKey: billDatasetKeys.dataset(datasetId ?? ""),
    queryFn: () => getBillDataset(datasetId!),
    enabled: Boolean(datasetId),
  });
}

export function useBillDatasetSamplesQuery(
  datasetId: string | null | undefined,
  params: ListSamplesParams,
) {
  return useQuery({
    queryKey: billDatasetKeys.samples(datasetId ?? "", params),
    queryFn: () => listBillDatasetSamples(datasetId!, params),
    enabled: Boolean(datasetId),
    placeholderData: (p) => p,
  });
}

export function useBillEvaluationsQuery(params: {
  dataset_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: billDatasetKeys.evaluations(params),
    queryFn: () => listBillEvaluations(params),
    refetchInterval: (q) => {
      const rows = q.state.data?.evaluations ?? [];
      return rows.some((e) => ACTIVE_EVAL.has(String(e.status)))
        ? EVALUATION_POLL_INTERVAL_MS
        : false;
    },
  });
}

export function useBillPlatformJobsQuery() {
  return useQuery({
    queryKey: billDatasetKeys.jobs,
    queryFn: () => listBillPlatformJobs(),
    refetchInterval: (q) => {
      const rows = q.state.data ?? [];
      return rows.some((j) => ACTIVE_JOB.has(String(j.status).toLowerCase()))
        ? 5_000
        : false;
    },
  });
}

export function useBillExplorerQuery(
  params: Parameters<typeof exploreBillSamples>[0],
  enabled = true,
) {
  return useQuery({
    queryKey: billDatasetKeys.explorer(params),
    queryFn: () => exploreBillSamples(params),
    enabled,
  });
}

export function useBillHardFailuresQuery(
  params: {
    dataset_id: string;
    limit?: number;
    offset?: number;
  } | null,
) {
  return useQuery({
    queryKey: billDatasetKeys.hardFailures(params),
    queryFn: () => listBillHardFailures(params!),
    enabled: Boolean(params?.dataset_id),
  });
}

export function useBillCanonicalDatasetsQuery() {
  return useQuery({
    queryKey: billDatasetKeys.canonical,
    queryFn: listCanonicalBillDatasets,
  });
}

export function useBillDatasetProfilesQuery() {
  return useQuery({
    queryKey: billDatasetKeys.profiles,
    queryFn: listBillProfiles,
  });
}

export function useBillTaxonomyQuery() {
  return useQuery({
    queryKey: billDatasetKeys.taxonomy,
    queryFn: getBillFailureTaxonomy,
  });
}

export function useBillDatasetMutations() {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: billDatasetKeys.all });

  return {
    archive: useMutation({
      mutationFn: archiveBillDataset,
      onSuccess: invalidate,
    }),
    hardDelete: useMutation({
      mutationFn: hardDeleteBillDataset,
      onSuccess: invalidate,
    }),
    cancelJob: useMutation({
      mutationFn: cancelBillPlatformJob,
      onSuccess: () => qc.invalidateQueries({ queryKey: billDatasetKeys.jobs }),
    }),
    exportFeedback: useMutation({
      mutationFn: exportBillFeedback,
    }),
  };
}
