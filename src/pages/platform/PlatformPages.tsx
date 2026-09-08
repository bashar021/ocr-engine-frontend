import { Table, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'

import { PageHeader } from '@/components/common/PageHeader'
import { listReleases, listDeployments, listClients, listAuditEvents, getVersionGraph } from '@/api/platform/tasks'
import { useTaskContext } from '@/features/tasks/TaskContext'

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
  const { data = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: listClients,
  })
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      <PageHeader title="API clients" description="Client identity and model policies" />
      <Table
        loading={isLoading}
        rowKey={(r) => String(r.id)}
        dataSource={data}
        columns={[
          { title: 'Key', dataIndex: 'key' },
          { title: 'Name', dataIndex: 'display_name' },
          { title: 'Status', dataIndex: 'status', width: 120 },
          { title: 'Key prefix', dataIndex: 'api_key_prefix', width: 120 },
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
