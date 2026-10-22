import {
  BarChartOutlined,
  CopyOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Alert,
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

import { StatusTag } from "@/components/common/StatusTag";
import type { PipelineRef } from "@/types/models";
import { formatMs } from "@/utils/format";

interface ModelRefMetricsModalProps {
  refItem: PipelineRef | null;
  open: boolean;
  onClose: () => void;
}

interface MetricDisplayItem {
  key: string;
  label: string;
  count: number;
  total: number;
  percentage: number;
  category: "detection" | "recognition" | "diagnostic" | "overall";
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

const FAILURE_TYPE_DESCRIPTIONS: Record<string, string> = {
  OK: "Detection usable and recognition matches ground truth.",
  MISMATCH: "Recognition produced a value that does not match ground truth.",
  DETECTION_FAILURE: "No usable prediction for the expected odometer cluster.",
  WRONG_DETECTION: "Proposed candidate box matched incorrect region in image.",
  PARTIAL_DETECTION: "Proposed bounding box clipped or missed part of the odometer dial.",
  MULTIPLE_DETECTIONS: "Multiple competing candidates produced ambiguous resolution.",
  DUPLICATE_DETECTION: "Redundant high-overlap predictions for the same cluster.",
  RECOGNITION_FAILURE: "OCR text engine produced unreadable string or failed decoding.",
  INVALID_IMAGE: "Image failed decode, dimensions, or basic quality validation.",
};

export function ModelRefMetricsModal({
  refItem,
  open,
  onClose,
}: ModelRefMetricsModalProps) {
  const [activeTab, setActiveTab] = useState<string>("failures");

  const em = refItem?.evaluation_metrics;
  const totalSamples =
    em?.total_samples || em?.total_images_evaluated || em?.processed_samples || 0;
  const successfulSamples = em?.successful_samples ?? 0;
  const failedSamples = em?.failed_samples ?? Math.max(0, totalSamples - successfulSamples);

  // Extract flat metrics dictionary
  const metricsMap = useMemo<Record<string, number>>(() => {
    if (!em) return {};
    const flat: Record<string, number> = {};

    // 1. Direct metrics dict
    if (em.metrics) {
      Object.assign(flat, em.metrics);
    }

    // 2. Fallback to latest_metrics nested or top-level properties
    if (em.latest_metrics) {
      const lm = em.latest_metrics as Record<string, unknown>;
      if (lm.metrics && typeof lm.metrics === "object") {
        Object.assign(flat, lm.metrics as Record<string, number>);
      }
      for (const [k, v] of Object.entries(lm)) {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          for (const [subK, subV] of Object.entries(v as Record<string, unknown>)) {
            if (typeof subV === "number") {
              flat[subK] = subV;
            }
          }
        } else if (typeof v === "number") {
          flat[k] = v;
        }
      }
    }

    // 3. Fallback to top-level rates on evaluation_metrics
    if (typeof em.detection_success_rate === "number") {
      flat.detection_success_rate = em.detection_success_rate;
    }
    if (typeof em.recognition_exact_match_accuracy === "number") {
      flat.exact_match_accuracy = em.recognition_exact_match_accuracy;
    }
    if (typeof em.end_to_end_accuracy === "number") {
      flat.end_to_end_accuracy = em.end_to_end_accuracy;
    }
    if (typeof em.end_to_end_success_rate === "number") {
      flat.end_to_end_success_rate = em.end_to_end_success_rate;
    }
    if (typeof em.latency_p50_ms === "number") {
      flat.latency_p50_ms = em.latency_p50_ms;
    }
    if (typeof em.latency_p95_ms === "number") {
      flat.latency_p95_ms = em.latency_p95_ms;
    }

    return flat;
  }, [em]);

  // Failure Types breakdown list
  const failureTypeStats = useMemo(() => {
    if (!em) return [];
    const total = totalSamples || 1;

    // A. Use backend provided failure_types array if present
    if (em.failure_types && em.failure_types.length > 0) {
      return em.failure_types.map((f) => {
        const stageInfo = FAILURE_TYPE_STAGES[f.key] || {
          label: f.stage || "General",
          color: f.stageColor || "default",
        };
        const desc =
          f.description ||
          FAILURE_TYPE_DESCRIPTIONS[f.key] ||
          "Evaluation outcome category.";
        return {
          key: f.key,
          name: f.name || f.key,
          rawKey: f.rawKey || f.key,
          count: f.count,
          percentage: Number(f.percentage.toFixed(2)),
          stage: stageInfo.label,
          stageColor: stageInfo.color,
          description: desc,
        };
      });
    }

    // B. Reconstruct from metrics map fallback
    const list = [];
    const okCount = successfulSamples;
    const okPct = Number(((okCount / total) * 100).toFixed(2));
    list.push({
      key: "OK",
      name: "OK / Clean Match",
      rawKey: "OK",
      count: okCount,
      percentage: okPct,
      stage: "Success / Passed",
      stageColor: "green",
      description: "Detection usable and recognition matches ground truth.",
    });

    const detFailRate = metricsMap.detection_failure_rate ?? 0;
    if (detFailRate > 0) {
      const cnt = Math.round(detFailRate * total);
      list.push({
        key: "DETECTION_FAILURE",
        name: "Detection Failure",
        rawKey: "DETECTION_FAILURE",
        count: cnt,
        percentage: Number((detFailRate * 100).toFixed(2)),
        stage: "Detection",
        stageColor: "volcano",
        description: "No usable prediction for the expected odometer cluster.",
      });
    }

    if (failedSamples > 0) {
      const remainingFails = Math.max(0, failedSamples - Math.round(detFailRate * total));
      if (remainingFails > 0) {
        list.push({
          key: "MISMATCH",
          name: "Mismatch",
          rawKey: "MISMATCH",
          count: remainingFails,
          percentage: Number(((remainingFails / total) * 100).toFixed(2)),
          stage: "Recognition",
          stageColor: "orange",
          description: "Recognition produced a value that does not match ground truth.",
        });
      }
    }

    return list;
  }, [em, totalSamples, successfulSamples, failedSamples, metricsMap]);

  // Small Metrics list with BOTH Count and Percentage
  const smallMetrics = useMemo(() => {
    if (!refItem || !em) return [];
    const total = totalSamples || 1;

    const getRatioMetric = (
      name: string,
      label: string,
      category: MetricDisplayItem["category"],
      description?: string,
      customCount?: number,
    ): MetricDisplayItem => {
      const val = metricsMap[name];
      if (typeof val === "number") {
        const count = customCount !== undefined ? customCount : Math.round(val * total);
        const percentage = Number((val * 100).toFixed(2));
        return { key: name, label, count, total, percentage, category, description };
      }
      return {
        key: name,
        label,
        count: customCount ?? 0,
        total,
        percentage: 0.0,
        category,
        description,
      };
    };

    const items: MetricDisplayItem[] = [
      // Accuracy & Primary Rates
      getRatioMetric(
        "exact_match_accuracy",
        "Exact Match Accuracy",
        "recognition",
        "Strict 100% character match against normalized ground truth.",
        successfulSamples,
      ),
      getRatioMetric(
        "end_to_end_accuracy",
        "End-to-End Accuracy",
        "overall",
        "Complete pipeline accuracy from raw full frame to final odometer value.",
        successfulSamples,
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
  }, [refItem, em, totalSamples, successfulSamples, metricsMap]);

  // Fail Stages breakdown
  const stageStats = useMemo(() => {
    if (!em) return [];
    const total = totalSamples || 1;

    if (em.fail_stages && em.fail_stages.length > 0) {
      return em.fail_stages;
    }

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

    if (okCount === 0 && detCount === 0 && recCount === 0) {
      okCount = successfulSamples;
      recCount = failedSamples;
    }

    return [
      {
        stage: "No Failure / Passed",
        count: okCount,
        percentage: Number(((okCount / total) * 100).toFixed(1)),
        color: "green",
        desc: "Passed all detection and recognition validation checks.",
      },
      {
        stage: "Detection Stage Failure",
        count: detCount,
        percentage: Number(((detCount / total) * 100).toFixed(1)),
        color: "volcano",
        desc: "Failed at the object detection / bounding box proposal step.",
      },
      {
        stage: "Recognition Stage Failure",
        count: recCount,
        percentage: Number(((recCount / total) * 100).toFixed(1)),
        color: "orange",
        desc: "Bounding box detected, but OCR text failed to match ground truth.",
      },
      {
        stage: "Pre-OCR / Image Quality",
        count: imageCount,
        percentage: Number(((imageCount / total) * 100).toFixed(1)),
        color: "purple",
        desc: "Image failed decode, dimensions, or initial quality validation.",
      },
    ];
  }, [em, totalSamples, successfulSamples, failedSamples, failureTypeStats]);

  const copyMetricsJson = () => {
    if (!refItem) return;
    const payload = {
      model_ref: refItem.model_ref,
      ocr_type: refItem.ocr_type,
      status: refItem.status,
      is_default: refItem.is_default,
      detection_artifact: refItem.detection,
      recognition_artifact: refItem.recognition,
      evaluation_metrics: refItem.evaluation_metrics,
      metrics: metricsMap,
      failure_types: failureTypeStats,
      fail_stages: stageStats,
      evaluated_datasets: em?.evaluated_datasets || [],
    };
    void navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    message.success("Model ref metrics copied to clipboard as JSON");
  };

  if (!refItem) return null;

  const exactMatchRate = metricsMap.exact_match_accuracy ?? metricsMap.end_to_end_accuracy ?? 0;
  const detSuccessRate = metricsMap.detection_success_rate ?? 0;
  const recSuccessRate = metricsMap.recognition_success_rate ?? 0;
  const e2eSuccessRate = metricsMap.end_to_end_success_rate ?? exactMatchRate;
  const p50Latency = metricsMap.latency_p50_ms ?? null;
  const p95Latency = metricsMap.latency_p95_ms ?? null;

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
              {r.count.toLocaleString()}/{totalSamples.toLocaleString()}
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
              Model Ref Metrics & Performance: {refItem.model_ref}
            </span>
          </Space>
          <Space size={6}>
            <Tag color="cyan">OCR: {refItem.ocr_type}</Tag>
            {refItem.is_default && <Tag color="teal">Default Serving Ref</Tag>}
            <StatusTag status={refItem.status} />
          </Space>
        </div>
      }
      footer={
        <div className="flex items-center justify-between">
          <Button icon={<CopyOutlined />} onClick={copyMetricsJson} size="middle">
            Copy JSON
          </Button>
          <Button type="primary" onClick={onClose} className="bg-teal-700 hover:bg-teal-800 text-white">
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-5 py-2">
        {/* Meta Header */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 text-xs text-slate-600">
          <Row gutter={[16, 8]}>
            <Col xs={24} sm={12} md={6}>
              <span className="text-slate-400 block">Detection Model</span>
              <span className="font-semibold text-slate-800">
                {refItem.detection?.name || "None"}
                {refItem.detection?.version ? ` v${refItem.detection.version}` : ""}
              </span>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <span className="text-slate-400 block">Recognition Model</span>
              <span className="font-semibold text-slate-800">
                {refItem.recognition?.name || "None"}
                {refItem.recognition?.version ? ` v${refItem.recognition.version}` : ""}
              </span>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <span className="text-slate-400 block">Evaluated Datasets</span>
              <span className="text-slate-800 font-semibold">
                {em?.total_datasets_evaluated ?? 0} dataset
                {(em?.total_datasets_evaluated ?? 0) === 1 ? "" : "s"} (No duplication)
              </span>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <span className="text-slate-400 block">Last Evaluated</span>
              <span className="text-slate-800">
                {em?.last_evaluated_at
                  ? dayjs(em.last_evaluated_at).format("YYYY-MM-DD HH:mm")
                  : "—"}
              </span>
            </Col>
          </Row>
        </div>

        {/* 6 Top Key KPI Cards */}
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={8} lg={4}>
            <Card size="small" className="border-slate-200 text-center shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 block">
                Total Unique Images
              </span>
              <div className="mt-1 text-lg font-bold text-slate-800">
                {totalSamples.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400">
                {em?.total_datasets_evaluated ?? 0} dataset(s)
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
                {Math.round(exactMatchRate * totalSamples).toLocaleString()} / {totalSamples.toLocaleString()}
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
                {Math.round(detSuccessRate * totalSamples).toLocaleString()} / {totalSamples.toLocaleString()}
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
                {Math.round(recSuccessRate * totalSamples).toLocaleString()} / {totalSamples.toLocaleString()}
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
                {Math.round(e2eSuccessRate * totalSamples).toLocaleString()} / {totalSamples.toLocaleString()}
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

        {/* Tab Navigation */}
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
                        Failure Distribution ({totalSamples.toLocaleString()} evaluated samples)
                      </span>
                      <span>
                        Clean Passes:{" "}
                        <strong>
                          {failureTypeStats.find((f) => f.key === "OK")?.count.toLocaleString() ?? 0}
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
                          title={`${f.name}: ${f.count.toLocaleString()} (${f.percentage.toFixed(1)}%)`}
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
                            {f.count.toLocaleString()} ({f.percentage.toFixed(1)}%)
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
                    locale={{ emptyText: "No failure type metrics recorded for this model ref." }}
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
                                    {m.count.toLocaleString()} / {m.total.toLocaleString()}
                                  </div>
                                  <div className="font-semibold text-teal-700">
                                    {m.percentage.toFixed(2)}%
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
                                    {m.count.toLocaleString()} / {m.total.toLocaleString()}
                                  </div>
                                  <div className="font-semibold text-teal-700">
                                    {m.percentage.toFixed(2)}%
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
                                    {m.count.toLocaleString()} / {m.total.toLocaleString()}
                                  </div>
                                  <div className="font-semibold text-teal-700">
                                    {m.percentage.toFixed(2)}%
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
              key: "datasets",
              label: (
                <Space size={6}>
                  <DatabaseOutlined />
                  <span>
                    Evaluated Datasets ({em?.evaluated_datasets?.length ?? em?.total_datasets_evaluated ?? 0})
                  </span>
                </Space>
              ),
              children: (
                <div className="space-y-4">
                  <Alert
                    type="info"
                    showIcon
                    message="Deduplicated Multi-Dataset Aggregation"
                    description="Metrics for this model ref are aggregated across the latest completed evaluations of each distinct dataset. When a dataset is re-evaluated, earlier runs for that dataset are superseded to ensure no duplicate image counts."
                  />
                  <Table
                    rowKey="dataset_id"
                    dataSource={em?.evaluated_datasets || []}
                    pagination={false}
                    size="small"
                    className="border border-slate-200/80 rounded-xl bg-white overflow-hidden"
                    locale={{
                      emptyText:
                        "No datasets currently recorded for this model reference.",
                    }}
                    columns={[
                      {
                        title: "Dataset Name",
                        dataIndex: "dataset_name",
                        render: (name: string, r) => (
                          <div>
                            <span className="font-semibold text-slate-800">{name}</span>
                            {r.dataset_version && (
                              <span className="text-slate-400 text-xs ml-1.5">
                                v{r.dataset_version}
                              </span>
                            )}
                          </div>
                        ),
                      },
                      {
                        title: "Samples Evaluated",
                        dataIndex: "sample_count",
                        width: 150,
                        render: (count: number) => (
                          <span className="font-bold text-slate-800">
                            {count?.toLocaleString() ?? 0} samples
                          </span>
                        ),
                      },
                      {
                        title: "Accuracy",
                        dataIndex: "accuracy",
                        width: 140,
                        render: (acc: number | undefined, r) => (
                          <div>
                            <span className="font-bold text-emerald-700">
                              {typeof acc === "number" ? `${acc.toFixed(1)}%` : "—"}
                            </span>
                            {r.successful_samples !== undefined && (
                              <div className="text-[11px] text-slate-400">
                                {r.successful_samples} / {r.sample_count}
                              </div>
                            )}
                          </div>
                        ),
                      },
                      {
                        title: "Latest Evaluation Run",
                        dataIndex: "evaluation_id",
                        width: 180,
                        render: (id: string) => (
                          <span className="font-mono text-xs text-slate-500">
                            {id ? `${id.slice(0, 12)}…` : "—"}
                          </span>
                        ),
                      },
                      {
                        title: "Completed At",
                        dataIndex: "completed_at",
                        width: 170,
                        render: (d: string) =>
                          d ? dayjs(d).format("YYYY-MM-DD HH:mm") : "—",
                      },
                    ]}
                  />
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
                              {st.count.toLocaleString()} / {totalSamples.toLocaleString()}
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
                    rowKey="key"
                    dataSource={Object.entries(metricsMap).map(([k, v]) => ({
                      key: k,
                      name: k,
                      value: v,
                    }))}
                    pagination={{ pageSize: 10 }}
                    size="small"
                    className="border border-slate-200/80 rounded-xl bg-white overflow-hidden"
                    columns={[
                      {
                        title: "Metric Name",
                        dataIndex: "name",
                        render: (n: string) => (
                          <span className="font-mono text-xs font-semibold">{n}</span>
                        ),
                      },
                      {
                        title: "Value",
                        dataIndex: "value",
                        width: 180,
                        render: (v: number, r) => (
                          <span className="font-bold text-slate-900">
                            {r.name.includes("latency")
                              ? `${v.toFixed(1)} ms`
                              : r.name.includes("rate") || r.name.includes("accuracy")
                                ? `${(v * 100).toFixed(2)}%`
                                : v}
                          </span>
                        ),
                      },
                      {
                        title: "Type",
                        key: "type",
                        width: 140,
                        render: (_, r) => (
                          <Tag>
                            {r.name.includes("latency")
                              ? "Milliseconds (ms)"
                              : "Ratio [0-1]"}
                          </Tag>
                        ),
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
