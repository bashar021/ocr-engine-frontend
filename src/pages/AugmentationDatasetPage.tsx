import {
  DatabaseOutlined,
  ExperimentOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import { listDatabankDatasets } from "@/api/databank";
import { listDatasets } from "@/api/evaluation";
import {
  createAugmentedDataset,
  listAugmentationStrategies,
  previewAugmentation,
  type AugmentationPreviewResponse,
} from "@/api/training";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusTag } from "@/components/common/StatusTag";
import { useTaskContext } from "@/features/tasks/TaskContext";
import type { EvaluationDataset } from "@/types/evaluation";

const { Text, Paragraph } = Typography;

const PRESET_PIPELINES: Array<{ name: string; label: string; strategies: string[]; desc: string }> = [
  {
    name: "balanced",
    label: "Balanced Detection Mix",
    strategies: ["rotate_small", "brightness", "sun_glare", "motion_blur", "noise"],
    desc: "Well-rounded mix of slight angle variance, lighting shifts, sensor grain, and motion blur.",
  },
  {
    name: "automotive",
    label: "Windshield Glare & Tilt",
    strategies: ["sun_glare", "perspective_tilt", "shadow", "motion_blur"],
    desc: "Simulates typical automotive cabin challenges: reflections, dash shadows, and tilted camera.",
  },
  {
    name: "low_light",
    label: "Low-Light & Cabin Blur",
    strategies: ["brightness_low", "noise", "motion_blur", "color_temperature"],
    desc: "Simulates night-time cluster shots with sensor noise and headlight tinting.",
  },
  {
    name: "geometry",
    label: "Geometry Invariance",
    strategies: ["rotate_small", "flip_h", "aspect_stretch", "perspective_tilt"],
    desc: "Stretches, tilts, and mirrors to make detector invariant to phone position.",
  },
];

function isAugmentedDataset(d: EvaluationDataset): boolean {
  if (d.origin === "augmented") return true;
  const meta = d.metadata ?? {};
  return Boolean(
    meta.augmentation_strategy ||
    meta.augmentation_strategies ||
    meta.origin === "augmented"
  );
}

export function AugmentationDatasetPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { activeTaskKey } = useTaskContext();

  const [sourceDatasetId, setSourceDatasetId] = useState<string | undefined>();
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([
    "rotate_small",
    "brightness",
    "sun_glare",
  ]);
  const [multiplier, setMultiplier] = useState<number>(1);
  const [customName, setCustomName] = useState<string>("");
  const [previewData, setPreviewData] = useState<AugmentationPreviewResponse | null>(null);

  // Load all strategies
  const strategiesQuery = useQuery({
    queryKey: ["training", "augmentation", "strategies"],
    queryFn: listAugmentationStrategies,
  });

  // Load Databank label datasets
  const databankQuery = useQuery({
    queryKey: ["databank", "datasets", activeTaskKey, "label_data"],
    queryFn: () => listDatabankDatasets(activeTaskKey, { dataset_type: "label" }),
  });

  // Load Training datasets (Evaluation / Augmented)
  const trainingQuery = useQuery({
    queryKey: ["evaluation", "datasets", "training", activeTaskKey],
    queryFn: () => listDatasets({ ocr_type: activeTaskKey, scope: "training", limit: 200 }),
  });

  const augmentedRows = useMemo(
    () => (trainingQuery.data?.datasets ?? []).filter(isAugmentedDataset),
    [trainingQuery.data?.datasets],
  );

  const datasetOptions = useMemo(() => {
    const groups: Array<{ label: string; options: Array<{ label: string; value: string; sampleCount: number; name: string }> }> = [];

    const dbDatasets = databankQuery.data?.datasets ?? [];
    if (dbDatasets.length > 0) {
      groups.push({
        label: "Databank Label Datasets",
        options: dbDatasets.map((d) => ({
          label: `[Databank] ${d.name} (${d.sample_count ?? 0} samples)`,
          value: d.id,
          sampleCount: d.sample_count ?? 0,
          name: d.name,
        })),
      });
    }

    const evalDatasets = (trainingQuery.data?.datasets ?? []).filter((d) => !isAugmentedDataset(d));
    if (evalDatasets.length > 0) {
      groups.push({
        label: "Training Datasets",
        options: evalDatasets.map((d) => ({
          label: `[Training] ${d.name} v${d.version} (${d.sample_count ?? 0} samples)`,
          value: d.id,
          sampleCount: d.sample_count ?? 0,
          name: d.name,
        })),
      });
    }

    return groups;
  }, [databankQuery.data, trainingQuery.data]);

  // Set default source dataset if available
  useEffect(() => {
    if (!sourceDatasetId && datasetOptions.length > 0) {
      const firstOpt = datasetOptions[0]?.options[0];
      if (firstOpt) {
        setSourceDatasetId(firstOpt.value);
      }
    }
  }, [datasetOptions, sourceDatasetId]);

  // Group strategies by category
  const categorizedStrategies = useMemo(() => {
    const list = strategiesQuery.data ?? [];
    return {
      geometric: list.filter((s) => s.category === "geometric"),
      photometric: list.filter((s) => s.category === "photometric"),
      noise_blur: list.filter((s) => s.category === "noise_blur"),
      occlusion: list.filter((s) => s.category === "occlusion"),
    };
  }, [strategiesQuery.data]);

  // Auto-generate suggested name
  const currentSourceDataset = useMemo(() => {
    const all = datasetOptions.flatMap((g) => g.options);
    return all.find((o) => o.value === sourceDatasetId);
  }, [datasetOptions, sourceDatasetId]);

  const defaultDatasetName = useMemo(() => {
    if (!currentSourceDataset) return "augmented-dataset";
    const stratTag = selectedStrategies.slice(0, 2).join("-") || "mix";
    return `${currentSourceDataset.name}-aug-${stratTag}`;
  }, [currentSourceDataset, selectedStrategies]);

  // Live preview mutation
  const previewMutation = useMutation({
    mutationFn: () =>
      previewAugmentation({
        source_dataset_id: sourceDatasetId,
        strategies: selectedStrategies.length > 0 ? selectedStrategies : ["brightness"],
      }),
    onSuccess: (data) => setPreviewData(data),
    onError: (e) => message.error(`Preview failed: ${getApiErrorMessage(e)}`),
  });

  // Trigger preview on initial load or strategy change (debounced)
  useEffect(() => {
    if (selectedStrategies.length > 0) {
      const timer = setTimeout(() => {
        previewMutation.mutate();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [selectedStrategies, sourceDatasetId]);

  // Create dataset mutation
  const createMutation = useMutation({
    mutationFn: () =>
      createAugmentedDataset({
        source_dataset_id: sourceDatasetId!,
        strategies: selectedStrategies,
        multiplier,
        name: customName.trim() || defaultDatasetName,
      }),
    onSuccess: (created) => {
      message.success(
        `Created augmented dataset "${created.name}" v${created.version} (${created.sample_count ?? 0} samples)!`,
      );
      setCustomName("");
      void queryClient.invalidateQueries({ queryKey: ["evaluation", "datasets"] });
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  const toggleStrategy = (key: string) => {
    setSelectedStrategies((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const columns: ColumnsType<EvaluationDataset> = [
    {
      title: "Dataset Name",
      key: "name",
      render: (_, d) => (
        <div>
          <span className="font-medium text-slate-800">{d.name}</span>{" "}
          <Typography.Text type="secondary" className="text-xs">
            v{d.version}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Strategies Applied",
      key: "strategies",
      render: (_, d) => {
        const meta = d.metadata ?? {};
        const strats =
          (meta.augmentation_strategies as string[]) ||
          (meta.augmentation_strategy ? [String(meta.augmentation_strategy)] : []);
        if (strats.length === 0) return <Tag color="teal">Augmented</Tag>;
        return (
          <Space wrap size={[4, 4]}>
            {strats.map((s) => (
              <Tag key={s} color="cyan" className="!text-[11px]">
                {s}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: "Multiplier",
      key: "multiplier",
      width: 90,
      render: (_, d) => {
        const mult = (d.metadata?.augmentation_multiplier as number) || 1;
        return <Tag color="purple">{mult}x</Tag>;
      },
    },
    {
      title: "Source Dataset",
      key: "source",
      ellipsis: true,
      render: (_, d) => {
        const name = d.metadata?.source_dataset_name as string | undefined;
        const ver = d.metadata?.source_dataset_version as string | undefined;
        if (name) return `${name}${ver ? ` v${ver}` : ""}`;
        return (d.metadata?.source_dataset_id as string | undefined)?.slice(0, 8) ?? "—";
      },
    },
    {
      title: "Samples",
      dataIndex: "sample_count",
      width: 100,
      render: (v) => <span className="font-semibold text-emerald-600">{v ?? 0}</span>,
    },
    {
      title: "Created",
      dataIndex: "created_at",
      width: 120,
      render: (t) => (t ? dayjs(t).format("YYYY-MM-DD") : "—"),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 100,
      render: (s) => <StatusTag status={s ?? "ready"} />,
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50/50 p-6 space-y-6">
      <PageHeader
        title="Data Augmentation"
        description="Generate robust synthetic variations (lighting, rotations, windshield glare, blur, and aspect tilt) with synchronized bounding box transforms."
        actions={<Tag color="teal" icon={<ExperimentOutlined />}>Non-Destructive</Tag>}
      />

      <Alert
        message="Strict Non-Destructive Copy Guarantee"
        description="Original datasets are NEVER modified. Augmentations are always generated into a brand-new, isolated dataset with unique file paths and newly computed bounding boxes. Source files remain 100% intact."
        type="info"
        showIcon
        icon={<SafetyCertificateOutlined className="text-teal-600" />}
        className="!border-teal-200 !bg-teal-50/70"
      />

      <Row gutter={[24, 24]}>
        {/* Left Column: Controls */}
        <Col xs={24} xl={14} className="space-y-6">
          {/* Source Dataset Card */}
          <Card
            title={
              <Space>
                <DatabaseOutlined className="text-teal-600" />
                <span>1. Select Source Dataset</span>
              </Space>
            }
            className="rounded-xl border border-slate-200/80 bg-white shadow-xs"
          >
            <Paragraph type="secondary" className="text-xs">
              Choose any ready dataset from Databank (label data) or Training datasets. A clean snapshot copy will be generated.
            </Paragraph>
            <Select
              value={sourceDatasetId}
              onChange={(val) => setSourceDatasetId(val)}
              options={datasetOptions}
              loading={databankQuery.isLoading || trainingQuery.isLoading}
              style={{ width: "100%" }}
              placeholder="Select source dataset..."
              showSearch
            />
          </Card>

          {/* Quick Presets */}
          <Card
            title={
              <Space>
                <ThunderboltOutlined className="text-amber-500" />
                <span>2. Quick Pipeline Presets</span>
              </Space>
            }
            className="rounded-xl border border-slate-200/80 bg-white shadow-xs"
          >
            <Row gutter={[12, 12]}>
              {PRESET_PIPELINES.map((p) => {
                const isActive =
                  p.strategies.every((s) => selectedStrategies.includes(s)) &&
                  selectedStrategies.length === p.strategies.length;
                return (
                  <Col xs={24} sm={12} key={p.name}>
                    <div
                      onClick={() => setSelectedStrategies([...p.strategies])}
                      className={`cursor-pointer rounded-lg border p-3 transition-all ${
                        isActive
                          ? "border-teal-500 bg-teal-50/80 shadow-xs ring-1 ring-teal-500/30"
                          : "border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-100/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 text-xs">{p.label}</span>
                        {isActive && <Tag color="teal">Active</Tag>}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">{p.desc}</p>
                      <div className="mt-2 flex orientation-row flex-wrap gap-1">
                        {p.strategies.map((s) => (
                          <Tag key={s} className="!text-[10px] !m-0 !px-1.5 !py-0 !border-slate-200 bg-white text-slate-600">
                            {s}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  </Col>
                );
              })}
            </Row>

            <div className="mt-3 flex justify-end gap-2">
              <Button
                size="small"
                onClick={() =>
                  setSelectedStrategies((strategiesQuery.data ?? []).map((s) => s.key))
                }
              >
                Select All ({strategiesQuery.data?.length ?? 0})
              </Button>
              <Button size="small" onClick={() => setSelectedStrategies([])}>
                Clear All
              </Button>
            </div>
          </Card>

          {/* Detailed Strategy Selector Tabs */}
          <Card
            title={
              <Space>
                <ExperimentOutlined className="text-teal-600" />
                <span>3. Choose Augmentation Types ({selectedStrategies.length} selected)</span>
              </Space>
            }
            className="rounded-xl border border-slate-200/80 bg-white shadow-xs"
          >
            <Tabs
              defaultActiveKey="geometric"
              items={[
                {
                  key: "geometric",
                  label: `Geometric (${categorizedStrategies.geometric.filter((s) => selectedStrategies.includes(s.key)).length})`,
                  children: (
                    <Row gutter={[12, 12]}>
                      {categorizedStrategies.geometric.map((s) => {
                        const checked = selectedStrategies.includes(s.key);
                        return (
                          <Col xs={24} sm={12} key={s.key}>
                            <div
                              onClick={() => toggleStrategy(s.key)}
                              className={`cursor-pointer rounded border p-2.5 transition-colors ${
                                checked
                                  ? "border-teal-500 bg-teal-50/80 ring-1 ring-teal-500/30"
                                  : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-100/50"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <Checkbox checked={checked} onChange={() => {}} className="text-slate-800 text-xs font-medium">
                                  {s.label}
                                </Checkbox>
                                <Tag color="teal" className="!text-[10px]">BBox Sync</Tag>
                              </div>
                              <p className="mt-1 ml-6 text-[11px] text-slate-500">{s.description}</p>
                            </div>
                          </Col>
                        );
                      })}
                    </Row>
                  ),
                },
                {
                  key: "photometric",
                  label: `Photometric (${categorizedStrategies.photometric.filter((s) => selectedStrategies.includes(s.key)).length})`,
                  children: (
                    <Row gutter={[12, 12]}>
                      {categorizedStrategies.photometric.map((s) => {
                        const checked = selectedStrategies.includes(s.key);
                        return (
                          <Col xs={24} sm={12} key={s.key}>
                            <div
                              onClick={() => toggleStrategy(s.key)}
                              className={`cursor-pointer rounded border p-2.5 transition-colors ${
                                checked
                                  ? "border-teal-500 bg-teal-50/80 ring-1 ring-teal-500/30"
                                  : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-100/50"
                              }`}
                            >
                              <Checkbox checked={checked} onChange={() => {}} className="text-slate-800 text-xs font-medium">
                                {s.label}
                              </Checkbox>
                              <p className="mt-1 ml-6 text-[11px] text-slate-500">{s.description}</p>
                            </div>
                          </Col>
                        );
                      })}
                    </Row>
                  ),
                },
                {
                  key: "noise_blur",
                  label: `Noise & Blur (${categorizedStrategies.noise_blur.filter((s) => selectedStrategies.includes(s.key)).length})`,
                  children: (
                    <Row gutter={[12, 12]}>
                      {categorizedStrategies.noise_blur.map((s) => {
                        const checked = selectedStrategies.includes(s.key);
                        return (
                          <Col xs={24} sm={12} key={s.key}>
                            <div
                              onClick={() => toggleStrategy(s.key)}
                              className={`cursor-pointer rounded border p-2.5 transition-colors ${
                                checked
                                  ? "border-teal-500 bg-teal-50/80 ring-1 ring-teal-500/30"
                                  : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-100/50"
                              }`}
                            >
                              <Checkbox checked={checked} onChange={() => {}} className="text-slate-800 text-xs font-medium">
                                {s.label}
                              </Checkbox>
                              <p className="mt-1 ml-6 text-[11px] text-slate-500">{s.description}</p>
                            </div>
                          </Col>
                        );
                      })}
                    </Row>
                  ),
                },
                {
                  key: "occlusion",
                  label: `Occlusion (${categorizedStrategies.occlusion.filter((s) => selectedStrategies.includes(s.key)).length})`,
                  children: (
                    <Row gutter={[12, 12]}>
                      {categorizedStrategies.occlusion.map((s) => {
                        const checked = selectedStrategies.includes(s.key);
                        return (
                          <Col xs={24} sm={12} key={s.key}>
                            <div
                              onClick={() => toggleStrategy(s.key)}
                              className={`cursor-pointer rounded border p-2.5 transition-colors ${
                                checked
                                  ? "border-teal-500 bg-teal-50/80 ring-1 ring-teal-500/30"
                                  : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-100/50"
                              }`}
                            >
                              <Checkbox checked={checked} onChange={() => {}} className="text-slate-800 text-xs font-medium">
                                {s.label}
                              </Checkbox>
                              <p className="mt-1 ml-6 text-[11px] text-slate-500">{s.description}</p>
                            </div>
                          </Col>
                        );
                      })}
                    </Row>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        {/* Right Column: Live Interactive Preview & Generation Settings */}
        <Col xs={24} xl={10} className="space-y-6">
          {/* Live Preview Card */}
          <Card
            title={
              <div className="flex items-center justify-between w-full">
                <Space>
                  <EyeOutlined className="text-teal-600" />
                  <span>Interactive Live Preview</span>
                </Space>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={previewMutation.isPending}
                  onClick={() => previewMutation.mutate()}
                >
                  Re-roll
                </Button>
              </div>
            }
            className="rounded-xl border border-slate-200/80 bg-white shadow-xs"
          >
            <Paragraph type="secondary" className="text-xs !mb-3">
              Bounding box recalculation verification: Bounding boxes are drawn in green/teal. Note how geometric transforms dynamically shift and rotate coordinates.
            </Paragraph>

            {previewMutation.isPending && !previewData ? (
              <div className="flex h-56 items-center justify-center">
                <Spin tip="Generating preview..." />
              </div>
            ) : previewData ? (
              <div className="space-y-4">
                <Row gutter={12}>
                  {/* Original */}
                  <Col span={12}>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-medium text-slate-700">Original Sample</span>
                        <span>{previewData.original.width}×{previewData.original.height}</span>
                      </div>
                      <div className="relative overflow-hidden rounded border border-slate-200 bg-slate-900/5 aspect-[4/3]">
                        <img
                          src={previewData.original.data_url}
                          alt="Original sample"
                          className="h-full w-full object-contain"
                        />
                        {previewData.original.bbox && (
                          <div
                            className="absolute border-2 border-emerald-400 bg-emerald-400/20 pointer-events-none"
                            style={{
                              left: `${(previewData.original.bbox.x1 / previewData.original.width) * 100}%`,
                              top: `${(previewData.original.bbox.y1 / previewData.original.height) * 100}%`,
                              width: `${((previewData.original.bbox.x2 - previewData.original.bbox.x1) / previewData.original.width) * 100}%`,
                              height: `${((previewData.original.bbox.y2 - previewData.original.bbox.y1) / previewData.original.height) * 100}%`,
                            }}
                          >
                            <span className="absolute -top-4 left-0 rounded bg-emerald-600 px-1 py-0.2 text-[9px] font-bold text-white">
                              bbox
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Col>

                  {/* Augmented */}
                  <Col span={12}>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-teal-700">
                        <span className="font-medium">Augmented Result</span>
                        <span>{previewData.augmented.width}×{previewData.augmented.height}</span>
                      </div>
                      <div className="relative overflow-hidden rounded border border-teal-500/60 bg-slate-900/5 aspect-[4/3]">
                        <img
                          src={previewData.augmented.data_url}
                          alt="Augmented sample"
                          className="h-full w-full object-contain"
                        />
                        {previewData.augmented.bbox && (
                          <div
                            className="absolute border-2 border-teal-500 bg-teal-500/20 pointer-events-none"
                            style={{
                              left: `${(previewData.augmented.bbox.x1 / previewData.augmented.width) * 100}%`,
                              top: `${(previewData.augmented.bbox.y1 / previewData.augmented.height) * 100}%`,
                              width: `${((previewData.augmented.bbox.x2 - previewData.augmented.bbox.x1) / previewData.augmented.width) * 100}%`,
                              height: `${((previewData.augmented.bbox.y2 - previewData.augmented.bbox.y1) / previewData.augmented.height) * 100}%`,
                            }}
                          >
                            <span className="absolute -top-4 left-0 rounded bg-teal-600 px-1 py-0.2 text-[9px] font-bold text-white">
                              transformed
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Col>
                </Row>

                <div className="rounded border border-slate-200 bg-slate-50 p-2.5 text-xs">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span>Applied Pipeline:</span>
                    <span className="text-teal-700 font-semibold">{previewData.strategies_applied.length} transforms</span>
                  </div>
                  <Space wrap size={[4, 4]}>
                    {previewData.strategies_applied.map((s) => (
                      <Tag key={s} color="teal" className="!text-[10px]">
                        {s}
                      </Tag>
                    ))}
                  </Space>
                </div>
              </div>
            ) : (
              <Empty description="No preview available" />
            )}
          </Card>

          {/* Dataset Generation Controls */}
          <Card
            title={
              <Space>
                <PlusOutlined className="text-teal-600" />
                <span>4. Output Dataset Generation</span>
              </Space>
            }
            className="rounded-xl border border-slate-200/80 bg-white shadow-xs"
          >
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Dataset Expansion Multiplier
                </label>
                <Select
                  value={multiplier}
                  onChange={(v) => setMultiplier(v)}
                  style={{ width: "100%" }}
                  options={[
                    { label: "1x (Direct Augmented Copy — Same size as source)", value: 1 },
                    { label: "2x (Double Dataset — 2 variations per original sample)", value: 2 },
                    { label: "3x (Triple Dataset — 3 distinct variations per sample)", value: 3 },
                    { label: "5x (5x Expansion — Comprehensive multi-strategy mix)", value: 5 },
                  ]}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  New Augmented Dataset Name
                </label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={defaultDatasetName}
                />
                <Text type="secondary" className="text-[11px] mt-1 block">
                  Leave blank to use default: <code>{defaultDatasetName}</code>
                </Text>
              </div>

              <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Source Samples:</span>
                  <span className="font-semibold text-slate-800">{currentSourceDataset?.sampleCount ?? 0}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Multiplier:</span>
                  <span className="font-semibold text-teal-700">{multiplier}x</span>
                </div>
                <Divider className="!my-1.5 !border-slate-200" />
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>Estimated Output Size:</span>
                  <span className="font-bold text-emerald-600">
                    {(currentSourceDataset?.sampleCount ?? 0) * multiplier} samples
                  </span>
                </div>
              </div>

              <Button
                type="primary"
                size="large"
                icon={<ThunderboltOutlined />}
                loading={createMutation.isPending}
                disabled={!sourceDatasetId || selectedStrategies.length === 0}
                onClick={() => createMutation.mutate()}
                block
                className="!h-11 !bg-teal-700 hover:!bg-teal-800 text-white font-semibold"
              >
                Create Augmented Dataset
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Existing Augmented Datasets Table */}
      <Card
        title={
          <div className="flex items-center justify-between">
            <Space>
              <ExperimentOutlined className="text-teal-600" />
              <span>Augmented Datasets ({augmentedRows.length})</span>
            </Space>
          </div>
        }
        className="rounded-xl border border-slate-200/80 bg-white shadow-xs"
      >
        <Table
          rowKey="id"
          dataSource={augmentedRows}
          columns={columns}
          loading={trainingQuery.isLoading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: "No augmented datasets created yet" }}
        />
      </Card>
    </div>
  );
}
