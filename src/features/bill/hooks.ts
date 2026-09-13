import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  exportBillFeedback,
  getBillDocumentEvidence,
  getBillDocumentResult,
  getBillDocumentReview,
  getBillFailureTaxonomy,
  getBillProfile,
  getDefaultBillSchema,
  listBillFeedback,
  listBillModels,
  listBillProfiles,
  listBillProviders,
  listGeneratedBillProfiles,
  processBillDocument,
  submitBillReviewCorrection,
  updateBillProfile,
  validateBillSchema,
  type ProfileVersionBody,
} from "@/api/bill";
import {
  documentFromProcessResponse,
  listLocalBillDocuments,
  saveBillBlob,
  upsertLocalBillDocument,
} from "@/features/bill/localDocuments";
import { getApiErrorMessage } from "@/api/client";

export const billKeys = {
  all: ["bill"] as const,
  localDocs: ["bill", "local-docs"] as const,
  result: (id: string) => ["bill", "result", id] as const,
  evidence: (id: string) => ["bill", "evidence", id] as const,
  review: (id: string) => ["bill", "review", id] as const,
  profiles: ["bill", "profiles"] as const,
  profile: (id: string) => ["bill", "profile", id] as const,
  feedback: (docId?: string) => ["bill", "feedback", docId ?? "all"] as const,
  providers: ["bill", "providers"] as const,
  models: ["bill", "models"] as const,
  taxonomy: ["bill", "taxonomy"] as const,
  generated: ["bill", "generated-profiles"] as const,
};

export function useLocalBillDocuments(refreshKey = 0) {
  return useQuery({
    queryKey: [...billKeys.localDocs, refreshKey],
    queryFn: () => listLocalBillDocuments(),
  });
}

export function useBillDocumentResult(documentId: string | undefined) {
  return useQuery({
    queryKey: billKeys.result(documentId ?? ""),
    queryFn: () => getBillDocumentResult(documentId!),
    enabled: Boolean(documentId),
  });
}

export function useBillDocumentEvidence(documentId: string | undefined) {
  return useQuery({
    queryKey: billKeys.evidence(documentId ?? ""),
    queryFn: () => getBillDocumentEvidence(documentId!),
    enabled: Boolean(documentId),
  });
}

export function useBillDocumentReview(documentId: string | undefined) {
  return useQuery({
    queryKey: billKeys.review(documentId ?? ""),
    queryFn: () => getBillDocumentReview(documentId!),
    enabled: Boolean(documentId),
  });
}

export function useBillProfiles() {
  return useQuery({
    queryKey: billKeys.profiles,
    queryFn: listBillProfiles,
  });
}

export function useBillProfile(profileId: string | undefined) {
  return useQuery({
    queryKey: billKeys.profile(profileId ?? ""),
    queryFn: () => getBillProfile(profileId!),
    enabled: Boolean(profileId),
  });
}

export function useUpdateBillProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      profileId,
      body,
    }: {
      profileId: string;
      body: ProfileVersionBody;
    }) => updateBillProfile(profileId, body),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: billKeys.profiles });
      void qc.invalidateQueries({ queryKey: billKeys.profile(vars.profileId) });
    },
  });
}

export function useBillFeedback(documentId?: string) {
  return useQuery({
    queryKey: billKeys.feedback(documentId),
    queryFn: () => listBillFeedback(documentId),
  });
}

export function useBillProviders() {
  return useQuery({
    queryKey: billKeys.providers,
    queryFn: listBillProviders,
  });
}

export function useBillModels() {
  return useQuery({
    queryKey: billKeys.models,
    queryFn: listBillModels,
  });
}

export function useBillFailureTaxonomy() {
  return useQuery({
    queryKey: billKeys.taxonomy,
    queryFn: getBillFailureTaxonomy,
  });
}

export function useGeneratedBillProfiles() {
  return useQuery({
    queryKey: billKeys.generated,
    queryFn: listGeneratedBillProfiles,
  });
}

export function useDefaultBillSchema() {
  return useQuery({
    queryKey: ["bill", "default-schema"],
    queryFn: getDefaultBillSchema,
  });
}

export function useProcessBillDocuments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      files: File[];
      profileId?: string;
      profileVersion?: string;
      forceProcess?: boolean;
      onFileDone?: (file: File, ok: boolean, error?: string) => void;
    }) => {
      const results = [];
      for (const file of args.files) {
        const startedAt = Date.now();
        const blobKey = `blob-${crypto.randomUUID()}`;
        try {
          await saveBillBlob(blobKey, file);
          const response = await processBillDocument(file, {
            profileId: args.profileId,
            profileVersion: args.profileVersion,
            forceProcess: args.forceProcess,
          });
          const local = documentFromProcessResponse({
            file,
            blobKey,
            response,
            startedAt,
          });
          upsertLocalBillDocument(local);
          args.onFileDone?.(file, true);
          results.push({ ok: true as const, local, response });
        } catch (err) {
          const message = getApiErrorMessage(err);
          args.onFileDone?.(file, false, message);
          results.push({ ok: false as const, file, error: message, blobKey });
        }
      }
      return results;
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: billKeys.localDocs });
    },
  });
}

export function useSubmitBillCorrection(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: submitBillReviewCorrection.bind(null, documentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: billKeys.feedback(documentId) });
      void qc.invalidateQueries({ queryKey: billKeys.review(documentId) });
      void qc.invalidateQueries({ queryKey: billKeys.feedback() });
    },
  });
}

export function useExportBillFeedback() {
  return useMutation({ mutationFn: exportBillFeedback });
}

export function useValidateBillSchema() {
  return useMutation({ mutationFn: validateBillSchema });
}
