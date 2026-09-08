import { Card, Col, Empty, Row, Statistic, Tag, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'

import { PageHeader } from '@/components/common/PageHeader'
import { getDashboard } from '@/api/platform/tasks'
import { useTaskContext } from '@/features/tasks/TaskContext'

export function OverviewPage() {
  const { activeTaskKey, activeTask, hasCapability } = useTaskContext()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', activeTaskKey],
    queryFn: () => getDashboard(activeTaskKey),
    enabled: Boolean(activeTaskKey),
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      <PageHeader
        title={`${activeTask?.display_name ?? activeTaskKey} overview`}
        description="Task-aware operational snapshot: production model, releases, and capabilities."
      />
      {isLoading ? (
        <Typography.Text>Loading dashboard…</Typography.Text>
      ) : !data ? (
        <Empty description="No dashboard data" />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {(data.capabilities ?? []).map((c) => (
              <Tag key={c}>{c}</Tag>
            ))}
          </div>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card>
                <Statistic title="Model versions" value={data.model_version_count} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Statistic title="Releases" value={data.release_count} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Statistic
                  title="Active revision"
                  value={
                    (data.active_deployment_revision?.revision_number as number) ??
                    '—'
                  }
                />
              </Card>
            </Col>
          </Row>
          <Card className="mt-4" title="Production model version">
            <Typography.Text code>
              {data.production_model_version_id ?? 'Not deployed'}
            </Typography.Text>
          </Card>
          {!hasCapability('supports_live_ocr') && (
            <Typography.Paragraph className="mt-4 !text-slate-500">
              This task does not advertise live OCR capability.
            </Typography.Paragraph>
          )}
        </>
      )}
    </div>
  )
}
