import {
  AimOutlined,
  DatabaseOutlined,
  LockOutlined,
  PlayCircleOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import { listDatabankDatasets } from "@/api/databank";
import { listDatasets } from "@/api/evaluation";
import { listArtifacts } from "@/api/models";
import {
  startTrainingRun,
  suggestTrainingVersion,
} from "@/api/training";
import { PageHeader } from "@/components/common/PageHeader";
import { useTaskContext } from "@/features/tasks/TaskContext";

const { Title, Paragraph } = Typography;

export function FineTuneModelPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { activeTaskKey } = useTaskContext();
  const [form] = Form.useForm();

  const selectedBaseId = Form.useWatch("training_base_artifact_id", form);

  // Query detection model artifacts from Model Registry
  const artifactsQuery = useQuery({
    queryKey: ["models", "artifacts", "detection", activeTaskKey],
    queryFn: () => listArtifacts({ role: "detection", ocr_type: activeTaskKey, limit: 100 }),
  });

  // Query Databank label datasets
  const databankQuery = useQuery({
    queryKey: ["databank", "datasets", activeTaskKey, "label_data"],
    queryFn: () => listDatabankDatasets(activeTaskKey, { dataset_type: "label" }),
  });

  // Query Evaluation training datasets
  const evalDatasetsQuery = useQuery({
    queryKey: ["evaluation", "datasets", "training", activeTaskKey],
    queryFn: () => listDatasets({ ocr_type: activeTaskKey, scope: "training", limit: 100 }),
  });

  const baseArtifacts = useMemo(() => {
    return (artifactsQuery.data?.artifacts ?? []).filter((a) => a.role === "detection");
  }, [artifactsQuery.data]);

  const selectedBase = useMemo(() => {
    return baseArtifacts.find((a) => a.id === selectedBaseId);
  }, [baseArtifacts, selectedBaseId]);

  const datasetOptions = useMemo(() => {
    const groups: Array<{ label: string; options: Array<{ label: string; value: string; sampleCount: number }> }> = [];

    const dbDatasets = databankQuery.data?.datasets ?? [];
    if (dbDatasets.length > 0) {
      groups.push({
        label: "Databank Label Datasets",
        options: dbDatasets.map((d) => ({
          label: `[Databank] ${d.name} (${d.sample_count ?? 0} samples)`,
          value: d.id,
          sampleCount: d.sample_count ?? 0,
        })),
      });
    }

    const evalDatasets = evalDatasetsQuery.data?.datasets ?? [];
    if (evalDatasets.length > 0) {
      groups.push({
        label: "Training & Augmented Datasets",
        options: evalDatasets.map((d) => ({
          label: `[Training] ${d.name} v${d.version} (${d.sample_count ?? 0} samples)`,
          value: d.id,
          sampleCount: d.sample_count ?? 0,
        })),
      });
    }

    return groups;
  }, [databankQuery.data, evalDatasetsQuery.data]);

  // Suggest version mutation
  const suggestVersionMutation = useMutation({
    mutationFn: () => {
      const dsRefs = (form.getFieldValue("dataset_ids") || []).map((id: string) => ({
        dataset_id: id,
        role: "new",
      }));
      return suggestTrainingVersion({
        ocr_type: activeTaskKey,
        role: "detection",
        name: selectedBase?.name || "odometer-detector",
        training_base_artifact_id: selectedBaseId || undefined,
        dataset_ids: dsRefs.length > 0 ? dsRefs : undefined,
      });
    },
    onSuccess: (data) => {
      form.setFieldsValue({
        version: data.suggested_version,
        name: data.name,
      });
      message.success(`Suggested next version: v${data.suggested_version} (${data.bump_level} bump)`);
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  // When base model changes, update suggested name and version
  useEffect(() => {
    if (selectedBase) {
      form.setFieldValue("name", selectedBase.name);
      suggestVersionMutation.mutate();
    }
  }, [selectedBaseId]);

  // Start training run mutation
  const trainMutation = useMutation({
    mutationFn: async (values: any) => {
      const dsRefs = (values.dataset_ids || []).map((id: string) => ({
        dataset_id: id,
        role: "new",
      }));

      let freezeVal = 10;
      if (values.freeze_mode === "full") freezeVal = 0;
      else if (values.freeze_mode === "partial") freezeVal = 5;
      else if (values.freeze_mode === "custom") freezeVal = Number(values.custom_freeze ?? 10);

      const hyper = {
        epochs: Number(values.epochs || 20),
        batch: Number(values.batch || 16),
        imgsz: Number(values.imgsz || 640),
        val_ratio: Number(values.val_ratio || 20) / 100.0,
        optimizer: values.optimizer || "AdamW",
        lr0: Number(values.lr0 || 0.001),
        lrf: Number(values.lrf || 0.01),
        freeze: freezeVal,
        cos_lr: Boolean(values.cos_lr ?? true),
        warmup_epochs: Number(values.warmup_epochs || 3.0),
        patience: Number(values.patience || 20),
        device: values.device === "auto" ? undefined : values.device,
        pretrained: true,
      };

      return startTrainingRun({
        ocr_type: activeTaskKey,
        role: "detection",
        name: values.name,
        version: values.version || "1.1.0",
        adapter_id: "ultralytics_detection",
        training_base_artifact_id: values.training_base_artifact_id,
        dataset_ids: dsRefs,
        hyperparameters: hyper,
        auto_evaluate: Boolean(values.auto_evaluate),
        auto_version: !values.version,
      });
    },
    onSuccess: (run) => {
      message.success(`Fine-tuning run started: ${run.name} v${run.version}`);
      navigate(`/training/runs/${run.id}`);
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50/50 p-6 space-y-6">
      <PageHeader
        title="Fine-tune Detection Model"
        description="Adapt and retrain an existing model checkpoint from the Model Registry on newly labeled or augmented data with transfer learning controls."
        actions={<Tag color="teal" icon={<ToolOutlined />}>Transfer Learning</Tag>}
      />

      <Alert
        message="Strict Non-Destructive Guarantee"
        description="The base model artifact in the Model Registry is never modified or overwritten. Fine-tuning produces and registers an entirely new version checkpoint (e.g. v1.1.0). Source datasets are snapshot into an isolated workspace."
        type="info"
        showIcon
        icon={<SafetyCertificateOutlined className="text-teal-600" />}
        className="!border-teal-200 !bg-teal-50/70"
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          freeze_mode: "backbone",
          custom_freeze: 10,
          epochs: 20,
          batch: 16,
          imgsz: 640,
          val_ratio: 20,
          optimizer: "AdamW",
          lr0: 0.001,
          lrf: 0.01,
          cos_lr: true,
          warmup_epochs: 3.0,
          patience: 20,
          device: "auto",
          auto_evaluate: true,
        }}
        onFinish={(values) => trainMutation.mutate(values)}
      >
        <Row gutter={[24, 24]}>
          {/* Left Column: Base Model & New Datasets */}
          <Col xs={24} lg={14} className="space-y-6">
            <Card
              title={
                <Space>
                  <AimOutlined className="text-teal-600" />
                  <span>1. Select Base Model Checkpoint</span>
                </Space>
              }
              className="rounded-xl border border-slate-200/80 bg-white shadow-xs"
            >
              <Paragraph type="secondary" className="text-xs">
                Pick a baseline detection model from the Model Registry to fine-tune. Weights and learned representations will be loaded into the trainer.
              </Paragraph>

              <Form.Item
                name="training_base_artifact_id"
                label="Base Detection Model Artifact"
                rules={[{ required: true, message: "Please select a base model artifact" }]}
              >
                <Select
                  placeholder="Select base model from Model Registry..."
                  options={baseArtifacts.map((a) => {
                    const acc = a.training_accuracy
                      ? `mAP50: ${(a.training_accuracy * 100).toFixed(1)}%`
                      : "mAP50: N/A";
                    return {
                      value: a.id,
                      label: `${a.name} v${a.version} (${acc}) · ${dayjs(a.created_at).format("YYYY-MM-DD")}`,
                    };
                  })}
                  loading={artifactsQuery.isLoading}
                  showSearch
                />
              </Form.Item>

              {selectedBase && (
                <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{selectedBase.name} v{selectedBase.version}</span>
                    <Tag color="cyan">{selectedBase.framework || "ultralytics"}</Tag>
                  </div>
                  <div className="flex gap-4 text-slate-500">
                    <span>mAP50: <strong className="text-slate-800">{selectedBase.training_accuracy ? `${(selectedBase.training_accuracy * 100).toFixed(1)}%` : "N/A"}</strong></span>
                    <span>Created: <strong className="text-slate-800">{dayjs(selectedBase.created_at).format("YYYY-MM-DD HH:mm")}</strong></span>
                    <span>Status: <strong className="text-emerald-600">{selectedBase.status}</strong></span>
                  </div>
                </div>
              )}

              <Divider className="!border-slate-100" />

              <Row gutter={16}>
                <Col span={14}>
                  <Form.Item
                    name="name"
                    label="Output Model Name"
                    rules={[{ required: true, message: "Model name required" }]}
                  >
                    <Input placeholder="e.g. odometer-detector" />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item
                    name="version"
                    label={
                      <div className="flex items-center justify-between w-full">
                        <span>New Version</span>
                        <Button
                          type="link"
                          size="small"
                          className="!p-0 !text-xs !h-auto text-teal-600"
                          onClick={() => suggestVersionMutation.mutate()}
                          loading={suggestVersionMutation.isPending}
                        >
                          Auto-suggest
                        </Button>
                      </div>
                    }
                    rules={[{ required: true, message: "Version required" }]}
                  >
                    <Input placeholder="1.1.0" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card
              title={
                <Space>
                  <DatabaseOutlined className="text-teal-600" />
                  <span>2. New Training / Hard-Case Datasets</span>
                </Space>
              }
              className="rounded-xl border border-slate-200/80 bg-white shadow-xs"
            >
              <Paragraph type="secondary" className="text-xs">
                Select the new data for fine-tuning. This can be newly labeled odometer batches, curated hard failure cases, or augmented datasets.
              </Paragraph>

              <Form.Item
                name="dataset_ids"
                label="Fine-tuning Datasets"
                rules={[{ required: true, message: "Please select at least one fine-tuning dataset" }]}
              >
                <Select
                  mode="multiple"
                  placeholder="Select datasets to retrain on..."
                  options={datasetOptions}
                  loading={databankQuery.isLoading || evalDatasetsQuery.isLoading}
                  style={{ width: "100%" }}
                  showSearch
                />
              </Form.Item>
            </Card>
          </Col>

          {/* Right Column: Layer Freezing & Transfer Learning Hyperparameters */}
          <Col xs={24} lg={10} className="space-y-6">
            <Card
              title={
                <Space>
                  <LockOutlined className="text-emerald-600" />
                  <span>3. Transfer Learning & Layer Freezing</span>
                </Space>
              }
              className="rounded-xl border border-slate-200/80 bg-white shadow-xs"
            >
              <Form.Item
                name="freeze_mode"
                label="Backbone Freezing Strategy"
              >
                <Radio.Group className="w-full space-y-2">
                  <div className="rounded border border-slate-200 p-3 bg-slate-50/60">
                    <Radio value="backbone">
                      <span className="font-medium text-slate-800">Backbone Frozen (freeze=10)</span>
                      <Tag color="green" className="ml-2">Recommended</Tag>
                    </Radio>
                    <p className="ml-6 text-xs text-slate-500">
                      Freezes feature extraction backbone (layers 0–9). Only trains detection heads. Prevents catastrophic forgetting on datasets &lt; 1,000 images.
                    </p>
                  </div>

                  <div className="rounded border border-slate-200 p-3 bg-slate-50/60">
                    <Radio value="partial">
                      <span className="font-medium text-slate-800">Partial Freeze (freeze=5)</span>
                    </Radio>
                    <p className="ml-6 text-xs text-slate-500">
                      Freezes low-level edge/texture layers; adapts higher-level feature fusion and detection heads.
                    </p>
                  </div>

                  <div className="rounded border border-slate-200 p-3 bg-slate-50/60">
                    <Radio value="full">
                      <span className="font-medium text-slate-800">Full Fine-tune (freeze=0)</span>
                    </Radio>
                    <p className="ml-6 text-xs text-slate-500">
                      Updates all weights across all layers. Recommended for large datasets (&gt; 2,000 images) with lower learning rate.
                    </p>
                  </div>
                </Radio.Group>
              </Form.Item>

              <Divider className="!border-slate-100" />

              <Title level={5} className="!text-slate-800 !text-sm">Fine-tuning Hyperparameters</Title>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="lr0" label="Fine-tune LR (lr0)">
                    <InputNumber min={0.00005} max={0.01} step={0.0005} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="epochs" label="Epochs">
                    <InputNumber min={1} max={300} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="batch" label="Batch Size">
                    <Select
                      options={[
                        { label: "8", value: 8 },
                        { label: "16", value: 16 },
                        { label: "32", value: 32 },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="optimizer" label="Optimizer">
                    <Select
                      options={[
                        { label: "AdamW", value: "AdamW" },
                        { label: "SGD", value: "SGD" },
                        { label: "Auto", value: "auto" },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="cos_lr" valuePropName="checked" label="Cosine LR Decay">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="auto_evaluate" valuePropName="checked" label="Auto-Evaluate">
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="device" label="Hardware Device">
                <Select
                  options={[
                    { label: "Auto Detect", value: "auto" },
                    { label: "Apple Silicon GPU (mps)", value: "mps" },
                    { label: "NVIDIA CUDA GPU (cuda:0)", value: "cuda:0" },
                    { label: "CPU Only", value: "cpu" },
                  ]}
                />
              </Form.Item>
            </Card>

            <Card className="rounded-xl border border-slate-200/80 bg-white shadow-xs">
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                icon={<PlayCircleOutlined />}
                loading={trainMutation.isPending}
                block
                className="!h-11 !bg-teal-700 hover:!bg-teal-800 text-white font-semibold"
              >
                Launch Fine-tuning Run
              </Button>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
}
