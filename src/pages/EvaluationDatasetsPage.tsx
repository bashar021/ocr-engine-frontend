import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  DatabaseOutlined,
  EyeOutlined,
  FileTextOutlined,
  OrderedListOutlined,
  ReloadOutlined,
  SearchOutlined,
  SyncOutlined,
  TableOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Pagination,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useMemo, useState } from "react";

import { getApiErrorMessage } from "@/api/client";
import { StatusTag } from "@/components/common/StatusTag";
import { DatasetSamplesDrawer } from "@/components/evaluation/DatasetSamplesDrawer";
import { DatasetsTable } from "@/components/evaluation/DatasetsTable";
import { UploadDatasetModal } from "@/components/evaluation/UploadDatasetModal";
import { EVALUATION_POLL_INTERVAL_MS } from "@/constants/polling";
import {
  useArchiveDataset,
  useHardDeleteDataset,
} from "@/features/evaluation/useEvaluationMutations";
import { useDatasetsQuery } from "@/features/evaluation/useDatasetsQuery";
import { useTaskContext } from "@/features/tasks/TaskContext";
import { useDebounce } from "@/hooks/useDebounce";
import type { EvaluationDataset } from "@/types/evaluation";
import { getDatasetDeleteAvailability } from "@/utils/datasetDeleteAvailability";
import { truncateDigest } from "@/utils/format";

const DATASET_STATUSES = [
  { value: "uploading", label: "Uploading" },
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "failed", label: "Failed" },
  { value: "consumed", label: "Consumed" },
  { value: "archived", label: "Archived" },
];

const DATASET_ORIGINS = [
  { value: "upload", label: "Uploaded" },
  { value: "curated_hard_case", label: "System curated" },
  { value: "merged_training", label: "Merged training" },
  { value: "system", label: "System" },
];

const SOURCE_TYPES = [
  { value: "zip_upload", label: "ZIP upload" },
  { value: "system", label: "System" },
];

function datasetOrigin(dataset: EvaluationDataset): string {
  return (
    dataset.origin ||
    (typeof dataset.metadata?.origin === "string"
      ? dataset.metadata.origin
      : "upload")
  );
}

const ORIGIN_CONFIG: Record<string, { label: string; color: string }> = {
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

export function EvaluationDatasetsPage() {
  const { activeTaskKey } = useTaskContext();
  const { modal, message } = App.useApp();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [origin, setOrigin] = useState<string | undefined>();
  const [sourceType, setSourceType] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebounce(search, 300);
  const hasClientFilters = Boolean(origin || sourceType);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [samplesDataset, setSamplesDataset] =
    useState<EvaluationDataset | null>(null);
  const archiveMutation = useArchiveDataset();
  const hardDeleteMutation = useHardDeleteDataset();

  const params = useMemo(
    () => ({
      scope: "evaluation" as const,
      search: debouncedSearch || undefined,
      ocr_type: activeTaskKey,
      status,
      include_archived: status === "archived",
      limit: hasClientFilters ? 500 : pageSize,
      offset: hasClientFilters ? 0 : (page - 1) * pageSize,
    }),
    [debouncedSearch, activeTaskKey, status, page, pageSize, hasClientFilters],
  );

  const query = useDatasetsQuery(params);

  const filteredDatasets = useMemo(() => {
    let rows = query.data?.datasets ?? [];
    // Do not show datasets generated on the basis of databank categories
    rows = rows.filter((d) => !datasetOrigin(d).startsWith("databank_"));
    if (origin) {
      rows = rows.filter((d) => datasetOrigin(d) === origin);
    }
    if (sourceType) {
      rows = rows.filter((d) => d.source_type === sourceType);
    }
    return rows;
  }, [query.data?.datasets, origin, sourceType]);

  const pagedDatasets = useMemo(() => {
    if (!hasClientFilters) return filteredDatasets;
    const start = (page - 1) * pageSize;
    return filteredDatasets.slice(start, start + pageSize);
  }, [filteredDatasets, hasClientFilters, page, pageSize]);

  const displayTotal = hasClientFilters
    ? filteredDatasets.length
    : (query.data?.total ?? 0);

  const deletePending =
    archiveMutation.isPending || hardDeleteMutation.isPending;

  // KPI Calculations
  const allDatasets = query.data?.datasets ?? [];
  const readyDatasetsCount = allDatasets.filter((d) => d.status === "ready").length;
  const totalSamplesCount = allDatasets.reduce(
    (acc, d) => acc + (d.sample_count ?? 0),
    0,
  );
  const activeProcessingCount = allDatasets.filter(
    (d) => d.status === "uploading" || d.status === "processing",
  ).length;

  const handleResetFilters = () => {
    setSearch("");
    setStatus(undefined);
    setOrigin(undefined);
    setSourceType(undefined);
    setPage(1);
  };

  const isFiltered = Boolean(search || status || origin || sourceType);

  const handleSoftDelete = (dataset: EvaluationDataset) => {
    const del = getDatasetDeleteAvailability(dataset, {
      mutating: deletePending,
    });
    if (!del.canSoftDelete) {
      message.warning(del.softReason ?? "Archive unavailable");
      return;
    }
    modal.confirm({
      title: "Archive dataset?",
      content: (
        <div className="text-sm text-slate-600">
          Archives <strong>{dataset.name}</strong> v{dataset.version}. It leaves
          the active list (filter Status → Archived to view). Evaluation history is preserved.
        </div>
      ),
      okText: "Archive",
      okButtonProps: { danger: true },
      centered: true,
      zIndex: 1100,
      onOk: async () => {
        try {
          await archiveMutation.mutateAsync(dataset.id);
          message.success("Dataset archived — filter Status = Archived to view it");
        } catch (error) {
          message.error(getApiErrorMessage(error));
          throw error;
        }
      },
    });
  };

  const handleHardDelete = (dataset: EvaluationDataset) => {
    const del = getDatasetDeleteAvailability(dataset, {
      mutating: deletePending,
    });
    if (!del.canHardDelete) {
      message.warning(del.hardReason ?? "Delete permanently unavailable");
      return;
    }
    modal.confirm({
      title: "Permanently delete dataset?",
      content: (
        <div className="text-sm text-slate-600">
          Permanently removes <strong>{dataset.name}</strong> v{dataset.version}
          , including its images, samples, and all associated evaluation runs. This
          action cannot be undone.
        </div>
      ),
      okText: "Delete forever",
      okButtonProps: { danger: true },
      centered: true,
      zIndex: 1100,
      onOk: async () => {
        try {
          await hardDeleteMutation.mutateAsync(dataset.id);
          message.success("Dataset permanently deleted");
        } catch (error) {
          message.error(getApiErrorMessage(error));
          throw error;
        }
      },
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-auto bg-slate-50/50">
      {/* Enhanced Top Header Bar */}
      <div className="border-b border-slate-200 bg-white px-6 py-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <OrderedListOutlined className="text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Datasets</h1>
              <p className="text-xs text-slate-500">
                Curated training & evaluation datasets with sample lineage and verification.
              </p>
            </div>
          </div>

          <Space wrap size="small">
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setUploadOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 font-medium shadow-xs"
            >
              Upload dataset
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void query.refetch()}
              loading={query.isFetching}
            >
              Refresh
            </Button>
          </Space>
        </div>
      </div>

      <div className="flex-1 space-y-5 p-6">
        {/* KPI Metrics Cards Strip */}
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Card size="small" className="border-slate-200 shadow-xs">
              <Statistic
                title={<span className="text-xs font-medium text-slate-500">Total Datasets</span>}
                value={displayTotal}
                prefix={<DatabaseOutlined className="text-blue-500" />}
                valueStyle={{ fontSize: "1.25rem", fontWeight: 700, color: "#1e293b" }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={6}>
            <Card size="small" className="border-slate-200 shadow-xs">
              <Statistic
                title={<span className="text-xs font-medium text-slate-500">Ready for Use</span>}
                value={readyDatasetsCount}
                prefix={<CheckCircleOutlined className="text-emerald-500" />}
                valueStyle={{ fontSize: "1.25rem", fontWeight: 700, color: "#059669" }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={6}>
            <Card size="small" className="border-slate-200 shadow-xs">
              <Statistic
                title={<span className="text-xs font-medium text-slate-500">Total Samples</span>}
                value={totalSamplesCount}
                prefix={<FileTextOutlined className="text-indigo-500" />}
                valueStyle={{ fontSize: "1.25rem", fontWeight: 700, color: "#4f46e5" }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={6}>
            <Card size="small" className="border-slate-200 shadow-xs">
              <Statistic
                title={<span className="text-xs font-medium text-slate-500">Active Pipelines</span>}
                value={activeProcessingCount}
                prefix={
                  activeProcessingCount > 0 ? (
                    <SyncOutlined spin className="text-amber-500" />
                  ) : (
                    <CheckCircleOutlined className="text-slate-400" />
                  )
                }
                valueStyle={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: activeProcessingCount > 0 ? "#d97706" : "#64748b",
                }}
              />
            </Card>
          </Col>
        </Row>

        {/* Enhanced Filter Toolbar Card */}
        <Card size="small" className="border-slate-200 bg-white shadow-xs">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">Filter Datasets</span>
                {isFiltered && (
                  <Tag color="blue" closable onClose={handleResetFilters}>
                    Filters active
                  </Tag>
                )}
                <span className="text-xs text-slate-400">
                  Polling every {EVALUATION_POLL_INTERVAL_MS / 1000}s while active
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Segmented
                  value={viewMode}
                  onChange={(v) => setViewMode(v as "table" | "cards")}
                  options={[
                    { label: "Table", value: "table", icon: <TableOutlined /> },
                    { label: "Cards", value: "cards", icon: <AppstoreOutlined /> },
                  ]}
                  size="small"
                />
                {isFiltered && (
                  <Button size="small" icon={<ClearOutlined />} onClick={handleResetFilters}>
                    Reset
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Search Query
                </label>
                <Input
                  placeholder="Search datasets…"
                  allowClear
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  prefix={<SearchOutlined className="text-slate-400" />}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
                <Select
                  allowClear
                  placeholder="All Statuses"
                  options={DATASET_STATUSES}
                  value={status}
                  onChange={(v) => {
                    setStatus(v);
                    setPage(1);
                  }}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Origin</label>
                <Select
                  allowClear
                  placeholder="All Origins"
                  options={DATASET_ORIGINS}
                  value={origin}
                  onChange={(v) => {
                    setOrigin(v);
                    setPage(1);
                  }}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Source Type</label>
                <Select
                  allowClear
                  placeholder="All Source Types"
                  options={SOURCE_TYPES}
                  value={sourceType}
                  onChange={(v) => {
                    setSourceType(v);
                    setPage(1);
                  }}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          </div>
        </Card>

        {query.isError ? (
          <Alert
            type="error"
            showIcon
            message="Failed to load datasets"
            description={getApiErrorMessage(query.error)}
            action={
              <Button size="small" onClick={() => void query.refetch()}>
                Retry
              </Button>
            }
          />
        ) : null}

        {/* Main Content: Table or Cards View */}
        {viewMode === "table" ? (
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-xs">
            <DatasetsTable
              data={pagedDatasets}
              loading={query.isLoading || query.isFetching}
              deletePending={deletePending}
              total={displayTotal}
              page={page}
              pageSize={pageSize}
              onPageChange={(p, s) => {
                setPage(p);
                setPageSize(s);
              }}
              onViewSamples={setSamplesDataset}
              onSoftDelete={handleSoftDelete}
              onHardDelete={handleHardDelete}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {pagedDatasets.length === 0 ? (
              <Card className="border-slate-200 text-center py-10 shadow-xs">
                <Empty description="No datasets match your filters." />
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pagedDatasets.map((d) => {
                  const del = getDatasetDeleteAvailability(d, {
                    mutating: deletePending,
                  });
                  const originKey = datasetOrigin(d);
                  const originCfg = ORIGIN_CONFIG[originKey] ?? {
                    label: originKey,
                    color: "default",
                  };

                  return (
                    <Card
                      key={d.id}
                      size="small"
                      className="border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                          <div>
                            <div className="font-semibold text-slate-800 text-sm">
                              {d.name}
                            </div>
                            <span className="text-xs text-slate-400">v{d.version}</span>
                          </div>
                          <StatusTag status={d.status} />
                        </div>

                        {d.status === "uploading" || d.status === "processing" ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-slate-500">
                              <span>Processing dataset…</span>
                            </div>
                            <Progress
                              percent={d.status === "processing" ? 60 : 30}
                              size="small"
                              status="active"
                            />
                          </div>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-2">
                          <Tag color={originCfg.color} className="m-0 text-xs">
                            {originCfg.label}
                          </Tag>
                          <span className="text-xs text-slate-500">
                            <strong>{(d.sample_count ?? 0).toLocaleString()}</strong> samples
                          </span>
                        </div>

                        {d.manifest_digest && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            Digest: {truncateDigest(d.manifest_digest)}
                          </div>
                        )}

                        <div className="text-xs text-slate-400">
                          Created {dayjs(d.created_at).format("YYYY-MM-DD HH:mm")}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                        <Button
                          size="small"
                          type="primary"
                          ghost
                          icon={<EyeOutlined />}
                          onClick={() => setSamplesDataset(d)}
                        >
                          Samples
                        </Button>

                        <Space size={4}>
                          <Button
                            size="small"
                            disabled={!del.canSoftDelete}
                            onClick={() => handleSoftDelete(d)}
                          >
                            Archive
                          </Button>
                          <Button
                            size="small"
                            danger
                            disabled={!del.canHardDelete}
                            onClick={() => handleHardDelete(d)}
                          >
                            Delete
                          </Button>
                        </Space>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Pagination for Cards View */}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
              <Typography.Text type="secondary" className="text-xs">
                Showing {(page - 1) * pageSize + 1} -{" "}
                {Math.min(page * pageSize, displayTotal)} of{" "}
                {displayTotal.toLocaleString()} datasets
              </Typography.Text>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={displayTotal}
                showSizeChanger
                pageSizeOptions={["10", "20", "50"]}
                onChange={(p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                }}
              />
            </div>
          </div>
        )}
      </div>

      <UploadDatasetModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <DatasetSamplesDrawer
        open={Boolean(samplesDataset)}
        dataset={samplesDataset}
        onClose={() => setSamplesDataset(null)}
      />
    </div>
  );
}
