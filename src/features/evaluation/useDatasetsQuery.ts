import { useQuery } from '@tanstack/react-query'

import { listDatasets } from '@/api/evaluation'
import { EVALUATION_POLL_INTERVAL_MS } from '@/constants/polling'
import type { ListDatasetsParams } from '@/types/evaluation'

const ACTIVE_DATASET_STATUSES = new Set(['uploading', 'processing'])

export const datasetsQueryKey = (params: ListDatasetsParams) =>
  ['evaluation', 'datasets', params] as const

export function useDatasetsQuery(params: ListDatasetsParams, enabled = true) {
  return useQuery({
    queryKey: datasetsQueryKey(params),
    queryFn: () => listDatasets(params),
    enabled,
    placeholderData: (previous) => previous,
    refetchInterval: (query) => {
      const rows = query.state.data?.datasets ?? []
      const needsPoll = rows.some((d) => ACTIVE_DATASET_STATUSES.has(d.status))
      return needsPoll ? EVALUATION_POLL_INTERVAL_MS : false
    },
  })
}
