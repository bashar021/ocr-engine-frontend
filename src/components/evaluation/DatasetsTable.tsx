import { EyeOutlined } from "@ant-design/icons";
import { Button, Progress, Space, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";

import { StatusTag } from "@/components/common/StatusTag";
import type { EvaluationDataset } from "@/types/evaluation";
import { getDatasetDeleteAvailability } from "@/utils/datasetDeleteAvailability";
import { truncateDigest } from "@/utils/format";

const ORIGIN_LABEL: Record<string, { label: string; color: string }> = {
  upload: { label: "Uploaded", color: "blue" },
  curated_hard_case: { label: "System curated", color: "purple" },
  merged_training: { label: "Merged training", color: "geekblue" },
  system: { label: "System", color: "cyan" },
  databank_reviewed: { label: "Databank reviewed", color: "green" },
  databank_blurry: { label: "Databank blurry", color: "orange" },
  databank_dead: { label: "Databank dead", color: "red" },
  databank_category: { label: "Databank category", color: "gold" },
  recognition_crops: { label: "Recognition crops", color: "magenta" },
};

function originTag(
  origin: string | null | undefined,
  metadata: Record<string, unknown> | null,
) {
  const raw =
    origin ||
    (typeof metadata?.origin === "string" ? metadata.origin : null) ||
    (metadata?.purpose === "training_hard_cases"
      ? "curated_hard_case"
      : "upload");
  const cfg = ORIGIN_LABEL[raw] ?? { label: String(raw), color: "default" };
  return <Tag color={cfg.color}>{cfg.label}</Tag>;
}

interface DatasetsTableProps {
  data: EvaluationDataset[];
  loading?: boolean;
  /** True while a soft/hard delete API request is in flight */
  deletePending?: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  onViewSamples: (dataset: EvaluationDataset) => void;
  onSoftDelete: (dataset: EvaluationDataset) => void;
  onHardDelete: (dataset: EvaluationDataset) => void;
}

export function DatasetsTable({
  data,
  loading,
  deletePending = false,
  total,
  page,
  pageSize,
  onPageChange,
  onViewSamples,
  onSoftDelete,
  onHardDelete,
}: DatasetsTableProps) {
  const columns: ColumnsType<EvaluationDataset> = [
    {
      title: "Name",
      dataIndex: "name",
      fixed: "left",
      width: 180,
      render: (name: string, row) => (
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-xs text-slate-500">v{row.version}</div>
        </div>
      ),
    },
    {
      title: "Origin",
      key: "origin",
      width: 140,
      render: (_, row) => originTag(row.origin, row.metadata),
    },
    {
      title: "Lineage",
      key: "lineage",
      width: 200,
      render: (_, row) => {
        const parents = row.merged_from;
        const label =
          (typeof row.metadata?.merged_parent_labels === "string"
            ? row.metadata.merged_parent_labels
            : null) ||
          (parents?.length
            ? parents.map((p) => `${p.name}@${p.version}`).join(" + ")
            : null);
        if (!label) return "—";
        return (
          <Tooltip title={label}>
            <span className="text-xs">Merge of {label}</span>
          </Tooltip>
        );
      },
    },
    { title: "OCR type", dataIndex: "ocr_type", width: 110 },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (status: string) => <StatusTag status={status} />,
    },
    {
      title: "Samples",
      dataIndex: "sample_count",
      width: 90,
    },
    {
      title: "Progress",
      key: "progress",
      width: 140,
      render: (_, row) =>
        row.status === "uploading" || row.status === "processing" ? (
          <Progress
            percent={row.status === "processing" ? 60 : 30}
            size="small"
            status="active"
          />
        ) : (
          "—"
        ),
    },
    {
      title: "Source file",
      dataIndex: "source_reference",
      width: 140,
      render: (v: string | null) => v || "—",
    },
    {
      title: "Manifest",
      dataIndex: "manifest_digest",
      width: 130,
      render: (digest: string | null) =>
        digest ? (
          <Tooltip title={digest}>
            <span className="font-mono text-xs">{truncateDigest(digest)}</span>
          </Tooltip>
        ) : (
          "—"
        ),
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
      width: 250,
      render: (_, row) => {
        const del = getDatasetDeleteAvailability(row, {
          mutating: deletePending,
        });
        const softBtn = (
          <Button
            size="small"
            disabled={!del.canSoftDelete}
            onClick={() => {
              if (!del.canSoftDelete) return;
              onSoftDelete(row);
            }}
          >
            Archive
          </Button>
        );
        const hardBtn = (
          <Button
            size="small"
            danger
            disabled={!del.canHardDelete}
            onClick={() => {
              if (!del.canHardDelete) return;
              onHardDelete(row);
            }}
          >
            Delete
          </Button>
        );
        return (
          <Space size="small" wrap>
            <Button
              size="small"
              type="primary"
              ghost
              icon={<EyeOutlined />}
              onClick={() => onViewSamples(row)}
            >
              Samples
            </Button>
            {del.canSoftDelete ? (
              softBtn
            ) : (
              <Tooltip title={del.softReason ?? "Archive unavailable"}>
                <span>{softBtn}</span>
              </Tooltip>
            )}
            {del.canHardDelete ? (
              hardBtn
            ) : (
              <Tooltip title={del.hardReason ?? "Delete permanently unavailable"}>
                <span>{hardBtn}</span>
              </Tooltip>
            )}
          </Space>
        );
      },
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
      scroll={{ x: 1600 }}
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
