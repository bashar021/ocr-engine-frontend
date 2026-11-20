import axios from 'axios'

/** Leave empty in local/dev so Vite proxies `/v1` → OCR engine. */
const configuredBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()

export const apiClient = axios.create({
  baseURL: configuredBase || undefined,
  timeout: 120_000,
})

apiClient.interceptors.request.use((config) => {
  const apiKey = (import.meta.env.VITE_API_KEY as string | undefined)?.trim()
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey
  }
  return config
})

// Blob responses (e.g. image downloads) keep their error body as an unparsed
// Blob, so the JSON error payload is lost. Re-read it into an object here so
// getApiErrorMessage can surface the real backend message/error_code.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      try {
        const text = await error.response.data.text()
        if (text) error.response.data = JSON.parse(text)
      } catch {
        // Leave the blob in place; getApiErrorMessage falls back to error.message.
      }
    }
    return Promise.reject(error)
  },
)

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { detail?: string; error_code?: string; message?: string }
      | undefined
    if (data?.detail && typeof data.detail === 'string') return data.detail
    if (data?.message) return data.message
    if (data?.error_code) return data.error_code
    if (error.message) return error.message
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong'
}

/** Backend error_code (e.g. SAMPLE_IMAGE_MISSING), when present. */
export function getApiErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error_code?: string } | undefined
    if (data?.error_code) return data.error_code
  }
  return undefined
}
