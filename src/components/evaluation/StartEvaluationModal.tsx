import axios from 'axios'
import { Form, Modal, Select, message } from 'antd'
import { useMemo } from 'react'

import { getApiErrorMessage } from '@/api/client'
import { useStartEvaluation } from '@/features/evaluation/useEvaluationMutations'
import { useModelRefsQuery } from '@/features/models/useModelRefsQuery'
import type { EvaluationDataset } from '@/types/evaluation'

interface StartEvaluationModalProps {
  open: boolean
  dataset: EvaluationDataset | null
  onClose: () => void
}

interface FormValues {
  model_ref: string
  evaluation_type: string
  batch_size: number
  worker_threads: number
}

export function StartEvaluationModal({
  open,
  dataset,
  onClose,
}: StartEvaluationModalProps) {
  const [form] = Form.useForm<FormValues>()
  const start = useStartEvaluation()
  const refsQuery = useModelRefsQuery(
    { ocr_type: dataset?.ocr_type, include_metrics: false },
    open && Boolean(dataset),
  )

  const refOptions = useMemo(
    () =>
      (refsQuery.data?.refs ?? [])
        .filter((r) => r.status === 'active' || r.status === 'draft')
        .map((r) => ({
          value: r.model_ref,
          label: `${r.model_ref} (${r.status}${r.is_default ? ', default' : ''})`,
        })),
    [refsQuery.data?.refs],
  )

  const queueEvaluation = async (force = false) => {
    if (!dataset) return
    const values = await form.validateFields()
    await start.mutateAsync({
      dataset_id: dataset.id,
      ocr_type: dataset.ocr_type,
      model_ref: values.model_ref,
      evaluation_type: values.evaluation_type,
      evaluation_config: {
        batch_size: values.batch_size || 16,
        worker_threads: values.worker_threads || 4,
      },
      force,
    })
    message.success(force ? 'Re-evaluation queued' : 'Evaluation queued')
    form.resetFields()
    onClose()
  }

  const handleOk = async () => {
    if (!dataset) return
    try {
      await queueEvaluation(false)
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return
      const errorCode =
        axios.isAxiosError(error) &&
        (error.response?.data as { error_code?: string } | undefined)
          ?.error_code
      if (errorCode === 'EVALUATION_ALREADY_EXISTS') {
        Modal.confirm({
          title: 'Evaluation already exists',
          content:
            'An evaluation already exists for this dataset and pipeline. Re-evaluate by deleting the prior run and queueing a new one?',
          okText: 'Re-evaluate',
          onOk: async () => {
            try {
              await queueEvaluation(true)
            } catch (retryError) {
              if (
                retryError &&
                typeof retryError === 'object' &&
                'errorFields' in retryError
              ) {
                return
              }
              message.error(getApiErrorMessage(retryError))
            }
          },
        })
        return
      }
      message.error(getApiErrorMessage(error))
    }
  }

  return (
    <Modal
      title={dataset ? `Start evaluation — ${dataset.name}` : 'Start evaluation'}
      open={open}
      onCancel={() => {
        form.resetFields()
        onClose()
      }}
      onOk={() => void handleOk()}
      okText="Start"
      confirmLoading={start.isPending}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-4"
        initialValues={{ evaluation_type: 'test', batch_size: 16, worker_threads: 4 }}
      >
        <Form.Item
          name="model_ref"
          label="Model ref"
          rules={[{ required: true, message: 'Select a model ref' }]}
        >
          <Select
            placeholder="Select bound pipeline"
            options={refOptions}
            loading={refsQuery.isLoading}
            showSearch
          />
        </Form.Item>
        <Form.Item name="evaluation_type" label="Evaluation type">
          <Select
            options={[
              { value: 'test', label: 'Test' },
              { value: 'benchmark', label: 'Benchmark' },
              { value: 'regression', label: 'Regression' },
            ]}
          />
        </Form.Item>
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/40">
          <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            ⚡ Laptop Acceleration & Execution Tuning
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              name="batch_size"
              label="Batch Size"
              extra="Standard: 16"
              className="!mb-0"
            >
              <Select
                options={[
                  { value: 8, label: '8 (Low RAM)' },
                  { value: 16, label: '16 (Recommended for Laptops)' },
                  { value: 32, label: '32 (High Performance)' },
                  { value: 64, label: '64 (Workstation / Server)' },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="worker_threads"
              label="Parallel Workers"
              extra="Standard: 4 threads"
              className="!mb-0"
            >
              <Select
                options={[
                  { value: 1, label: '1 (Single-threaded)' },
                  { value: 2, label: '2 (Light)' },
                  { value: 4, label: '4 (Recommended for Laptops)' },
                  { value: 8, label: '8 (High Performance)' },
                ]}
              />
            </Form.Item>
          </div>
        </div>
      </Form>
    </Modal>
  )
}
