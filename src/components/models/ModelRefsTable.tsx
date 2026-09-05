import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Button,
  Dropdown,
  Pagination,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import type { MenuProps } from "antd";
import dayjs from "dayjs";
import { useMemo } from "react";

import { StatusTag } from "@/components/common/StatusTag";
import {
  MetricWithDelta,
  buildPreviousActiveMap,
  type MetricKey,
} from "@/components/models/metricDelta";
import type { PipelineRef } from "@/types/models";
import { formatMs, formatPercent } from "@/utils/format";

interface ModelRefsTableProps {
  data: PipelineRef[];
  /** Full list used to find previous active baseline (not deactivated). */
  allRefs?: PipelineRef[];
  loading?: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  onActivate?: (ref: PipelineRef, setDefault: boolean) => void;
  onSetDefault?: (ref: PipelineRef) => void;
  onDeactivate?: (ref: PipelineRef) => void;
  actionLoadingKey?: string | null;
}

function BoundModelCell({
  label,
  name,
  version,
  runtime,
}: {
  label: string;
  name?: string;
  version?: string;
  runtime?: string;
}) {
  if (!name) return <span>—</span>;
  return (
    <div>
      <Typography.Text
        type="secondary"
        className="text-xs uppercase tracking-wide"
      >
        {label}
      </Typography.Text>
      <div className="font-medium text-slate-900">
        {name} <span className="font-normal text-slate-500">v{version}</span>
      </div>
      <Typography.Text type="secondary" className="text-xs">
        {runtime}
      </Typography.Text>
    </div>
  );
}

function refActionKey(ref: PipelineRef) {
  return `${ref.ocr_type}/${ref.model_ref}`;
}

export function ModelRefsTable({
  data,
  allRefs,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  onActivate,
  onSetDefault,
  onDeactivate,
  actionLoadingKey,
}: ModelRefsTableProps) {
  const previousActive = useMemo(
    () => buildPreviousActiveMap(allRefs ?? data),
    [allRefs, data],
  );

  const metricCell = (
    row: PipelineRef,
    key: MetricKey,
    format: (v: number | null | undefined) => string,
  ) => {
    const prev = previousActive.get(row.id);
    const prevVal =
      row.status === "active" && prev
        ? (prev.evaluation_metrics?.[key] as number | null | undefined)
        : null;
    return (
      <MetricWithDelta
        value={row.evaluation_metrics?.[key] as number | null | undefined}
        previous={prevVal}
        metricKey={key}
        format={format}
      />
    );
  };

  const columns = useMemo<ColumnDef<PipelineRef>[]>(
    () => [
      {
        accessorKey: "model_ref",
        header: "Model ref",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">
              {row.original.model_ref}
            </span>
            {row.original.is_default ? <Tag color="teal">default</Tag> : null}
          </div>
        ),
      },
      { accessorKey: "ocr_type", header: "OCR type" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <StatusTag status={getValue<string>()} />,
      },
      {
        id: "detection",
        header: "Detection model",
        cell: ({ row }) => (
          <BoundModelCell
            label="detection"
            name={row.original.detection?.name}
            version={row.original.detection?.version}
            runtime={row.original.detection?.runtime}
          />
        ),
      },
      {
        id: "recognition",
        header: "Recognition model",
        cell: ({ row }) => (
          <BoundModelCell
            label="recognition"
            name={row.original.recognition?.name}
            version={row.original.recognition?.version}
            runtime={row.original.recognition?.runtime}
          />
        ),
      },
      {
        id: "images_evaluated",
        header: "Images evaluated",
        cell: ({ row }) =>
          row.original.evaluation_metrics?.total_images_evaluated ?? "—",
      },
      {
        id: "datasets_evaluated",
        header: "Datasets evaluated",
        cell: ({ row }) =>
          row.original.evaluation_metrics?.total_datasets_evaluated ?? "—",
      },
      {
        id: "eval_runs",
        header: "Eval runs",
        cell: ({ row }) =>
          row.original.evaluation_metrics?.evaluation_count_completed ?? "—",
      },
      {
        id: "detection_success_rate",
        header: "Det. success",
        cell: ({ row }) =>
          metricCell(row.original, "detection_success_rate", formatPercent),
      },
      {
        id: "recognition_exact_match",
        header: "Rec. exact match",
        cell: ({ row }) =>
          metricCell(
            row.original,
            "recognition_exact_match_accuracy",
            formatPercent,
          ),
      },
      {
        id: "e2e_accuracy",
        header: "E2E accuracy",
        cell: ({ row }) =>
          metricCell(row.original, "end_to_end_accuracy", formatPercent),
      },
      {
        id: "e2e_success",
        header: "E2E success",
        cell: ({ row }) =>
          metricCell(row.original, "end_to_end_success_rate", formatPercent),
      },
      {
        id: "latency_p50",
        header: "Latency p50",
        cell: ({ row }) => metricCell(row.original, "latency_p50_ms", formatMs),
      },
      {
        id: "latency_p95",
        header: "Latency p95",
        cell: ({ row }) => metricCell(row.original, "latency_p95_ms", formatMs),
      },
      {
        accessorKey: "notes",
        header: "Notes",
        cell: ({ getValue }) => getValue<string | null>() || "—",
      },
      {
        accessorKey: "updated_at",
        header: "Updated",
        cell: ({ getValue }) => {
          const v = getValue<string | null>();
          return v ? dayjs(v).format("YYYY-MM-DD HH:mm") : "—";
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const ref = row.original;
          const key = refActionKey(ref);
          const busy = actionLoadingKey === key;
          const isActive = ref.status === "active";
          const canActivate = !isActive;
          const canSetDefault = isActive && !ref.is_default;
          const canDeactivate = isActive;

          const activateMenu: MenuProps["items"] = [
            {
              key: "activate",
              label: "Activate",
              onClick: () => onActivate?.(ref, false),
            },
            {
              key: "activate-default",
              label: "Activate & set default",
              onClick: () => onActivate?.(ref, true),
            },
          ];

          return (
            <Space size="small" wrap>
              {canActivate ? (
                <Dropdown menu={{ items: activateMenu }} trigger={["click"]}>
                  <Button size="small" type="primary" loading={busy}>
                    Activate
                  </Button>
                </Dropdown>
              ) : null}
              {canSetDefault ? (
                <Popconfirm
                  title={`Set ${ref.model_ref} as default?`}
                  description="OCR requests without a model_ref will use this pipeline."
                  okText="Set default"
                  onConfirm={() => onSetDefault?.(ref)}
                >
                  <Button size="small" loading={busy}>
                    Set default
                  </Button>
                </Popconfirm>
              ) : null}
              {canDeactivate ? (
                <Popconfirm
                  title={`Deactivate ${ref.model_ref}?`}
                  description={
                    ref.is_default
                      ? "This removes the default flag and unloads the ref from serving."
                      : "This unloads the ref from serving."
                  }
                  okText="Deactivate"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => onDeactivate?.(ref)}
                >
                  <Button size="small" danger loading={busy}>
                    Deactivate
                  </Button>
                </Popconfirm>
              ) : null}
              {!canActivate && !canSetDefault && !canDeactivate ? (
                <Typography.Text type="secondary">—</Typography.Text>
              ) : null}
            </Space>
          );
        },
      },
    ],
    [actionLoadingKey, onActivate, onDeactivate, onSetDefault, previousActive],
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
      <Spin spinning={Boolean(loading)}>
        <div className="overflow-x-auto">
          <table className="min-w-[1960px] w-full border-collapse text-left text-sm">
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
                    No model refs found
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
