import {
  CloudUploadOutlined,
  PictureOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import {
  Button,
  Empty,
  Progress,
  Radio,
  Select,
  Tag,
  Upload,
  message,
} from 'antd'
import { useMemo, useRef, useState } from 'react'

import { getApiErrorMessage } from '@/api/client'
import { runOdometerOcr } from '@/api/ocr'
import { PageHeader } from '@/components/common/PageHeader'
import { OcrImageViewer } from '@/components/ocr/OcrImageViewer'
import { useModelRefsQuery } from '@/features/models/useModelRefsQuery'
import type { OcrJobResult } from '@/types/ocr'
import { formatPercent } from '@/utils/format'

type Mode = 'single' | 'batch'

function statusColor(status?: string) {
  if (status === 'success') return 'green'
  if (status === 'low_confidence') return 'gold'
  if (status === 'failed') return 'red'
  return 'default'
}

export function OcrPlaygroundPage() {
  const [mode, setMode] = useState<Mode>('single')
  const [modelRef, setModelRef] = useState<string | undefined>()
  const [jobs, setJobs] = useState<OcrJobResult[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [running, setRunning] = useState(false)
  const filesRef = useRef<File[]>([])

  const refsQuery = useModelRefsQuery({ include_metrics: false, ocr_type: 'odometer' })
  const refOptions = useMemo(
    () =>
      (refsQuery.data?.refs ?? [])
        .filter((r) => r.status === 'active')
        .map((r) => ({
          value: r.model_ref,
          label: `${r.model_ref}${r.is_default ? ' (default)' : ''}`,
        })),
    [refsQuery.data?.refs],
  )

  const active = jobs[activeIndex]

  const progress = useMemo(() => {
    if (!jobs.length) return 0
    const done = jobs.filter((j) => !j.loading && (j.response || j.error)).length
    return Math.round((done / jobs.length) * 100)
  }, [jobs])

  const clearJobs = () => {
    for (const job of jobs) URL.revokeObjectURL(job.previewUrl)
    filesRef.current = []
    setJobs([])
    setActiveIndex(0)
  }

  const onFilesSelected = (files: File[]) => {
    if (!files.length) return
    clearJobs()
    const selected = mode === 'single' ? files.slice(0, 1) : files
    filesRef.current = selected
    setJobs(
      selected.map((file) => ({
        fileName: file.name,
        previewUrl: URL.createObjectURL(file),
      })),
    )
    setActiveIndex(0)
  }

  const runAll = async () => {
    if (!filesRef.current.length) {
      message.warning('Select at least one image')
      return
    }
    setRunning(true)
    for (let i = 0; i < filesRef.current.length; i += 1) {
      const file = filesRef.current[i]!
      setJobs((prev) =>
        prev.map((p, idx) => (idx === i ? { ...p, loading: true, error: undefined } : p)),
      )
      setActiveIndex(i)
      try {
        const response = await runOdometerOcr(file, modelRef)
        setJobs((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, loading: false, response, error: undefined } : p,
          ),
        )
      } catch (error) {
        setJobs((prev) =>
          prev.map((p, idx) =>
            idx === i
              ? { ...p, loading: false, error: getApiErrorMessage(error) }
              : p,
          ),
        )
      }
    }
    setRunning(false)
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: 'Dashboard', path: '/' },
          { title: 'OCR playground' },
        ]}
        actions={
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={running}
            onClick={() => void runAll()}
            disabled={!jobs.length}
          >
            Run OCR
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="relative mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-5 text-white shadow-lg">
              <div className="flex items-center gap-2 text-sm font-medium text-teal-200">
                <PictureOutlined />
                Live OCR studio
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Detect · Read · Review
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Run odometer OCR on one image or a batch. Selected detections are drawn
                as green boxes; all candidates appear in cyan.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Mode
              </div>
              <Radio.Group
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value)
                  clearJobs()
                }}
                optionType="button"
                buttonStyle="solid"
                options={[
                  { value: 'single', label: 'Single image' },
                  { value: 'batch', label: 'Multiple images' },
                ]}
              />

              <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Model ref
              </div>
              <Select
                allowClear
                className="w-full"
                placeholder="Default active model"
                options={refOptions}
                value={modelRef}
                onChange={setModelRef}
                loading={refsQuery.isLoading}
              />

              <Upload.Dragger
                className="mt-4"
                multiple={mode === 'batch'}
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                showUploadList={false}
                beforeUpload={(_, fileList) => {
                  onFilesSelected([...fileList] as File[])
                  return false
                }}
              >
                <p className="ant-upload-drag-icon">
                  <CloudUploadOutlined />
                </p>
                <p className="ant-upload-text">
                  {mode === 'single' ? 'Drop one dashboard image' : 'Drop multiple images'}
                </p>
                <p className="ant-upload-hint">JPEG / PNG / WebP</p>
              </Upload.Dragger>

              {jobs.length > 0 ? (
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>
                      {jobs.length} image{jobs.length === 1 ? '' : 's'}
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <Progress percent={progress} size="small" />
                </div>
              ) : null}
            </div>

            {jobs.length > 1 ? (
              <div className="max-h-64 space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-white p-3">
                {jobs.map((job, idx) => (
                  <button
                    key={`${job.fileName}-${idx}`}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                      idx === activeIndex
                        ? 'bg-teal-50 text-teal-900'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{job.fileName}</span>
                    {job.loading ? (
                      <Tag>running</Tag>
                    ) : job.response ? (
                      <Tag color={statusColor(job.response.status)}>
                        {job.response.status}
                      </Tag>
                    ) : job.error ? (
                      <Tag color="red">error</Tag>
                    ) : (
                      <Tag>queued</Tag>
                    )}
                  </button>
                ))}
              </div>
            ) : null}
          </aside>

          <section className="min-w-0">
            {!active ? (
              <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white">
                <Empty description="Upload an image to preview detections" />
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {active.fileName}
                      </div>
                      <div className="text-xs text-slate-500">Bounding boxes overlay</div>
                    </div>
                    {active.response ? (
                      <Tag color={statusColor(active.response.status)}>
                        {active.response.status}
                      </Tag>
                    ) : null}
                  </div>
                  <OcrImageViewer
                    src={active.previewUrl}
                    boxes={active.response?.detections ?? []}
                    selected={active.response?.selected_detection}
                    imageWidth={active.response?.image_size?.width}
                    imageHeight={active.response?.image_size?.height}
                  />
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Reading
                    </div>
                    <div className="mt-2 font-mono text-3xl font-semibold tracking-wide text-slate-900">
                      {active.response?.value ?? '—'}
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      Overall confidence{' '}
                      <span className="font-medium text-slate-900">
                        {formatPercent(active.response?.confidence ?? null)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Model ref: {active.response?.model_ref ?? modelRef ?? 'default'}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Confidence breakdown
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Detection</span>
                        <span className="font-medium">
                          {formatPercent(
                            active.response?.confidence_breakdown?.detection_confidence ??
                              active.response?.selected_detection?.confidence ??
                              null,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Recognition</span>
                        <span className="font-medium">
                          {formatPercent(
                            active.response?.confidence_breakdown?.recognition_confidence ??
                              null,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Quality</span>
                        <span className="font-medium">
                          {formatPercent(
                            active.response?.confidence_breakdown?.quality_score ?? null,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-slate-100 pt-2">
                        <span className="text-slate-500">Final</span>
                        <span className="font-medium">
                          {formatPercent(
                            active.response?.confidence_breakdown?.final_confidence ??
                              active.response?.confidence ??
                              null,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {active.response?.fail_stage || active.response?.status === 'failed' ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <div className="font-semibold">
                        Failed at:{' '}
                        {active.response?.fail_stage ?? 'unknown stage'}
                      </div>
                      <div className="mt-1 text-amber-800">
                        {active.response?.fail_stage === 'recognition'
                          ? 'Detection succeeded — bounding box is still shown.'
                          : active.response?.fail_stage === 'detection'
                            ? 'No usable odometer region was found.'
                            : active.response?.message || 'OCR did not complete successfully.'}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Detection boxes
                    </div>
                    <div className="mt-2 space-y-2 text-sm">
                      {(active.response?.detections ?? []).length === 0 ? (
                        <div className="text-slate-500">No boxes yet</div>
                      ) : (
                        (active.response?.detections ?? []).map((box, i) => (
                          <div
                            key={`${box.x1}-${i}`}
                            className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs"
                          >
                            [{box.x1.toFixed(0)}, {box.y1.toFixed(0)}] → [
                            {box.x2.toFixed(0)}, {box.y2.toFixed(0)}] ·{' '}
                            {(box.confidence * 100).toFixed(1)}%
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {active.error ||
                  (active.response?.message && active.response.status === 'failed') ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {active.error || active.response?.message}
                      {active.response?.error_code
                        ? ` (${active.response.error_code})`
                        : ''}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
