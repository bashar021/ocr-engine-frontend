import type { ReactNode } from 'react'

interface DataTableToolbarProps {
  left?: ReactNode
  right?: ReactNode
  className?: string
}

export function DataTableToolbar({ left, right, className }: DataTableToolbarProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 ${className ?? ''}`}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">{left}</div>
      <div className="flex flex-wrap items-center gap-2">{right}</div>
    </div>
  )
}
