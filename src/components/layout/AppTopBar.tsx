import { Breadcrumb, Layout, Space, Tag, Typography } from 'antd'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import { useTaskContext } from '@/features/tasks/TaskContext'

const { Header } = Layout

const ROUTE_LABELS: Record<string, string> = {
  overview: 'Overview',
  ocr: 'Live OCR',
  models: 'Models',
  list: 'Model list',
  refs: 'Model refs',
  'recognition-configs': 'Recognition configs',
  releases: 'Releases',
  deployments: 'Deployments',
  evaluation: 'Datasets',
  datasets: 'Datasets',
  'dataset-list': 'Dataset list',
  'training-datasets': 'Training datasets',
  runs: 'Runs',
  'data-explorer': 'Data explorer',
  annotation: 'Annotation review',
  'training-center': 'Training Center',
  training: 'Training',
  curate: 'Curate failures',
  clients: 'API clients',
  history: 'Audit / history',
  settings: 'Settings',
  jobs: 'Jobs',
  'import-export': 'Import / Export',
  experiments: 'Experiments',
  detection: 'Detection',
  recognition: 'Recognition',
}

async function fetchHealth(): Promise<{ status?: string }> {
  const { data } = await apiClient.get('/health/live')
  return data
}

export function AppTopBar() {
  const { activeTask, activeTaskKey } = useTaskContext()
  const location = useLocation()
  const healthQuery = useQuery({
    queryKey: ['health', 'live'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: 1,
  })

  const parts = location.pathname.split('/').filter(Boolean)
  const crumbs = parts.map((part, idx) => {
    const path = '/' + parts.slice(0, idx + 1).join('/')
    const label = ROUTE_LABELS[part] ?? part
    return {
      title:
        idx === parts.length - 1 ? label : <Link to={path}>{label}</Link>,
    }
  })

  return (
    <Header className="!sticky !top-0 !z-20 flex !h-14 items-center justify-between border-b border-slate-200 !bg-white !px-4 !leading-none shadow-sm">
      <Space size="middle" wrap className="min-w-0">
        <Typography.Text strong className="!text-slate-800">
          OCR Platform
        </Typography.Text>
        <Tag color="cyan" className="!m-0">
          {activeTask?.display_name ?? activeTaskKey}
        </Tag>
        {crumbs.length > 0 && (
          <Breadcrumb
            className="hidden md:block"
            items={[{ title: <Link to="/overview">Home</Link> }, ...crumbs]}
          />
        )}
      </Space>
      <Space size="small">
        <Tag
          color={
            healthQuery.data
              ? 'success'
              : healthQuery.isError
                ? 'error'
                : 'default'
          }
        >
          {healthQuery.isLoading
            ? 'Checking…'
            : healthQuery.isError
              ? 'API down'
              : 'API healthy'}
        </Tag>
        <Tag>{import.meta.env.MODE === 'production' ? 'prod' : 'local'}</Tag>
      </Space>
    </Header>
  )
}
