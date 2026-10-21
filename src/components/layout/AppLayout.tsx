import { Layout } from "antd";
import { Outlet, useLocation } from "react-router-dom";

import { AppErrorBoundary } from "@/components/layout/AppErrorBoundary";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopBar } from "@/components/layout/AppTopBar";

const { Content } = Layout;

export function AppLayout() {
  const location = useLocation();

  return (
    <Layout className="h-dvh max-h-dvh overflow-hidden bg-slate-100">
      <AppSidebar />
      <Layout className="min-h-0 min-w-0 flex-1 overflow-hidden bg-slate-100">
        <AppTopBar />
        <Content className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <AppErrorBoundary key={location.pathname} resetKey={`${location.pathname}${location.search}`}>
            <Outlet key={location.pathname} />
          </AppErrorBoundary>
        </Content>
      </Layout>
    </Layout>
  );
}
