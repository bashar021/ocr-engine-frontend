import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQuery } from '@tanstack/react-query'

import { getTask, listTasks, type TaskDefinition } from '@/api/platform/tasks'

const STORAGE_KEY = 'ocr.activeTask'

type TaskContextValue = {
  tasks: TaskDefinition[]
  activeTaskKey: string
  activeTask: TaskDefinition | null
  setActiveTaskKey: (key: string) => void
  hasCapability: (cap: string) => boolean
  isLoading: boolean
}

const TaskContext = createContext<TaskContextValue | null>(null)

export function TaskProvider({ children }: { children: ReactNode }) {
  const [activeTaskKey, setActiveTaskKeyState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'odometer'
  })

  const tasksQuery = useQuery({
    queryKey: ['platform', 'tasks'],
    queryFn: listTasks,
  })

  const taskQuery = useQuery({
    queryKey: ['platform', 'task', activeTaskKey],
    queryFn: () => getTask(activeTaskKey),
    enabled: Boolean(activeTaskKey),
  })

  const setActiveTaskKey = useCallback((key: string) => {
    localStorage.setItem(STORAGE_KEY, key)
    setActiveTaskKeyState(key)
  }, [])

  useEffect(() => {
    const tasks = tasksQuery.data
    if (!tasks?.length) return
    if (!tasks.some((t) => t.key === activeTaskKey)) {
      setActiveTaskKey(tasks[0]!.key)
    }
  }, [tasksQuery.data, activeTaskKey, setActiveTaskKey])

  const activeTask = taskQuery.data ?? tasksQuery.data?.find((t) => t.key === activeTaskKey) ?? null

  const value = useMemo<TaskContextValue>(
    () => ({
      tasks: tasksQuery.data ?? [],
      activeTaskKey,
      activeTask,
      setActiveTaskKey,
      hasCapability: (cap: string) =>
        Boolean(activeTask?.capabilities?.includes(cap)),
      isLoading: tasksQuery.isLoading || taskQuery.isLoading,
    }),
    [tasksQuery.data, tasksQuery.isLoading, taskQuery.isLoading, activeTaskKey, activeTask, setActiveTaskKey],
  )

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>
}

export function useTaskContext(): TaskContextValue {
  const ctx = useContext(TaskContext)
  if (!ctx) {
    throw new Error('useTaskContext must be used within TaskProvider')
  }
  return ctx
}
