import {
  BarChartOutlined,
  CopyOutlined,
  DashboardOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Modal,
  Progress,
  Row,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  getEvaluationMetrics,
  getEvaluationSlices,
  listAllEvaluationResults,
} from "@/api/evaluation";
import { StatusTag } from "@/components/common/StatusTag";
import type {
  EvaluationResult,
  EvaluationRun,
  EvaluationSliceItem,
} from "@/types/evaluation";
import {
  FAILURE_TYPE_DESCRIPTIONS,
  FAILURE_TYPE_LABELS,
  formatFailureType,
} from "@/utils/failureTaxonomy";
import { formatMs } from "@/utils/format";

interface EvaluationMetricsModalProps {
  run: EvaluationRun | null;
  open: boolean;
  onClose: () => void;
  onViewResults?: (run: EvaluationRun) => void;
}

interface MetricDisplayItem {
  key: string;
  label: string;
  count: number | null;
  total: number;
  percentage: number | null;
  unit?: string;
  category: "detection" | "recognition" | "diagnostic" | "latency" | "overall";
  description?: string;
}

const FAILURE_TYPE_STAGES: Record<string, { label: string; color: string }> = {
  OK: { label: "Success / Passed", color: "green" },
  MISMATCH: { label: "Recognition", color: "orange" },
  DETECTION_FAILURE: { label: "Detection", color: "volcano" },
  WRONG_DETECTION: { label: "Detection", color: "volcano" },
  PARTIAL_DETECTION: { label: "Detection", color: "orange" },
  MULTIPLE_DETECTIONS: { label: "Detection", color: "gold" },
  DUPLICATE_DETECTION: { label: "Detection", color: "gold" },
  RECOGNITION_FAILURE: { label: "Recognition", color: "red" },
  INVALID_IMAGE: { label: "Image Quality", color: "purple" },
};

export function EvaluationMetricsModal({
  run,
  open,
  onClose,
  onViewResults,
}: EvaluationMetricsModalProps) {
  const [activeTab, setActiveTab] = useState<string>("failures");

  const runId = run?.id;

  // 1. Query metrics from backend API
  const metricsQuery = useQuery({
    queryKey: ["evaluation", "metrics", runId],
    queryFn: () => getEvaluationMetrics(runId!),
    enabled: Boolean(open && runId),
    staleTime: 15_000,
  });

  const apiMetricsMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of metricsQuery.data?.metrics ?? []) {
      map[m.metric_name] = m.metric_value;
    }
    return map;
  }, [metricsQuery.data?.metrics]);

  // 2. Query failure type slices from backend API (fast SQL aggregation)
  const slicesQuery = useQuery({
    queryKey: ["evaluation", "slices", runId, "failure_type"],
    queryFn: () => getEvaluationSlices(runId!, "failure_type", 1),
    enabled: Boolean(open && runId),
    staleTime: 15_000,
  });

  // 3. Query sample-level results for granular breakdown when needed
  const resultsQuery = useQuery({
    queryKey: ["evaluation", "results", runId, "all"],
    queryFn: () => listAllEvaluationResults(runId!),
    enabled: Boolean(open && runId && !slicesQuery.data),
    staleTime: 30_000,
  });

  const totalSamples = run?.total_samples || run?.processed_samples || 0;
  const processedSamples = run?.processed_samples ?? totalSamples;

  // Combine failure types data from slices or sample results
  const failureTypeStats = useMemo(() => {
    if (!run) return [];

    const total = totalSamples || 1;

    // A. Use backend slices if available
    const allSlices: EvaluationSliceItem[] = [
      ...(slicesQuery.data?.slices ?? []),
      ...(slicesQuery.data?.insufficient_sample_slices ?? []),
    ];

    if (allSlices.length > 0) {
      return allSlices.map((s) => {
        const count = s.sample_count;
        const pct = (count / total) * 100;
        const stageInfo = FAILURE_TYPE_STAGES[s.key] || {
          label: "General",
          color: "default",
        };
        const friendlyName = FAILURE_TYPE_LABELS[s.key] || formatFailureType(s.key);
        const desc = FAILURE_TYPE_DESCRIPTIONS[s.key] || "Taxonomy evaluation outcome.";

        return {
          key: s.key,
          name: friendlyName,
          rawKey: s.key,
          count,
          percentage: pct,
          correct: s.correct,
          incorrect: s.incorrect,
          stage: stageInfo.label,
          stageColor: stageInfo.color,
          description: desc,
        };
      });
    }

    // B. Fallback to sample results aggregation
    const results: EvaluationResult[] = resultsQuery.data || [];
    if (results.length > 0) {
      const counts: Record<string, { total: number; correct: number }> = {};
      for (const r of results) {
        const ft = r.failure_type || (r.is_correct ? "OK" : "UNKNOWN");
        if (!counts[ft]) counts[ft] = { total: 0, correct: 0 };
        counts[ft].total += 1;
        if (r.is_correct) counts[ft].correct += 1;
      }

      return Object.entries(counts)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([key, data]) => {
          const count = data.total;
          const pct = (count / total) * 100;
          const stageInfo = FAILURE_TYPE_STAGES[key] || {
            label: "General",
            color: "default",
          };
          const friendlyName = FAILURE_TYPE_LABELS[key] || formatFailureType(key);
          const desc = FAILURE_TYPE_DESCRIPTIONS[key] || "Evaluation outcome category.";

          return {
            key,
            name: friendlyName,
            rawKey: key,
            count,
            percentage: pct,
            correct: data.correct,
            incorrect: count - data.correct,
            stage: stageInfo.label,
            stageColor: stageInfo.color,
            description: desc,
          };
        });
    }

    // C. Fallback from run.metrics if results not yet loaded
    const metricRecord = { ...(run.metrics || {}), ...apiMetricsMap };
    const fallbackList = [];
    const okRate = metricRecord.exact_match_accuracy ?? 0;
    const okCount = Math.round(okRate * total);
    fallbackList.push({
      key: "OK",
      name: "OK / Clean Match",
      rawKey: "OK",
      count: okCount,
      percentage: okRate * 100,
      correct: okCount,
      incorrect: 0,
      stage: "Success / Passed",
      stageColor: "green",
      description: "Detection usable and recognition matches ground truth.",
    });

    const detFailRate = metricRecord.detection_failure_rate ?? 0;
    if (detFailRate > 0) {
      const cnt = Math.round(detFailRate * total);
      fallbackList.push({
        key: "DETECTION_FAILURE",
        name: "Detection Failure",
        rawKey: "DETECTION_FAILURE",
        count: cnt,
        percentage: detFailRate * 100,
        correct: 0,
        incorrect: cnt,
        stage: "Detection",
        stageColor: "volcano",
        description: "No usable prediction for the expected odometer cluster.",
      });
    }

    const mismatchCount = Math.max(0, total - okCount - Math.round(detFailRate * total));
    if (mismatchCount > 0) {
      fallbackList.push({
        key: "MISMATCH",
        name: "Mismatch",
        rawKey: "MISMATCH",
        count: mismatchCount,
        percentage: (mismatchCount / total) * 100,
        correct: 0,
        incorrect: mismatchCount,
        stage: "Recognition",
        stageColor: "orange",
        description: "Recognition produced a value that does not match ground truth.",
      });
    }

    return fallbackList;
  }, [run, totalSamples, slicesQuery.data, resultsQuery.data, apiMetricsMap]);

  // Small Metrics list with BOTH Count and Percentage
  const smallMetrics = useMemo(() => {
    if (!run) return [];

    const total = totalSamples || 1;
    const runM = { ...(run.metrics || {}), ...apiMetricsMap };

    // Helper to extract or estimate count and percent
    const getRatioMetric = (
      name: string,
      label: string,
      category: MetricDisplayItem["category"],
      description?: string,
      customCount?: number,
    ): MetricDisplayItem => {
      const val = runM[name];
      if (typeof val === "number") {
        const count = customCount !== undefined ? customCount : Math.round(val * total);
        const percentage = Number((val * 100).toFixed(2));
        return { key: name, label, count, total, percentage, category, description };
      }
      return { key: name, label, count: customCount ?? 0, total, percentage: 0.0, category, description };
    };

    const items: MetricDisplayItem[] = [
      // Accuracy & Primary Rates
      getRatioMetric(
        "exact_match_accuracy",
        "Exact Match Accuracy",
        "recognition",
        "Strict 100% character match against normalized ground truth.",
        run.successful_samples,
      ),
      getRatioMetric(
        "end_to_end_accuracy",
        "End-to-End Accuracy",
        "overall",
        "Complete pipeline accuracy from raw full frame to final odometer value.",
      ),
      getRatioMetric(
        "end_to_end_success_rate",
        "End-to-End Success Rate",
        "overall",
        "Proportion of evaluations terminating with valid high-confidence status.",
      ),
      getRatioMetric(
        "low_confidence_rate",
        "Low Confidence Rate",
        "overall",
        "Proportion of predictions falling below minimum reliability threshold.",
      ),

      // Detection Metrics
      getRatioMetric(
        "detection_success_rate",
        "Detection Success Rate",
        "detection",
        "Detector correctly identified the bounding box coordinates.",
      ),
      getRatioMetric(
        "detection_miss_rate",
        "Detection Miss Rate",
        "detection",
        "Detector failed to locate any bounding box.",
      ),
      getRatioMetric(
        "avg_detection_confidence",
        "Avg Detection Confidence",
        "detection",
        "Mean confidence score across all proposed bounding boxes.",
      ),
      getRatioMetric(
        "detection_failure_rate",
        "Detection Failure Rate",
        "detection",
        "No detection candidate satisfied minimum IoU / aspect criteria.",
      ),
      getRatioMetric(
        "wrong_detection_rate",
        "Wrong Detection Rate",
        "detection",
        "Proposed candidate box matched incorrect region in image.",
      ),
      getRatioMetric(
        "partial_detection_rate",
        "Partial Detection Rate",
        "detection",
        "Proposed bounding box clipped or missed part of the odometer dial.",
      ),
      getRatioMetric(
        "multiple_detection_rate",
        "Multiple Detections Rate",
        "detection",
        "Multiple competing candidates produced ambiguous resolution.",
      ),
      getRatioMetric(
        "duplicate_detection_rate",
        "Duplicate Detection Rate",
        "detection",
        "Redundant high-overlap predictions for the same cluster.",
      ),
      getRatioMetric(
        "detection_ok_outcome_rate",
        "Detection OK Outcome Rate",
        "detection",
        "Detector passed all verification heuristics.",
      ),

      // Diagnostics & Flags
      getRatioMetric(
        "vertical_orientation_diagnostic_rate",
        "Vertical Orientation Flag",
        "diagnostic",
        "Image was captured with severe roll or sideways orientation.",
      ),
      getRatioMetric(
        "unusual_aspect_diagnostic_rate",
        "Unusual Aspect Ratio Flag",
        "diagnostic",
        "Bounding box aspect ratio differed significantly from odometer cluster.",
      ),
      getRatioMetric(
        "low_gt_coverage_diagnostic_rate",
        "Low Ground Truth Coverage Flag",
        "diagnostic",
        "Box coverage of true target region fell below threshold.",
      ),
      getRatioMetric(
        "low_iou_diagnostic_rate",
        "Low IoU Diagnostic Flag",
        "diagnostic",
        "Intersection over Union with ground truth box was low.",
      ),

      // Recognition Metrics
      getRatioMetric(
        "recognition_success_rate",
        "Recognition Success Rate",
        "recognition",
        "OCR text engine produced readable string from cropped candidate.",
      ),
    ];

    return items;
  }, [run, totalSamples]);

  // Fail Stage breakdown
  const stageStats = useMemo(() => {
    if (!run) return [];
    const total = totalSamples || 1;

    let detCount = 0;
    let recCount = 0;
    let imageCount = 0;
    let okCount = 0;

    for (const item of failureTypeStats) {
      if (item.stage === "Success / Passed") okCount += item.count;
      else if (item.stage === "Detection") detCount += item.count;
      else if (item.stage === "Recognition") recCount += item.count;
      else imageCount += item.count;
    }

    // Fallback if not populated
    if (okCount === 0 && detCount === 0 && recCount === 0) {
      okCount = run.successful_samples || 0;
      const fails = run.failed_samples || 0;
      recCount = fails;
    }

    return [
      {
        stage: "No Failure / Passed",
        count: okCount,
        percentage: (okCount / total) * 100,
        color: "green",
        desc: "Passed all detection and recognition validation checks.",
      },
      {
        stage: "Detection Stage Failure",
        count: detCount,
        percentage: (detCount / total) * 100,
        color: "volcano",
        desc: "Failed at the object detection / bounding box proposal step.",
      },
      {
        stage: "Recognition Stage Failure",
        count: recCount,
        percentage: (recCount / total) * 100,
        color: "orange",
        desc: "Bounding box detected, but OCR text failed to match ground truth.",
      },
      {
        stage: "Pre-OCR / Image Quality",
        count: imageCount,
        percentage: (imageCount / total) * 100,
        color: "purple",
        desc: "Image failed decode, dimensions, or initial quality validation.",
      },
    ];
  }, [run, totalSamples, failureTypeStats]);

  const copyMetricsJson = () => {
    if (!run) return;
    const payload = {
      run_id: run.id,
      dataset: run.dataset_name,
      model_ref: run.model_ref,
      total_samples: totalSamples,
      processed_samples: processedSamples,
      successful_samples: run.successful_samples,
      failed_samples: run.failed_samples,
      metrics: { ...(run.metrics || {}), ...apiMetricsMap },
      failure_types: failureTypeStats.map((f) => ({
        type: f.rawKey,
        count: f.count,
        percentage: Number(f.percentage.toFixed(2)),
      })),
    };
    void navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    message.success("Metrics copied to clipboard as JSON");
  };

  if (!run) return null;

  const exactMatchRate = run.metrics?.exact_match_accuracy ?? apiMetricsMap.exact_match_accuracy ?? 0;
  const detSuccessRate = run.metrics?.detection_success_rate ?? apiMetricsMap.detection_success_rate ?? 0;
  const recSuccessRate = run.metrics?.recognition_success_rate ?? apiMetricsMap.recognition_success_rate ?? 0;
  const e2eSuccessRate = run.metrics?.end_to_end_success_rate ?? apiMetricsMap.end_to_end_success_rate ?? exactMatchRate;
  const p50Latency = run.metrics?.latency_p50_ms ?? apiMetricsMap.latency_p50_ms ?? null;
  const p95Latency = run.metrics?.latency_p95_ms ?? apiMetricsMap.latency_p95_ms ?? null;

  const failureColumns: ColumnsType<(typeof failureTypeStats)[number]> = [
    {
      title: "Failure Type",
      key: "name",
      width: 220,
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <Space size={6}>
            <Tag
              color={r.key === "OK" ? "green" : r.percentage > 10 ? "red" : "orange"}
              className="font-semibold"
            >
              {r.name}
            </Tag>
          </Space>
          <span className="font-mono text-[11px] text-slate-400">{r.rawKey}</span>
        </Space>
      ),
    },
    {
      title: "Stage",
      dataIndex: "stage",
      width: 140,
      render: (stage: string, r) => <Tag color={r.stageColor}>{stage}</Tag>,
    },
    {
      title: "Count",
      dataIndex: "count",
      width: 130,
      sorter: (a, b) => a.count - b.count,
      defaultSortOrder: "descend",
      render: (v: number) => (
        <div>
          <span className="font-bold text-slate-800 text-sm">{v.toLocaleString()}</span>{" "}
          <span className="text-xs text-slate-500">samples</span>
        </div>
      ),
    },
    {
      title: "Percentage",
      dataIndex: "percentage",
      width: 200,
      sorter: (a, b) => a.percentage - b.percentage,
      render: (pct: number, r) => (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800">{pct.toFixed(2)}%</span>
            <span className="text-slate-400">
              {r.count}/{totalSamples}
            </span>
          </div>
          <Progress
            percent={pct}
            showInfo={false}
            size="small"
            strokeColor={
              r.key === "OK" ? "#0f766e" : pct > 10 ? "#ef4444" : "#f59e0b"
            }
          />
        </div>
      ),
    },
    {
      title: "Taxonomy Description",
      dataIndex: "description",
      render: (desc: string) => <span className="text-xs text-slate-600">{desc}</span>,
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={1000}
      centered
      destroyOnHidden
      title={
        <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
          <Space align="center" size={8}>
            <DashboardOutlined className="text-teal-700 text-lg" />
            <span className="font-semibold text-slate-900 text-base">
              Evaluation Metrics & Failure Analysis
            </span>
          </Space>
          <Space size={6}>
            <Tag color="cyan">Model: {run.model_ref || "Default"}</Tag>
            <StatusTag status={run.status} />
          </Space>
        </div>
      }
      footer={
        <div className="flex items-center justify-between">
          <Button icon={<CopyOutlined />} onClick={copyMetricsJson} size="middle">
            Copy JSON
          </Button>
          <Space>
            {onViewResults && (
              <Button
                type="primary"
                icon={<EyeOutlined />}
                onClick={() => {
                  onClose();
                  onViewResults(run);
                }}
                className="bg-teal-700 hover:bg-teal-800 text-white"
              >
                View Sample Results
              </Button>
            )}
            <Button onClick={onClose}>Close</Button>
          </Space>
        </div>
      }
    >
      <div className="space-y-5 py-2">
        {/* Meta Header */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 text-xs text-slate-600">
          <Row gutter={[16, 8]}>
            <Col xs={24} sm={12} md={6}>
              <span className="text-slate-400 block">Dataset</span>
              <span className="font-semibold text-slate-800">
                {run.dataset_name || run.dataset_id}
                {run.dataset_version ? ` v${run.dataset_version}` : ""}
              </span>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <span className="text-slate-400 block">Evaluation ID</span>
              <span className="font-mono text-slate-800">{run.id.slice(0, 14)}…</span>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <span className="text-slate-400 block">Type & Evaluator</span>
              <span className="text-slate-800">
                {run.evaluation_type} · {run.evaluator_version || "v1"}
              </span>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <span className="text-slate-400 block">Run Date</span>
              <span className="text-slate-800">
                {run.created_at ? dayjs(run.created_at).format("YYYY-MM-DD HH:mm") : "—"}
              </span>
            </Col>
          </Row>
        </div>

        {/* 6 Top Key KPI Cards */}
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={8} lg={4}>
            <Card size="small" className="border-slate-200 text-center shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 block">
                Total Samples
              </span>
              <div className="mt-1 text-lg font-bold text-slate-800">
                {totalSamples.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400">
                {processedSamples} processed
              </div>
            </Card>
          </Col>

          <Col xs={12} sm={8} lg={4}>
            <Card
              size="small"
              className="border-emerald-200 bg-emerald-50/30 text-center shadow-2xs"
            >
              <span className="text-[11px] font-medium text-emerald-800 block">
                Exact Match (Acc)
              </span>
              <div className="mt-1 text-lg font-bold text-emerald-700">
                {(exactMatchRate * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] font-medium text-emerald-800">
                {Math.round(exactMatchRate * totalSamples)} / {totalSamples}
              </div>
            </Card>
          </Col>

          <Col xs={12} sm={8} lg={4}>
            <Card size="small" className="border-slate-200 text-center shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 block">
                Detection Success
              </span>
              <div className="mt-1 text-lg font-bold text-teal-700">
                {(detSuccessRate * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-500">
                {Math.round(detSuccessRate * totalSamples)} / {totalSamples}
              </div>
            </Card>
          </Col>

          <Col xs={12} sm={8} lg={4}>
            <Card size="small" className="border-slate-200 text-center shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 block">
                Recognition Success
              </span>
              <div className="mt-1 text-lg font-bold text-teal-700">
                {(recSuccessRate * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-500">
                {Math.round(recSuccessRate * totalSamples)} / {totalSamples}
              </div>
            </Card>
          </Col>

          <Col xs={12} sm={8} lg={4}>
            <Card size="small" className="border-slate-200 text-center shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 block">
                E2E Success Rate
              </span>
              <div className="mt-1 text-lg font-bold text-indigo-600">
                {(e2eSuccessRate * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-500">
                {Math.round(e2eSuccessRate * totalSamples)} / {totalSamples}
              </div>
            </Card>
          </Col>

          <Col xs={12} sm={8} lg={4}>
            <Card size="small" className="border-slate-200 text-center shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 block">
                Latency (p50 / p95)
              </span>
              <div className="mt-1 text-base font-bold text-slate-800">
                {formatMs(p50Latency)}
              </div>
              <div className="text-[11px] text-slate-500">
                p95: {formatMs(p95Latency)}
              </div>
            </Card>
          </Col>
        </Row>

        {/* Tab Navigation for All Metrics and Failure Types */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          type="line"
          items={[
            {
              key: "failures",
              label: (
                <Space size={6}>
                  <ExclamationCircleOutlined />
                  <span>Failure Types ({failureTypeStats.length})</span>
                </Space>
              ),
              children: (
                <div className="space-y-4">
                  {/* Visual Segmented Progress Bar */}
                  <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">
                        Failure Distribution ({totalSamples} samples)
                      </span>
                      <span>
                        Clean Passes:{" "}
                        <strong>
                          {failureTypeStats.find((f) => f.key === "OK")?.count ?? 0}
                        </strong>{" "}
                        (
                        {failureTypeStats
                          .find((f) => f.key === "OK")
                          ?.percentage.toFixed(1) ?? 0}
                        %)
                      </span>
                    </div>

                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                      {failureTypeStats.map((f) => (
                        <Tooltip
                          key={f.key}
                          title={`${f.name}: ${f.count} (${f.percentage.toFixed(1)}%)`}
                        >
                          <div
                            style={{
                              width: `${Math.max(f.percentage, 0.5)}%`,
                              backgroundColor:
                                f.key === "OK"
                                  ? "#0f766e"
                                  : f.stageColor === "volcano"
                                    ? "#f97316"
                                    : f.stageColor === "orange"
                                      ? "#f59e0b"
                                      : f.stageColor === "red"
                                        ? "#ef4444"
                                        : "#8b5cf6",
                            }}
                            className="h-full transition-all"
                          />
                        </Tooltip>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px]">
                      {failureTypeStats.map((f) => (
                        <div key={f.key} className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor:
                                f.key === "OK"
                                  ? "#0f766e"
                                  : f.stageColor === "volcano"
                                    ? "#f97316"
                                    : f.stageColor === "orange"
                                      ? "#f59e0b"
                                      : f.stageColor === "red"
                                        ? "#ef4444"
                                        : "#8b5cf6",
                            }}
                          />
                          <span className="text-slate-600">{f.name}:</span>
                          <span className="font-semibold text-slate-800">
                            {f.count} ({f.percentage.toFixed(1)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Failure Types Table */}
                  <Table
                    rowKey="key"
                    columns={failureColumns}
                    dataSource={failureTypeStats}
                    pagination={false}
                    size="small"
                    className="border border-slate-200/80 rounded-xl bg-white overflow-hidden"
                    loading={slicesQuery.isLoading || resultsQuery.isLoading}
                    locale={{ emptyText: "No failure type metrics recorded for this run." }}
                  />
                </div>
              ),
            },
            {
              key: "all_metrics",
              label: (
                <Space size={6}>
                  <BarChartOutlined />
                  <span>All Small Metrics ({smallMetrics.length})</span>
                </Space>
              ),
              children: (
                <div className="space-y-4">
                  <Row gutter={[16, 16]}>
                    {/* Detection Metrics Box */}
                    <Col xs={24} md={12}>
                      <Card
                        title={
                          <Space size={6}>
                            <Tag color="volcano">Detection Stage</Tag>
                            <span className="text-sm font-semibold">Detection Metrics</span>
                          </Space>
                        }
                        size="small"
                        className="rounded-xl border border-slate-200/80 bg-white shadow-2xs"
                      >
                        <div className="divide-y divide-slate-100 text-xs">
                          {smallMetrics
                            .filter((m) => m.category === "detection")
                            .map((m) => (
                              <div
                                key={m.key}
                                className="flex items-center justify-between py-2.5"
                              >
                                <div>
                                  <div className="font-medium text-slate-800">
                                    {m.label}
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    {m.key}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-slate-900">
                                    {(m.count ?? 0).toLocaleString()} / {m.total.toLocaleString()}
                                  </div>
                                  <div className="font-semibold text-teal-700">
                                    {m.percentage !== null ? `${m.percentage}%` : "0.0%"}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </Card>
                    </Col>

                    {/* Recognition Metrics Box */}
                    <Col xs={24} md={12}>
                      <Card
                        title={
                          <Space size={6}>
                            <Tag color="orange">Recognition & E2E</Tag>
                            <span className="text-sm font-semibold">
                              Recognition Metrics
                            </span>
                          </Space>
                        }
                        size="small"
                        className="rounded-xl border border-slate-200/80 bg-white shadow-2xs"
                      >
                        <div className="divide-y divide-slate-100 text-xs">
                          {smallMetrics
                            .filter(
                              (m) =>
                                m.category === "recognition" || m.category === "overall",
                            )
                            .map((m) => (
                              <div
                                key={m.key}
                                className="flex items-center justify-between py-2.5"
                              >
                                <div>
                                  <div className="font-medium text-slate-800">
                                    {m.label}
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    {m.key}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-slate-900">
                                    {(m.count ?? 0).toLocaleString()} / {m.total.toLocaleString()}
                                  </div>
                                  <div className="font-semibold text-teal-700">
                                    {m.percentage !== null ? `${m.percentage}%` : "0.0%"}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </Card>
                    </Col>

                    {/* Detection Diagnostics Flags */}
                    <Col xs={24}>
                      <Card
                        title={
                          <Space size={6}>
                            <Tag color="cyan">Diagnostics & Quality Flags</Tag>
                            <span className="text-sm font-semibold">
                              Quality Flags & Geometry Invariance
                            </span>
                          </Space>
                        }
                        size="small"
                        className="rounded-xl border border-slate-200/80 bg-white shadow-2xs"
                      >
                        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-xs">
                          {smallMetrics
                            .filter((m) => m.category === "diagnostic")
                            .map((m) => (
                              <div
                                key={m.key}
                                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-2.5"
                              >
                                <div>
                                  <div className="font-medium text-slate-800">
                                    {m.label}
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    {m.key}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-slate-800">
                                    {(m.count ?? 0).toLocaleString()} / {m.total.toLocaleString()}
                                  </div>
                                  <div className="font-semibold text-teal-700">
                                    {m.percentage !== null ? `${m.percentage}%` : "0.0%"}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </Card>
                    </Col>
                  </Row>
                </div>
              ),
            },
            {
              key: "stages",
              label: (
                <Space size={6}>
                  <ThunderboltOutlined />
                  <span>Fail Stages Breakdown</span>
                </Space>
              ),
              children: (
                <div className="space-y-4">
                  <Row gutter={[12, 12]}>
                    {stageStats.map((st) => (
                      <Col xs={24} sm={12} key={st.stage}>
                        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-2">
                          <div className="flex items-center justify-between">
                            <Tag color={st.color} className="font-semibold text-xs">
                              {st.stage}
                            </Tag>
                            <span className="text-xs text-slate-400">
                              {st.count} / {totalSamples}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-bold text-slate-800">
                              {st.count.toLocaleString()}
                            </span>
                            <span className="text-lg font-bold text-teal-700">
                              {st.percentage.toFixed(1)}%
                            </span>
                          </div>
                          <Progress
                            percent={st.percentage}
                            showInfo={false}
                            size="small"
                            strokeColor={
                              st.color === "green"
                                ? "#0f766e"
                                : st.color === "volcano"
                                  ? "#f97316"
                                  : st.color === "orange"
                                    ? "#f59e0b"
                                    : "#8b5cf6"
                            }
                          />
                          <p className="text-[11px] text-slate-500 !mb-0">{st.desc}</p>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </div>
              ),
            },
            {
              key: "raw_metrics",
              label: (
                <Space size={6}>
                  <InfoCircleOutlined />
                  <span>Raw Metrics Records</span>
                </Space>
              ),
              children: (
                <div>
                  <Table
                    rowKey={(r) => `${r.metric_group}-${r.metric_name}`}
                    dataSource={metricsQuery.data?.metrics ?? []}
                    loading={metricsQuery.isLoading}
                    pagination={{ pageSize: 10 }}
                    size="small"
                    className="border border-slate-200/80 rounded-xl bg-white overflow-hidden"
                    columns={[
                      {
                        title: "Group",
                        dataIndex: "metric_group",
                        width: 120,
                        render: (g: string) => <Tag color="blue">{g}</Tag>,
                      },
                      {
                        title: "Metric Name",
                        dataIndex: "metric_name",
                        render: (n: string) => (
                          <span className="font-mono text-xs font-semibold">{n}</span>
                        ),
                      },
                      {
                        title: "Value",
                        dataIndex: "metric_value",
                        width: 140,
                        render: (v: number, r) => (
                          <span className="font-bold text-slate-900">
                            {r.metric_unit === "ratio"
                              ? `${(v * 100).toFixed(2)}%`
                              : r.metric_unit === "ms"
                                ? `${v.toFixed(1)} ms`
                                : v}
                          </span>
                        ),
                      },
                      {
                        title: "Sample Count",
                        dataIndex: "sample_count",
                        width: 120,
                        render: (v: number) => `${v ?? totalSamples} samples`,
                      },
                      {
                        title: "Unit",
                        dataIndex: "metric_unit",
                        width: 90,
                        render: (u: string) => <Tag>{u || "—"}</Tag>,
                      },
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
      </div>
    </Modal>
  );
}
