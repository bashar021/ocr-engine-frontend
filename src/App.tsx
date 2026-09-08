import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp, ConfigProvider } from 'antd'
import { BrowserRouter } from 'react-router-dom'

import { TaskProvider } from '@/features/tasks/TaskContext'
import { AppRoutes } from '@/routes'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#0f766e',
            borderRadius: 8,
            fontFamily:
              '"IBM Plex Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          },
        }}
      >
        <AntdApp>
          <BrowserRouter>
            <TaskProvider>
              <AppRoutes />
            </TaskProvider>
          </BrowserRouter>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  )
}
