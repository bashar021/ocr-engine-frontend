import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  archiveDataset,
  cancelEvaluation,
  copyResultToDataset,
  createDataset,
  deleteAllEvaluations,
  deleteEvaluation,
  hardDeleteDataset,
  mergeTrainingDatasets,
  moveSampleToDatabankCategory,
  reEvaluate,
  setDatasetEvaluationEligibility,
  startEvaluation,
  uploadDatasetZip,
} from "@/api/evaluation";
import type {
  CreateDatasetPayload,
  EvaluationRun,
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

export function useDeleteEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEvaluation(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["evaluation", "runs"] });
    },
  });
}

export function useDeleteAllEvaluations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ocr_type?: string) => deleteAllEvaluations(ocr_type),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["evaluation", "runs"] });
    },
  });
}

export function useReEvaluate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (run: EvaluationRun) => reEvaluate(run),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["evaluation", "runs"] });
      await queryClient.invalidateQueries({
        queryKey: ["evaluation", "datasets"],
      });
    },
  });
}

export function useMoveSampleToDatabankCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      datasetId,
      sampleId,
      category,
    }: {
      datasetId: string;
      sampleId: string;
      category: string;
    }) => moveSampleToDatabankCategory(datasetId, sampleId, category),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["evaluation", "samples", variables.datasetId],
      });
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

export function useCopyResultToDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      evaluationId,
      resultId,
      targetDatasetId,
    }: {
      evaluationId: string;
      resultId: string;
      targetDatasetId: string;
    }) => copyResultToDataset(evaluationId, resultId, targetDatasetId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["evaluation", "datasets"],
      });
    },
  });
}
