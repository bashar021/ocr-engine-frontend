import { useQuery } from '@tanstack/react-query'

import { listEvaluations } from '@/api/evaluation'
import { EVALUATION_POLL_INTERVAL_MS } from '@/constants/polling'
import type { ListEvaluationsParams } from '@/types/evaluation'

const ACTIVE_RUN_STATUSES = new Set(['queued', 'running'])

export const evaluationsQueryKey = (params: ListEvaluationsParams) =>
  ['evaluation', 'runs', params] as const

export function useEvaluationsQuery(params: ListEvaluationsParams, enabled = true) {
  return useQuery({
    queryKey: evaluationsQueryKey(params),
    queryFn: () => listEvaluations(params),
    enabled,
    placeholderData: (previous) => previous,
    refetchInterval: (query) => {
      const rows = query.state.data?.evaluations ?? []
      const needsPoll = rows.some((e) => ACTIVE_RUN_STATUSES.has(e.status))
      return needsPoll ? EVALUATION_POLL_INTERVAL_MS : false
    },
  })
}
