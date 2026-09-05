import { Button, Drawer, Pagination, Spin, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'

import { useDatasetSamplesQuery } from '@/features/evaluation/useEvaluationDetailQuery'
import type { DatasetSample, EvaluationDataset } from '@/types/evaluation'
import { formatBytes } from '@/utils/format'

interface DatasetSamplesDrawerProps {
  dataset: EvaluationDataset | null
  open: boolean
  onClose: () => void
}

export function DatasetSamplesDrawer({
  dataset,
  open,
  onClose,
}: DatasetSamplesDrawerProps) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const samplesQuery = useDatasetSamplesQuery(open ? dataset?.id ?? null : null, {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  })

  const columns: ColumnsType<DatasetSample> = [
    { title: 'Filename', dataIndex: 'filename', key: 'filename' },
    { title: 'Ground truth', dataIndex: 'ground_truth', key: 'ground_truth' },
    {
      title: 'Normalized',
      dataIndex: 'ground_truth_normalized',
      key: 'ground_truth_normalized',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (
        <Tag color={v === 'active' ? 'green' : 'red'}>{v}</Tag>
      ),
    },
    {
      title: 'Size',
      dataIndex: 'size_bytes',
      key: 'size_bytes',
      render: (v: number | null) => formatBytes(v),
    },
    {
      title: 'Dims',
      key: 'dims',
      render: (_, row) =>
        row.width && row.height ? `${row.width}×${row.height}` : '—',
    },
  ]

  return (
    <Drawer
      title={dataset ? `Samples — ${dataset.name} v${dataset.version}` : 'Samples'}
      open={open}
      onClose={() => {
        setPage(1)
        onClose()
      }}
      width={720}
      destroyOnHidden
      extra={
        <Button onClick={() => void samplesQuery.refetch()} loading={samplesQuery.isFetching}>
          Refresh
        </Button>
      }
    >
      <Spin spinning={samplesQuery.isLoading || samplesQuery.isFetching}>
        <Table
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={samplesQuery.data?.samples ?? []}
          pagination={false}
        />
        <div className="mt-4 flex justify-end">
          <Pagination
            current={page}
            pageSize={pageSize}
            total={samplesQuery.data?.total ?? 0}
            showSizeChanger
            onChange={(p, s) => {
              setPage(p)
              setPageSize(s)
            }}
          />
        </div>
      </Spin>
    </Drawer>
  )
}
