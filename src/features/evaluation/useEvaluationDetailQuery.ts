import { useQuery } from '@tanstack/react-query'

import {
  getEvaluation,
  getEvaluationMetrics,
  listDatasetSamples,
  listEvaluationResults,
} from '@/api/evaluation'
import { EVALUATION_POLL_INTERVAL_MS } from '@/constants/polling'

export function useDatasetSamplesQuery(
  datasetId: string | null,
  params: { limit: number; offset: number },
) {
  return useQuery({
    queryKey: ['evaluation', 'samples', datasetId, params],
    queryFn: () => listDatasetSamples(datasetId!, params),
    enabled: Boolean(datasetId),
  })
}

export function useEvaluationDetailQuery(evaluationId: string | null) {
  return useQuery({
    queryKey: ['evaluation', 'detail', evaluationId],
    queryFn: () => getEvaluation(evaluationId!),
    enabled: Boolean(evaluationId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'queued' || status === 'running'
        ? EVALUATION_POLL_INTERVAL_MS
        : false
    },
  })
}

export function useEvaluationMetricsQuery(
  evaluationId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['evaluation', 'metrics', evaluationId],
    queryFn: () => getEvaluationMetrics(evaluationId!),
    enabled: Boolean(evaluationId) && enabled,
  })
}

export function useEvaluationResultsQuery(
  evaluationId: string | null,
  params: { limit: number; offset: number },
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['evaluation', 'results', evaluationId, params],
    queryFn: () => listEvaluationResults(evaluationId!, params),
    enabled: Boolean(evaluationId) && enabled,
  })
}
