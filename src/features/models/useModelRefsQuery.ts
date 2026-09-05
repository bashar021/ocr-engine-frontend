import { useQuery } from "@tanstack/react-query";

import { listPipelineRefs } from "@/api/models";
import type { ListPipelineRefsParams } from "@/types/models";

export const modelRefsQueryKey = (params: ListPipelineRefsParams) =>
  ["models", "refs", params] as const;

export function useModelRefsQuery(
  params: ListPipelineRefsParams,
  enabled = true,
) {
  return useQuery({
    queryKey: modelRefsQueryKey(params),
    queryFn: () => listPipelineRefs(params),
    enabled,
    placeholderData: (previous) => previous,
  });
}
