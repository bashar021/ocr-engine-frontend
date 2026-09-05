import { apiClient } from '@/api/client'
import type { OcrResponse } from '@/types/ocr'

export async function runOdometerOcr(
  file: File,
  modelRef?: string,
): Promise<OcrResponse> {
  const form = new FormData()
  form.append('image', file)
  const path = modelRef
    ? `/v1/ocr/odometer/${encodeURIComponent(modelRef)}`
    : '/v1/ocr/odometer'
  const { data } = await apiClient.post<OcrResponse>(path, form)
  return data
}
