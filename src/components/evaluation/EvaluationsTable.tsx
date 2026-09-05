import { Button, Progress, Space, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";

import { StatusTag } from "@/components/common/StatusTag";
import type { EvaluationRun } from "@/types/evaluation";
import { formatMs, formatPercent } from "@/utils/format";

interface EvaluationsTableProps {
  data: EvaluationRun[];
  loading?: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  onViewResults: (run: EvaluationRun) => void;
  onCancel: (run: EvaluationRun) => void;
}

function metric(row: EvaluationRun, name: string): number | null {
  const value = row.metrics?.[name];
  return typeof value === "number" ? value : null;
}

export function EvaluationsTable({
  data,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  onViewResults,
  onCancel,
}: EvaluationsTableProps) {
  const columns: ColumnsType<EvaluationRun> = [
    {
      title: "Run",
      dataIndex: "id",
      width: 110,
      fixed: "left",
      render: (id: string) => (
        <span className="font-mono text-xs">{id.slice(0, 8)}…</span>
      ),
    },
    { title: "Model ref", dataIndex: "model_ref", width: 100 },
    {
      title: "Dataset",
      key: "dataset",
      width: 200,
      render: (_, row) => {
        if (row.dataset_name) {
          return (
            <span>
              {row.dataset_name}
              {row.dataset_version ? (
                <span className="text-slate-500"> v{row.dataset_version}</span>
              ) : null}
            </span>
          );
        }
        return (
          <span className="font-mono text-xs text-slate-500">
            {row.dataset_id.slice(0, 8)}…
          </span>
        );
      },
    },
    { title: "OCR type", dataIndex: "ocr_type", width: 110 },
    { title: "Type", dataIndex: "evaluation_type", width: 100 },
    {
      title: "Status",
      dataIndex: "status",
      width: 110,
      render: (status: string) => <StatusTag status={status} />,
    },
    {
      title: "Progress",
      key: "progress",
      width: 150,
      render: (_, row) => {
        const pct = row.total_samples
          ? Math.round((row.processed_samples / row.total_samples) * 100)
          : 0;
        if (row.status === "queued" || row.status === "running") {
          return (
            <div>
              <Progress percent={pct} size="small" status="active" />
              <div className="text-xs text-slate-500">
                {row.processed_samples}/{row.total_samples}
              </div>
            </div>
          );
        }
        return `${row.processed_samples}/${row.total_samples}`;
      },
    },
    {
      title: "Success / fail",
      key: "sf",
      width: 110,
      render: (_, row) => `${row.successful_samples} / ${row.failed_samples}`,
    },
    {
      title: "Det. success",
      key: "detection_success_rate",
      width: 110,
      render: (_, row) => formatPercent(metric(row, "detection_success_rate")),
    },
    {
      title: "Det. miss",
      key: "detection_miss_rate",
      width: 100,
      render: (_, row) => formatPercent(metric(row, "detection_miss_rate")),
    },
    {
      title: "Avg det. conf.",
      key: "avg_detection_confidence",
      width: 110,
      render: (_, row) =>
        formatPercent(metric(row, "avg_detection_confidence")),
    },
    {
      title: "Rec. success",
      key: "recognition_success_rate",
      width: 110,
      render: (_, row) =>
        formatPercent(metric(row, "recognition_success_rate")),
    },
    {
      title: "Exact match",
      key: "exact_match_accuracy",
      width: 110,
      render: (_, row) => formatPercent(metric(row, "exact_match_accuracy")),
    },
    {
      title: "E2E accuracy",
      key: "end_to_end_accuracy",
      width: 110,
      render: (_, row) => formatPercent(metric(row, "end_to_end_accuracy")),
    },
    {
      title: "E2E success",
      key: "end_to_end_success_rate",
      width: 110,
      render: (_, row) => formatPercent(metric(row, "end_to_end_success_rate")),
    },
    {
      title: "Low conf.",
      key: "low_confidence_rate",
      width: 100,
      render: (_, row) => formatPercent(metric(row, "low_confidence_rate")),
    },
    {
      title: "Latency p50",
      key: "latency_p50_ms",
      width: 100,
      render: (_, row) => formatMs(metric(row, "latency_p50_ms")),
    },
    {
      title: "Latency p95",
      key: "latency_p95_ms",
      width: 100,
      render: (_, row) => formatMs(metric(row, "latency_p95_ms")),
    },
    {
      title: "Created",
      dataIndex: "created_at",
      width: 150,
      render: (v: string | null) =>
        v ? dayjs(v).format("YYYY-MM-DD HH:mm") : "—",
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 180,
      render: (_, row) => (
        <Space size="small">
          <Button size="small" onClick={() => onViewResults(row)}>
            Results
          </Button>
          <Button
            size="small"
            danger
            disabled={row.status !== "queued" && row.status !== "running"}
            onClick={() => onCancel(row)}
          >
            Cancel
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Table
      rowKey="id"
      size="middle"
      className="rounded-lg border border-slate-200 bg-white"
      columns={columns}
      dataSource={data}
      loading={loading}
      scroll={{ x: 2300 }}
      pagination={{
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50],
        showTotal: (count, range) => `${range[0]}–${range[1]} of ${count}`,
        onChange: onPageChange,
      }}
    />
  );
}
