import { Select, Space, Typography } from 'antd'

import { useTaskContext } from '@/features/tasks/TaskContext'

export function TaskSwitcher() {
  const { tasks, activeTaskKey, setActiveTaskKey, isLoading } = useTaskContext()

  return (
    <Space direction="vertical" size={2} className="w-full px-3 pb-3 pt-2">
      <Typography.Text className="!text-[11px] !uppercase !tracking-wide !text-slate-400">
        Active task
      </Typography.Text>
      <Select
        className="w-full"
        loading={isLoading}
        value={activeTaskKey}
        options={tasks.map((t) => ({
          value: t.key,
          label: t.display_name,
        }))}
        onChange={setActiveTaskKey}
        popupMatchSelectWidth={false}
      />
    </Space>
  )
}
