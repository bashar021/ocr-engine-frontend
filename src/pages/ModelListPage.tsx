import { CloudUploadOutlined } from '@ant-design/icons'
import { Alert, Button } from 'antd'
import { useMemo, useState } from 'react'

import { getApiErrorMessage } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import {
  ModelFilters,
  type ModelFilterState,
} from '@/components/models/ModelFilters'
import { ModelsTable } from '@/components/models/ModelsTable'
import { UploadModelModal } from '@/components/models/UploadModelModal'
import { useModelsQuery } from '@/features/models/useModelsQuery'
import { useDebounce } from '@/hooks/useDebounce'

const DEFAULT_FILTERS: ModelFilterState = { search: '' }

export function ModelListPage() {
  const [filters, setFilters] = useState<ModelFilterState>(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [uploadOpen, setUploadOpen] = useState(false)
  const debouncedSearch = useDebounce(filters.search, 300)

  const params = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      ocr_type: filters.ocr_type,
      role: filters.role,
      status: filters.status,
      runtime: filters.runtime,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      include_metrics: false,
    }),
    [debouncedSearch, filters, page, pageSize],
  )

  const query = useModelsQuery(params)

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: 'Dashboard', path: '/' },
          { title: 'Models', path: '/models/list' },
          { title: 'Model list' },
        ]}
        actions={
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            onClick={() => setUploadOpen(true)}
          >
            Upload model
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        <ModelFilters
          tab="models"
          value={filters}
          onChange={(next) => {
            setFilters(next)
            setPage(1)
          }}
          total={query.data?.total}
        />
        {query.isError ? (
          <Alert
            type="error"
            showIcon
            message="Failed to load models"
            description={getApiErrorMessage(query.error)}
            action={
              <Button size="small" onClick={() => void query.refetch()}>
                Retry
              </Button>
            }
          />
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto">
          <ModelsTable
            data={query.data?.artifacts ?? []}
            loading={query.isLoading || query.isFetching}
            total={query.data?.total ?? 0}
            page={page}
            pageSize={pageSize}
            onPageChange={(p, s) => {
              setPage(p)
              setPageSize(s)
            }}
          />
        </div>
      </div>
      <UploadModelModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  )
}
