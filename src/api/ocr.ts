import { apiClient } from '@/api/client'
import type { OcrResponse } from '@/types/ocr'

export async function runOdometerOcr(
  file: File,
  modelRef?: string,
): Promise<OcrResponse> {
  return runTaskOcr('odometer', file, { modelRef })
}

export async function runTaskOcr(
  taskKey: string,
  file: File,
  opts?: { modelRef?: string; modelVersion?: string; modelAlias?: string },
): Promise<OcrResponse> {
  const form = new FormData()
  form.append('image', file)
  // Prefer compatibility routes for odometer when only modelRef is set
  if (taskKey === 'odometer' && !opts?.modelVersion && !opts?.modelAlias) {
    const path = opts?.modelRef
      ? `/v1/ocr/odometer/${encodeURIComponent(opts.modelRef)}`
      : '/v1/ocr/odometer'
    const { data } = await apiClient.post<OcrResponse>(path, form)
    return data
  }
  if (opts?.modelVersion) {
    const { data } = await apiClient.post<OcrResponse>(
      `/v1/ocr/${encodeURIComponent(taskKey)}/models/${encodeURIComponent(opts.modelVersion)}`,
      form,
    )
    return data
  }
  if (opts?.modelRef) form.append('model_ref', opts.modelRef)
  if (opts?.modelAlias) form.append('model_alias', opts.modelAlias)
  const { data } = await apiClient.post<OcrResponse>(
    `/v1/ocr/${encodeURIComponent(taskKey)}`,
    form,
  )
  return data
}
