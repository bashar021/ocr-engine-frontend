import { useMemo, useState } from "react";
import {
  App,
  Alert,
  Button,
  Dropdown,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { MenuProps } from "antd";
import {
  DeleteOutlined,
  ExperimentOutlined,
  ExportOutlined,
  MoreOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";

import { getApiErrorMessage } from "@/api/client";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTableToolbar } from "@/components/common/DataTableToolbar";
import { SearchInput } from "@/components/common/SearchInput";
import { CapabilityAlert } from "@/components/bill/dataset/DatasetContextBar";
import { BillZipUploadModal } from "@/components/bill/dataset/BillZipUploadModal";
import { StartEvaluationModal } from "@/components/evaluation/StartEvaluationModal";
import { useBillDatasetContext } from "@/features/bill/dataset/context";
import {
  useBillDatasetMutations,
  useBillDatasetsQuery,
} from "@/features/bill/dataset/hooks";
import { useDebounce } from "@/hooks/useDebounce";
import type { EvaluationDataset } from "@/types/evaluation";
import { getDatasetDeleteAvailability } from "@/utils/datasetDeleteAvailability";
import { BILL_DATASET_GAPS } from "@/features/bill/dataset/capabilities";

export function BillDatasetsPage() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { setDatasetId, setVersion } = useBillDatasetContext();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [evalDataset, setEvalDataset] = useState<EvaluationDataset | null>(
    null,
  );
  const debounced = useDebounce(search, 300);
  const mutations = useBillDatasetMutations();

  const query = useBillDatasetsQuery({
    scope: "evaluation",
    search: debounced || undefined,
    status,
    include_archived: status === "archived",
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const rows = query.data?.datasets ?? [];

  const openDataset = (d: EvaluationDataset) => {
    setDatasetId(d.id);
    setVersion(d.version);
    navigate(`/bill/data?datasetId=${encodeURIComponent(d.id)}`);
  };

  const confirmArchive = (d: EvaluationDataset) => {
    const del = getDatasetDeleteAvailability(d, {
      mutating: mutations.archive.isPending,
    });
    if (!del.canSoftDelete) {
      message.warning(del.softReason || "Archive not allowed");
      return;
    }
    modal.confirm({
      title: `Archive ${d.name}?`,
      content: `${d.sample_count} documents. Soft-delete via backend archive API.`,
      okType: "danger",
      onOk: async () => {
        try {
          await mutations.archive.mutateAsync(d.id);
          message.success("Dataset archived");
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  const confirmHardDelete = (d: EvaluationDataset) => {
    const del = getDatasetDeleteAvailability(d, {
      mutating: mutations.hardDelete.isPending,
    });
    if (!del.canHardDelete) {
      message.warning(del.hardReason || "Hard delete not allowed");
      return;
    }
    modal.confirm({
      title: `Permanently delete ${d.name}?`,
      content: "This cannot be undone.",
      okType: "danger",
      onOk: async () => {
        try {
          await mutations.hardDelete.mutateAsync(d.id);
          message.success("Dataset deleted");
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  const exportFeedback = async () => {
    try {
      const res = await mutations.exportFeedback.mutateAsync();
      message.success(
        `Feedback export: ${res.count ?? 0} records${res.path ? ` → ${res.path}` : ""}`,
      );
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const columns = useMemo(
    () => [
      {
        title: "Dataset",
        dataIndex: "name",
        render: (name: string, row: EvaluationDataset) => (
          <div>
            <Button
              type="link"
              className="!px-0"
              onClick={() => openDataset(row)}
            >
              {name}
            </Button>
            <div className="font-mono text-xs text-slate-400">{row.id}</div>
          </div>
        ),
      },
      {
        title: "Version",
        dataIndex: "version",
        width: 90,
        render: (v: string) => `v${v}`,
      },
      {
        title: "Documents",
        dataIndex: "sample_count",
        width: 100,
        render: (n: number) => (
          <span className="tabular-nums">{n.toLocaleString()}</span>
        ),
      },
      {
        title: "Labeled",
        key: "labeled",
        width: 80,
        render: (_: unknown, row: EvaluationDataset) => {
          const n = (row as EvaluationDataset & { labeled_count?: number })
            .labeled_count;
          return n != null ? (
            <span className="tabular-nums">{n}</span>
          ) : (
            "—"
          );
        },
      },
      {
        title: "Partial",
        key: "partial",
        width: 80,
        render: (_: unknown, row: EvaluationDataset) => {
          const n = (row as EvaluationDataset & { partial_count?: number })
            .partial_count;
          return n != null ? (
            <span className="tabular-nums">{n}</span>
          ) : (
            "—"
          );
        },
      },
      {
        title: "Unlabeled",
        key: "unlabeled",
        width: 90,
        render: (_: unknown, row: EvaluationDataset) => {
          const n = (row as EvaluationDataset & { unlabeled_count?: number })
            .unlabeled_count;
          return n != null ? (
            <span className="tabular-nums">{n}</span>
          ) : (
            "—"
          );
        },
      },
      {
        title: "Splits",
        key: "splits",
        width: 140,
        render: (_: unknown, row: EvaluationDataset) => {
          const s = row.split_counts;
          if (!s) return "—";
          return (
            <Typography.Text className="text-xs tabular-nums">
              T{s.train ?? 0}/V{s.val ?? 0}/E{s.test ?? 0}
            </Typography.Text>
          );
        },
      },
      {
        title: "Status",
        dataIndex: "status",
        width: 110,
        render: (s: string) => <Tag>{s}</Tag>,
      },
      {
        title: "Eval",
        key: "eval",
        width: 90,
        render: (_: unknown, row: EvaluationDataset) =>
          row.has_active_evaluation ? (
            <Tag color="processing">Running</Tag>
          ) : row.evaluation_eligible === false ? (
            <Tag>Ineligible</Tag>
          ) : (
            <Tag color="green">Eligible</Tag>
          ),
      },
      {
        title: "Created",
        dataIndex: "created_at",
        width: 120,
        render: (v: string | null) => (v ? dayjs(v).format("YYYY-MM-DD") : "—"),
      },
      {
        title: "",
        key: "actions",
        width: 56,
        render: (_: unknown, row: EvaluationDataset) => {
          const items: MenuProps["items"] = [
            {
              key: "open",
              label: "Open data list",
              onClick: () => openDataset(row),
            },
            {
              key: "annotate",
              label: "Annotations",
              onClick: () => {
                setDatasetId(row.id);
                setVersion(row.version);
                navigate(
                  `/bill/annotations?datasetId=${encodeURIComponent(row.id)}`,
                );
              },
            },
            {
              key: "eval",
              label: "Run evaluation",
              icon: <ExperimentOutlined />,
              onClick: () => setEvalDataset(row),
            },
            { type: "divider" },
            {
              key: "archive",
              label: "Archive",
              danger: true,
              onClick: () => confirmArchive(row),
            },
            {
              key: "delete",
              label: "Hard delete",
              icon: <DeleteOutlined />,
              danger: true,
              onClick: () => confirmHardDelete(row),
            },
          ];
          return (
            <Dropdown menu={{ items }} trigger={["click"]}>
              <Button
                size="small"
                icon={<MoreOutlined />}
                aria-label="Actions"
              />
            </Dropdown>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        breadcrumbs={[
          { title: "Bill OCR", path: "/bill/documents" },
          { title: "Datasets" },
        ]}
        title="Datasets"
        description="Server evaluation datasets with ocr_type=bill. Counts come from the backend — not fabricated."
        actions={
          <Space>
            <Button
              icon={<ExportOutlined />}
              loading={mutations.exportFeedback.isPending}
              onClick={() => void exportFeedback()}
            >
              Export feedback
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setUploadOpen(true)}
            >
              Upload Bill ZIP
            </Button>
          </Space>
        }
      />
      <CapabilityAlert
        type="info"
        title="Bill OCR package import"
        detail="Use Upload Bill ZIP for manifest.jsonl + documents/ + annotations/. Unlabeled documents without annotation files are supported. Odometer filename-GT ZIPs belong under the shared Datasets nav, not here."
      />
      <div className="px-4 pb-4">
        <DataTableToolbar
          left={
            <>
              <SearchInput
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                placeholder="Search datasets"
              />
              <select
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                value={status ?? ""}
                onChange={(e) => {
                  setStatus(e.target.value || undefined);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {[
                  "uploading",
                  "processing",
                  "ready",
                  "failed",
                  "archived",
                  "consumed",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </>
          }
        />

        {query.isError ? (
          <Alert
            type="error"
            showIcon
            className="mb-3"
            message={getApiErrorMessage(query.error)}
            action={
              <Button size="small" onClick={() => void query.refetch()}>
                Retry
              </Button>
            }
          />
        ) : null}

        <Table
          size="small"
          rowKey="id"
          loading={query.isLoading}
          dataSource={rows}
          columns={columns}
          pagination={{
            current: page,
            pageSize,
            total: query.data?.total ?? 0,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          locale={{
            emptyText: "No bill datasets yet. Upload a ZIP or create via API.",
          }}
          sticky
        />

        <Typography.Paragraph type="secondary" className="!mt-3 !mb-0 text-xs">
          Unavailable backend capabilities ({BILL_DATASET_GAPS.length}):{" "}
          {BILL_DATASET_GAPS.slice(0, 3).join("; ")}…
          <Link to="/bill/issues"> See Issues tab</Link>
        </Typography.Paragraph>
      </div>

      <BillZipUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onImported={(d) => {
          setDatasetId(d.id);
          setVersion(d.version);
          setUploadOpen(false);
          navigate(`/bill/data?datasetId=${encodeURIComponent(d.id)}`);
        }}
      />
      <StartEvaluationModal
        open={Boolean(evalDataset)}
        dataset={evalDataset}
        onClose={() => setEvalDataset(null)}
      />
    </div>
  );
}
