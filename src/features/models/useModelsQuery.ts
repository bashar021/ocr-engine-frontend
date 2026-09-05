import { useQuery } from "@tanstack/react-query";

import { listArtifacts } from "@/api/models";
import type { ListArtifactsParams } from "@/types/models";

export const modelsQueryKey = (params: ListArtifactsParams) =>
  ["models", "artifacts", params] as const;

export function useModelsQuery(params: ListArtifactsParams, enabled = true) {
  return useQuery({
    queryKey: modelsQueryKey(params),
    queryFn: () => listArtifacts(params),
    enabled,
    placeholderData: (previous) => previous,
  });
}
