import { Alert, Card, Descriptions, Spin, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'

import { getApiErrorMessage } from '@/api/client'
import { getSettings } from '@/api/explorer'
import { PageHeader } from '@/components/common/PageHeader'

function BoolTag({ value }: { value: boolean }) {
  return (
    <Typography.Text type={value ? 'success' : 'secondary'}>
      {value ? 'enabled' : 'disabled'}
    </Typography.Text>
  )
}

export function SettingsPage() {
  const settingsQuery = useQuery({
    queryKey: ['platform', 'settings'],
    queryFn: getSettings,
  })

  const settings = settingsQuery.data

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <PageHeader
        breadcrumbs={[
          { title: 'Dashboard', path: '/overview' },
          { title: 'Settings' },
        ]}
      />

      <div className="space-y-4 p-6">
        {settingsQuery.isLoading ? (
          <Spin />
        ) : settingsQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Failed to load settings"
            description={getApiErrorMessage(settingsQuery.error)}
          />
        ) : settings ? (
          <>
            <Alert type="info" showIcon message={settings.note} />

            <Card title="Workers" size="small">
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Training worker">
                  <BoolTag value={settings.workers.training_worker_enabled} />
                </Descriptions.Item>
                <Descriptions.Item label="Evaluation worker">
                  <BoolTag
                    value={settings.workers.evaluation_worker_enabled}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="Training max concurrency">
                  {settings.workers.training_max_concurrency}
                </Descriptions.Item>
                <Descriptions.Item label="Evaluation max concurrency">
                  {settings.workers.evaluation_max_concurrency}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="Training gates" size="small">
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Auto promote">
                  <BoolTag value={settings.training_gates.auto_promote} />
                </Descriptions.Item>
                <Descriptions.Item label="Auto retrain">
                  <BoolTag
                    value={settings.training_gates.auto_retrain_enabled}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="Min exact match">
                  {settings.training_gates.min_exact_match}
                </Descriptions.Item>
                <Descriptions.Item label="Max CER regression">
                  {settings.training_gates.max_cer_regression}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="Inference & observability" size="small">
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Request timeout (s)">
                  {settings.inference.request_timeout_seconds ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Max image bytes">
                  {settings.inference.max_image_bytes ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Metrics">
                  <BoolTag value={settings.observability.metrics_enabled} />
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  )
}
