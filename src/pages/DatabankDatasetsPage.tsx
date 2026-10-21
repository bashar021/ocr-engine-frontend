import {
  AppstoreOutlined,
  ClearOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileTextOutlined,
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TableOutlined,
  TagsOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Radio,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadFile } from "antd/es/upload/interface";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import {
  createDatabankDataset,
  deleteDatabankDataset,
  downloadDatabankCsv,
  listDatabankDatasets,
  uploadRawToDatabank,
  uploadToDatabank,
} from "@/api/databank";
import { StatusTag } from "@/components/common/StatusTag";
import { DatabankSamplesDrawer } from "@/components/databank/DatabankSamplesDrawer";
import { useTaskContext } from "@/features/tasks/TaskContext";
import { useDebounce } from "@/hooks/useDebounce";
import type { DatabankDataset } from "@/types/databank";

type DatasetScope = "all" | "raw" | "label" | "both";

export function getDatasetScope(dataset: DatabankDataset): "raw" | "label" | "both" | "empty" {
  const rawCount = dataset.raw_pending_count ?? (dataset.category_counts?.raw?.total ?? 0);
  const total = dataset.sample_count ?? 0;
  const labeledCount = Math.max(0, total - rawCount);

  if (rawCount > 0 && labeledCount > 0) return "both";
  if (rawCount > 0) return "raw";
  if (labeledCount > 0) return "label";

  const metaType = (dataset.metadata?.dataset_type as string) || dataset.dataset_type;
  if (metaType === "raw") return "raw";
  if (metaType === "label") return "label";
  return "empty";
}

export function DatabankDatasetsPage() {
  const { activeTaskKey } = useTaskContext();
  const { message: appMessage } = App.useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Search & Filter state
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [scopeFilter, setScopeFilter] = useState<DatasetScope>("all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedUploadDatasetId, setSelectedUploadDatasetId] = useState<string>("");
  const [uploadMode, setUploadMode] = useState<"raw" | "label">("label");
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);
  const [samplesDataset, setSamplesDataset] = useState<DatabankDataset | null>(null);

  // Datasets Query
  const datasetsQuery = useQuery({
    queryKey: ["databank", "datasets-list", activeTaskKey, statusFilter, debouncedSearch],
    queryFn: () =>
      listDatabankDatasets(activeTaskKey, {
        status: statusFilter,
        search: debouncedSearch.trim() || undefined,
        limit: 1000,
      }),
  });

  const allDatasets = datasetsQuery.data?.datasets ?? [];

  // Filter datasets based on scope
  const filteredDatasets = useMemo(() => {
    if (scopeFilter === "all") return allDatasets;
    return allDatasets.filter((d) => {
      const scope = getDatasetScope(d);
      if (scopeFilter === "raw") return scope === "raw" || scope === "both";
      if (scopeFilter === "label") return scope === "label" || scope === "both";
      if (scopeFilter === "both") return scope === "both";
      return true;
    });
  }, [allDatasets, scopeFilter]);

  // Paginated rows
  const pagedDatasets = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDatasets.slice(start, start + pageSize);
  }, [filteredDatasets, page, pageSize]);

  // KPIs
  const totalDatasetsCount = allDatasets.length;
  const rawDatasetsCount = allDatasets.filter(
    (d) => getDatasetScope(d) === "raw" || getDatasetScope(d) === "both",
  ).length;
  const labelDatasetsCount = allDatasets.filter(
    (d) => getDatasetScope(d) === "label" || getDatasetScope(d) === "both",
  ).length;
  const totalSamplesCount = allDatasets.reduce((sum, d) => sum + (d.sample_count || 0), 0);
  const totalHasGtCount = allDatasets.reduce((sum, d) => sum + (d.has_gt_count || 0), 0);

  // Create Dataset Mutation
  const createMutation = useMutation({
    mutationFn: (values: { name: string; description?: string; dataset_type: string }) =>
      createDatabankDataset({
        ocr_type: activeTaskKey,
        name: values.name,
        description: values.description,
        dataset_type: values.dataset_type,
      }),
    onSuccess: (newDs) => {
      appMessage.success(`Created dataset "${newDs.name}"`);
      setCreateModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["databank", "datasets-list"] });
    },
    onError: (err) => appMessage.error(getApiErrorMessage(err)),
  });

  // Delete Dataset Mutation
  const deleteMutation = useMutation({
    mutationFn: (datasetId: string) => deleteDatabankDataset(datasetId),
    onSuccess: () => {
      appMessage.success("Dataset deleted successfully");
      void queryClient.invalidateQueries({ queryKey: ["databank", "datasets-list"] });
    },
    onError: (err) => appMessage.error(getApiErrorMessage(err)),
  });

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async (values: { datasetId: string; file: File; mode: "raw" | "label" }) => {
      if (values.mode === "raw") {
        return uploadRawToDatabank(activeTaskKey, values.file, values.datasetId);
      }
      return uploadToDatabank(activeTaskKey, values.file, values.datasetId);
    },
    onSuccess: (res) => {
      appMessage.success(res.message || `Uploaded ${res.added_samples ?? 0} samples`);
      setUploadModalOpen(false);
      setUploadFileList([]);
      void queryClient.invalidateQueries({ queryKey: ["databank", "datasets-list"] });
    },
    onError: (err) => appMessage.error(getApiErrorMessage(err)),
  });

  const handleDownloadCsv = async (dataset: DatabankDataset) => {
    try {
      const { blob, filename } = await downloadDatabankCsv(dataset.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      appMessage.success(`Downloaded ${filename}`);
    } catch (err) {
      appMessage.error(getApiErrorMessage(err));
    }
  };

  const isFiltered = Boolean(searchInput || statusFilter || scopeFilter !== "all");

  const handleResetFilters = () => {
    setSearchInput("");
    setStatusFilter(undefined);
    setScopeFilter("all");
    setPage(1);
  };

  const columns: ColumnsType<DatabankDataset> = [
    {
      title: "Dataset Name",
      key: "name",
      fixed: "left",
      width: 230,
      render: (_, row) => {
        const isDefault = row.name === "data-bank";
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">{row.name}</span>
              {isDefault && (
                <Tag color="geekblue" className="m-0 text-[10px]">
                  Default Bank
                </Tag>
              )}
            </div>
            <div className="text-xs text-slate-400">
              v{row.version} • {row.ocr_type}
            </div>
            {row.description && (
              <div className="line-clamp-1 text-xs text-slate-500" title={row.description}>
                {row.description}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Scope / Type",
      key: "scope",
      width: 130,
      render: (_, row) => {
        const scope = getDatasetScope(row);
        if (scope === "raw") {
          return (
            <Tag color="orange" className="font-medium">
              Raw Data
            </Tag>
          );
        }
        if (scope === "label") {
          return (
            <Tag color="cyan" className="font-medium">
              Label Data
            </Tag>
          );
        }
        if (scope === "both") {
          return (
            <Tag color="purple" className="font-medium">
              Raw & Label
            </Tag>
          );
        }
        return <Tag color="default">Empty</Tag>;
      },
    },
    {
      title: "Total Samples",
      dataIndex: "sample_count",
      key: "sample_count",
      width: 120,
      sorter: (a, b) => (a.sample_count || 0) - (b.sample_count || 0),
      render: (count: number) => (
        <span className="font-semibold text-slate-800">
          {(count || 0).toLocaleString()}
        </span>
      ),
    },
    {
      title: "Content Breakdown",
      key: "breakdown",
      width: 250,
      render: (_, row) => {
        const raw = row.raw_pending_count ?? (row.category_counts?.raw?.total ?? 0);
        const reviewed = row.reviewed_count || 0;
        const unreviewed = row.unreviewed_count || 0;
        const hasGt = row.has_gt_count || 0;

        return (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {raw > 0 && (
              <Tag color="orange" className="m-0 text-[11px]">
                {raw.toLocaleString()} Raw
              </Tag>
            )}
            {reviewed > 0 && (
              <Tag color="green" className="m-0 text-[11px]">
                {reviewed.toLocaleString()} Reviewed
              </Tag>
            )}
            {unreviewed > 0 && (
              <Tag color="blue" className="m-0 text-[11px]">
                {unreviewed.toLocaleString()} Unreviewed
              </Tag>
            )}
            {hasGt > 0 && (
              <Tag color="emerald" className="m-0 text-[11px]">
                {hasGt.toLocaleString()} Has GT
              </Tag>
            )}
            {row.sample_count === 0 && (
              <span className="text-slate-400">No samples</span>
            )}
          </div>
        );
      },
    },
    {
      title: "Categories",
      key: "categories",
      width: 220,
      render: (_, row) => {
        const catCounts = row.category_counts || {};
        const entries = Object.entries(catCounts).filter(
          ([cat, data]) => cat !== "" && cat !== "raw" && (data?.total || 0) > 0,
        );

        if (entries.length === 0) {
          return <span className="text-xs text-slate-400">None</span>;
        }

        return (
          <div className="flex flex-wrap gap-1">
            {entries.slice(0, 4).map(([cat, data]) => (
              <Tag
                key={cat}
                color={cat === "blurry" ? "gold" : cat === "dead" ? "red" : "geekblue"}
                className="m-0 text-[10px]"
              >
                {cat} ({data.total})
              </Tag>
            ))}
            {entries.length > 4 && (
              <Tag className="m-0 text-[10px]">+{entries.length - 4} more</Tag>
            )}
          </div>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (status: string) => <StatusTag status={status || "ready"} />,
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      width: 140,
      render: (val: string | null) =>
        val ? dayjs(val).format("YYYY-MM-DD HH:mm") : "—",
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 320,
      render: (_, row) => {
        const isDefault = row.name === "data-bank";
        return (
          <Space size="small" wrap>
            <Tooltip title="Open in Label Data tab">
              <Button
                size="small"
                type="primary"
                ghost
                icon={<TagsOutlined />}
                onClick={() => navigate(`/databank/label-data?dataset_id=${row.id}`)}
              >
                Label Data
              </Button>
            </Tooltip>

            <Tooltip title="Open in Raw Data tab">
              <Button
                size="small"
                icon={<InboxOutlined />}
                onClick={() => navigate(`/databank/raw?dataset_id=${row.id}`)}
              >
                Raw Data
              </Button>
            </Tooltip>

            <Tooltip title="Preview samples in this dataset">
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => setSamplesDataset(row)}
              >
                Samples
              </Button>
            </Tooltip>

            <Tooltip title="Export samples CSV">
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => void handleDownloadCsv(row)}
              />
            </Tooltip>

            {!isDefault && (
              <Popconfirm
                title="Delete dataset?"
                description={`Are you sure you want to delete "${row.name}"? This action cannot be undone.`}
                onConfirm={() => deleteMutation.mutate(row.id)}
                okText="Delete"
                okButtonProps={{ danger: true }}
                cancelText="Cancel"
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-auto bg-slate-50/50">
      {/* Enhanced Top Header Bar */}
      <div className="border-b border-slate-200 bg-white px-6 py-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <DatabaseOutlined className="text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Datasets</h1>
              <p className="text-xs text-slate-500">
                Complete visibility and management for all Raw Data and Label Data datasets.
              </p>
            </div>
          </div>

          <Space wrap size="small">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
              className="bg-gradient-to-r from-teal-700 to-emerald-700 font-medium shadow-xs"
            >
              Create Dataset
            </Button>
            <Button
              icon={<UploadOutlined />}
              onClick={() => {
                if (allDatasets.length > 0) {
                  setSelectedUploadDatasetId(allDatasets[0].id);
                }
                setUploadModalOpen(true);
              }}
            >
              Upload Data
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void datasetsQuery.refetch()}
              loading={datasetsQuery.isFetching}
            >
              Refresh
            </Button>
          </Space>
        </div>
      </div>

      <div className="flex-1 space-y-5 p-6">
        {/* KPI Strip */}
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Card size="small" className="border-slate-200 shadow-xs">
              <Statistic
                title={<span className="text-xs font-medium text-slate-500">Total Datasets</span>}
                value={totalDatasetsCount}
                prefix={<DatabaseOutlined className="text-teal-600" />}
                valueStyle={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f766e" }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={6}>
            <Card size="small" className="border-slate-200 shadow-xs">
              <Statistic
                title={<span className="text-xs font-medium text-slate-500">Raw Data Datasets</span>}
                value={rawDatasetsCount}
                prefix={<InboxOutlined className="text-orange-500" />}
                valueStyle={{ fontSize: "1.25rem", fontWeight: 700, color: "#ea580c" }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={6}>
            <Card size="small" className="border-slate-200 shadow-xs">
              <Statistic
                title={<span className="text-xs font-medium text-slate-500">Label Data Datasets</span>}
                value={labelDatasetsCount}
                prefix={<TagsOutlined className="text-cyan-600" />}
                valueStyle={{ fontSize: "1.25rem", fontWeight: 700, color: "#0891b2" }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={6}>
            <Card size="small" className="border-slate-200 shadow-xs">
              <Statistic
                title={<span className="text-xs font-medium text-slate-500">Total Samples</span>}
                value={totalSamplesCount}
                prefix={<FileTextOutlined className="text-indigo-500" />}
                suffix={
                  <span className="text-xs font-normal text-slate-400">
                    ({totalHasGtCount.toLocaleString()} with GT)
                  </span>
                }
                valueStyle={{ fontSize: "1.25rem", fontWeight: 700, color: "#4f46e5" }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filter Toolbar Card */}
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
                  Showing {filteredDatasets.length} of {totalDatasetsCount} datasets
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Search Query
                </label>
                <Input
                  placeholder="Search dataset name or description…"
                  allowClear
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setPage(1);
                  }}
                  prefix={<SearchOutlined className="text-slate-400" />}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Dataset Scope / Type
                </label>
                <Select
                  value={scopeFilter}
                  onChange={(v) => {
                    setScopeFilter(v);
                    setPage(1);
                  }}
                  options={[
                    { label: "All Datasets", value: "all" },
                    { label: "Raw Data Datasets", value: "raw" },
                    { label: "Label Data Datasets", value: "label" },
                    { label: "Raw & Label (Both)", value: "both" },
                  ]}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Status
                </label>
                <Select
                  allowClear
                  placeholder="All Statuses"
                  value={statusFilter}
                  onChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                  options={[
                    { label: "Ready", value: "ready" },
                    { label: "Processing", value: "processing" },
                    { label: "Failed", value: "failed" },
                  ]}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          </div>
        </Card>

        {datasetsQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Failed to load datasets"
            description={getApiErrorMessage(datasetsQuery.error)}
            action={
              <Button size="small" onClick={() => void datasetsQuery.refetch()}>
                Retry
              </Button>
            }
          />
        ) : null}

        {/* Content: Table or Cards */}
        {viewMode === "table" ? (
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-xs">
            <Table<DatabankDataset>
              rowKey="id"
              columns={columns}
              dataSource={pagedDatasets}
              loading={datasetsQuery.isLoading || datasetsQuery.isFetching}
              pagination={{
                current: page,
                pageSize,
                total: filteredDatasets.length,
                showSizeChanger: true,
                pageSizeOptions: ["10", "25", "50", "100"],
                onChange: (p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                },
              }}
              locale={{
                emptyText: (
                  <Empty
                    description="No datasets match the current filters."
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ),
              }}
              scroll={{ x: 1200 }}
              size="middle"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {pagedDatasets.length === 0 ? (
              <Card className="border-slate-200 py-10 text-center shadow-xs">
                <Empty description="No datasets match your filters." />
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pagedDatasets.map((d) => {
                  const scope = getDatasetScope(d);
                  const isDefault = d.name === "data-bank";
                  const raw = d.raw_pending_count ?? (d.category_counts?.raw?.total ?? 0);
                  const reviewed = d.reviewed_count || 0;
                  const unreviewed = d.unreviewed_count || 0;

                  return (
                    <Card
                      key={d.id}
                      size="small"
                      className="flex flex-col justify-between border-slate-200 shadow-2xs transition-shadow hover:shadow-xs"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                          <div>
                            <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-sm">
                              {d.name}
                              {isDefault && (
                                <Tag color="geekblue" className="m-0 text-[10px]">
                                  Default
                                </Tag>
                              )}
                            </div>
                            <span className="text-xs text-slate-400">v{d.version}</span>
                          </div>
                          <StatusTag status={d.status || "ready"} />
                        </div>

                        {d.description && (
                          <div className="text-xs text-slate-500 line-clamp-2">
                            {d.description}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5">
                          {scope === "raw" && (
                            <Tag color="orange" className="m-0 text-xs">
                              Raw Data
                            </Tag>
                          )}
                          {scope === "label" && (
                            <Tag color="cyan" className="m-0 text-xs">
                              Label Data
                            </Tag>
                          )}
                          {scope === "both" && (
                            <Tag color="purple" className="m-0 text-xs">
                              Raw & Label
                            </Tag>
                          )}
                          <span className="text-xs text-slate-500">
                            <strong>{(d.sample_count || 0).toLocaleString()}</strong> samples
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1 text-xs">
                          {raw > 0 && <Tag color="orange">{raw} Raw</Tag>}
                          {reviewed > 0 && <Tag color="green">{reviewed} Reviewed</Tag>}
                          {unreviewed > 0 && <Tag color="blue">{unreviewed} Unreviewed</Tag>}
                        </div>

                        <div className="text-[11px] text-slate-400">
                          Created {d.created_at ? dayjs(d.created_at).format("YYYY-MM-DD HH:mm") : "—"}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                        <Space size={4}>
                          <Button
                            size="small"
                            type="primary"
                            ghost
                            icon={<TagsOutlined />}
                            onClick={() => navigate(`/databank/label-data?dataset_id=${d.id}`)}
                          >
                            Label
                          </Button>
                          <Button
                            size="small"
                            icon={<InboxOutlined />}
                            onClick={() => navigate(`/databank/raw?dataset_id=${d.id}`)}
                          >
                            Raw
                          </Button>
                          <Button
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => setSamplesDataset(d)}
                          >
                            Samples
                          </Button>
                        </Space>

                        <Space size={4}>
                          <Button
                            size="small"
                            icon={<DownloadOutlined />}
                            onClick={() => void handleDownloadCsv(d)}
                          />
                          {!isDefault && (
                            <Popconfirm
                              title="Delete dataset?"
                              description={`Are you sure you want to delete "${d.name}"?`}
                              onConfirm={() => deleteMutation.mutate(d.id)}
                              okText="Delete"
                              okButtonProps={{ danger: true }}
                            >
                              <Button size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                          )}
                        </Space>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
              <Typography.Text type="secondary" className="text-xs">
                Showing {(page - 1) * pageSize + 1} -{" "}
                {Math.min(page * pageSize, filteredDatasets.length)} of{" "}
                {filteredDatasets.length.toLocaleString()} datasets
              </Typography.Text>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={filteredDatasets.length}
                showSizeChanger
                pageSizeOptions={["10", "25", "50", "100"]}
                onChange={(p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Create Dataset Modal */}
      <CreateDatasetModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={(vals) => createMutation.mutateAsync(vals)}
        loading={createMutation.isPending}
      />

      {/* Upload Data Modal */}
      <UploadDataModal
        open={uploadModalOpen}
        datasets={allDatasets}
        selectedDatasetId={selectedUploadDatasetId}
        onSelectDatasetId={setSelectedUploadDatasetId}
        uploadMode={uploadMode}
        onSelectUploadMode={setUploadMode}
        fileList={uploadFileList}
        onFileListChange={setUploadFileList}
        onClose={() => setUploadModalOpen(false)}
        onSubmit={async () => {
          if (!selectedUploadDatasetId || uploadFileList.length === 0) return;
          const file = uploadFileList[0].originFileObj as File;
          await uploadMutation.mutateAsync({
            datasetId: selectedUploadDatasetId,
            file,
            mode: uploadMode,
          });
        }}
        loading={uploadMutation.isPending}
      />

      {/* Samples Drawer */}
      <DatabankSamplesDrawer
        open={Boolean(samplesDataset)}
        dataset={samplesDataset}
        onClose={() => setSamplesDataset(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Dataset Modal Component
// ---------------------------------------------------------------------------

function CreateDatasetModal({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (vals: { name: string; description?: string; dataset_type: string }) => Promise<unknown>;
  loading: boolean;
}) {
  const [form] = Form.useForm();

  return (
    <Modal
      open={open}
      title="Create New Dataset"
      onCancel={onClose}
      okText="Create Dataset"
      confirmLoading={loading}
      onOk={() => {
        form.validateFields().then(async (values) => {
          await onSubmit(values);
          form.resetFields();
        });
      }}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ dataset_type: "label" }}
      >
        <Form.Item
          name="name"
          label="Dataset Name"
          rules={[
            { required: true, message: "Please input dataset name" },
            {
              pattern: /^[a-zA-Z0-9_-]+$/,
              message: "Letters, numbers, underscores, and dashes only",
            },
          ]}
        >
          <Input placeholder="e.g. march_raw_batch or meter_training_v1" />
        </Form.Item>

        <Form.Item name="description" label="Description (Optional)">
          <Input.TextArea rows={3} placeholder="Brief summary of dataset contents or purpose" />
        </Form.Item>

        <Form.Item name="dataset_type" label="Dataset Purpose / Type" required>
          <Radio.Group className="w-full">
            <Space direction="vertical" className="w-full">
              <Radio value="label">
                <span className="font-medium text-slate-800">Label Data</span>
                <div className="text-xs text-slate-500">
                  For categorized, labeled, and annotated ground-truth data
                </div>
              </Radio>
              <Radio value="raw">
                <span className="font-medium text-slate-800">Raw Data</span>
                <div className="text-xs text-slate-500">
                  For ingesting unreviewed raw images to extract digits via Gemini
                </div>
              </Radio>
            </Space>
          </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Upload Data Modal Component
// ---------------------------------------------------------------------------

function UploadDataModal({
  open,
  datasets,
  selectedDatasetId,
  onSelectDatasetId,
  uploadMode,
  onSelectUploadMode,
  fileList,
  onFileListChange,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  datasets: DatabankDataset[];
  selectedDatasetId: string;
  onSelectDatasetId: (id: string) => void;
  uploadMode: "raw" | "label";
  onSelectUploadMode: (mode: "raw" | "label") => void;
  fileList: UploadFile[];
  onFileListChange: (files: UploadFile[]) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  loading: boolean;
}) {
  return (
    <Modal
      open={open}
      title="Upload Data to Dataset"
      onCancel={onClose}
      okText="Start Upload"
      confirmLoading={loading}
      okButtonProps={{ disabled: !selectedDatasetId || fileList.length === 0 }}
      onOk={onSubmit}
      destroyOnHidden
    >
      <div className="space-y-4 py-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Target Dataset <span className="text-red-500">*</span>
          </label>
          <Select
            value={selectedDatasetId}
            onChange={onSelectDatasetId}
            style={{ width: "100%" }}
            placeholder="Select dataset"
            options={datasets.map((d) => ({
              label: `${d.name} (${(d.sample_count || 0).toLocaleString()} samples)`,
              value: d.id,
            }))}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Upload Workflow Mode
          </label>
          <Radio.Group
            value={uploadMode}
            onChange={(e) => onSelectUploadMode(e.target.value)}
            className="w-full"
          >
            <Space direction="vertical" className="w-full">
              <Radio value="label">
                <span className="font-medium text-slate-800">Label Data</span>
                <span className="block text-xs text-slate-500">
                  Processes and categorizes images with model predictions
                </span>
              </Radio>
              <Radio value="raw">
                <span className="font-medium text-slate-800">Raw Data</span>
                <span className="block text-xs text-slate-500">
                  Ingests raw images without model prediction (ready for Gemini GT extraction)
                </span>
              </Radio>
            </Space>
          </Radio.Group>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Data File (ZIP or Image) <span className="text-red-500">*</span>
          </label>
          <Upload.Dragger
            fileList={fileList}
            beforeUpload={(file) => {
              onFileListChange([file as unknown as UploadFile]);
              return false;
            }}
            onRemove={() => onFileListChange([])}
            maxCount={1}
            accept=".zip,.jpg,.jpeg,.png,.webp"
          >
            <p className="ant-upload-drag-icon">
              <CloudUploadOutlined className="text-3xl text-teal-600" />
            </p>
            <p className="ant-upload-text font-medium text-slate-800">
              Click or drag file to this area to upload
            </p>
            <p className="ant-upload-hint text-xs text-slate-400">
              Support for single image or ZIP archive containing dataset images
            </p>
          </Upload.Dragger>
        </div>
      </div>
    </Modal>
  );
}
