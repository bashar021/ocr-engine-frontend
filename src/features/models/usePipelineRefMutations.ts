import { message } from "antd";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import {
  activatePipelineRef,
  disablePipelineRef,
  setDefaultPipelineRef,
} from "@/api/models";

type RefKey = { ocrType: string; modelRef: string };

export function usePipelineRefMutations() {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["models", "refs"] });
  };

  const activate = useMutation({
    mutationFn: ({
      ocrType,
      modelRef,
      setDefault = false,
      baseline_evaluation_id,
      candidate_evaluation_id,
      promotion_override,
      promotion_reason,
    }: RefKey & {
      setDefault?: boolean;
      baseline_evaluation_id?: string;
      candidate_evaluation_id?: string;
      promotion_override?: boolean;
      promotion_reason?: string;
    }) =>
      activatePipelineRef(ocrType, modelRef, setDefault, {
        baseline_evaluation_id,
        candidate_evaluation_id,
        promotion_override,
        promotion_reason,
      }),
    onSuccess: async (_data, vars) => {
      await invalidate();
      message.success(
        vars.setDefault
          ? `Activated ${vars.modelRef} and set as default`
          : `Activated ${vars.modelRef}`,
      );
    },
    onError: (err) => {
      message.error(getApiErrorMessage(err));
    },
  });

  const setDefault = useMutation({
    mutationFn: ({ ocrType, modelRef }: RefKey) =>
      setDefaultPipelineRef(ocrType, modelRef),
    onSuccess: async (_data, vars) => {
      await invalidate();
      message.success(`Set ${vars.modelRef} as default`);
    },
    onError: (err) => {
      message.error(getApiErrorMessage(err));
    },
  });

  const disable = useMutation({
    mutationFn: ({ ocrType, modelRef }: RefKey) =>
      disablePipelineRef(ocrType, modelRef),
    onSuccess: async (_data, vars) => {
      await invalidate();
      message.success(`Deactivated ${vars.modelRef}`);
    },
    onError: (err) => {
      message.error(getApiErrorMessage(err));
    },
  });

  return { activate, setDefault, disable };
}
