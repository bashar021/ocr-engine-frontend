import {
  Alert,
  Card,
  Collapse,
  Descriptions,
  Table,
  Tag,
  Typography,
} from 'antd'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'

import { PageHeader } from '@/components/common/PageHeader'
import {
  listClientRequestLogs,
  listReleases,
  listDeployments,
  listClients,
  listAuditEvents,
  getVersionGraph,
} from '@/api/platform/tasks'
import { useTaskContext } from '@/features/tasks/TaskContext'

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || ''

function apiUrl(path: string): string {
  if (API_BASE) return `${API_BASE.replace(/\/$/, '')}${path}`
  return path
}

const OCR_RESPONSE_FIELDS = [
  { field: 'request_id', type: 'string (UUID)', note: 'Correlation id for support' },
  { field: 'status', type: '"success" | "low_confidence" | "failed"', note: 'Overall outcome' },
  { field: 'value', type: 'string | null', note: 'Recognized odometer reading when found' },
  { field: 'confidence', type: 'number | null', note: 'Final confidence 0–1' },
  {
    field: 'selected_detection',
    type: 'BoundingBox | null',
    note: '{ x1, y1, x2, y2, confidence, label? } for chosen detection',
  },
  {
    field: 'detections',
    type: 'BoundingBox[]',
    note: 'All candidate detections with bbox + confidence',
  },
  { field: 'error_code', type: 'string | null', note: 'Machine-readable code when not found / failed' },
  { field: 'message', type: 'string | null', note: 'Human-readable detail when value is absent' },
  { field: 'model_ref', type: 'string | null', note: 'Pipeline ref that served the request' },
  { field: 'image_size', type: '{ width, height } | null', note: 'Decoded image dimensions' },
]

export function ReleasesPage() {
  const { activeTaskKey } = useTaskContext()
  const { data = [], isLoading } = useQuery({
    queryKey: ['releases', activeTaskKey],
    queryFn: () => listReleases(activeTaskKey),
  })
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      <PageHeader title="Releases" description={`Model releases for ${activeTaskKey}`} />
      <Table
        loading={isLoading}
        rowKey={(r) => String(r.id)}
        dataSource={data}
        columns={[
          { title: 'ID', dataIndex: 'id', ellipsis: true },
          { title: 'Status', dataIndex: 'status', width: 120 },
          { title: 'Model version', dataIndex: 'model_version_id', ellipsis: true },
          { title: 'Created', dataIndex: 'created_at', width: 200 },
        ]}
      />
    </div>
  )
}

export function DeploymentsPage() {
  const { activeTaskKey } = useTaskContext()
  const { data = [], isLoading } = useQuery({
    queryKey: ['deployments', activeTaskKey],
    queryFn: () => listDeployments(activeTaskKey),
  })
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      <PageHeader title="Deployments" description={`Deployment revisions for ${activeTaskKey}`} />
      <Table
        loading={isLoading}
        rowKey={(r) => String(r.id)}
        dataSource={data}
        columns={[
          { title: 'Revision', dataIndex: 'revision_number', width: 100 },
          { title: 'Active', dataIndex: 'is_active', width: 90, render: (v) => (v ? 'yes' : '') },
          { title: 'Model version', dataIndex: 'model_version_id', ellipsis: true },
          { title: 'Reason', dataIndex: 'reason', ellipsis: true },
          { title: 'Created', dataIndex: 'created_at', width: 200 },
        ]}
      />
    </div>
  )
}

export function ClientsPage() {
  const { activeTaskKey } = useTaskContext()

  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: listClients,
  })

  const logsQuery = useQuery({
    queryKey: ['clients', 'request-logs', activeTaskKey],
    queryFn: () => listClientRequestLogs({ ocr_type: activeTaskKey, limit: 50 }),
  })

  const curlDefault = `curl -X POST '${apiUrl('/v1/ocr/odometer')}' \\
  -H 'X-API-Key: YOUR_API_KEY' \\
  -H 'X-Request-ID: $(uuidgen)' \\
  -F 'image=@/path/to/dashboard.jpg'`

  const curlModelRef = `curl -X POST '${apiUrl('/v1/ocr/odometer/v2')}' \\
  -H 'X-API-Key: YOUR_API_KEY' \\
  -F 'image=@/path/to/dashboard.jpg'`

  const curlGeneric = `curl -X POST '${apiUrl(`/v1/ocr/${activeTaskKey}`)}' \\
  -H 'X-API-Key: YOUR_API_KEY' \\
  -F 'image=@/path/to/image.jpg' \\
  -F 'model_ref=v2'`

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      <PageHeader
        title="API clients"
        description="Third-party OCR integration, client credentials, and request history"
      />

      <div className="mb-6 space-y-4">
        <Card title="OCR Client API documentation" size="small">
          <Alert
            type="info"
            showIcon
            className="mb-4"
            message="Authentication"
            description={
              <>
                Send your client API key in the <Typography.Text code>X-API-Key</Typography.Text>{' '}
                header. Optional <Typography.Text code>X-Request-ID</Typography.Text> (UUID) for
                idempotency and support correlation.
              </>
            }
          />

          <Typography.Title level={5} className="!mt-0">
            Endpoints
          </Typography.Title>
          <Descriptions bordered size="small" column={1} className="mb-4">
            <Descriptions.Item label="Default model">
              <Typography.Text code>POST /v1/ocr/odometer</Typography.Text>
              <div className="mt-1 text-sm text-slate-600">
                Uses the task default pipeline ref (configured <Typography.Text code>is_default</Typography.Text>{' '}
                model ref).
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Explicit model ref (legacy path)">
              <Typography.Text code>POST /v1/ocr/odometer/{'{model_ref}'}</Typography.Text>
              <div className="mt-1 text-sm text-slate-600">
                Example: <Typography.Text code>/v1/ocr/odometer/v2</Typography.Text> pins inference to
                pipeline ref <Typography.Text code>v2</Typography.Text>.
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Generic task route">
              <Typography.Text code>POST /v1/ocr/{activeTaskKey}</Typography.Text>
              <div className="mt-1 text-sm text-slate-600">
                Multipart form: <Typography.Text code>image</Typography.Text> (required), optional{' '}
                <Typography.Text code>model_ref</Typography.Text>,{' '}
                <Typography.Text code>model_version</Typography.Text>, or{' '}
                <Typography.Text code>model_alias</Typography.Text> fields to select a version.
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Version by path">
              <Typography.Text code>
                POST /v1/ocr/{activeTaskKey}/models/{'{model_version}'}
              </Typography.Text>
            </Descriptions.Item>
          </Descriptions>

          <Typography.Title level={5}>Model version selection</Typography.Title>
          <ul className="mb-4 list-disc pl-5 text-sm text-slate-700">
            <li>
              <strong>Path segment</strong> — <Typography.Text code>/v1/ocr/odometer/v2</Typography.Text>{' '}
              is the simplest way to pin a logical ref.
            </li>
            <li>
              <strong>Form field</strong> — on <Typography.Text code>POST /v1/ocr/odometer</Typography.Text>{' '}
              or <Typography.Text code>POST /v1/ocr/{activeTaskKey}</Typography.Text>, pass{' '}
              <Typography.Text code>model_ref=v2</Typography.Text> in the multipart body.
            </li>
            <li>
              <strong>Platform aliases</strong> — <Typography.Text code>model_version</Typography.Text>{' '}
              or <Typography.Text code>model_alias</Typography.Text> on the generic route resolve
              through deployment policy (client policies may restrict allowed versions).
            </li>
          </ul>

          <Collapse
            size="small"
            items={[
              {
                key: 'curl-default',
                label: 'Example — default model',
                children: (
                  <pre className="overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                    {curlDefault}
                  </pre>
                ),
              },
              {
                key: 'curl-ref',
                label: 'Example — explicit model_ref in path',
                children: (
                  <pre className="overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                    {curlModelRef}
                  </pre>
                ),
              },
              {
                key: 'curl-generic',
                label: `Example — generic ${activeTaskKey} route with model_ref form field`,
                children: (
                  <pre className="overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                    {curlGeneric}
                  </pre>
                ),
              },
            ]}
          />
        </Card>

        <Card title="Response contract" size="small">
          <Typography.Paragraph type="secondary" className="text-sm">
            Successful and failed responses share the same JSON shape. When no reading is found,
            <Typography.Text code> value</Typography.Text> is null and{' '}
            <Typography.Text code>error_code</Typography.Text> /{' '}
            <Typography.Text code>message</Typography.Text> explain why.
          </Typography.Paragraph>
          <Table
            size="small"
            pagination={false}
            rowKey="field"
            dataSource={OCR_RESPONSE_FIELDS}
            columns={[
              { title: 'Field', dataIndex: 'field', width: 180, render: (v) => <Typography.Text code>{v}</Typography.Text> },
              { title: 'Type', dataIndex: 'type', width: 220 },
              { title: 'Description', dataIndex: 'note' },
            ]}
          />
        </Card>
      </div>

      <Typography.Title level={5}>Registered clients</Typography.Title>
      <Table
        className="mb-8"
        loading={clientsQuery.isLoading}
        rowKey={(r) => String(r.id)}
        dataSource={clientsQuery.data ?? []}
        columns={[
          { title: 'Key', dataIndex: 'key' },
          { title: 'Name', dataIndex: 'display_name' },
          { title: 'Status', dataIndex: 'status', width: 120 },
          { title: 'Key prefix', dataIndex: 'api_key_prefix', width: 120 },
        ]}
      />

      <Typography.Title level={5}>Recent OCR requests</Typography.Title>
      <Typography.Paragraph type="secondary" className="text-sm">
        Persisted request metadata for task <Typography.Text code>{activeTaskKey}</Typography.Text>.
      </Typography.Paragraph>
      <Table
        loading={logsQuery.isLoading}
        rowKey="request_id"
        dataSource={logsQuery.data ?? []}
        columns={[
          {
            title: 'Time',
            dataIndex: 'created_at',
            width: 170,
            render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—'),
          },
          {
            title: 'Client',
            dataIndex: 'client_label',
            width: 140,
            render: (v) => v ?? '—',
          },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 120,
            render: (v, r) => (
              <Tag color={v === 'success' ? 'green' : v === 'failed' ? 'red' : 'orange'}>
                {v}
                {r.error_code ? ` · ${r.error_code}` : ''}
              </Tag>
            ),
          },
          { title: 'Model ref', dataIndex: 'model_ref', width: 100 },
          {
            title: 'Value',
            dataIndex: 'value',
            width: 100,
            render: (v) => v ?? '—',
          },
          {
            title: 'Confidence',
            dataIndex: 'confidence',
            width: 100,
            render: (v) => (v != null ? `${(Number(v) * 100).toFixed(1)}%` : '—'),
          },
          {
            title: 'Latency',
            dataIndex: 'latency_ms',
            width: 90,
            render: (v) => (v != null ? `${v} ms` : '—'),
          },
          {
            title: 'Request ID',
            dataIndex: 'request_id',
            ellipsis: true,
          },
        ]}
      />
    </div>
  )
}

export function AuditHistoryPage() {
  const { activeTaskKey } = useTaskContext()
  const auditQuery = useQuery({
    queryKey: ['audit'],
    queryFn: () => listAuditEvents({ limit: 100 }),
  })
  const graphQuery = useQuery({
    queryKey: ['graph', activeTaskKey],
    queryFn: () => getVersionGraph(activeTaskKey),
  })
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      <PageHeader
        title="Audit & history"
        description="Append-only audit trail and version graph for the active task."
      />
      <Typography.Title level={5}>Version graph</Typography.Title>
      <pre className="mb-6 max-h-64 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
        {JSON.stringify(graphQuery.data ?? {}, null, 2)}
      </pre>
      <Typography.Title level={5}>Audit events</Typography.Title>
      <Table
        loading={auditQuery.isLoading}
        rowKey={(r) => String(r.id)}
        dataSource={auditQuery.data ?? []}
        columns={[
          { title: 'Action', dataIndex: 'action', width: 180 },
          { title: 'Entity', dataIndex: 'entity_type', width: 140 },
          { title: 'Entity ID', dataIndex: 'entity_id', ellipsis: true },
          { title: 'Actor', dataIndex: 'actor', width: 120 },
          { title: 'When', dataIndex: 'created_at', width: 200 },
        ]}
      />
    </div>
  )
}
