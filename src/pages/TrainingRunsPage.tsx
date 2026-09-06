import { ThunderboltOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Progress,
  Select,
  Switch,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import { listDatasets } from "@/api/evaluation";
import { listArtifacts } from "@/api/models";
import {
  cancelTrainingRun,
  getPaddleTrainingReadiness,
  listTrainingAdapters,
  listTrainingRuns,
  startTrainingRun,
  suggestTrainingVersion,
} from "@/api/training";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusTag } from "@/components/common/StatusTag";
import { TrainingDataCountsPanel } from "@/components/training/TrainingDataCountsPanel";
import type { TrainingRun } from "@/types/training";

const POLL_MS = 3000;

export function TrainingRunsPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [role, setRole] = useState<"detection" | "recognition">("detection");
  const [form] = Form.useForm();
  const baseId = Form.useWatch("training_base_artifact_id", form);
  const name = Form.useWatch("name", form);
  const baseDatasetId = Form.useWatch("base_dataset_id", form);
  const hardDatasetIds = Form.useWatch("hard_dataset_ids", form) as
    | string[]
    | undefined;

  useEffect(() => {
    const st = location.state as {
      preferBaseArtifactId?: string;
      role?: "detection" | "recognition";
    } | null;
    if (st?.role === "recognition") {
      setRole("recognition");
      form.setFieldValue("role", "recognition");
    }
    if (st?.preferBaseArtifactId) {
      form.setFieldValue("training_base_artifact_id", st.preferBaseArtifactId);
      message.info(
        "Base model set from previous run — review and start when ready",
      );
    }
  }, [location.state, form]);

  const adaptersQuery = useQuery({
    queryKey: ["training", "adapters"],
    queryFn: listTrainingAdapters,
  });
  const paddleReadyQuery = useQuery({
    queryKey: ["training", "paddle-readiness"],
    queryFn: getPaddleTrainingReadiness,
    enabled: role === "recognition",
    staleTime: 30_000,
  });
  const runsQuery = useQuery({
    queryKey: ["training", "runs"],
    queryFn: () => listTrainingRuns({ limit: 50 }),
    refetchInterval: (q) => {
      const runs = q.state.data?.runs ?? [];
      const busy = runs.some((r) =>
        ["queued", "starting", "running"].includes(r.status),
      );
      return busy ? POLL_MS : false;
    },
  });
  const datasetsQuery = useQuery({
    queryKey: ["evaluation", "datasets", "ready", "training"],
    queryFn: () =>
      listDatasets({ status: "ready", scope: "training", limit: 100 }),
  });
  const evalDatasetsQuery = useQuery({
    queryKey: ["evaluation", "datasets", "ready", "evaluation"],
    queryFn: () =>
      listDatasets({ status: "ready", scope: "evaluation", limit: 100 }),
  });
  const artifactsQuery = useQuery({
    queryKey: ["models", "artifacts", role],
    queryFn: () => listArtifacts({ role, limit: 100 }),
  });
  const detectionArtsQuery = useQuery({
    queryKey: ["models", "artifacts", "detection"],
    queryFn: () => listArtifacts({ role: "detection", limit: 100 }),
  });
  const recognitionArtsQuery = useQuery({
    queryKey: ["models", "artifacts", "recognition"],
    queryFn: () => listArtifacts({ role: "recognition", limit: 100 }),
  });

  const datasetOptions = useMemo(() => {
    const all = datasetsQuery.data?.datasets ?? [];
    const filtered =
      role === "recognition"
        ? all.filter(
            (d) =>
              d.pack === "recognition_crops" ||
              d.metadata?.pack === "recognition_crops" ||
              Boolean(d.split_counts) ||
              d.image_mode === "recognition_crop",
          )
        : all;
    return filtered.map((d) => {
      const sc = d.split_counts;
      const splitLabel = sc
        ? ` · ${sc.train ?? 0}/${sc.val ?? 0}/${sc.test ?? 0}`
        : "";
      return {
        value: d.id,
        label: `${d.name} v${d.version} (${d.sample_count}${splitLabel})`,
        sample_count: d.sample_count,
      };
    });
  }, [datasetsQuery.data, role]);

  const evalDatasetOptions = useMemo(
    () =>
      (evalDatasetsQuery.data?.datasets ?? []).map((d) => ({
        value: d.id,
        label: `${d.name} v${d.version} (${d.sample_count} samples)`,
        sample_count: d.sample_count,
      })),
    [evalDatasetsQuery.data],
  );

  const adapterOptions = useMemo(
    () =>
      (adaptersQuery.data?.adapters ?? [])
        .filter((a) => a.roles.includes(role))
        .map((a) => ({ value: a.id, label: a.label })),
    [adaptersQuery.data, role],
  );

  const datasetRefs = useMemo(() => {
    const refs: Array<{ dataset_id: string; role: string }> = [];
    if (baseDatasetId) refs.push({ dataset_id: baseDatasetId, role: "base" });
    for (const id of hardDatasetIds ?? []) {
      refs.push({ dataset_id: id, role: "hard_case" });
    }
    return refs;
  }, [baseDatasetId, hardDatasetIds]);

  const suggestQuery = useQuery({
    queryKey: ["training", "suggest-version", role, name, baseId, datasetRefs],
    queryFn: () =>
      suggestTrainingVersion({
        ocr_type: "odometer",
        role,
        name: name || "model",
        training_base_artifact_id: baseId,
        dataset_ids: datasetRefs,
      }),
    enabled: Boolean(name) && datasetRefs.length > 0,
  });

  useEffect(() => {
    form.setFieldValue("adapter_id", adapterOptions[0]?.value);
  }, [adapterOptions, form]);

  useEffect(() => {
    if (suggestQuery.data?.suggested_version) {
      form.setFieldsValue({
        version: suggestQuery.data.suggested_version,
        bump_level: suggestQuery.data.bump_level,
      });
    }
  }, [suggestQuery.data, form]);

  useEffect(() => {
    if (!baseId) return;
    const art = (artifactsQuery.data?.artifacts ?? []).find(
      (a) => a.id === baseId,
    );
    if (art && !name) {
      form.setFieldValue("name", art.name);
    }
  }, [baseId, artifactsQuery.data, form, name]);

  const onStart = async () => {
    try {
      const values = await form.validateFields();
      if (!values.base_dataset_id && !(values.hard_dataset_ids ?? []).length) {
        message.error("Select at least one dataset");
        return;
      }
      const dataset_ids: Array<{ dataset_id: string; role: string }> = [];
      if (values.base_dataset_id) {
        dataset_ids.push({ dataset_id: values.base_dataset_id, role: "base" });
      }
      for (const id of values.hard_dataset_ids ?? []) {
        dataset_ids.push({ dataset_id: id, role: "hard_case" });
      }
      const isRec = values.role === "recognition";
      const run = await startTrainingRun({
        ocr_type: "odometer",
        role: values.role,
        name: values.name,
        version: values.version,
        adapter_id: values.adapter_id,
        dataset_ids,
        training_base_artifact_id:
          values.training_base_artifact_id || undefined,
        hyperparameters: isRec
          ? {
              epochs: values.epochs ?? 20,
              batch: values.batch ?? 8,
              learning_rate: values.learning_rate ?? 0.000015,
              run_test_eval: values.run_test_eval !== false,
              use_gpu: Boolean(values.use_gpu),
            }
          : {
              epochs: values.epochs ?? 25,
              imgsz: values.imgsz ?? 640,
              batch: values.batch ?? 8,
              patience: values.patience ?? 20,
            },
        config: {
          paired_detection_artifact_id: values.paired_detection_artifact_id,
          paired_recognition_artifact_id: values.paired_recognition_artifact_id,
          run_test_eval: values.run_test_eval !== false,
        },
        auto_evaluate: Boolean(values.auto_evaluate),
        evaluate_dataset_ids: values.evaluate_dataset_ids,
        auto_version: values.auto_version !== false,
      });
      message.success(`Training queued as ${run.name}:${run.version}`);
      await queryClient.invalidateQueries({ queryKey: ["training"] });
    } catch (error) {
      if ((error as { errorFields?: unknown }).errorFields) return;
      message.error(getApiErrorMessage(error));
    }
  };

  const columns: ColumnsType<TrainingRun> = [
    {
      title: "Model",
      key: "model",
      render: (_, r) => (
        <div>
          <Link className="font-medium" to={`/training/runs/${r.id}`}>
            {r.name}:{r.version}
          </Link>
          <div className="text-xs text-slate-500">
            {r.role} · {r.adapter_id}
          </div>
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (s: string) => <StatusTag status={s} />,
    },
    {
      title: "Data (P+N=T)",
      key: "data",
      width: 160,
      render: (_, r) =>
        r.data_counts ? (
          <span className="text-xs">
            {r.data_counts.parent_sample_count}+{r.data_counts.new_sample_count}
            =<strong>{r.data_counts.total_sample_count}</strong>
          </span>
        ) : (
          "—"
        ),
    },
    {
      title: "Progress",
      key: "progress",
      width: 140,
      render: (_, r) => (
        <Progress
          percent={Math.round(r.progress_pct || 0)}
          size="small"
          status={r.status === "failed" ? "exception" : undefined}
        />
      ),
    },
    {
      title: "Artifact",
      dataIndex: "output_artifact_id",
      width: 120,
      render: (v: string | null) =>
        v ? <Tag color="blue">{v.slice(0, 8)}…</Tag> : "—",
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_, r) =>
        ["queued", "starting", "running"].includes(r.status) ? (
          <Button
            size="small"
            danger
            onClick={() =>
              void cancelTrainingRun(r.id)
                .then(() => {
                  message.success("Cancel requested");
                  void queryClient.invalidateQueries({
                    queryKey: ["training", "runs"],
                  });
                })
                .catch((e) => message.error(getApiErrorMessage(e)))
            }
          >
            Cancel
          </Button>
        ) : (
          <Link to={`/training/runs/${r.id}`}>Details</Link>
        ),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: "Dashboard", path: "/" },
          { title: "Training", path: "/training" },
          { title: "Runs" },
        ]}
        actions={
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={() => void onStart()}
          >
            Start training
          </Button>
        }
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-6">
        {role === "recognition" && paddleReadyQuery.data ? (
          <Alert
            type={paddleReadyQuery.data.ready ? "success" : "warning"}
            showIcon
            message={
              paddleReadyQuery.data.ready
                ? "Paddle training environment ready"
                : "Paddle training not fully configured"
            }
            description={
              <div className="text-sm">
                <div>{paddleReadyQuery.data.message}</div>
                <ul className="mt-2 list-disc pl-5">
                  {paddleReadyQuery.data.checks.map((c) => (
                    <li key={c.name}>
                      {c.ok ? "✓" : "✗"} {c.name}: {c.detail}
                    </li>
                  ))}
                </ul>
              </div>
            }
          />
        ) : null}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              role: "detection",
              epochs: 25,
              imgsz: 640,
              batch: 8,
              patience: 20,
              learning_rate: 0.000015,
              run_test_eval: true,
              use_gpu: false,
              auto_evaluate: false,
              auto_version: true,
            }}
            className="grid gap-2 md:grid-cols-2 lg:grid-cols-3"
          >
            <Form.Item name="role" label="Role" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: "detection", label: "Detection" },
                  { value: "recognition", label: "Recognition" },
                ]}
                onChange={(v) => {
                  setRole(v);
                  if (v === "recognition") {
                    form.setFieldsValue({
                      epochs: 20,
                      learning_rate: 0.000015,
                      name: form.getFieldValue("name") || "odometer-recognizer",
                    });
                  }
                }}
              />
            </Form.Item>
            <Form.Item
              name="adapter_id"
              label="Adapter"
              rules={[{ required: true }]}
            >
              <Select options={adapterOptions} />
            </Form.Item>
            <Form.Item
              name="training_base_artifact_id"
              label={
                role === "recognition"
                  ? "Base model (strong version)"
                  : "Parent / base artifact"
              }
              extra={
                role === "recognition"
                  ? "Empty = default PaddleOCR pretrained. Prefer your best prior candidate for the next run."
                  : undefined
              }
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={(artifactsQuery.data?.artifacts ?? [])
                  .slice()
                  .sort((a, b) => {
                    const aa = a.training_accuracy ?? -1;
                    const bb = b.training_accuracy ?? -1;
                    return bb - aa;
                  })
                  .map((a) => ({
                    value: a.id,
                    label: `${a.name}:${a.version}${
                      a.training_accuracy != null
                        ? ` · ${(a.training_accuracy * 100).toFixed(1)}%`
                        : ""
                    }${a.metadata && (a.metadata as { candidate?: boolean }).candidate ? " · candidate" : ""}`,
                  }))}
                placeholder={
                  role === "recognition"
                    ? "Default PaddleOCR (or pick strong version)"
                    : undefined
                }
              />
            </Form.Item>
            <Form.Item
              name="name"
              label="Output name"
              rules={[{ required: true }]}
            >
              <Input
                placeholder={
                  role === "recognition"
                    ? "odometer-recognizer"
                    : "odometer-detector"
                }
              />
            </Form.Item>
            <Form.Item
              name="version"
              label="Output version (auto)"
              rules={[{ required: true }]}
            >
              <Input placeholder="1.1.0" />
            </Form.Item>
            <Form.Item name="bump_level" label="Bump level">
              <Input disabled placeholder="from dataset size" />
            </Form.Item>
            <Form.Item
              name="auto_version"
              label="Auto version"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item name="epochs" label="Epochs">
              <InputNumber min={1} max={300} className="w-full" />
            </Form.Item>
            {role === "detection" ? (
              <>
                <Form.Item name="imgsz" label="Image size">
                  <InputNumber
                    min={320}
                    max={1280}
                    step={32}
                    className="w-full"
                  />
                </Form.Item>
                <Form.Item name="patience" label="Early-stop patience">
                  <InputNumber min={0} max={100} className="w-full" />
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item name="learning_rate" label="Learning rate">
                  <InputNumber
                    min={1e-6}
                    max={0.1}
                    step={0.0001}
                    className="w-full"
                  />
                </Form.Item>
                <Form.Item
                  name="run_test_eval"
                  label="Eval frozen test after train"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  name="use_gpu"
                  label="Use GPU"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </>
            )}
            <Form.Item name="batch" label="Batch size">
              <InputNumber min={1} max={64} className="w-full" />
            </Form.Item>
            {role === "detection" ? (
              <Form.Item
                name="base_dataset_id"
                label="Original / parent training dataset"
                className="md:col-span-1"
              >
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={evalDatasetOptions}
                  placeholder="Evaluation-eligible datasets"
                />
              </Form.Item>
            ) : null}
            <Form.Item
              name="hard_dataset_ids"
              label={
                role === "recognition"
                  ? "Recognition crop pack(s)"
                  : "New / hard-case datasets"
              }
              className="md:col-span-2"
              rules={
                role === "recognition"
                  ? [{ required: true, message: "Select a recognition pack" }]
                  : undefined
              }
            >
              <Select
                mode="multiple"
                allowClear
                showSearch
                optionFilterProp="label"
                options={datasetOptions}
                placeholder={
                  role === "recognition"
                    ? "Packs with train/val/test (Build recognition pack)"
                    : "From Training datasets (curated / merged)"
                }
              />
            </Form.Item>
            <Form.Item
              name="evaluate_dataset_ids"
              label="Post-train eval datasets"
            >
              <Select
                mode="multiple"
                allowClear
                options={evalDatasetOptions}
                placeholder="Evaluation-eligible datasets only"
              />
            </Form.Item>
            <Form.Item
              name="paired_detection_artifact_id"
              label="Paired detection"
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={(detectionArtsQuery.data?.artifacts ?? []).map(
                  (a) => ({
                    value: a.id,
                    label: `${a.name}:${a.version}`,
                  }),
                )}
              />
            </Form.Item>
            {role === "detection" ? (
              <Form.Item
                name="paired_recognition_artifact_id"
                label="Paired recognition"
              >
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={(recognitionArtsQuery.data?.artifacts ?? []).map(
                    (a) => ({
                      value: a.id,
                      label: `${a.name}:${a.version}`,
                    }),
                  )}
                />
              </Form.Item>
            ) : null}
            <Form.Item
              name="auto_evaluate"
              label="Auto-evaluate"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Form>
          {suggestQuery.data ? (
            <div className="mt-2 space-y-2">
              <Alert
                type="success"
                showIcon
                message={`Suggested ${suggestQuery.data.suggested_version} (${suggestQuery.data.bump_level}) from parent ${suggestQuery.data.parent_version}`}
                description={`Rules — patch: ${suggestQuery.data.rules.patch}; minor: ${suggestQuery.data.rules.minor}; major: ${suggestQuery.data.rules.major}`}
              />
              <TrainingDataCountsPanel
                counts={suggestQuery.data.data_counts}
                parentVersion={suggestQuery.data.parent_version}
                newVersion={suggestQuery.data.suggested_version}
              />
            </div>
          ) : null}
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={runsQuery.data?.runs ?? []}
          loading={runsQuery.isLoading}
          expandable={{
            expandedRowRender: (r) => (
              <div className="space-y-2 text-sm">
                {r.data_counts ? (
                  <TrainingDataCountsPanel counts={r.data_counts} />
                ) : null}
                <div>
                  <strong>Logs</strong>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs">
                    {r.logs_tail || "—"}
                  </pre>
                </div>
                {r.error_message ? (
                  <div className="text-red-600">{r.error_message}</div>
                ) : null}
              </div>
            ),
          }}
          pagination={false}
        />
      </div>
    </div>
  );
}
