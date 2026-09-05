import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  archiveDataset,
  cancelEvaluation,
  createDataset,
  hardDeleteDataset,
  mergeTrainingDatasets,
  setDatasetEvaluationEligibility,
  startEvaluation,
  uploadDatasetZip,
} from "@/api/evaluation";
import type {
  CreateDatasetPayload,
  StartEvaluationPayload,
} from "@/types/evaluation";

export function useUploadDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateDatasetPayload & { file: File }) => {
      const created = await createDataset({
        ocr_type: payload.ocr_type,
        name: payload.name,
        version: payload.version,
        description: payload.description,
        origin: payload.origin ?? "upload",
      });
      return uploadDatasetZip(created.id, payload.file);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["evaluation", "datasets"],
      });
    },
  });
}

export function useStartEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: StartEvaluationPayload) => startEvaluation(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["evaluation", "runs"] });
      await queryClient.invalidateQueries({
        queryKey: ["evaluation", "datasets"],
      });
    },
  });
}

export function useCancelEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelEvaluation(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["evaluation", "runs"] });
    },
  });
}

export function useArchiveDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveDataset(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["evaluation", "datasets"],
      });
    },
  });
}

export function useHardDeleteDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hardDeleteDataset(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["evaluation", "datasets"],
      });
      await queryClient.invalidateQueries({ queryKey: ["evaluation", "runs"] });
    },
  });
}

export function useMergeTrainingDatasets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      dataset_ids: string[];
      name?: string;
      version?: string;
      description?: string;
    }) => mergeTrainingDatasets(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["evaluation", "datasets"],
      });
    },
  });
}

export function useSetDatasetEvaluationEligibility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      datasetId,
      eligible,
    }: {
      datasetId: string;
      eligible: boolean;
    }) => setDatasetEvaluationEligibility(datasetId, eligible),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["evaluation", "datasets"],
      });
    },
  });
}
