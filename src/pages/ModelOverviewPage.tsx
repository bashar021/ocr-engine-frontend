import { PageHeader } from '@/components/common/PageHeader'
import { ModelsOverviewPanel } from '@/components/models/ModelsOverviewPanel'

export function ModelOverviewPage() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: 'Dashboard', path: '/' },
          { title: 'Models', path: '/models/list' },
          { title: 'Overview' },
        ]}
      />
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <ModelsOverviewPanel />
      </div>
    </div>
  )
}
