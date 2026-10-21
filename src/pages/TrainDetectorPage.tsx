import {
  ExperimentOutlined,
  PlayCircleOutlined,
  PlusCircleOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
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
  Row,
  Select,
  Slider,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import { listDatabankDatasets } from "@/api/databank";
import { listDatasets } from "@/api/evaluation";
import {
  startTrainingRun,
  suggestTrainingVersion,
} from "@/api/training";
import { PageHeader } from "@/components/common/PageHeader";
import { useTaskContext } from "@/features/tasks/TaskContext";

const { Text, Paragraph } = Typography;

const ARCHITECTURE_PRESETS = [
  {
    value: "yolov8s.pt",
    label: "YOLOv8 Small (Recommended)",
    desc: "11.2M params — Excellent balance of detection precision and edge speed.",
    badge: "Recommended",
    badgeColor: "green",
  },
  {
    value: "yolov8n.pt",
    label: "YOLOv8 Nano",
    desc: "3.2M params — Ultra-fast, ideal for testing and real-time mobile inference.",
    badge: "Fastest",
    badgeColor: "blue",
  },
  {
    value: "yolov8m.pt",
    label: "YOLOv8 Medium",
    desc: "25.9M params — Higher capacity for complex dials and difficult angles.",
    badge: "High Precision",
    badgeColor: "purple",
  },
  {
    value: "yolov8l.pt",
    label: "YOLOv8 Large",
    desc: "43.7M params — Maximum bounding box recall across rare dash clusters.",
    badge: "Deep",
    badgeColor: "orange",
  },
  {
    value: "yolo11n.pt",
    label: "YOLO11 Nano",
    desc: "Next-gen ultralytics architecture — lightweight and low latency.",
    badge: "YOLO11",
    badgeColor: "cyan",
  },
  {
    value: "yolo11s.pt",
    label: "YOLO11 Small",
    desc: "Next-gen ultralytics architecture — balanced accuracy.",
    badge: "YOLO11",
    badgeColor: "cyan",
  },
  {
    value: "yolo11m.pt",
    label: "YOLO11 Medium",
    desc: "Next-gen ultralytics architecture — enhanced feature pyramid.",
    badge: "YOLO11",
    badgeColor: "cyan",
  },
];

export function TrainDetectorPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { activeTaskKey } = useTaskContext();
  const [form] = Form.useForm();

  const selectedArch = Form.useWatch("architecture", form) || "yolov8s.pt";
  const selectedDatasets = Form.useWatch("dataset_ids", form) || [];

  // Query Databank label datasets
  const databankQuery = useQuery({
    queryKey: ["databank", "datasets", activeTaskKey, "label_data"],
    queryFn: () => listDatabankDatasets(activeTaskKey, { dataset_type: "label" }),
  });

  // Query Evaluation training / augmented datasets
  const evalDatasetsQuery = useQuery({
    queryKey: ["evaluation", "datasets", "training", activeTaskKey],
    queryFn: () => listDatasets({ ocr_type: activeTaskKey, scope: "training", limit: 100 }),
  });

  const datasetOptions = useMemo(() => {
    const groups: Array<{ label: string; options: Array<{ label: string; value: string; sampleCount: number }> }> = [];

    // Databank Label Datasets
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

    // Evaluation / Augmented Datasets
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

  // Compute selected samples total
  const selectedTotalSamples = useMemo(() => {
    let total = 0;
    const allOpts = datasetOptions.flatMap((g) => g.options);
    for (const id of selectedDatasets) {
      const match = allOpts.find((o) => o.value === id);
      if (match) total += match.sampleCount;
    }
    return total;
  }, [datasetOptions, selectedDatasets]);

  // Suggest version on dataset change or initial load
  const suggestVersionMutation = useMutation({
    mutationFn: () => {
      const name = form.getFieldValue("name") || `odometer-detector-${selectedArch.replace(".pt", "")}`;
      const dsRefs = (form.getFieldValue("dataset_ids") || []).map((id: string) => ({
        dataset_id: id,
        role: "base",
      }));
      return suggestTrainingVersion({
        ocr_type: activeTaskKey,
        role: "detection",
        name,
        dataset_ids: dsRefs.length > 0 ? dsRefs : undefined,
      });
    },
    onSuccess: (data) => {
      form.setFieldsValue({
        version: data.suggested_version,
        name: data.name,
      });
      message.success(`Suggested version: v${data.suggested_version}`);
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  // Start training run mutation
  const trainMutation = useMutation({
    mutationFn: async (values: any) => {
      const dsRefs = (values.dataset_ids || []).map((id: string) => ({
        dataset_id: id,
        role: "base",
      }));

      const hyper = {
        pretrained_weights: values.architecture,
        epochs: Number(values.epochs || 30),
        batch: Number(values.batch || 16),
        imgsz: Number(values.imgsz || 640),
        val_ratio: Number(values.val_ratio || 20) / 100.0,
        optimizer: values.optimizer || "AdamW",
        lr0: Number(values.lr0 || 0.01),
        lrf: Number(values.lrf || 0.01),
        patience: Number(values.patience || 20),
        device: values.device === "auto" ? undefined : values.device,
        pretrained: true,
      };

      return startTrainingRun({
        ocr_type: activeTaskKey,
        role: "detection",
        name: values.name,
        version: values.version || "1.0.0",
        adapter_id: "ultralytics_detection",
        dataset_ids: dsRefs,
        hyperparameters: hyper,
        auto_evaluate: Boolean(values.auto_evaluate),
        auto_version: !values.version,
      });
    },
    onSuccess: (run) => {
      message.success(`Detection training run started: ${run.name} v${run.version}`);
      navigate(`/training/runs/${run.id}`);
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50/50 p-6 space-y-6">
      <PageHeader
        title="New Detection Model"
        description="Train a high-performance bounding box detector from baseline YOLOv8 or YOLO11 architectures on your odometer datasets."
        actions={<Tag color="teal" icon={<PlusCircleOutlined />}>New Model</Tag>}
      />

      <Alert
        message="Strict Non-Destructive Guarantee"
        description="Original datasets are never altered. Source images and labels are cleanly snapshot into an isolated ephemeral workspace for training. Your databank and label data remain 100% intact."
        type="info"
        showIcon
        icon={<SafetyCertificateOutlined className="text-teal-600" />}
        className="!border-teal-200 !bg-teal-50/70"
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          architecture: "yolov8s.pt",
          name: "odometer-detector-v8s",
          version: "1.0.0",
          epochs: 30,
          batch: 16,
          imgsz: 640,
          val_ratio: 20,
          optimizer: "AdamW",
          lr0: 0.01,
          lrf: 0.01,
          patience: 20,
          device: "auto",
          auto_evaluate: true,
        }}
        onFinish={(values) => trainMutation.mutate(values)}
      >
        <Row gutter={[24, 24]}>
          {/* Left Column: Datasets & Architecture */}
          <Col xs={24} lg={14} className="space-y-6">
            <Card
              title={
                <Space>
                  <ExperimentOutlined className="text-teal-600" />
                  <span>1. Source Training Datasets</span>
                </Space>
              }
              className="rounded-xl border border-slate-200/80 bg-white shadow-xs"
            >
              <Paragraph type="secondary" className="text-xs">
                Select one or more labeled datasets from Databank or Training Datasets. All bounding boxes will be converted into YOLO detection format automatically.
              </Paragraph>

              <Form.Item
                name="dataset_ids"
                label="Selected Datasets"
                rules={[{ required: true, message: "Please select at least one dataset" }]}
              >
                <Select
                  mode="multiple"
                  placeholder="Select labeled datasets..."
                  options={datasetOptions}
                  loading={databankQuery.isLoading || evalDatasetsQuery.isLoading}
                  style={{ width: "100%" }}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>

              {selectedDatasets.length > 0 && (
                <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <Text type="secondary">Selected Datasets Count: <span className="font-semibold text-slate-800">{selectedDatasets.length}</span></Text>
                  <Tag color="cyan">Total Samples: {selectedTotalSamples}</Tag>
                </div>
              )}
            </Card>

            <Card
              title={
                <Space>
                  <SettingOutlined className="text-slate-700" />
                  <span>2. Model Architecture & Identity</span>
                </Space>
              }
              className="rounded-xl border border-slate-200/80 bg-white shadow-xs"
            >
              <Form.Item
                name="architecture"
                label="Baseline Architecture & Pretrained Weights"
                rules={[{ required: true }]}
              >
                <Select
                  options={ARCHITECTURE_PRESETS.map((p) => ({
                    value: p.value,
                    label: (
                      <div className="flex items-center justify-between py-1">
                        <div>
                          <span className="font-medium text-slate-800">{p.label}</span>
                          <span className="ml-2 text-xs text-slate-500">({p.desc})</span>
                        </div>
                        <Tag color={p.badgeColor}>{p.badge}</Tag>
                      </div>
                    ),
                  }))}
                  onChange={(val) => {
                    const clean = String(val).replace(".pt", "").replace("yolo", "yolo-");
                    form.setFieldValue("name", `odometer-detector-${clean}`);
                  }}
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={14}>
                  <Form.Item
                    name="name"
                    label="Model Name"
                    rules={[{ required: true, message: "Please enter model name" }]}
                  >
                    <Input placeholder="e.g. odometer-detector-v8s" />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item
                    name="version"
                    label={
                      <div className="flex items-center justify-between w-full">
                        <span>Version</span>
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
                    <Input placeholder="1.0.0" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* Right Column: Hyperparameters */}
          <Col xs={24} lg={10} className="space-y-6">
            <Card
              title={
                <Space>
                  <SettingOutlined className="text-slate-700" />
                  <span>3. Training Hyperparameters</span>
                </Space>
              }
              className="rounded-xl border border-slate-200/80 bg-white shadow-xs"
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="epochs" label="Epochs" rules={[{ required: true }]}>
                    <InputNumber min={1} max={500} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="batch" label="Batch Size" rules={[{ required: true }]}>
                    <Select
                      options={[
                        { label: "8 (Low VRAM)", value: 8 },
                        { label: "16 (Standard)", value: 16 },
                        { label: "32 (High Throughput)", value: 32 },
                        { label: "64", value: 64 },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="imgsz" label="Image Size (px)">
                    <Select
                      options={[
                        { label: "512 x 512 (Fast)", value: 512 },
                        { label: "640 x 640 (Standard)", value: 640 },
                        { label: "1024 x 1024 (HD Dials)", value: 1024 },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="optimizer" label="Optimizer">
                    <Select
                      options={[
                        { label: "AdamW (Recommended)", value: "AdamW" },
                        { label: "SGD (Momentum)", value: "SGD" },
                        { label: "Adam", value: "Adam" },
                        { label: "Auto", value: "auto" },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="val_ratio"
                label={
                  <div className="flex items-center justify-between w-full">
                    <span>Train / Val Split Ratio</span>
                    <Text type="secondary" className="text-xs">
                      {100 - (form.getFieldValue("val_ratio") || 20)}% Train / {form.getFieldValue("val_ratio") || 20}% Val
                    </Text>
                  </div>
                }
              >
                <Slider min={10} max={40} step={5} />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="lr0" label="Initial LR (lr0)">
                    <InputNumber min={0.0001} max={0.1} step={0.001} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="patience" label="Early Stop Patience">
                    <InputNumber min={5} max={100} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="device" label="Compute Hardware">
                <Select
                  options={[
                    { label: "Auto Detect (GPU / MPS / CPU)", value: "auto" },
                    { label: "Apple Silicon GPU (mps)", value: "mps" },
                    { label: "NVIDIA CUDA GPU (cuda:0)", value: "cuda:0" },
                    { label: "CPU Only", value: "cpu" },
                  ]}
                />
              </Form.Item>

              <Divider className="!border-slate-100" />

              <Form.Item
                name="auto_evaluate"
                valuePropName="checked"
                className="!mb-0"
                label={
                  <div>
                    <span className="font-medium text-slate-800">Auto-Evaluate Post-Training</span>
                    <Paragraph type="secondary" className="!mb-0 text-xs">
                      Run benchmark evaluation and register mAP50 directly to the Model Registry upon completion.
                    </Paragraph>
                  </div>
                }
              >
                <Switch />
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
                Launch Detection Training Run
              </Button>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
}
