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

  const handleOk = async () => {
    if (!dataset) return
    try {
      const values = await form.validateFields()
      await start.mutateAsync({
        dataset_id: dataset.id,
        ocr_type: dataset.ocr_type,
        model_ref: values.model_ref,
        evaluation_type: values.evaluation_type,
      })
      message.success('Evaluation queued')
      form.resetFields()
      onClose()
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return
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
        initialValues={{ evaluation_type: 'test' }}
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
      </Form>
    </Modal>
  )
}
