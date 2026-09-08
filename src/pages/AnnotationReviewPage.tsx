import { CheckOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  List,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { reviewDatabankSample } from '@/api/databank'
import { getApiErrorMessage } from '@/api/client'
import {
  exploreSamples,
  fetchExplorerImageUrl,
  type ExplorerSampleSummary,
} from '@/api/explorer'
import { PageHeader } from '@/components/common/PageHeader'
import { useTaskContext } from '@/features/tasks/TaskContext'

function needsReview(sample: ExplorerSampleSummary): boolean {
  const lifecycle = sample.lifecycle_state ?? ''
  const review = sample.review_status ?? ''
  return (
    review === 'unreviewed' ||
    lifecycle === 'review_required' ||
    lifecycle === 'annotated'
  )
}

export function AnnotationReviewPage() {
  const queryClient = useQueryClient()
  const { activeTaskKey } = useTaskContext()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [form] = Form.useForm<{ corrected_gt: string }>()

  const samplesQuery = useQuery({
    queryKey: ['annotation-review', activeTaskKey],
    queryFn: async () => {
      const [unreviewed, reviewRequired, annotated] = await Promise.all([
        exploreSamples({
          task_key: activeTaskKey,
          source: 'databank',
          review_status: 'unreviewed',
          limit: 100,
          offset: 0,
        }),
        exploreSamples({
          task_key: activeTaskKey,
          source: 'databank',
          lifecycle_state: 'review_required',
          limit: 100,
          offset: 0,
        }),
        exploreSamples({
          task_key: activeTaskKey,
          source: 'databank',
          lifecycle_state: 'annotated',
          limit: 100,
          offset: 0,
        }),
      ])
      const merged = new Map<string, ExplorerSampleSummary>()
      for (const batch of [
        unreviewed.items,
        reviewRequired.items,
        annotated.items,
      ]) {
        for (const item of batch) {
          if (needsReview(item)) merged.set(item.id, item)
        }
      }
      return [...merged.values()].sort((a, b) =>
        (b.created_at ?? '').localeCompare(a.created_at ?? ''),
      )
    },
    enabled: Boolean(activeTaskKey),
  })

  const samples = samplesQuery.data ?? []

  const activeSample = useMemo(
    () => samples.find((s) => s.id === activeId) ?? samples[0] ?? null,
    [samples, activeId],
  )

  useEffect(() => {
    if (!activeSample && samples.length > 0) {
      setActiveId(samples[0]!.id)
    }
  }, [activeSample, samples])

  useEffect(() => {
    if (!activeSample) {
      form.resetFields()
      return
    }
    form.setFieldsValue({
      corrected_gt:
        activeSample.ground_truth ?? activeSample.prediction ?? '',
    })
  }, [activeSample, form])

  useEffect(() => {
    let revoked: string | null = null
    const imagePath = activeSample?.image_url
    if (!imagePath) {
      setPreviewUrl(null)
      return
    }
    let cancelled = false
    void fetchExplorerImageUrl(imagePath).then((url) => {
      if (cancelled) {
        URL.revokeObjectURL(url)
        return
      }
      revoked = url
      setPreviewUrl(url)
    })
    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [activeSample?.image_url])

  const verifyMutation = useMutation({
    mutationFn: (corrected_gt: string) =>
      reviewDatabankSample(activeSample!.dataset_id, activeSample!.id, {
        corrected_gt,
      }),
    onSuccess: () => {
      message.success('Sample verified')
      void queryClient.invalidateQueries({ queryKey: ['annotation-review'] })
      void queryClient.invalidateQueries({ queryKey: ['explorer'] })
      void queryClient.invalidateQueries({ queryKey: ['databank'] })
      setActiveId(null)
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  })

  const handleVerify = async () => {
    const values = await form.validateFields()
    verifyMutation.mutate(values.corrected_gt)
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: 'Dashboard', path: '/overview' },
          { title: 'Annotation review' },
        ]}
        actions={
          <Typography.Text type="secondary" className="text-sm">
            Task: <Tag>{activeTaskKey}</Tag>
          </Typography.Text>
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-6 lg:grid-cols-[320px_1fr]">
        <Card
          title={`Queue (${samples.length})`}
          className="min-h-0 overflow-auto"
          size="small"
        >
          {samplesQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message="Failed to load review queue"
              description={getApiErrorMessage(samplesQuery.error)}
            />
          ) : (
            <List
              loading={samplesQuery.isLoading}
              dataSource={samples}
              locale={{ emptyText: 'No samples need review' }}
              renderItem={(item) => (
                <List.Item
                  className={`cursor-pointer !px-2 ${activeSample?.id === item.id ? 'bg-teal-50' : ''}`}
                  onClick={() => setActiveId(item.id)}
                >
                  <List.Item.Meta
                    title={
                      <span className="text-sm">{item.filename}</span>
                    }
                    description={
                      <Space size={4} wrap>
                        <Tag>{item.lifecycle_state ?? '—'}</Tag>
                        {item.review_status ? (
                          <Tag>{item.review_status}</Tag>
                        ) : null}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>

        <Card
          title={activeSample?.filename ?? 'Select a sample'}
          className="min-h-0 overflow-auto"
          size="small"
          extra={
            activeSample ? (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={verifyMutation.isPending}
                onClick={() => void handleVerify()}
              >
                Mark verified
              </Button>
            ) : null
          }
        >
          {!activeSample ? (
            <Typography.Text type="secondary">
              Choose a sample from the queue to review.
            </Typography.Text>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={activeSample.filename}
                    className="w-full rounded-lg border border-slate-200 object-contain bg-slate-50"
                  />
                ) : (
                  <div className="rounded-lg bg-slate-100 p-8 text-center text-slate-500">
                    Loading image…
                  </div>
                )}
                <div className="mt-3 space-y-1 text-sm">
                  <div>
                    <Typography.Text type="secondary">
                      Prediction:{' '}
                    </Typography.Text>
                    {activeSample.prediction ?? '—'}
                  </div>
                  <div>
                    <Typography.Text type="secondary">
                      Current GT:{' '}
                    </Typography.Text>
                    {activeSample.ground_truth ?? '—'}
                  </div>
                </div>
              </div>
              <Form form={form} layout="vertical">
                <Form.Item
                  name="corrected_gt"
                  label="Ground truth correction"
                  rules={[
                    { required: true, message: 'Enter the correct value' },
                  ]}
                >
                  <Input placeholder="Corrected ground truth" />
                </Form.Item>
              </Form>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
