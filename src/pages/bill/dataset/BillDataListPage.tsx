import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Drawer,
  Image,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { EyeOutlined, LinkOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import dayjs from "dayjs";

import { getApiErrorMessage } from "@/api/client";
import { fetchBillSampleImageObjectUrl } from "@/api/billDataset";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTableToolbar } from "@/components/common/DataTableToolbar";
import { SearchInput } from "@/components/common/SearchInput";
import {
  CapabilityAlert,
  DatasetHealthBar,
} from "@/components/bill/dataset/DatasetContextBar";
import { useBillDatasetContext } from "@/features/bill/dataset/context";
import {
  useBillDatasetQuery,
  useBillDatasetSamplesQuery,
  useBillExplorerQuery,
} from "@/features/bill/dataset/hooks";
import {
  annotationStatusFromSample,
  coveragePct,
} from "@/features/bill/dataset/annotationStatus";
import { useDebounce } from "@/hooks/useDebounce";
import { listLocalBillDocuments } from "@/features/bill/localDocuments";
import type { DatasetSample } from "@/types/evaluation";
import type { BillLocalDocument } from "@/types/bill";

export function BillDataListPage() {
  const { datasetId, chunk } = useBillDatasetContext();
  const [search, setSearch] = useState("");
  const [hasGt, setHasGt] = useState<boolean | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [preview, setPreview] = useState<DatasetSample | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localDocs, setLocalDocs] = useState<BillLocalDocument[]>([]);
  const debounced = useDebounce(search, 300);

  const datasetQuery = useBillDatasetQuery(datasetId);
  const samplesQuery = useBillDatasetSamplesQuery(datasetId, {
    limit: pageSize,
    offset: (page - 1) * pageSize,
    split: chunk && chunk !== "all" ? chunk : undefined,
    search: debounced || undefined,
    has_gt: hasGt,
  });

  const explorerQuery = useBillExplorerQuery(
    {
      task_key: "bill",
      dataset_id: datasetId ?? undefined,
      q: debounced || undefined,
      limit: 25,
      offset: 0,
    },
    !datasetId,
  );

  useEffect(() => {
    setLocalDocs(listLocalBillDocuments());
  }, []);

  useEffect(() => {
    let revoke: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      if (!preview || !datasetId) {
        setPreviewUrl(null);
        return;
      }
      try {
        const url = await fetchBillSampleImageObjectUrl(datasetId, preview.id);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        revoke = () => URL.revokeObjectURL(url);
        setPreviewUrl(url);
      } catch {
        if (!cancelled) setPreviewUrl(null);
      }
    })();
    return () => {
      cancelled = true;
      revoke?.();
    };
  }, [preview, datasetId]);

  const pageCoverage = useMemo(
    () => coveragePct(samplesQuery.data?.samples ?? []),
    [samplesQuery.data?.samples],
  );

  const columns = [
    {
      title: "Document",
      dataIndex: "filename",
      render: (name: string, row: DatasetSample) => (
        <div>
          <Typography.Text strong className="text-sm">
            {name}
          </Typography.Text>
          <div className="font-mono text-xs text-slate-400">{row.id}</div>
        </div>
      ),
    },
    {
      title: "Split",
      dataIndex: "split",
      width: 90,
      render: (v: string | null | undefined) => v || "—",
    },
    {
      title: "Annotation",
      key: "ann",
      width: 110,
      render: (_: unknown, row: DatasetSample) => {
        const s = annotationStatusFromSample(row);
        const color =
          s === "LABELED"
            ? "green"
            : s === "UNLABELED"
              ? "default"
              : s === "PARTIAL"
                ? "gold"
                : "red";
        return <Tag color={color}>{s}</Tag>;
      },
    },
    {
      title: "GT",
      dataIndex: "ground_truth",
      ellipsis: true,
      render: (v: string) =>
        v || <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "Format",
      dataIndex: "image_format",
      width: 80,
      render: (v: string | null) => v || "—",
    },
    {
      title: "Created",
      dataIndex: "created_at",
      width: 110,
      render: (v: string | null) => (v ? dayjs(v).format("YYYY-MM-DD") : "—"),
    },
    {
      title: "",
      key: "actions",
      width: 100,
      render: (_: unknown, row: DatasetSample) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setPreview(row)}
            aria-label="Preview"
          />
          {typeof row.metadata?.document_id === "string" ? (
            <Link
              to={`/bill/documents/${encodeURIComponent(String(row.metadata.document_id))}`}
            >
              <Button
                size="small"
                icon={<LinkOutlined />}
                aria-label="Open bill doc"
              />
            </Link>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        breadcrumbs={[
          { title: "Datasets", path: "/bill/datasets" },
          { title: "Data list" },
        ]}
        title="Data list"
        description="Server-paginated samples for the selected bill dataset. Local processed documents are listed separately (no backend list API)."
      />

      {!datasetId ? (
        <CapabilityAlert
          type="warning"
          title="Select a dataset in the context bar"
          detail="Without a dataset, this tab shows explorer search (task_key=bill) and the browser-local process inbox only."
        />
      ) : null}

      <DatasetHealthBar
        sampleCount={datasetQuery.data?.sample_count}
        labeled={pageCoverage?.labeled}
        unlabeled={pageCoverage?.unlabeled}
        splitCounts={datasetQuery.data?.split_counts}
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
                placeholder="Search filename / GT"
              />
              <Select
                size="small"
                allowClear
                placeholder="Annotation"
                className="min-w-[140px]"
                value={
                  hasGt === true
                    ? "labeled"
                    : hasGt === false
                      ? "unlabeled"
                      : undefined
                }
                options={[
                  { value: "labeled", label: "Has GT" },
                  { value: "unlabeled", label: "No GT" },
                ]}
                onChange={(v) => {
                  setHasGt(
                    v === "labeled"
                      ? true
                      : v === "unlabeled"
                        ? false
                        : undefined,
                  );
                  setPage(1);
                }}
              />
            </>
          }
        />

        {datasetId ? (
          <>
            {samplesQuery.isError ? (
              <Alert
                type="error"
                showIcon
                className="mb-3"
                message={getApiErrorMessage(samplesQuery.error)}
              />
            ) : null}
            <Table
              size="small"
              rowKey="id"
              loading={samplesQuery.isLoading}
              dataSource={samplesQuery.data?.samples ?? []}
              columns={columns}
              pagination={{
                current: page,
                pageSize,
                total: samplesQuery.data?.total ?? 0,
                showSizeChanger: true,
                onChange: (p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                },
              }}
              locale={{ emptyText: "No documents match the current filters." }}
              sticky
            />
          </>
        ) : (
          <>
            <Typography.Title level={5} className="!mt-2">
              Explorer (task_key=bill)
            </Typography.Title>
            {explorerQuery.isError ? (
              <Alert
                type="error"
                showIcon
                message={getApiErrorMessage(explorerQuery.error)}
              />
            ) : (
              <Table
                size="small"
                rowKey="id"
                loading={explorerQuery.isLoading}
                dataSource={explorerQuery.data?.items ?? []}
                pagination={false}
                columns={[
                  { title: "File", dataIndex: "filename" },
                  { title: "Dataset", dataIndex: "dataset_name" },
                  { title: "Source", dataIndex: "source", width: 100 },
                  {
                    title: "Review",
                    dataIndex: "review_status",
                    width: 110,
                    render: (v: string | null | undefined) => v || "—",
                  },
                ]}
                locale={{ emptyText: "No explorer samples for bill." }}
              />
            )}
          </>
        )}

        <Typography.Title level={5} className="!mt-6">
          Local process inbox ({localDocs.length})
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="!mt-0 text-xs">
          Browser-local only — backend has no GET /v1/documents list. Open a row
          to use the Bill document review workspace.
        </Typography.Paragraph>
        <Table
          size="small"
          rowKey="id"
          dataSource={localDocs}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: "File",
              dataIndex: "fileName",
              render: (v: string, row: BillLocalDocument) => (
                <Link
                  to={`/bill/documents/${encodeURIComponent(row.documentId)}`}
                >
                  {v}
                </Link>
              ),
            },
            { title: "Document ID", dataIndex: "documentId", ellipsis: true },
            {
              title: "Status",
              dataIndex: "status",
              width: 120,
              render: (v: string) => <Tag>{v}</Tag>,
            },
            {
              title: "Pages",
              dataIndex: "pageCount",
              width: 70,
              render: (v: number | undefined) => v ?? "—",
            },
          ]}
          locale={{ emptyText: "Local inbox empty — process documents first." }}
        />
      </div>

      <Drawer
        title={preview?.filename}
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        width={480}
      >
        {previewUrl ? (
          <Image src={previewUrl} alt={preview?.filename} className="mb-3" />
        ) : (
          <Typography.Text type="secondary">
            Preview unavailable
          </Typography.Text>
        )}
        <pre className="mt-3 max-h-64 overflow-auto rounded bg-slate-50 p-2 text-xs">
          {JSON.stringify(
            {
              id: preview?.id,
              ground_truth: preview?.ground_truth,
              split: preview?.split,
              metadata: preview?.metadata,
              annotation: preview ? annotationStatusFromSample(preview) : null,
            },
            null,
            2,
          )}
        </pre>
      </Drawer>
    </div>
  );
}
