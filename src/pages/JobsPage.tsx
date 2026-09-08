import { Alert, Card, Empty, Table, Tag, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { apiClient, getApiErrorMessage } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { useTaskContext } from '@/features/tasks/TaskContext'

type JobRow = {
  id: string
  job_type?: string
  status: string
  task_key?: string
  created_at?: string
  started_at?: string
  completed_at?: string
  error_message?: string | null
  progress_pct?: number | null
}

async function listJobs(taskKey: string): Promise<JobRow[]> {
  const { data } = await apiClient.get<{ jobs?: JobRow[]; items?: JobRow[] }>(
    '/v1/jobs',
    { params: { task_key: taskKey, limit: 100 } },
  )
  return data.jobs ?? data.items ?? []
}

export function JobsPage() {
  const { activeTaskKey, activeTask } = useTaskContext()
  const query = useQuery({
    queryKey: ['jobs', activeTaskKey],
    queryFn: () => listJobs(activeTaskKey),
    refetchInterval: 5_000,
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      <PageHeader
        title="Jobs"
        description={`Async OCR / batch jobs for ${activeTask?.display_name ?? activeTaskKey}. Training and evaluation jobs appear in their own sections.`}
      />
      {query.isError && (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          message={getApiErrorMessage(query.error)}
          action={
            <Typography.Link onClick={() => query.refetch()}>Retry</Typography.Link>
          }
        />
      )}
      <Card>
        <Table
          rowKey="id"
          loading={query.isLoading}
          dataSource={query.data ?? []}
          locale={{
            emptyText: (
              <Empty
                description={
                  <span>
                    No async jobs yet. Submit from{' '}
                    <Link to="/ocr">Live OCR</Link> (batch) or the generic OCR
                    async API.
                  </span>
                }
              />
            ),
          }}
          columns={[
            {
              title: 'Job ID',
              dataIndex: 'id',
              render: (id: string) => <Typography.Text code copyable>{id}</Typography.Text>,
            },
            { title: 'Type', dataIndex: 'job_type', render: (v) => v ?? '—' },
            {
              title: 'Status',
              dataIndex: 'status',
              render: (s: string) => <Tag>{s}</Tag>,
            },
            { title: 'Task', dataIndex: 'task_key' },
            {
              title: 'Progress',
              dataIndex: 'progress_pct',
              render: (v) => (v == null ? '—' : `${v}%`),
            },
            { title: 'Created', dataIndex: 'created_at' },
            {
              title: 'Error',
              dataIndex: 'error_message',
              ellipsis: true,
              render: (v) => v || '—',
            },
          ]}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  )
}
