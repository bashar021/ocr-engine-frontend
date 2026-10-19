import { App, Button, Space, Typography, message } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Pagination, Spin, Tag, Tooltip } from "antd";
import dayjs from "dayjs";
import { useMemo } from "react";

import { StatusTag } from "@/components/common/StatusTag";
import { downloadArtifact } from "@/api/models";
import type { ModelArtifact } from "@/types/models";
import { formatBytes, formatPercent, truncateDigest } from "@/utils/format";

interface ModelsTableProps {
  data: ModelArtifact[];
  loading?: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  tab?: "activated" | "deactivated";
  onDeactivate?: (artifact: ModelArtifact) => void;
  onActivate?: (artifact: ModelArtifact) => void;
  onDelete?: (artifact: ModelArtifact) => void;
  actionLoadingId?: string | null;
  exportingId?: string | null;
}

export function ModelsTable({
  data,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  tab = "activated",
  onDeactivate,
  onActivate,
  onDelete,
  actionLoadingId,
  exportingId,
}: ModelsTableProps) {
  const { modal } = App.useApp();
  const [messageApi, contextHolder] = message.useMessage();

  const columns = useMemo<ColumnDef<ModelArtifact>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const meta = (row.original.metadata || {}) as Record<string, unknown>;
          const candidate = Boolean(meta.candidate);
          const total = meta.total_sample_count;
          return (
            <div>
              <div className="flex items-center gap-2 font-medium text-slate-900">
                {row.original.name}
                {candidate ? <Tag color="gold">candidate</Tag> : null}
              </div>
              <Typography.Text type="secondary" className="text-xs">
                {row.original.filename}
                {total != null ? ` · train data ${String(total)}` : ""}
              </Typography.Text>
            </div>
          );
        },
      },
      { accessorKey: "version", header: "Version" },
      {
        id: "lineage_data",
        header: "Train data P+N=T",
        cell: ({ row }) => {
          const meta = (row.original.metadata || {}) as Record<string, unknown>;
          const p = meta.parent_sample_count;
          const n = meta.new_sample_count;
          const t = meta.total_sample_count;
          if (p == null && n == null && t == null) return "—";
          return (
            <span className="text-xs">
              {String(p ?? "—")}+{String(n ?? "—")}=
              <strong>{String(t ?? "—")}</strong>
            </span>
          );
        },
      },
      { accessorKey: "ocr_type", header: "OCR type" },
      { accessorKey: "role", header: "Role" },
      { accessorKey: "runtime", header: "Runtime" },
      {
        accessorKey: "framework",
        header: "Framework",
        cell: ({ getValue }) => getValue<string | null>() || "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <StatusTag status={getValue<string>()} />,
      },
      {
        accessorKey: "size_bytes",
        header: "Size",
        cell: ({ getValue }) => formatBytes(getValue<number>()),
      },
      {
        accessorKey: "artifact_digest",
        header: "Digest",
        cell: ({ getValue }) => {
          const digest = getValue<string>();
          return (
            <Tooltip title={digest}>
              <span className="font-mono text-xs">
                {truncateDigest(digest)}
              </span>
            </Tooltip>
          );
        },
      },
      {
        id: "ground_accuracy",
        header: "Ground accuracy",
        cell: ({ row }) =>
          formatPercent(
            row.original.ground_accuracy ?? row.original.training_accuracy,
          ),
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ getValue }) => {
          const v = getValue<string | null>();
          return v ? dayjs(v).format("YYYY-MM-DD HH:mm") : "—";
        },
      },
      {
        accessorKey: "created_by",
        header: "Created by",
        cell: ({ getValue }) => getValue<string | null>() || "—",
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const art = row.original;
          const busy = actionLoadingId === art.id;
          const exporting = exportingId === art.id;
          const defaultFilename = `${art.name}-${art.version}`;
          return (
            <Space size={4} wrap>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                loading={exporting}
                onClick={() => {
                  void downloadArtifact(art.id, defaultFilename).catch(() => {
                    void messageApi.error("Export failed. Please try again.");
                  });
                }}
              >
                Export
              </Button>
              {tab === "activated" ? (
                <Button
                  size="small"
                  loading={busy}
                  onClick={() =>
                    modal.confirm({
                      title: "Deactivate model?",
                      content: (
                        <div className="text-sm text-slate-600">
                          Retires{" "}
                          <strong>
                            {art.name}@{art.version}
                          </strong>{" "}
                          so it cannot be bound to new pipeline refs. Blocked if
                          an active ref still uses it.
                        </div>
                      ),
                      okText: "Deactivate",
                      onOk: () => onDeactivate?.(art),
                    })
                  }
                >
                  Deactivate
                </Button>
              ) : (
                <Button
                  size="small"
                  type="primary"
                  loading={busy}
                  onClick={() => onActivate?.(art)}
                >
                  Activate
                </Button>
              )}
              <Button
                size="small"
                danger
                loading={busy}
                onClick={() =>
                  modal.confirm({
                    title: "Delete model permanently?",
                    content: (
                      <div className="text-sm text-slate-600">
                        Deletes{" "}
                        <strong>
                          {art.name}@{art.version}
                        </strong>{" "}
                        and its file from disk. Blocked if refs, evaluations, or
                        training runs still reference it.
                      </div>
                    ),
                    okText: "Delete forever",
                    okButtonProps: { danger: true },
                    onOk: () => onDelete?.(art),
                  })
                }
              >
                Delete
              </Button>
            </Space>
          );
        },
      },
    ],
    [actionLoadingId, exportingId, messageApi, modal, onActivate, onDeactivate, onDelete, tab],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(total / Math.max(pageSize, 1))),
  });

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {contextHolder}
      <Spin spinning={Boolean(loading)}>
        <div className="overflow-x-auto">
          <table className="min-w-[1500px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-slate-200">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="whitespace-nowrap px-3 py-3 font-medium"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-3 py-10 text-center text-slate-500"
                  >
                    No models found
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 hover:bg-slate-50/80"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="whitespace-nowrap px-3 py-3 align-top"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Spin>
      <div className="flex justify-end border-t border-slate-100 px-4 py-3">
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          pageSizeOptions={[10, 20, 50]}
          showTotal={(count, range) => `${range[0]}–${range[1]} of ${count}`}
          onChange={onPageChange}
        />
      </div>
    </div>
  );
}
