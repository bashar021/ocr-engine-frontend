import { Alert, Card, Col, Empty, Row, Statistic, Tag, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/common/PageHeader'
import { getDashboard, type DashboardPayload } from '@/api/platform/tasks'
import { useTaskContext } from '@/features/tasks/TaskContext'
import { getApiErrorMessage } from '@/api/client'

type DashboardExt = DashboardPayload & {
  dataset?: {
    databank_dataset_count?: number
    verified_samples?: number
    pending_review?: number
    difficult_samples?: number
    quality_distribution?: Record<string, number>
  }
  operations?: {
    recent_evaluations?: Array<Record<string, unknown>>
    recent_training_runs?: Array<Record<string, unknown>>
    active_hard_cases?: number
  }
}

export function OverviewPage() {
  const { activeTaskKey, activeTask } = useTaskContext()
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', activeTaskKey],
    queryFn: () => getDashboard(activeTaskKey) as Promise<DashboardExt>,
    enabled: Boolean(activeTaskKey),
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      <PageHeader
        title={`${activeTask?.display_name ?? activeTaskKey} overview`}
        description="Task-aware operational snapshot. Switch tasks in the sidebar to update metrics, datasets, and models."
      />
      {isError && (
        <Alert
          type="error"
          showIcon
          className="mb-4"
          message={getApiErrorMessage(error)}
          action={<Typography.Link onClick={() => refetch()}>Retry</Typography.Link>}
        />
      )}
      {isLoading ? (
        <Typography.Text>Loading dashboard…</Typography.Text>
      ) : !data ? (
        <Empty description="No dashboard data" />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {(data.capabilities ?? []).slice(0, 12).map((c) => (
              <Tag key={c}>{c}</Tag>
            ))}
          </div>

          <Typography.Title level={5}>Data</Typography.Title>
          <Row gutter={[16, 16]} className="mb-4">
            <Col xs={12} md={6}>
              <Card>
                <Statistic
                  title={<Link to="/evaluation/dataset-list">Verified samples</Link>}
                  value={data.dataset?.verified_samples ?? 0}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic
                  title={<Link to="/annotation">Pending review</Link>}
                  value={data.dataset?.pending_review ?? 0}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic
                  title={<Link to="/data-explorer">Difficult samples</Link>}
                  value={data.dataset?.difficult_samples ?? 0}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic
                  title="Databank datasets"
                  value={data.dataset?.databank_dataset_count ?? 0}
                />
              </Card>
            </Col>
          </Row>

          <Typography.Title level={5}>Models & releases</Typography.Title>
          <Row gutter={[16, 16]} className="mb-4">
            <Col xs={12} md={6}>
              <Card>
                <Statistic
                  title={<Link to="/models/list">Model versions</Link>}
                  value={data.model_version_count}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic
                  title={<Link to="/releases">Releases</Link>}
                  value={data.release_count}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic
                  title={<Link to="/deployments">Active revision</Link>}
                  value={
                    (data.active_deployment_revision?.revision_number as number) ??
                    '—'
                  }
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic
                  title="Hard cases"
                  value={data.operations?.active_hard_cases ?? 0}
                />
              </Card>
            </Col>
          </Row>

          <Card className="mb-4" title="Production model version">
            <Typography.Text code copyable={Boolean(data.production_model_version_id)}>
              {data.production_model_version_id ?? 'Not deployed'}
            </Typography.Text>
          </Card>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card
                title={<Link to="/evaluation/runs">Recent evaluations</Link>}
                size="small"
              >
                {(data.operations?.recent_evaluations ?? []).length === 0 ? (
                  <Empty description="No evaluations yet" />
                ) : (
                  <ul className="m-0 list-none space-y-2 p-0">
                    {(data.operations?.recent_evaluations ?? []).map((e) => (
                      <li key={String(e.id)}>
                        <Tag>{String(e.status)}</Tag>{' '}
                        <Typography.Text code>{String(e.model_ref)}</Typography.Text>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card
                title={<Link to="/training/runs">Recent training</Link>}
                size="small"
              >
                {(data.operations?.recent_training_runs ?? []).length === 0 ? (
                  <Empty description="No training runs yet" />
                ) : (
                  <ul className="m-0 list-none space-y-2 p-0">
                    {(data.operations?.recent_training_runs ?? []).map((t) => (
                      <li key={String(t.id)}>
                        <Tag>{String(t.status)}</Tag>{' '}
                        {String(t.name)}@{String(t.version)}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </Col>
          </Row>

          {data.dataset?.quality_distribution &&
            Object.keys(data.dataset.quality_distribution).length > 0 && (
              <Card className="mt-4" title="Quality distribution" size="small">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.dataset.quality_distribution).map(
                    ([k, v]) => (
                      <Tag key={k}>
                        {k}: {v}
                      </Tag>
                    ),
                  )}
                </div>
              </Card>
            )}
        </>
      )}
    </div>
  )
}
