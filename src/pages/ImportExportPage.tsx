import { Link } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Space,
  Typography,
  message,
} from 'antd'

import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { apiClient, getApiErrorMessage } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { useTaskContext } from '@/features/tasks/TaskContext'

type ValidationResult = {
  manifest: Record<string, unknown>
}

export function ImportExportPage() {
  const { activeTaskKey, activeTask } = useTaskContext()
  const [raw, setRaw] = useState(
    JSON.stringify(
      {
        package_type: 'dataset_manifest',
        schema_version: '1.0.0',
        created_at: new Date().toISOString(),
        task_key: activeTaskKey,
        items: [],
      },
      null,
      2,
    ),
  )
  const [report, setReport] = useState<ValidationResult | null>(null)

  const validate = useMutation({
    mutationFn: async () => {
      const manifest = JSON.parse(raw)
      const { data } = await apiClient.post<ValidationResult>(
        '/v1/import/validate',
        { manifest },
      )
      return data
    },
    onSuccess: (data) => {
      setReport(data)
      message.success('Manifest validated')
    },
    onError: (err) => {
      setReport(null)
      message.error(getApiErrorMessage(err))
    },
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      <PageHeader
        title="Import / Export"
        description={`Validate local import packages for ${activeTask?.display_name ?? activeTaskKey} before committing. Dataset ZIP uploads also enforce the same validation rules server-side.`}
      />
      <Alert
        type="info"
        showIcon
        className="mb-4"
        message="Local-first packages"
        description="Exports stay on local filesystem paths. No cloud/S3 is required. Always validate the manifest before registering artifacts or datasets."
      />
      <Card title="Validate import manifest">
        <Form layout="vertical" onFinish={() => validate.mutate()}>
          <Form.Item label="Manifest JSON" required>
            <Input.TextArea
              rows={16}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="!font-mono text-xs"
            />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={validate.isPending}>
              Validate before import
            </Button>
            <Button
              onClick={() =>
                setRaw(
                  JSON.stringify(
                    {
                      package_type: 'dataset_manifest',
                      schema_version: '1.0.0',
                      created_at: new Date().toISOString(),
                      task_key: activeTaskKey,
                      items: [],
                    },
                    null,
                    2,
                  ),
                )
              }
            >
              Reset template
            </Button>
          </Space>
        </Form>
        {report && (
          <Card size="small" className="mt-4" title="Validation report">
            <Typography.Paragraph>
              Package validated. Proceed only if checksums and files match this
              manifest.
            </Typography.Paragraph>
            <pre className="overflow-auto rounded bg-slate-50 p-3 text-xs">
              {JSON.stringify(report.manifest, null, 2)}
            </pre>
          </Card>
        )}
      </Card>
      <Card className="mt-4" title="Export">
        <Typography.Paragraph type="secondary">
          Use dataset and model list pages to export ZIP packages. Exports include
          manifests with schema_version, task_key, digests, and split metadata for
          reproducibility.
        </Typography.Paragraph>
        <Space>
          <Link to="/evaluation/datasets">
            <Button>Open datasets</Button>
          </Link>
          <Link to="/models/list">
            <Button>Open models</Button>
          </Link>
        </Space>
      </Card>
    </div>
  )
}
