import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  exploreSamples,
  fetchExplorerImageUrl,
  getExplorerSample,
  setLifecycle,
  setQualityTag as patchQualityTag,
  bulkSetLifecycle,
  type ExplorerSampleDetail,
  type ExplorerSampleSummary,
} from "@/api/explorer";
import { getApiErrorMessage } from "@/api/client";
import { DataTableToolbar } from "@/components/common/DataTableToolbar";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchInput } from "@/components/common/SearchInput";
import { useDebounce } from "@/hooks/useDebounce";
import { useTaskContext } from "@/features/tasks/TaskContext";

const SOURCE_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "databank", label: "Databank" },
  { value: "evaluation", label: "Evaluation" },
];

function MatchTag({ match }: { match?: boolean | null }) {
  if (match == null) return <>—</>;
  return match ? (
    <Tag color="success">match</Tag>
  ) : (
    <Tag color="error">miss</Tag>
  );
}

export function DataExplorerPage() {
  const queryClient = useQueryClient();
  const { activeTaskKey } = useTaskContext();

  const [source, setSource] = useState("all");
  const [lifecycleState, setLifecycleState] = useState<string | undefined>();
  const [qualityTag, setQualityTag] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<ExplorerSampleSummary | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [detail, setDetail] = useState<ExplorerSampleDetail | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      task_key: activeTaskKey,
      source,
      lifecycle_state: lifecycleState,
      quality_tag: qualityTag,
      q: debouncedSearch || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    [
      activeTaskKey,
      source,
      lifecycleState,
      qualityTag,
      debouncedSearch,
      page,
      pageSize,
    ],
  );

  const samplesQuery = useQuery({
    queryKey: ["explorer", "samples", params],
    queryFn: () => exploreSamples(params),
    enabled: Boolean(activeTaskKey),
  });

  const detailQuery = useQuery({
    queryKey: ["explorer", "sample", selected?.source, selected?.id],
    queryFn: () => getExplorerSample(selected!.source, selected!.id),
    enabled: Boolean(selected?.source && selected?.id),
  });

  useEffect(() => {
    setDetail(detailQuery.data ?? null);
  }, [detailQuery.data]);

  useEffect(() => {
    let revoked: string | null = null;
    const imagePath = detail?.image_url;
    if (!imagePath) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    void fetchExplorerImageUrl(imagePath).then((url) => {
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      revoked = url;
      setPreviewUrl(url);
    });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [detail?.image_url]);

  const lifecycleMutation = useMutation({
    mutationFn: (state: string) =>
      setLifecycle(selected!.dataset_id, selected!.id, state),
    onSuccess: () => {
      message.success("Lifecycle updated");
      void queryClient.invalidateQueries({ queryKey: ["explorer"] });
      void detailQuery.refetch();
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  });

  const qualityMutation = useMutation({
    mutationFn: (tag: string) =>
      patchQualityTag(selected!.dataset_id, selected!.id, tag),
    onSuccess: () => {
      message.success("Quality tag updated");
      void queryClient.invalidateQueries({ queryKey: ["explorer"] });
      void detailQuery.refetch();
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  });

  const lifecycleOptions = useMemo(
    () =>
      (samplesQuery.data?.lifecycle_states ?? []).map((s) => ({
        value: s,
        label: s,
      })),
    [samplesQuery.data?.lifecycle_states],
  );

  const qualityOptions = useMemo(
    () =>
      (samplesQuery.data?.quality_tags ?? []).map((t) => ({
        value: t,
        label: t,
      })),
    [samplesQuery.data?.quality_tags],
  );

  const columns: ColumnsType<ExplorerSampleSummary> = [
    {
      title: "File",
      dataIndex: "filename",
      ellipsis: true,
    },
    {
      title: "Source",
      dataIndex: "source",
      width: 100,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: "Ground truth",
      dataIndex: "ground_truth",
      width: 130,
      ellipsis: true,
      render: (v) => v ?? "—",
    },
    {
      title: "Prediction",
      dataIndex: "prediction",
      width: 130,
      ellipsis: true,
      render: (v) => v ?? "—",
    },
    {
      title: "Match",
      dataIndex: "match",
      width: 80,
      render: (v: boolean | null) => <MatchTag match={v} />,
    },
    {
      title: "Lifecycle",
      dataIndex: "lifecycle_state",
      width: 130,
      render: (v) => (v ? <Tag>{v}</Tag> : "—"),
    },
    {
      title: "Quality",
      dataIndex: "quality_tag",
      width: 100,
      render: (v) => (v ? <Tag>{v}</Tag> : "—"),
    },
  ];

  const isDatabank = selected?.source === "databank";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: "Dashboard", path: "/overview" },
          { title: "Dataset", path: "/evaluation/datasets" },
          { title: "Data explorer" },
        ]}
        actions={
          <Typography.Text type="secondary" className="text-sm">
            Task: <Tag>{activeTaskKey}</Tag>
          </Typography.Text>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        <DataTableToolbar
          left={
            <Space wrap size={[8, 8]}>
              <Select
                value={source}
                onChange={(v) => {
                  setSource(v);
                  setPage(1);
                }}
                options={SOURCE_OPTIONS}
                className="w-36"
              />
              <Select
                allowClear
                placeholder="Lifecycle"
                value={lifecycleState}
                options={lifecycleOptions}
                onChange={(v) => {
                  setLifecycleState(v);
                  setPage(1);
                }}
                className="w-44"
              />
              <Select
                allowClear
                placeholder="Quality tag"
                value={qualityTag}
                options={qualityOptions}
                onChange={(v) => {
                  setQualityTag(v);
                  setPage(1);
                }}
                className="w-36"
              />
              <SearchInput
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                placeholder="Search file / GT…"
              />
            </Space>
          }
          right={
            <Space>
              <Button
                disabled={selectedKeys.length === 0}
                onClick={() => {
                  const items = (samplesQuery.data?.items ?? []).filter((r) =>
                    selectedKeys.includes(`${r.source}:${r.id}`),
                  );
                  const byDs = new Map<string, string[]>();
                  for (const it of items) {
                    if (it.source !== "databank") continue;
                    const list = byDs.get(it.dataset_id) ?? [];
                    list.push(it.id);
                    byDs.set(it.dataset_id, list);
                  }
                  void Promise.all(
                    [...byDs.entries()].map(([ds, ids]) =>
                      bulkSetLifecycle(ds, ids, "verified"),
                    ),
                  )
                    .then(() => {
                      message.success("Bulk verified");
                      setSelectedKeys([]);
                      void queryClient.invalidateQueries({
                        queryKey: ["explorer"],
                      });
                    })
                    .catch((err) => message.error(getApiErrorMessage(err)));
                }}
              >
                Bulk verify ({selectedKeys.length})
              </Button>
              <span className="text-sm text-slate-500">
                {samplesQuery.data?.total_estimate ?? 0} sample
                {(samplesQuery.data?.total_estimate ?? 0) === 1 ? "" : "s"}
              </span>
            </Space>
          }
        />

        {samplesQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Failed to load samples"
            description={getApiErrorMessage(samplesQuery.error)}
            action={
              <Button size="small" onClick={() => void samplesQuery.refetch()}>
                Retry
              </Button>
            }
          />
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto">
          <Table
            rowKey={(row) => `${row.source}:${row.id}`}
            loading={samplesQuery.isLoading}
            columns={columns}
            dataSource={samplesQuery.data?.items ?? []}
            rowSelection={{
              selectedRowKeys: selectedKeys,
              onChange: (keys) => setSelectedKeys(keys.map(String)),
              getCheckboxProps: (row) => ({
                disabled: row.source !== "databank",
              }),
            }}
            onRow={(row) => ({
              onClick: () => setSelected(row),
              className: "cursor-pointer",
            })}
            pagination={{
              current: page,
              pageSize,
              total: samplesQuery.data?.total_estimate ?? 0,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
          />
        </div>
      </div>

      <Drawer
        title={
          selected ? `${selected.filename} · ${selected.source}` : "Sample"
        }
        open={Boolean(selected)}
        onClose={() => {
          setSelected(null);
          setDetail(null);
        }}
        width={640}
        destroyOnHidden
      >
        {detailQuery.isLoading ? (
          <Typography.Text>Loading detail…</Typography.Text>
        ) : detail ? (
          <div className="space-y-4">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={detail.filename}
                className="max-h-64 w-full rounded-lg border border-slate-200 object-contain bg-slate-50"
              />
            ) : (
              <div className="rounded-lg bg-slate-100 p-6 text-center text-slate-500">
                Loading image…
              </div>
            )}

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Dataset">
                {detail.dataset_name ?? detail.dataset_id}
              </Descriptions.Item>
              <Descriptions.Item label="Ground truth">
                {detail.final_gt ??
                  detail.corrected_gt ??
                  detail.ground_truth ??
                  "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Lifecycle">
                {detail.lifecycle_state ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Quality tag">
                {detail.quality_tag ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Review status">
                {detail.review_status ?? "—"}
              </Descriptions.Item>
            </Descriptions>

            {detail.predictions.length > 0 ? (
              <div>
                <Typography.Text strong>Predictions</Typography.Text>
                <Table
                  size="small"
                  className="mt-2"
                  rowKey={(_, i) => String(i)}
                  pagination={false}
                  dataSource={detail.predictions}
                  columns={[
                    { title: "Kind", dataIndex: "kind", width: 90 },
                    { title: "Value", dataIndex: "value", ellipsis: true },
                    {
                      title: "Conf.",
                      dataIndex: "confidence",
                      width: 70,
                      render: (v: number | null | undefined) =>
                        v != null ? `${(v * 100).toFixed(0)}%` : "—",
                    },
                    {
                      title: "Match",
                      dataIndex: "match",
                      width: 70,
                      render: (v, row) =>
                        row.is_correct != null ? (
                          <MatchTag match={row.is_correct} />
                        ) : (
                          <MatchTag match={v} />
                        ),
                    },
                  ]}
                />
              </div>
            ) : null}

            {detail.provenance ? (
              <div>
                <Typography.Text strong>Provenance</Typography.Text>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-50 p-3 text-xs">
                  {JSON.stringify(detail.provenance, null, 2)}
                </pre>
              </div>
            ) : null}

            {isDatabank ? (
              <Space wrap>
                <Select
                  placeholder="Set lifecycle"
                  options={lifecycleOptions}
                  value={detail.lifecycle_state}
                  onChange={(v) => lifecycleMutation.mutate(v)}
                  loading={lifecycleMutation.isPending}
                  className="min-w-[180px]"
                />
                <Select
                  placeholder="Set quality tag"
                  options={qualityOptions}
                  value={detail.quality_tag}
                  onChange={(v) => qualityMutation.mutate(v)}
                  loading={qualityMutation.isPending}
                  className="min-w-[160px]"
                />
              </Space>
            ) : null}
          </div>
        ) : detailQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Failed to load sample detail"
            description={getApiErrorMessage(detailQuery.error)}
          />
        ) : null}
      </Drawer>
    </div>
  );
}
