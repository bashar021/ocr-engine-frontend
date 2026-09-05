import { Layout } from 'antd'
import { Outlet } from 'react-router-dom'

import { AppSidebar } from '@/components/layout/AppSidebar'

const { Content } = Layout

export function AppLayout() {
  return (
    <Layout className="h-dvh max-h-dvh overflow-hidden bg-slate-100">
      <AppSidebar />
      <Layout className="min-h-0 min-w-0 flex-1 overflow-hidden bg-slate-100">
        <Content className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
