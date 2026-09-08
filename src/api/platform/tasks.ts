import { apiClient } from '@/api/client'

export type TaskDefinition = {
  id: string
  key: string
  display_name: string
  description?: string | null
  status: string
  current_version?: string | null
  capabilities: string[]
  ui_config: Record<string, unknown>
}

export type DashboardPayload = {
  task: TaskDefinition
  production_model_version_id?: string | null
  active_deployment_revision?: Record<string, unknown> | null
  model_version_count: number
  release_count: number
  recent_releases: Array<Record<string, unknown>>
  capabilities: string[]
}

export async function listTasks(): Promise<TaskDefinition[]> {
  const { data } = await apiClient.get<{ tasks: TaskDefinition[] }>('/v1/tasks')
  return data.tasks
}

export async function getTask(taskKey: string): Promise<TaskDefinition> {
  const { data } = await apiClient.get<TaskDefinition>(`/v1/tasks/${taskKey}`)
  return data
}

export async function getDashboard(taskKey: string): Promise<DashboardPayload> {
  const { data } = await apiClient.get<DashboardPayload>(
    `/v1/dashboard/${taskKey}`,
  )
  return data
}

export async function listAuditEvents(params?: {
  entity_type?: string
  limit?: number
}) {
  const { data } = await apiClient.get<{ events: Array<Record<string, unknown>> }>(
    '/v1/audit-events',
    { params },
  )
  return data.events
}

export async function listClients() {
  const { data } = await apiClient.get<{ clients: Array<Record<string, unknown>> }>(
    '/v1/clients',
  )
  return data.clients
}

export async function listReleases(taskKey: string) {
  const { data } = await apiClient.get<{ releases: Array<Record<string, unknown>> }>(
    `/v1/tasks/${taskKey}/releases`,
  )
  return data.releases
}

export async function listDeployments(taskKey: string) {
  const { data } = await apiClient.get<{ revisions: Array<Record<string, unknown>> }>(
    `/v1/tasks/${taskKey}/deployments`,
  )
  return data.revisions
}

export async function getVersionGraph(taskKey: string) {
  const { data } = await apiClient.get<Record<string, unknown>>(
    `/v1/history/graph/${taskKey}`,
  )
  return data
}
