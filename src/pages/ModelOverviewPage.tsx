import { PageHeader } from '@/components/common/PageHeader'
import { LlmOverviewPanel } from '@/components/models/LlmOverviewPanel'

export function ModelOverviewPage() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: 'Dashboard', path: '/' },
          { title: 'Models', path: '/models/list' },
          { title: 'LLM Overview' },
        ]}
      />
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <LlmOverviewPanel />
      </div>
    </div>
  )
}
