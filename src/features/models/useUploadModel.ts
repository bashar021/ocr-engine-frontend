import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getApiErrorMessage } from '@/api/client'
import { uploadArtifact } from '@/api/models'
import type { UploadArtifactPayload } from '@/types/models'

export function useUploadModel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UploadArtifactPayload) => uploadArtifact(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['models', 'artifacts'] })
    },
    meta: {
      errorMessage: (error: unknown) => getApiErrorMessage(error),
    },
  })
}
