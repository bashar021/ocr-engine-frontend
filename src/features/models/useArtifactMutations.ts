import { message } from "antd";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import { activateArtifact, deleteArtifact, retireArtifact } from "@/api/models";

export function useArtifactMutations() {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["models", "artifacts"] });
    await queryClient.invalidateQueries({
      queryKey: ["models", "recognition-configs"],
    });
  };

  const retire = useMutation({
    mutationFn: (id: string) => retireArtifact(id),
    onSuccess: async (art) => {
      await invalidate();
      message.success(`Deactivated ${art.name}@${art.version}`);
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const activate = useMutation({
    mutationFn: (id: string) => activateArtifact(id),
    onSuccess: async (art) => {
      await invalidate();
      message.success(`Activated ${art.name}@${art.version}`);
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteArtifact(id),
    onSuccess: async (art) => {
      await invalidate();
      message.success(`Deleted ${art.name}@${art.version}`);
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  return { retire, activate, remove };
}
