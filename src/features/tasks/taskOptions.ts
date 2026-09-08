import type { TaskDefinition } from '@/api/platform/tasks'

export function taskSelectOptions(tasks: TaskDefinition[]) {
  return tasks.map((t) => ({
    value: t.key,
    label: t.display_name,
  }))
}

export function defaultArtifactName(
  taskKey: string,
  role: 'detection' | 'recognition',
) {
  const suffix = role === 'recognition' ? 'recognizer' : 'detector'
  return `${taskKey}-${suffix}`
}

export function defaultRecognitionConfigName(taskKey: string) {
  return `${taskKey}-recognizer-paddle`
}

export function defaultRecognitionCropName(taskKey: string) {
  return `${taskKey}-recognition-crops`
}
