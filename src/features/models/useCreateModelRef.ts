import { useMutation, useQueryClient } from "@tanstack/react-query";

import { activatePipelineRef, createPipelineRef } from "@/api/models";
import type { CreatePipelineRefPayload } from "@/types/models";

export function useCreateModelRef() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePipelineRefPayload) => {
      const created = await createPipelineRef(payload);
      if (payload.activate) {
        return activatePipelineRef(
          created.ocr_type,
          created.model_ref,
          Boolean(payload.set_default),
        );
      }
      return created;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["models", "refs"] });
    },
  });
}
