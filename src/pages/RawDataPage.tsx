import {
  AppstoreOutlined,
  CheckCircleOutlined,
  CheckSquareOutlined,
  ClearOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FilterOutlined,
  InboxOutlined,
  LeftOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SaveOutlined,
  SearchOutlined,
  SyncOutlined,
  TableOutlined,
  TagsOutlined,
  ThunderboltOutlined,
  UndoOutlined,
  UploadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadFile } from "antd/es/upload/interface";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import {
  batchMoveDatabankSamples,
  batchSetDatabankSampleCategory,
  createDatabankDataset,
  deleteDatabankSample,
  downloadDatabankCsv,
  extractDatabankSampleWithGemini,
  fetchDatabankSampleImageUrl,
  getDatabank,
  getDatabankDataset,
  listDatabankDatasets,
  listDatabankSamples,
  reanalyzeDatabankUnreviewed,
  reviewDatabankSample,
  setDatabankSampleCategory,
  syncDatabankReviewedEval,
  uploadRawToDatabank,
} from "@/api/databank";
import { getGeminiConfig, getGeminiPrompts } from "@/api/scraper";
import { OcrImageViewer } from "@/components/ocr/OcrImageViewer";
import { useTaskContext } from "@/features/tasks/TaskContext";
import { useDebounce } from "@/hooks/useDebounce";
import { parseNumericalValue } from "@/pages/DatabankListPage";
import type {
  DatabankSample,
} from "@/types/databank";
import type { OcrBoundingBox } from "@/types/ocr";

function toViewerBox(
  box: DatabankSample["display_bbox"] | DatabankSample["corrected_bbox"] | DatabankSample["upload_bbox"] | DatabankSample["bbox"],
): OcrBoundingBox | null {
  if (!box) return null;
  return {
    x1: box.x1,
    y1: box.y1,
    x2: box.x2,
    y2: box.y2,
    confidence: box.confidence ?? 0.95,
    label: box.label ?? "gemini",
  };
}

// ---------------------------------------------------------------------------
// Cached Image Thumbnail for Raw Samples
// ---------------------------------------------------------------------------

function RawSampleThumbnail({
  datasetId,
  sampleId,
  filename,
  className = "h-14 w-14",
  onClick,
}: {
  datasetId: string;
  sampleId: string;
  filename: string;
  className?: string;
  onClick?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;

    void fetchDatabankSampleImageUrl(datasetId, sampleId)
      .then((blobUrl) => {
        if (active) {
          objectUrl = blobUrl;
          setUrl(blobUrl);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [datasetId, sampleId]);

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      className={`relative flex items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-100 ${className} ${
        onClick ? "cursor-pointer transition hover:border-blue-400 hover:shadow-xs" : ""
      }`}
    >
      {loading ? (
        <Spin size="small" />
      ) : url ? (
        <img
          src={url}
          alt={filename}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : failed ? (
        <PictureOutlined className="text-slate-400" />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main RawDataPage Component
// ---------------------------------------------------------------------------

export function RawDataPage() {
  const { modal, message: appMessage } = App.useApp();
  const queryClient = useQueryClient();
  const { activeTaskKey } = useTaskContext();
  const [searchParams, setSearchParams] = useSearchParams();

  // Datasets query for dropdown - strictly Raw Data datasets
  const datasetsQuery = useQuery({
    queryKey: ["databank", "datasets-list", activeTaskKey, "raw"],
    queryFn: () => listDatabankDatasets(activeTaskKey, { dataset_type: "raw" }),
  });

  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(
    () => searchParams.get("dataset_id") || "",
  );

  // Fallback default raw bank query
  const defaultBankQuery = useQuery({
    queryKey: ["databank", "default-raw-bank", activeTaskKey],
    queryFn: () => getDatabank(activeTaskKey, "raw"),
  });

  const effectiveDatasetId = useMemo(() => {
    if (selectedDatasetId) return selectedDatasetId;
    const firstFromList = datasetsQuery.data?.datasets?.[0]?.id;
    if (firstFromList) return firstFromList;
    return defaultBankQuery.data?.id || "";
  }, [selectedDatasetId, datasetsQuery.data?.datasets, defaultBankQuery.data?.id]);

  // Active dataset details
  const activeDatasetQuery = useQuery({
    queryKey: ["databank", "dataset", effectiveDatasetId],
    enabled: Boolean(effectiveDatasetId),
    queryFn: () => getDatabankDataset(effectiveDatasetId),
  });

  const dataset = activeDatasetQuery.data || defaultBankQuery.data;
  const datasetId = dataset?.id;

  // Filters state
  const [statusFilter, setStatusFilter] = useState<"all" | "unreviewed" | "reviewed">(
    (searchParams.get("status") as "all" | "unreviewed" | "reviewed") || "all",
  );
  const [categoryFilter, setCategoryFilter] = useState<string>(
    searchParams.get("category") || "all",
  );
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const debouncedSearch = useDebounce(searchInput, 400);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [viewMode, setViewMode] = useState<"table" | "gallery">("table");

  // Selection for batch actions
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Move Modal States
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveTargetType, setMoveTargetType] = useState<"raw" | "label">("raw");
  const [moveTargetDatasetId, setMoveTargetDatasetId] = useState<string>("");
  const [moveTargetCategory, setMoveTargetCategory] = useState<string>("raw");

  // Query all datasets (both raw and label) for the Move modal
  const allDatasetsQuery = useQuery({
    queryKey: ["databank", "datasets-all-list", activeTaskKey],
    queryFn: () => listDatabankDatasets(activeTaskKey),
  });

  const rawDatasets = useMemo(() => {
    return (allDatasetsQuery.data?.datasets || []).filter(
      (d) =>
        (d.metadata as Record<string, unknown> | undefined)?.dataset_type === "raw" ||
        d.name === "raw-data-bank" ||
        d.name.startsWith("raw-"),
    );
  }, [allDatasetsQuery.data?.datasets]);

  const labelDatasets = useMemo(() => {
    return (allDatasetsQuery.data?.datasets || []).filter(
      (d) =>
        !(
          (d.metadata as Record<string, unknown> | undefined)?.dataset_type === "raw" ||
          d.name === "raw-data-bank" ||
          d.name.startsWith("raw-")
        ),
    );
  }, [allDatasetsQuery.data?.datasets]);

  // Modals state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [createDatasetModalOpen, setCreateDatasetModalOpen] = useState(false);
  const [batchGeminiOpen, setBatchGeminiOpen] = useState(false);
  const [getValueSample, setGetValueSample] = useState<DatabankSample | null>(null);
  const [reviewSample, setReviewSample] = useState<DatabankSample | null>(null);

  // Sync state back to URL
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (statusFilter !== "all") next.set("status", statusFilter);
    else next.delete("status");

    if (categoryFilter !== "all") next.set("category", categoryFilter);
    else next.delete("category");

    if (debouncedSearch) next.set("search", debouncedSearch);
    else next.delete("search");

    if (selectedDatasetId) next.set("dataset_id", selectedDatasetId);
    else next.delete("dataset_id");

    setSearchParams(next, { replace: true });
  }, [statusFilter, categoryFilter, debouncedSearch, selectedDatasetId, setSearchParams, searchParams]);

  // Query Raw Samples
  const samplesQuery = useQuery({
    queryKey: [
      "databank",
      "raw-samples",
      datasetId,
      statusFilter,
      categoryFilter,
      debouncedSearch,
      page,
      pageSize,
    ],
    enabled: Boolean(datasetId),
    queryFn: () =>
      listDatabankSamples(datasetId!, {
        category: categoryFilter === "all" ? undefined : categoryFilter,
        within_review_status: statusFilter,
        search: debouncedSearch.trim() || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
  });

  // Category options
  const customCategories = useMemo(
    () => dataset?.custom_categories ?? [],
    [dataset?.custom_categories],
  );

  const availableCategories = useMemo(() => {
    return [
      { value: "raw", label: "Raw (Pending)" },
      { value: "ready", label: "Ready" },
      { value: "failed", label: "Failed" },
      ...customCategories
        .filter((c) => c !== "raw" && c !== "ready" && c !== "failed")
        .map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
    ];
  }, [customCategories]);

  // Short Category Tabs for selected raw dataset
  const rawCategoryTabs = useMemo(() => {
    const catCounts = dataset?.category_counts || {};
    const tabs: { key: string; label: string; count: number }[] = [
      {
        key: "all",
        label: "All Categories",
        count: dataset?.sample_count ?? dataset?.raw_pending_count ?? 0,
      },
      {
        key: "raw",
        label: "Raw (Pending)",
        count: catCounts["raw"]?.total ?? dataset?.raw_pending_count ?? 0,
      },
      {
        key: "ready",
        label: "Ready",
        count: catCounts["ready"]?.total ?? 0,
      },
      {
        key: "failed",
        label: "Failed",
        count: catCounts["failed"]?.total ?? 0,
      },
    ];
    for (const c of customCategories) {
      if (c !== "raw" && c !== "ready" && c !== "failed") {
        tabs.push({
          key: c,
          label: c.charAt(0).toUpperCase() + c.slice(1),
          count: catCounts[c]?.total ?? 0,
        });
      }
    }
    return tabs;
  }, [dataset, customCategories]);

  // Target dataset object & categories for Move modal
  const targetDatasetObj = useMemo(() => {
    return (
      allDatasetsQuery.data?.datasets?.find((d) => d.id === moveTargetDatasetId) ||
      dataset
    );
  }, [allDatasetsQuery.data?.datasets, moveTargetDatasetId, dataset]);

  const targetCategoryOptions = useMemo(() => {
    const isTargetRaw =
      (targetDatasetObj?.metadata as Record<string, unknown> | undefined)?.dataset_type === "raw" ||
      targetDatasetObj?.name === "raw-data-bank" ||
      targetDatasetObj?.name?.startsWith("raw-");

    const customCats = Array.isArray(targetDatasetObj?.custom_categories)
      ? targetDatasetObj.custom_categories.filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0 && v !== "raw",
        )
      : [];

    if (isTargetRaw) {
      return [
        { value: "raw", label: "Raw (Pending)" },
        { value: "ready", label: "Ready" },
        { value: "failed", label: "Failed" },
        ...customCats
          .filter((c) => c !== "ready" && c !== "failed")
          .map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
      ];
    }

    return [
      { value: "general", label: "General" },
      { value: "blurry", label: "Blurry" },
      { value: "dead", label: "Dead" },
      ...customCats.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
    ];
  }, [targetDatasetObj]);

  const handleOpenMoveModal = () => {
    setMoveTargetType("raw");
    setMoveTargetDatasetId(effectiveDatasetId);
    setMoveTargetCategory("raw");
    setMoveModalOpen(true);
  };

  const handleTargetTypeChange = (type: "raw" | "label") => {
    setMoveTargetType(type);
    if (type === "raw") {
      const defRawId = effectiveDatasetId || rawDatasets[0]?.id || "";
      setMoveTargetDatasetId(defRawId);
      setMoveTargetCategory("raw");
    } else {
      const defLabelId = labelDatasets[0]?.id || "";
      setMoveTargetDatasetId(defLabelId);
      setMoveTargetCategory("general");
    }
  };

  const handleTargetDatasetChange = (dsId: string) => {
    setMoveTargetDatasetId(dsId);
    const targetObj = allDatasetsQuery.data?.datasets?.find((d) => d.id === dsId);
    const isTargetRaw =
      (targetObj?.metadata as Record<string, unknown> | undefined)?.dataset_type === "raw" ||
      targetObj?.name === "raw-data-bank" ||
      targetObj?.name?.startsWith("raw-");
    setMoveTargetCategory(isTargetRaw ? "raw" : "general");
  };

  // Dataset dropdown options
  const datasetOptions = useMemo(() => {
    const list = datasetsQuery.data?.datasets || [];
    if (list.length === 0 && dataset) {
      return [
        {
          value: dataset.id,
          label: `${dataset.name} (${dataset.sample_count ?? 0} samples)`,
        },
      ];
    }
    return list.map((d) => ({
      value: d.id,
      label: `${d.name} (${d.sample_count ?? 0} samples)`,
    }));
  }, [datasetsQuery.data?.datasets, dataset]);

  // Raw counts - accurate Ground Truth Labeled and pending counts
  const totalRaw =
    dataset?.sample_count ??
    dataset?.raw_pending_count ??
    dataset?.category_counts?.raw?.total ??
    samplesQuery.data?.total ??
    0;
  const hasGtCount =
    dataset?.has_gt_count ??
    dataset?.category_counts?.raw?.has_gt ??
    0;
  const pendingGtCount = Math.max(0, totalRaw - hasGtCount);
  const pendingCount = pendingGtCount;
  const reviewedCount =
    dataset?.reviewed_count ??
    dataset?.category_counts?.raw?.reviewed ??
    0;
  const failedCount = dataset?.category_counts?.failed?.total ?? 0;

  // Mutations
  const createDatasetMutation = useMutation({
    mutationFn: (values: { name: string; description?: string }) =>
      createDatabankDataset({
        ocr_type: activeTaskKey,
        name: values.name,
        description: values.description,
        dataset_type: "raw",
      }),
    onSuccess: (newDs) => {
      appMessage.success(`Created raw dataset "${newDs.name}"`);
      setCreateDatasetModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["databank", "datasets-list"] });
      setSelectedDatasetId(newDs.id);
      setSelectedRowKeys([]);
      setPage(1);
    },
    onError: (error) => appMessage.error(getApiErrorMessage(error)),
  });

  const uploadRawMutation = useMutation({
    mutationFn: (values: { ocr_type: string; file: File; dataset_id?: string }) =>
      uploadRawToDatabank(values.ocr_type, values.file, values.dataset_id),
    onSuccess: (data) => {
      appMessage.success(
        data.message || `Uploaded ${data.added_samples ?? 0} raw samples`,
      );
      setUploadModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
    },
    onError: (error) => appMessage.error(getApiErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (sampleId: string) => deleteDatabankSample(datasetId!, sampleId),
    onSuccess: (res) => {
      appMessage.success(`Deleted ${res.filename}`);
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
    },
    onError: (error) => appMessage.error(getApiErrorMessage(error)),
  });

  const reanalyzeMutation = useMutation({
    mutationFn: () => reanalyzeDatabankUnreviewed(datasetId!, { category: "raw" }),
    onSuccess: () => {
      appMessage.success("Re-analyzing unreviewed raw samples with default model");
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
    },
    onError: (error) => appMessage.error(getApiErrorMessage(error)),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncDatabankReviewedEval(datasetId!, { category: "raw" }),
    onSuccess: () => {
      appMessage.success("Successfully synchronized reviewed raw samples to Datasets hub");
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
      void queryClient.invalidateQueries({ queryKey: ["evaluation", "datasets"] });
    },
    onError: (error) => appMessage.error(getApiErrorMessage(error)),
  });

  // Batch Handlers
  const batchMoveMutation = useMutation({
    mutationFn: async () => {
      if (!datasetId || selectedRowKeys.length === 0 || !moveTargetDatasetId) return;
      const isSameDataset = moveTargetDatasetId === datasetId;
      const catValue = moveTargetCategory === "general" ? "" : moveTargetCategory;

      if (isSameDataset) {
        await batchSetDatabankSampleCategory(
          datasetId,
          selectedRowKeys as string[],
          catValue,
        );
      } else {
        await batchMoveDatabankSamples(datasetId, {
          sample_ids: selectedRowKeys as string[],
          target_dataset_id: moveTargetDatasetId,
          target_category: catValue,
        });
      }
    },
    onSuccess: () => {
      appMessage.success(`Moved ${selectedRowKeys.length} sample(s) successfully`);
      setSelectedRowKeys([]);
      setMoveModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
    },
    onError: (err) => {
      appMessage.error(getApiErrorMessage(err));
    },
  });

  const handleBatchDelete = () => {
    if (!datasetId || selectedRowKeys.length === 0) return;
    const count = selectedRowKeys.length;
    modal.confirm({
      title: `Delete ${count} selected sample${count > 1 ? "s" : ""}?`,
      content: "This will permanently remove the sample images from the databank.",
      okType: "danger",
      onOk: async () => {
        try {
          for (const key of selectedRowKeys) {
            await deleteDatabankSample(datasetId, String(key));
          }
          appMessage.success(`Deleted ${count} samples`);
          setSelectedRowKeys([]);
          void queryClient.invalidateQueries({ queryKey: ["databank"] });
        } catch (err) {
          appMessage.error(getApiErrorMessage(err));
        }
      },
    });
  };

  const handleDownloadCsv = async () => {
    if (!datasetId) return;
    try {
      const { blob, filename } = await downloadDatabankCsv(datasetId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      appMessage.error(getApiErrorMessage(err));
    }
  };

  const samples = samplesQuery.data?.samples ?? [];
  const selectedSamples = useMemo(
    () => samples.filter((s) => selectedRowKeys.includes(s.id)),
    [samples, selectedRowKeys],
  );

  // Navigation for reviewSample modal
  const currentReviewIndex = useMemo(() => {
    if (!reviewSample) return -1;
    return samples.findIndex((s) => s.id === reviewSample.id);
  }, [samples, reviewSample]);

  const hasReviewPrev = currentReviewIndex > 0;
  const hasReviewNext =
    currentReviewIndex >= 0
      ? currentReviewIndex < samples.length - 1
      : samples.length > 0;

  const handleReviewPrev = () => {
    if (hasReviewPrev) {
      setReviewSample(samples[currentReviewIndex - 1]);
    }
  };

  const handleReviewNext = () => {
    if (currentReviewIndex >= 0 && currentReviewIndex < samples.length - 1) {
      setReviewSample(samples[currentReviewIndex + 1]);
    } else if (currentReviewIndex === -1 && samples.length > 0) {
      setReviewSample(samples[0]);
    }
  };

  const advanceReviewSample = () => {
    const idx = samples.findIndex((s) => s.id === reviewSample?.id);
    if (idx >= 0 && idx < samples.length - 1) {
      setReviewSample(samples[idx + 1]);
    } else if (idx === -1 && samples.length > 0) {
      setReviewSample(samples[0]);
    } else {
      appMessage.info("Reached the end of the current page.");
    }
  };

  // Navigation for getValueSample modal
  const currentGetValueIndex = useMemo(() => {
    if (!getValueSample) return -1;
    return samples.findIndex((s) => s.id === getValueSample.id);
  }, [samples, getValueSample]);

  const hasGetValuePrev = currentGetValueIndex > 0;
  const hasGetValueNext =
    currentGetValueIndex >= 0
      ? currentGetValueIndex < samples.length - 1
      : samples.length > 0;

  const handleGetValuePrev = () => {
    if (hasGetValuePrev) {
      setGetValueSample(samples[currentGetValueIndex - 1]);
    }
  };

  const handleGetValueNext = () => {
    if (currentGetValueIndex >= 0 && currentGetValueIndex < samples.length - 1) {
      setGetValueSample(samples[currentGetValueIndex + 1]);
    } else if (currentGetValueIndex === -1 && samples.length > 0) {
      setGetValueSample(samples[0]);
    }
  };

  const advanceGetValueSample = () => {
    const idx = samples.findIndex((s) => s.id === getValueSample?.id);
    if (idx >= 0 && idx < samples.length - 1) {
      setGetValueSample(samples[idx + 1]);
    } else if (idx === -1 && samples.length > 0) {
      setGetValueSample(samples[0]);
    } else {
      appMessage.info("Reached the end of the current page.");
    }
  };

  const isFiltered = Boolean(statusFilter !== "all" || categoryFilter !== "all" || searchInput);

  const handleResetFilters = () => {
    setStatusFilter("all");
    setCategoryFilter("all");
    setSearchInput("");
    setPage(1);
  };

  // Table columns definition
  const columns: ColumnsType<DatabankSample> = [
    {
      title: "Preview",
      key: "thumbnail",
      width: 72,
      render: (_: unknown, record: DatabankSample) =>
        datasetId ? (
          <RawSampleThumbnail
            datasetId={datasetId}
            sampleId={record.id}
            filename={record.filename}
            onClick={() => setReviewSample(record)}
          />
        ) : null,
    },
    {
      title: "File Name",
      dataIndex: "filename",
      key: "filename",
      ellipsis: true,
      render: (name: string, record: DatabankSample) => (
        <div className="space-y-0.5">
          <Typography.Text
            strong
            copyable={{ text: name }}
            className="block text-slate-800 text-sm"
          >
            {name}
          </Typography.Text>
          <span className="text-[11px] text-slate-400">ID: {record.id.slice(0, 8)}</span>
        </div>
      ),
    },
    {
      title: "Ground Truth (GT)",
      dataIndex: "final_gt",
      key: "final_gt",
      width: 170,
      render: (v: string | null | undefined, row: DatabankSample) => {
        const gt = v || row.ground_truth_normalized || row.ground_truth;
        return gt ? (
          <Tag color="cyan" className="font-mono text-xs px-2 py-0.5">
            {gt}
          </Tag>
        ) : (
          <Tag color="orange" className="text-xs">
            Needs GT
          </Tag>
        );
      },
    },
    {
      title: "Model Prediction",
      key: "prediction",
      width: 170,
      render: (_: unknown, row: DatabankSample) => {
        const pred = row.upload_predicted ?? row.rerun_predicted;
        const conf = row.upload_confidence ?? row.rerun_confidence;
        const match = row.upload_match ?? row.rerun_match;

        if (!pred) {
          return <span className="text-xs text-slate-400 italic">No prediction</span>;
        }

        return (
          <Space size={4}>
            <span className="font-mono text-xs font-semibold text-slate-700">
              {pred}
            </span>
            {conf != null && (
              <span className="text-[10px] text-slate-400">
                ({(conf * 100).toFixed(0)}%)
              </span>
            )}
            {match != null && (
              <Tag color={match ? "success" : "error"} className="text-[10px] ml-1">
                {match ? "ok" : "miss"}
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: "Bounding Box",
      key: "bounding_box",
      width: 170,
      render: (_: unknown, row: DatabankSample) => {
        const box = row.display_bbox || row.corrected_bbox || row.upload_bbox || row.bbox;
        if (!box) {
          return <span className="text-xs text-slate-400 italic">No BBox</span>;
        }
        return (
          <Tooltip
            title={`[x1: ${Math.round(box.x1)}, y1: ${Math.round(box.y1)}, x2: ${Math.round(box.x2)}, y2: ${Math.round(box.y2)}] (${Math.round(box.x2 - box.x1)}×${Math.round(box.y2 - box.y1)}px)`}
          >
            <Tag
              color="blue"
              className="font-mono text-xs cursor-pointer select-none transition hover:opacity-80"
              onClick={() => setReviewSample(row)}
            >
              [{Math.round(box.x1)}, {Math.round(box.y1)}, {Math.round(box.x2)}, {Math.round(box.y2)}]
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      width: 100,
      render: (cat: string | undefined) => {
        if (cat === "ready") {
          return (
            <Tag color="green" className="text-xs font-semibold">
              Ready
            </Tag>
          );
        }
        if (cat === "failed") {
          return (
            <Tag color="volcano" className="text-xs font-semibold">
              Failed
            </Tag>
          );
        }
        if (cat === "raw" || !cat) {
          return <Tag color="cyan" className="text-xs">Raw</Tag>;
        }
        return <Tag color="default" className="text-xs capitalize">{cat}</Tag>;
      },
    },
    {
      title: "Get Value (AI)",
      key: "get_value",
      width: 125,
      render: (_: unknown, row: DatabankSample) => (
        <Button
          size="small"
          type="primary"
          ghost
          icon={<ThunderboltOutlined />}
          onClick={() => setGetValueSample(row)}
          className="text-xs"
        >
          Get Value
        </Button>
      ),
    },
    {
      title: "Status",
      dataIndex: "review_status",
      key: "review_status",
      width: 110,
      render: (status: string) => (
        <Tag color={status === "reviewed" ? "green" : "warning"} className="text-xs">
          {status === "reviewed" ? "Reviewed" : "Unreviewed"}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_: unknown, row: DatabankSample) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setReviewSample(row)}
          >
            Review
          </Button>
          <Popconfirm
            title="Delete this raw sample?"
            onConfirm={() => deleteMutation.mutate(row.id)}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-slate-50/50">
      {/* Top Header Bar with Dataset Dropdown & Action / Batch Buttons */}
      <div className="border-b border-slate-200 bg-white px-6 py-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Dataset Dropdown & Create Dataset */}
          <div className="flex items-center gap-2">
            <DatabaseOutlined className="text-blue-600 text-base" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Dataset:
            </span>
            <Select
              value={effectiveDatasetId}
              onChange={(val) => {
                setSelectedDatasetId(val);
                setSelectedRowKeys([]);
                setPage(1);
              }}
              options={datasetOptions}
              loading={datasetsQuery.isLoading}
              style={{ minWidth: 230 }}
              placeholder="Select raw dataset"
            />
            <Button
              icon={<PlusOutlined />}
              onClick={() => setCreateDatasetModalOpen(true)}
            >
              New Dataset
            </Button>
          </div>

          {/* Right: Batch Actions (Dependent on Selection) & Main Tools */}
          <Space wrap size="small">
            <Button
              type={selectedRowKeys.length > 0 ? "primary" : "default"}
              icon={<ThunderboltOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={() => setBatchGeminiOpen(true)}
              className={
                selectedRowKeys.length > 0
                  ? "bg-amber-600 hover:bg-amber-500 border-amber-600 font-medium"
                  : ""
              }
            >
              {selectedRowKeys.length > 0
                ? `Batch Gemini GT (${selectedRowKeys.length})`
                : "Batch Gemini GT"}
            </Button>

            <Button
              icon={<TagsOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={handleOpenMoveModal}
            >
              Move
            </Button>

            <Popconfirm
              title={`Delete ${selectedRowKeys.length} selected sample${selectedRowKeys.length > 1 ? "s" : ""} permanently?`}
              disabled={selectedRowKeys.length === 0}
              onConfirm={handleBatchDelete}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={selectedRowKeys.length === 0}
              >
                Delete Selected
              </Button>
            </Popconfirm>

            <Button
              disabled={selectedRowKeys.length === 0}
              onClick={() => setSelectedRowKeys([])}
            >
              Deselect All
            </Button>

            <div className="mx-1 h-5 w-[1px] bg-slate-200" />

            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setUploadModalOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 font-medium shadow-xs"
            >
              Upload Raw Data
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleDownloadCsv}>
              Export CSV
            </Button>
            {pendingCount > 0 && (
              <Button
                icon={<ReloadOutlined />}
                onClick={() => reanalyzeMutation.mutate()}
                loading={reanalyzeMutation.isPending}
              >
                Re-analyze
              </Button>
            )}
            {reviewedCount > 0 && (
              <Button
                icon={<SyncOutlined />}
                onClick={() => syncMutation.mutate()}
                loading={syncMutation.isPending}
              >
                Sync to Datasets
              </Button>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                void queryClient.invalidateQueries({ queryKey: ["databank"] });
              }}
              loading={activeDatasetQuery.isFetching || samplesQuery.isFetching}
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
                title={
                  <span className="text-xs font-medium text-slate-500">
                    Total Raw Ingested
                  </span>
                }
                value={totalRaw}
                prefix={<InboxOutlined className="text-blue-500" />}
                valueStyle={{ fontSize: "1.25rem", fontWeight: 700, color: "#1e293b" }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={6}>
            <Card size="small" className="border-slate-200 shadow-xs">
              <Statistic
                title={
                  <span className="text-xs font-medium text-slate-500">
                    Ground Truth Labeled
                  </span>
                }
                value={hasGtCount}
                prefix={<CheckCircleOutlined className="text-emerald-500" />}
                suffix={
                  totalRaw > 0 ? (
                    <Tag color="success" className="ml-1 text-xs">
                      {((hasGtCount / totalRaw) * 100).toFixed(0)}%
                    </Tag>
                  ) : null
                }
                valueStyle={{ fontSize: "1.25rem", fontWeight: 700, color: "#059669" }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={6}>
            <Card size="small" className="border-slate-200 shadow-xs">
              <Statistic
                title={
                  <span className="text-xs font-medium text-slate-500">
                    Pending GT Review
                  </span>
                }
                value={pendingGtCount}
                prefix={<ExclamationCircleOutlined className="text-amber-500" />}
                valueStyle={{ fontSize: "1.25rem", fontWeight: 700, color: "#d97706" }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={6}>
            <Card size="small" className="border-slate-200 shadow-xs">
              <Statistic
                title={
                  <span className="text-xs font-medium text-slate-500">
                    Failed Extraction
                  </span>
                }
                value={failedCount}
                prefix={<CloseCircleOutlined className="text-rose-500" />}
                valueStyle={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: failedCount > 0 ? "#e11d48" : "#64748b",
                }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters & Search Toolbar Card */}
        <Card size="small" className="border-slate-200 bg-white shadow-xs">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FilterOutlined className="text-blue-600" />
                <span className="text-sm font-semibold text-slate-800">
                  Filter Raw Data
                </span>
                {isFiltered && (
                  <Tag color="blue" closable onClose={handleResetFilters}>
                    Filters active
                  </Tag>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Segmented
                  value={viewMode}
                  onChange={(v) => setViewMode(v as "table" | "gallery")}
                  options={[
                    { label: "Table", value: "table", icon: <TableOutlined /> },
                    { label: "Gallery", value: "gallery", icon: <AppstoreOutlined /> },
                  ]}
                  size="small"
                />
                {isFiltered && (
                  <Button
                    size="small"
                    icon={<ClearOutlined />}
                    onClick={handleResetFilters}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Category
                </label>
                <Select
                  value={categoryFilter}
                  onChange={(v) => {
                    setCategoryFilter(v);
                    setPage(1);
                  }}
                  options={rawCategoryTabs.map((t) => ({
                    label: t.label,
                    value: t.key,
                  }))}
                  style={{ width: "100%" }}
                  size="middle"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Review & Ground Truth Status
                </label>
                <Select
                  value={statusFilter}
                  onChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                  options={[
                    { label: "All Raw Samples", value: "all" },
                    { label: "Pending Review (Needs GT)", value: "unreviewed" },
                    { label: "Reviewed (Has GT)", value: "reviewed" },
                  ]}
                  style={{ width: "100%" }}
                  size="middle"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Search Query
                </label>
                <Input
                  placeholder="Search by filename, ground truth, or predicted OCR string..."
                  allowClear
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setPage(1);
                  }}
                  prefix={<SearchOutlined className="text-slate-400" />}
                  size="middle"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* ------------------------------------------------------------------ */}
        {/* Category Short Tabs (Available categories in the selected dataset) */}
        {/* ------------------------------------------------------------------ */}
        <Card
          variant="borderless"
          className="rounded-xl border border-slate-200/80 bg-white shadow-xs"
          styles={{ body: { padding: "12px 20px 0px 20px" } }}
        >
          <Tabs
            activeKey={categoryFilter}
            onChange={(key) => {
              setCategoryFilter(key);
              setPage(1);
              setSelectedRowKeys([]);
            }}
            type="line"
            items={rawCategoryTabs.map((t) => ({
              key: t.key,
              label: (
                <Space size={6} className="py-1">
                  <span>{t.label}</span>
                  <Badge
                    count={t.count}
                    overflowCount={9999}
                    style={{
                      backgroundColor:
                        categoryFilter === t.key ? "#0f766e" : "#f1f5f9",
                      color: categoryFilter === t.key ? "#ffffff" : "#64748b",
                      boxShadow: "none",
                      fontSize: 11,
                    }}
                  />
                </Space>
              ),
            }))}
          />
        </Card>

        {/* Selection summary indicator */}
        {selectedRowKeys.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50/80 px-4 py-2 text-xs text-teal-900 shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckSquareOutlined className="text-teal-600 text-sm" />
              <span className="font-semibold">
                {selectedRowKeys.length} sample{selectedRowKeys.length > 1 ? "s" : ""} selected
              </span>
            </div>
            <span className="text-slate-500">
              Use &ldquo;Batch Gemini GT&rdquo;, &ldquo;Move&rdquo;, or &ldquo;Delete Selected&rdquo; in the top bar.
            </span>
          </div>
        )}

        {/* Main Content Area */}
        {viewMode === "table" ? (
          <Card size="small" className="border-slate-200 shadow-xs">
            <Table
              rowKey="id"
              dataSource={samples}
              columns={columns}
              loading={samplesQuery.isLoading}
              rowSelection={{
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys),
              }}
              locale={{
                emptyText: (
                  <Empty
                    description="No raw samples found matching current filter"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  >
                    <Button
                      type="primary"
                      icon={<UploadOutlined />}
                      onClick={() => setUploadModalOpen(true)}
                    >
                      Upload Raw Images
                    </Button>
                  </Empty>
                ),
              }}
              pagination={{
                current: page,
                pageSize,
                total: samplesQuery.data?.total ?? 0,
                showSizeChanger: true,
                pageSizeOptions: ["25", "50", "100", "200"],
                showTotal: (t) => `Total ${t.toLocaleString()} raw samples`,
                onChange: (p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                },
              }}
              size="small"
              scroll={{ x: 1000 }}
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {samplesQuery.isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Spin tip="Loading raw images..." />
              </div>
            ) : samples.length === 0 ? (
              <Card className="py-12 text-center">
                <Empty description="No raw samples found matching filter">
                  <Button
                    type="primary"
                    icon={<UploadOutlined />}
                    onClick={() => setUploadModalOpen(true)}
                  >
                    Upload Raw Images
                  </Button>
                </Empty>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {samples.map((sample) => {
                  const isSelected = selectedRowKeys.includes(sample.id);
                  const gt =
                    sample.final_gt ||
                    sample.ground_truth_normalized ||
                    sample.ground_truth;
                  const pred = sample.upload_predicted ?? sample.rerun_predicted;

                  return (
                    <div
                      key={sample.id}
                      className={`group relative flex flex-col justify-between overflow-hidden rounded-lg border bg-white shadow-xs transition hover:shadow-md ${
                        isSelected
                          ? "border-blue-500 ring-2 ring-blue-200"
                          : "border-slate-200"
                      }`}
                    >
                      {/* Top thumbnail */}
                      <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
                        {datasetId && (
                          <RawSampleThumbnail
                            datasetId={datasetId}
                            sampleId={sample.id}
                            filename={sample.filename}
                            className="h-full w-full rounded-none"
                            onClick={() => setReviewSample(sample)}
                          />
                        )}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (e.target.checked) {
                              setSelectedRowKeys((prev) => [...prev, sample.id]);
                            } else {
                              setSelectedRowKeys((prev) =>
                                prev.filter((i) => i !== sample.id),
                              );
                            }
                          }}
                          className="absolute top-2 left-2 h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </div>

                      {/* Details body */}
                      <div className="space-y-2 p-2.5">
                        <div className="flex items-center justify-between gap-1">
                          <Tag
                            color={sample.review_status === "reviewed" ? "green" : "warning"}
                            className="m-0 text-[10px]"
                          >
                            {sample.review_status === "reviewed" ? "Reviewed" : "Needs GT"}
                          </Tag>
                          {gt && (
                            <Tag color="cyan" className="m-0 font-mono text-[11px]">
                              {gt}
                            </Tag>
                          )}
                        </div>

                        <Typography.Text
                          ellipsis={{ tooltip: sample.filename }}
                          className="block text-xs font-medium text-slate-800"
                        >
                          {sample.filename}
                        </Typography.Text>

                        {pred && (
                          <div className="text-[11px] text-slate-500 font-mono">
                            Pred: <strong>{pred}</strong>
                          </div>
                        )}

                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                          <Button
                            size="small"
                            type="text"
                            icon={<ThunderboltOutlined className="text-amber-500" />}
                            onClick={() => setGetValueSample(sample)}
                            className="px-1 text-xs"
                          >
                            Value
                          </Button>
                          <Space size={2}>
                            <Button
                              size="small"
                              type="text"
                              icon={<EyeOutlined />}
                              onClick={() => setReviewSample(sample)}
                            />
                            <Popconfirm
                              title="Delete sample?"
                              onConfirm={() => deleteMutation.mutate(sample.id)}
                            >
                              <Button
                                size="small"
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                              />
                            </Popconfirm>
                          </Space>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination for Gallery */}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
              <Typography.Text type="secondary" className="text-xs">
                Showing {(page - 1) * pageSize + 1} -{" "}
                {Math.min(page * pageSize, samplesQuery.data?.total ?? 0)} of{" "}
                {(samplesQuery.data?.total ?? 0).toLocaleString()} raw samples
              </Typography.Text>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={samplesQuery.data?.total ?? 0}
                showSizeChanger
                pageSizeOptions={["24", "48", "96"]}
                onChange={(p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Upload Raw Data Modal                                              */}
      {/* ------------------------------------------------------------------- */}
      <UploadRawModal
        open={uploadModalOpen}
        ocrType={activeTaskKey}
        datasetId={datasetId}
        datasetName={dataset?.name}
        confirmLoading={uploadRawMutation.isPending}
        onClose={() => setUploadModalOpen(false)}
        onSubmit={(values) => uploadRawMutation.mutate(values)}
      />

      {/* ------------------------------------------------------------------- */}
      {/* Create New Raw Dataset Modal                                       */}
      {/* ------------------------------------------------------------------- */}
      <CreateRawDatasetModal
        open={createDatasetModalOpen}
        confirmLoading={createDatasetMutation.isPending}
        onClose={() => setCreateDatasetModalOpen(false)}
        onSubmit={(values) => createDatasetMutation.mutate(values)}
      />

      {/* ------------------------------------------------------------------- */}
      {/* Batch Move Modal (3 Fields: Dataset type, Dataset, Category)        */}
      {/* ------------------------------------------------------------------- */}
      <Modal
        title={`Move ${selectedRowKeys.length} Selected Entr${selectedRowKeys.length === 1 ? "y" : "ies"}`}
        open={moveModalOpen}
        onCancel={() => setMoveModalOpen(false)}
        onOk={() => batchMoveMutation.mutate()}
        confirmLoading={batchMoveMutation.isPending}
        okText="Move Entries"
        okButtonProps={{ className: "bg-teal-700 hover:bg-teal-800 text-white" }}
        destroyOnHidden
        centered
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-slate-500">
            Transfer selected raw samples to another dataset (Raw or Label) and assign them to an available category.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="raw-move-dataset-type-select" className="text-xs font-semibold text-slate-700">
              Dataset type:
            </label>
            <Select
              id="raw-move-dataset-type-select"
              value={moveTargetType}
              onChange={handleTargetTypeChange}
              options={[
                { value: "raw", label: "Raw Data" },
                { value: "label", label: "Label Data" },
              ]}
              className="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="raw-move-dataset-select" className="text-xs font-semibold text-slate-700">
              Dataset:
            </label>
            <Select
              id="raw-move-dataset-select"
              value={moveTargetDatasetId}
              onChange={handleTargetDatasetChange}
              options={(moveTargetType === "raw" ? rawDatasets : labelDatasets).map((d) => ({
                value: d.id,
                label: `${d.name} (${d.sample_count ?? 0} samples)`,
              }))}
              className="w-full"
              placeholder="Select target dataset"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="raw-move-category-select" className="text-xs font-semibold text-slate-700">
              Category:
            </label>
            <Select
              id="raw-move-category-select"
              value={moveTargetCategory}
              onChange={setMoveTargetCategory}
              options={targetCategoryOptions}
              className="w-full"
              placeholder="Select target category"
            />
          </div>
        </div>
      </Modal>

      {/* ------------------------------------------------------------------- */}
      {/* Single Sample Get Value Modal (Gemini AI)                           */}
      {/* ------------------------------------------------------------------- */}
      {getValueSample && datasetId && (
        <RawGetValueModal
          sample={getValueSample}
          datasetId={datasetId}
          hasPrev={hasGetValuePrev}
          hasNext={hasGetValueNext}
          onPrev={handleGetValuePrev}
          onNext={handleGetValueNext}
          currentIndex={currentGetValueIndex}
          totalCount={samples.length}
          onClose={() => setGetValueSample(null)}
          onSaved={(_updated) => {
            void queryClient.invalidateQueries({ queryKey: ["databank"] });
            advanceGetValueSample();
          }}
        />
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Batch Gemini AI Modal                                              */}
      {/* ------------------------------------------------------------------- */}
      {batchGeminiOpen && datasetId && (
        <RawBatchGeminiModal
          open={batchGeminiOpen}
          datasetId={datasetId}
          selectedSamples={selectedSamples}
          onClose={() => setBatchGeminiOpen(false)}
          onFinished={() => {
            void queryClient.invalidateQueries({ queryKey: ["databank"] });
            setSelectedRowKeys([]);
          }}
        />
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Sample Review / Inspector Modal                                     */}
      {/* ------------------------------------------------------------------- */}
      {reviewSample && datasetId && (
        <RawSampleReviewModal
          sample={reviewSample}
          datasetId={datasetId}
          availableCategories={availableCategories}
          hasPrev={hasReviewPrev}
          hasNext={hasReviewNext}
          onPrev={handleReviewPrev}
          onNext={handleReviewNext}
          currentIndex={currentReviewIndex}
          totalCount={samples.length}
          onClose={() => setReviewSample(null)}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ["databank"] });
            advanceReviewSample();
          }}
          onOpenGetValue={() => {
            const s = reviewSample;
            setReviewSample(null);
            setGetValueSample(s);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Raw Dataset Modal Component
// ---------------------------------------------------------------------------

function CreateRawDatasetModal({
  open,
  onClose,
  onSubmit,
  confirmLoading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; description?: string }) => void;
  confirmLoading: boolean;
}) {
  const [form] = Form.useForm<{ name: string; description?: string }>();

  return (
    <Modal
      title={
        <Space>
          <DatabaseOutlined className="text-blue-600" />
          <span>Create New Raw Dataset</span>
        </Space>
      }
      open={open}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      onOk={() => {
        form
          .validateFields()
          .then((values) => {
            onSubmit(values);
            form.resetFields();
          })
          .catch(() => {});
      }}
      okText="Create Dataset"
      confirmLoading={confirmLoading}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" className="pt-2">
        <Form.Item
          name="name"
          label="Dataset Name"
          rules={[
            { required: true, message: "Please enter a dataset name" },
            {
              pattern: /^[a-zA-Z0-9_-]+$/,
              message: "Only alphanumeric characters, dashes, and underscores allowed",
            },
          ]}
        >
          <Input placeholder="e.g. batch-2026-10 or odometer-raw-set-2" />
        </Form.Item>
        <Form.Item name="description" label="Description (optional)">
          <Input.TextArea
            rows={3}
            placeholder="Brief description of this raw data collection..."
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Upload Raw Data Modal Component
// ---------------------------------------------------------------------------

function UploadRawModal({
  open,
  ocrType,
  datasetId,
  datasetName,
  onClose,
  onSubmit,
  confirmLoading,
}: {
  open: boolean;
  ocrType: string;
  datasetId?: string;
  datasetName?: string;
  confirmLoading: boolean;
  onClose: () => void;
  onSubmit: (values: { ocr_type: string; file: File; dataset_id?: string }) => void;
}) {
  const { message } = App.useApp();
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const handleOk = () => {
    const file = fileList[0]?.originFileObj;
    if (!file) {
      message.error("Please choose an image or ZIP file to upload");
      return;
    }
    onSubmit({ ocr_type: ocrType, file, dataset_id: datasetId });
    setFileList([]);
  };

  return (
    <Modal
      title={
        <Space>
          <UploadOutlined className="text-blue-600" />
          <span>Upload Raw Data</span>
        </Space>
      }
      open={open}
      onCancel={() => {
        setFileList([]);
        onClose();
      }}
      onOk={handleOk}
      okText="Upload Raw Data"
      confirmLoading={confirmLoading}
      destroyOnHidden
      width={560}
    >
      <div className="space-y-4 pt-2">
        {datasetName && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Target Dataset:</span>
            <Tag color="blue" className="font-semibold">
              {datasetName}
            </Tag>
          </div>
        )}

        <Alert
          type="info"
          showIcon
          message="Direct Raw Ingestion (No Inbuild Prediction)"
          description={
            <div className="text-xs text-slate-600 space-y-1 mt-1">
              <div>• Filenames do not require ground-truth formatting.</div>
              <div>• Uploaded images are ingested directly into <strong>Raw Data</strong>.</div>
              <div>• Internal model predictions are <strong>not</strong> executed during upload.</div>
              <div>• Extract GT values in bulk with Gemini AI or manual review before moving into General/Blurry/Dead.</div>
            </div>
          }
        />

        <Upload.Dragger
          maxCount={1}
          beforeUpload={() => false}
          fileList={fileList}
          onChange={({ fileList: next }) => setFileList(next)}
          accept=".zip,.jpg,.jpeg,.png,.webp,application/zip,image/jpeg,image/png,image/webp"
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined className="text-blue-500 text-3xl" />
          </p>
          <p className="ant-upload-text text-sm font-medium text-slate-700">
            Click or drag a single image or ZIP archive to this area
          </p>
          <p className="ant-upload-hint text-xs text-slate-500">
            Supports .zip packages, PNG, JPEG, and WebP format images
          </p>
        </Upload.Dragger>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Single Sample Get Value Modal (Gemini AI Extraction)
// ---------------------------------------------------------------------------

const DEFAULT_ODOMETER_PROMPT = `1. Does this image relate to a car dashboard?
2. Does this image relate to an odometer?
3. Is this image natural (a real-world photograph, not an artificially generated or edited image)?

If all 3 conditions are true, perform the following:

- Read the numeric odometer value displayed in the image.
- Detect the **tightest possible 2D bounding box around ONLY the visible odometer digits/value**.
- The bounding box must tightly enclose all digits representing the odometer reading.
- Do NOT include the complete display area, screen boundaries, display frame, dashboard panel, surrounding labels, icons, or other elements.
- Exclude units, symbols, and unrelated text unless they are visually part of the numeric odometer reading.
- Keep the bounding box as close to the outer edges of the first and last digits as possible, with minimal padding.
- If the odometer value contains multiple digits, include all digits in a single bounding box.

Return JSON ONLY in this format:

{
  "ground_truth": "<numeric digits>",
  "box_2d": [ymin, xmin, ymax, xmax]
}

Where:
- \`ground_truth\`: The numeric odometer reading exactly as displayed, without spaces or separators.
- \`box_2d\`: Bounding box coordinates around ONLY the odometer digits, in [ymin, xmin, ymax, xmax] order.
- Coordinates must be normalized to a range of 0–1000 relative to the original image dimensions.

If any of the 3 conditions fail, or the odometer digits are missing, unclear, partially unreadable, or impossible to localize accurately, return:

{"ground_truth": null, "box_2d": null}`;

function RawGetValueModal({
  sample,
  datasetId,
  onClose,
  onSaved,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  currentIndex,
  totalCount,
}: {
  sample: DatabankSample;
  datasetId: string;
  onClose: () => void;
  onSaved: (updated: DatabankSample) => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCount?: number;
}) {
  const { message } = App.useApp();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  const [selectedPromptId, setSelectedPromptId] = useState<string>("odometer_reading");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem("gemini_api_key") || "");
  const [reviewedValue, setReviewedValue] = useState<string>(
    sample.final_gt || sample.ground_truth_normalized || "",
  );
  const [extractedBbox, setExtractedBbox] = useState<DatabankSample["display_bbox"] | null>(
    sample.display_bbox || sample.corrected_bbox || sample.upload_bbox || sample.bbox || null,
  );
  const [extractError, setExtractError] = useState<string | null>(null);
  const [usedModelTag, setUsedModelTag] = useState<string | null>(null);

  const promptsQuery = useQuery({
    queryKey: ["scraper", "prompts"],
    queryFn: getGeminiPrompts,
  });

  const configQuery = useQuery({
    queryKey: ["scraper", "gemini-config"],
    queryFn: getGeminiConfig,
  });

  const effectiveModel =
    selectedModel || configQuery.data?.default_model || "gemini-3.5-flash-lite";

  const activePromptText =
    customPrompt !== null
      ? customPrompt
      : (promptsQuery.data?.find((p) => p.id === selectedPromptId)?.prompt ??
        (selectedPromptId === "odometer_reading"
          ? DEFAULT_ODOMETER_PROMPT
          : (promptsQuery.data?.[0]?.prompt || DEFAULT_ODOMETER_PROMPT)));

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;

    setImageLoading(true);
    setPreviewUrl(null);
    setReviewedValue(sample.final_gt || sample.ground_truth_normalized || "");
    setExtractedBbox(
      sample.display_bbox || sample.corrected_bbox || sample.upload_bbox || sample.bbox || null,
    );
    setExtractError(null);
    setUsedModelTag(null);

    void fetchDatabankSampleImageUrl(datasetId, sample.id)
      .then((url) => {
        if (active) {
          objectUrl = url;
          setPreviewUrl(url);
          setImageLoading(false);
        }
      })
      .catch(() => {
        if (active) setImageLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [datasetId, sample.id, sample]);

  const extractMutation = useMutation({
    mutationFn: (vars: { prompt: string; apiKey?: string; model?: string }) =>
      extractDatabankSampleWithGemini(datasetId, sample.id, {
        prompt: vars.prompt,
        api_key: vars.apiKey || undefined,
        model: vars.model || effectiveModel,
      }),
    onSuccess: (data) => {
      setExtractError(null);
      setUsedModelTag(data.model);
      message.success("Extracted response from Gemini! Review before saving.");
      setReviewedValue(data.extracted_value);
      if (data.bbox) {
        setExtractedBbox(data.bbox);
      }
    },
    onError: (err) => {
      const errMsg = getApiErrorMessage(err);
      setExtractError(errMsg);
      message.error(errMsg);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ gt, bbox }: { gt: string; bbox?: DatabankSample["display_bbox"] | null }) => {
      const updated = await reviewDatabankSample(datasetId, sample.id, {
        corrected_gt: gt,
        corrected_bbox: (bbox as unknown as Record<string, unknown>) || undefined,
      });
      try {
        await setDatabankSampleCategory(datasetId, sample.id, "ready");
      } catch {
        // ignore if already updated or best effort
      }
      return { ...updated, category: "ready" };
    },
    onSuccess: (updated) => {
      message.success("Ground truth & bounding box saved! Moved to Ready.");
      onSaved(updated);
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const handleExtract = () => {
    if (!activePromptText.trim()) {
      message.warning("Please enter or select a prompt");
      return;
    }
    setExtractError(null);
    if (apiKey) localStorage.setItem("gemini_api_key", apiKey.trim());

    extractMutation.mutate({
      prompt: activePromptText.trim(),
      apiKey: apiKey.trim() || undefined,
      model: effectiveModel,
    });
  };

  const handleSave = () => {
    if (!reviewedValue.trim()) {
      message.warning("Ground truth value cannot be empty");
      return;
    }
    saveMutation.mutate({ gt: reviewedValue.trim(), bbox: extractedBbox });
  };

  const serverHasKey = Boolean(configQuery.data?.has_api_key);

  const modelOptions =
    configQuery.data?.available_models && configQuery.data.available_models.length > 0
      ? configQuery.data.available_models.map((m) => ({ label: m.name, value: m.id }))
      : [
          { label: "Gemini 3.5 Flash Lite (Fastest & Stable)", value: "gemini-3.5-flash-lite" },
          { label: "Gemini 3.5 Flash", value: "gemini-3.5-flash" },
          { label: "Gemini 3 Flash Preview", value: "gemini-3-flash-preview" },
        ];

  return (
    <Modal
      title={
        <div className="flex items-center justify-between pr-8">
          <div className="flex items-center gap-2">
            <ThunderboltOutlined className="text-amber-500" />
            <span className="font-semibold text-slate-800">
              Get Value & BBox (Gemini AI) · {sample.filename}
            </span>
            {typeof currentIndex === "number" && typeof totalCount === "number" && totalCount > 0 && (
              <Tag color="blue" className="text-xs">
                {currentIndex + 1} / {totalCount}
              </Tag>
            )}
          </div>
          <Space size={6}>
            <Button
              size="small"
              icon={<LeftOutlined />}
              disabled={!hasPrev}
              onClick={onPrev}
              title="Previous sample"
            >
              Prev
            </Button>
            <Button
              size="small"
              icon={<RightOutlined />}
              disabled={!hasNext}
              onClick={onNext}
              title="Next sample"
            >
              Next
            </Button>
          </Space>
        </div>
      }
      open
      onCancel={onClose}
      maskClosable={false}
      width={720}
      centered
      footer={
        <div className="flex items-center justify-between">
          <Space>
            <Button onClick={onClose}>Close</Button>
            <Button
              icon={<LeftOutlined />}
              disabled={!hasPrev}
              onClick={onPrev}
            >
              Prev
            </Button>
            <Button
              icon={<RightOutlined />}
              disabled={!hasNext}
              onClick={onNext}
            >
              Next
            </Button>
          </Space>
          <Space>
            <Button
              danger
              onClick={async () => {
                try {
                  await setDatabankSampleCategory(datasetId, sample.id, "failed");
                  message.info("Marked sample as Failed");
                  onSaved({ ...sample, category: "failed" });
                } catch (e) {
                  message.error(getApiErrorMessage(e));
                }
              }}
            >
              Move to Failed
            </Button>
            <Button
              onClick={async () => {
                try {
                  await setDatabankSampleCategory(datasetId, sample.id, "ready");
                  message.info("Marked sample as Ready");
                  onSaved({ ...sample, category: "ready" });
                } catch (e) {
                  message.error(getApiErrorMessage(e));
                }
              }}
            >
              Move to Ready
            </Button>
            <Button
              type="primary"
              disabled={!reviewedValue.trim()}
              loading={saveMutation.isPending}
              onClick={handleSave}
            >
              Save Ground Truth
            </Button>
          </Space>
        </div>
      }
    >
      <div className="space-y-4 pt-2">
        {/* Thumbnail & Sample details */}
        <div className="flex gap-4 rounded-lg border bg-gray-50 p-3">
          <div className="flex h-36 w-48 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-900/10">
            {imageLoading ? (
              <Spin size="small" />
            ) : previewUrl ? (
              <OcrImageViewer
                className="h-full w-full"
                src={previewUrl}
                imageWidth={sample.width}
                imageHeight={sample.height}
                selected={toViewerBox(extractedBbox || sample.display_bbox || sample.corrected_bbox || sample.upload_bbox || sample.bbox)}
                zoom={1}
              />
            ) : (
              <PictureOutlined className="text-slate-400" />
            )}
          </div>
          <div className="flex flex-1 flex-col justify-center space-y-1 text-xs">
            <div>
              <Typography.Text strong>Filename: </Typography.Text>
              <span>{sample.filename}</span>
            </div>
            {sample.upload_predicted && (
              <div>
                <Typography.Text strong>OCR Predicted: </Typography.Text>
                <Tag color="geekblue" className="font-mono">{sample.upload_predicted}</Tag>
              </div>
            )}
            <div>
              <Typography.Text strong>Current Ground Truth: </Typography.Text>
              {sample.final_gt ? (
                <Tag color="cyan">{sample.final_gt}</Tag>
              ) : (
                <Typography.Text type="secondary">Not set</Typography.Text>
              )}
            </div>
            {extractedBbox && (
              <div>
                <Typography.Text strong>Bounding Box: </Typography.Text>
                <Tag color="blue" className="font-mono text-xs">
                  [{Math.round(extractedBbox.x1)}, {Math.round(extractedBbox.y1)}, {Math.round(extractedBbox.x2)}, {Math.round(extractedBbox.y2)}]
                </Tag>
              </div>
            )}
          </div>
        </div>

        {/* Prompt & Model Selection */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Select Prompt Preset:
            </label>
            <Select
              value={selectedPromptId}
              onChange={(pId) => {
                setSelectedPromptId(pId);
                const found = (promptsQuery.data ?? []).find((p) => p.id === pId);
                setCustomPrompt(found ? found.prompt : "");
              }}
              loading={promptsQuery.isLoading}
              options={(promptsQuery.data ?? []).map((p) => ({
                label: p.name,
                value: p.id,
              }))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Gemini Model:
            </label>
            <Select
              value={effectiveModel}
              onChange={setSelectedModel}
              loading={configQuery.isLoading}
              options={modelOptions}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700">
              Prompt Instructions & Boundary Box Context:
            </label>
            {customPrompt !== null && (
              <Button
                type="link"
                size="small"
                className="p-0 text-xs"
                onClick={() => setCustomPrompt(null)}
              >
                Reset to Preset
              </Button>
            )}
          </div>
          <Input.TextArea
            rows={5}
            value={activePromptText}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Prompt instructions for Gemini..."
            className="font-mono text-xs"
          />
        </div>

        {/* API Key setting */}
        <div className="rounded border border-dashed p-2.5 text-xs space-y-1.5 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-700">Gemini API Key:</span>
            {serverHasKey ? (
              <Tag color="success">Server API Key Configured</Tag>
            ) : (
              <Typography.Link
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get free API Key (Google AI Studio)
              </Typography.Link>
            )}
          </div>
          <Input.Password
            size="small"
            placeholder={
              serverHasKey
                ? "Optional override: enter custom Gemini API key"
                : "Enter your Gemini API key (saved in browser)"
            }
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        {/* Extract Button */}
        <div className="flex items-center justify-between">
          <Typography.Text type="secondary" className="text-xs">
            Using: <Typography.Text code>{effectiveModel}</Typography.Text>
          </Typography.Text>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={extractMutation.isPending}
            onClick={handleExtract}
          >
            {extractMutation.isPending ? "Extracting..." : "Hit Gemini API"}
          </Button>
        </div>

        {extractError && (
          <Alert
            type="error"
            showIcon
            closable
            onClose={() => setExtractError(null)}
            message="Gemini API Error"
            description={extractError}
          />
        )}

        {/* Reviewed Value Editor */}
        <div className="space-y-1.5 rounded-lg border border-teal-200 bg-teal-50/40 p-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-teal-900">
              Review Extracted Ground Truth:
            </label>
            {usedModelTag && <Tag color="geekblue">Model: {usedModelTag}</Tag>}
          </div>
          <Input.TextArea
            rows={2}
            value={reviewedValue}
            onChange={(e) => setReviewedValue(e.target.value)}
            placeholder="Extracted number will appear here..."
            style={{ fontSize: 14, fontWeight: 500 }}
          />
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Batch Gemini AI Modal Runner
// ---------------------------------------------------------------------------

interface BatchItemState {
  sample: DatabankSample;
  status: "pending" | "processing" | "saved_gt" | "moved_failed" | "moved_dead" | "error";
  extractedRaw?: string;
  savedGt?: string;
  bbox?: Record<string, unknown> | null;
  error?: string;
}

function RawBatchGeminiModal({
  open,
  datasetId,
  selectedSamples,
  onClose,
  onFinished,
}: {
  open: boolean;
  datasetId: string;
  selectedSamples: DatabankSample[];
  onClose: () => void;
  onFinished: () => void;
}) {
  const { message } = App.useApp();
  const [selectedPromptId, setSelectedPromptId] = useState<string>("odometer_reading");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem("gemini_api_key") || "");

  const [items, setItems] = useState<BatchItemState[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const stopRef = useRef(false);

  const promptsQuery = useQuery({
    queryKey: ["scraper", "prompts"],
    queryFn: getGeminiPrompts,
  });

  const configQuery = useQuery({
    queryKey: ["scraper", "gemini-config"],
    queryFn: getGeminiConfig,
  });

  const effectiveModel =
    selectedModel || configQuery.data?.default_model || "gemini-3.5-flash-lite";

  const activePromptText =
    promptsQuery.data?.find((p) => p.id === selectedPromptId)?.prompt ||
    (selectedPromptId === "odometer_reading"
      ? DEFAULT_ODOMETER_PROMPT
      : (promptsQuery.data?.[0]?.prompt || DEFAULT_ODOMETER_PROMPT));

  useEffect(() => {
    if (open) {
      setItems(
        selectedSamples.map((s) => ({
          sample: s,
          status: "pending",
        })),
      );
      setIsRunning(false);
      setIsFinished(false);
      setCurrentIndex(0);
      stopRef.current = false;
    }
  }, [open, selectedSamples]);

  const handleStart = async () => {
    if (!activePromptText.trim()) {
      message.warning("Please select a prompt preset");
      return;
    }

    stopRef.current = false;
    setIsRunning(true);
    setIsFinished(false);

    let savedTotal = 0;
    let failedTotal = 0;

    for (let i = 0; i < items.length; i++) {
      if (stopRef.current) break;

      setCurrentIndex(i);
      setItems((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: "processing" } : it)),
      );

      const target = items[i].sample;
      try {
        const res = await extractDatabankSampleWithGemini(datasetId, target.id, {
          prompt: activePromptText.trim(),
          api_key: apiKey.trim() || undefined,
          model: effectiveModel,
        });

        const rawVal = res.extracted_value || "";
        const numericVal = parseNumericalValue(rawVal);
        const bbox = res.bbox || null;

        if (numericVal !== null && bbox !== null) {
          await reviewDatabankSample(datasetId, target.id, {
            corrected_gt: numericVal,
            corrected_bbox: (bbox as unknown as Record<string, unknown>) || undefined,
          });
          try {
            await setDatabankSampleCategory(datasetId, target.id, "ready");
          } catch {
            // ignore
          }
          savedTotal++;
          setItems((prev) =>
            prev.map((it, idx) =>
              idx === i
                ? {
                    ...it,
                    status: "saved_gt",
                    extractedRaw: rawVal,
                    savedGt: numericVal,
                    bbox: (bbox as unknown as Record<string, unknown>) || undefined,
                  }
                : it,
            ),
          );
        } else {
          await setDatabankSampleCategory(datasetId, target.id, "failed");
          failedTotal++;
          setItems((prev) =>
            prev.map((it, idx) =>
              idx === i ? { ...it, status: "moved_failed", extractedRaw: rawVal } : it,
            ),
          );
        }
      } catch (err) {
        try {
          await setDatabankSampleCategory(datasetId, target.id, "failed");
        } catch {
          // ignore secondary error
        }
        failedTotal++;
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? { ...it, status: "error", error: getApiErrorMessage(err) }
              : it,
          ),
        );
      }
    }

    setIsRunning(false);
    setIsFinished(true);
    message.success(
      `Batch finished! Saved GT & BBox: ${savedTotal}, Moved to Failed Category: ${failedTotal}`,
    );
    onFinished();
  };

  const handleStop = () => {
    stopRef.current = true;
    setIsRunning(false);
  };

  const progressPct =
    items.length > 0
      ? Math.round(
          (items.filter((it) => it.status !== "pending" && it.status !== "processing")
            .length /
            items.length) *
            100,
        )
      : 0;

  return (
    <Modal
      title={
        <Space>
          <ThunderboltOutlined className="text-amber-500" />
          <span>Batch Gemini Ground Truth Extraction ({items.length} Samples)</span>
        </Space>
      }
      open={open}
      onCancel={() => {
        if (isRunning) handleStop();
        onClose();
      }}
      maskClosable={false}
      width={780}
      footer={
        <div className="flex items-center justify-between">
          <Button onClick={onClose} disabled={isRunning}>
            Close
          </Button>
          <Space>
            {isRunning ? (
              <Button danger onClick={handleStop}>
                Stop Extraction
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={handleStart}
                disabled={items.length === 0 || isFinished}
                className="bg-amber-600 hover:bg-amber-500 border-amber-600"
              >
                {isFinished ? "Extraction Completed" : "Start Batch Extraction"}
              </Button>
            )}
          </Space>
        </div>
      }
    >
      <div className="space-y-4 pt-2">
        <Alert
          type="info"
          showIcon
          message="Automated Extraction & Categorization Logic"
          description={
            <div className="text-xs text-slate-600 space-y-1 mt-1">
              <div>• <strong>Valid Digits & BBox:</strong> Extracted numbers and bounding box coordinates are saved to the sample.</div>
              <div>• <strong>Failed GT or BBox:</strong> Images failing to obtain both GT and Bounding Box are automatically relocated to the <strong>Failed</strong> category in the Raw Data tab.</div>
            </div>
          }
        />

        {!isRunning && !isFinished && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Preset Prompt:
                </label>
                <Select
                  value={selectedPromptId}
                  onChange={setSelectedPromptId}
                  options={(promptsQuery.data ?? []).map((p) => ({
                    label: p.name,
                    value: p.id,
                  }))}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Model:
                </label>
                <Select
                  value={effectiveModel}
                  onChange={setSelectedModel}
                  options={[
                    { label: "Gemini 3.5 Flash Lite (Fastest & Stable)", value: "gemini-3.5-flash-lite" },
                    { label: "Gemini 3.5 Flash", value: "gemini-3.5-flash" },
                  ]}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Prompt Instructions & Boundary Box Context:
              </label>
              <Input.TextArea
                rows={3}
                value={activePromptText}
                readOnly
                className="bg-slate-50 font-mono text-xs text-slate-700"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Custom Gemini API Key (optional):
              </label>
              <Input.Password
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  localStorage.setItem("gemini_api_key", e.target.value);
                }}
                placeholder="Uses server configured GEMINI_API_KEY if left empty"
              />
            </div>
          </>
        )}

        {(isRunning || isFinished) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                Processed {currentIndex + 1} of {items.length}
              </span>
              <span>{progressPct}%</span>
            </div>
            <Progress percent={progressPct} status={isRunning ? "active" : undefined} />
          </div>
        )}

        {/* Live Status Table */}
        <div className="max-h-60 overflow-y-auto rounded border border-slate-200">
          <Table
            rowKey={(r) => r.sample.id}
            dataSource={items}
            pagination={false}
            size="small"
            columns={[
              {
                title: "File",
                dataIndex: ["sample", "filename"],
                ellipsis: true,
              },
              {
                title: "Status",
                key: "status",
                width: 170,
                render: (_, r) => {
                  if (r.status === "processing") {
                    return (
                      <Tag color="processing" icon={<Spin size="small" />}>
                        Extracting...
                      </Tag>
                    );
                  }
                  if (r.status === "saved_gt") {
                    return (
                      <Tag color="success">GT: {r.savedGt} & BBox</Tag>
                    );
                  }
                  if (r.status === "moved_failed" || r.status === "moved_dead") {
                    return <Tag color="volcano">Moved to Failed</Tag>;
                  }
                  if (r.status === "error") {
                    return <Tag color="error">Error</Tag>;
                  }
                  return <Tag>Queued</Tag>;
                },
              },
            ]}
          />
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Sample Review / Inspector Modal
// ---------------------------------------------------------------------------

function RawSampleReviewModal({
  sample,
  datasetId,
  availableCategories,
  onClose,
  onSaved,
  onOpenGetValue,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  currentIndex,
  totalCount,
}: {
  sample: DatabankSample;
  datasetId: string;
  availableCategories: { value: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
  onOpenGetValue: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCount?: number;
}) {
  const { message } = App.useApp();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState<number>(1);
  const [isAutoZoomed, setIsAutoZoomed] = useState<boolean>(false);
  const [targetAction, setTargetAction] = useState<string | null>(null);

  const [gtInput, setGtInput] = useState(
    sample.final_gt || sample.ground_truth_normalized || "",
  );

  const activeBox = useMemo(
    () => toViewerBox(sample.display_bbox || sample.corrected_bbox || sample.upload_bbox || sample.bbox),
    [sample],
  );

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;

    setLoading(true);
    setPreviewUrl(null);
    setGtInput(sample.final_gt || sample.ground_truth_normalized || "");
    setTargetAction(null);

    // Calculate default zoom: zoom into the bounding box if it's too small relative to the frame
    if (activeBox) {
      const refW = sample.width && sample.width > 0 ? sample.width : 1000;
      const refH = sample.height && sample.height > 0 ? sample.height : 1000;
      const bw = Math.abs(activeBox.x2 - activeBox.x1);
      const bh = Math.abs(activeBox.y2 - activeBox.y1);
      if (bw > 0 && bh > 0) {
        const ratioW = bw / refW;
        const ratioH = bh / refH;
        const maxDimRatio = Math.max(ratioW, ratioH);

        // If bounding box occupies less than 35% of the frame dimension, auto-zoom
        if (maxDimRatio < 0.35) {
          const autoZ = Math.min(3.5, Math.max(1.5, Math.round((0.55 / maxDimRatio) * 10) / 10));
          setZoom(autoZ);
          setIsAutoZoomed(true);
        } else {
          setZoom(1);
          setIsAutoZoomed(false);
        }
      } else {
        setZoom(1);
        setIsAutoZoomed(false);
      }
    } else {
      setZoom(1);
      setIsAutoZoomed(false);
    }

    void fetchDatabankSampleImageUrl(datasetId, sample.id)
      .then((url) => {
        if (active) {
          objectUrl = url;
          setPreviewUrl(url);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [datasetId, sample.id, sample, activeBox]);

  const saveMutation = useMutation({
    mutationFn: async ({ gt, moveCat }: { gt: string; moveCat?: string }) => {
      await reviewDatabankSample(datasetId, sample.id, {
        corrected_gt: gt.trim() || undefined,
      });
      if (moveCat !== undefined) {
        const catValue = moveCat === "general" ? "" : moveCat;
        await setDatabankSampleCategory(datasetId, sample.id, catValue);
      }
    },
    onSuccess: () => {
      message.success("Sample updated & moved to next image");
      setTargetAction(null);
      onSaved();
    },
    onError: (err) => {
      setTargetAction(null);
      message.error(getApiErrorMessage(err));
    },
  });

  const handleSaveAction = (catAction: "ready" | "failed" | "keep" | string) => {
    setTargetAction(catAction);
    const targetCat = catAction === "keep" ? undefined : catAction;
    saveMutation.mutate({ gt: gtInput, moveCat: targetCat });
  };

  const otherCategories = availableCategories.filter(
    (c) => c.value !== "raw" && c.value !== "ready" && c.value !== "failed",
  );

  return (
    <Modal
      title={
        <div className="flex items-center justify-between pr-8">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">
              Inspect Raw Sample · {sample.filename}
            </span>
            {typeof currentIndex === "number" && typeof totalCount === "number" && totalCount > 0 && (
              <Tag color="blue" className="text-xs">
                {currentIndex + 1} / {totalCount}
              </Tag>
            )}
          </div>
          <Space size={6}>
            <Button
              size="small"
              icon={<LeftOutlined />}
              disabled={!hasPrev}
              onClick={onPrev}
              title="Previous sample"
            >
              Prev
            </Button>
            <Button
              size="small"
              icon={<RightOutlined />}
              disabled={!hasNext}
              onClick={onNext}
              title="Next sample"
            >
              Next
            </Button>
          </Space>
        </div>
      }
      open
      onCancel={onClose}
      width={1060}
      centered
      footer={
        <div className="flex items-center justify-between">
          <Space>
            <Button onClick={onClose}>Close</Button>
            <Button
              icon={<LeftOutlined />}
              disabled={!hasPrev}
              onClick={onPrev}
            >
              Prev
            </Button>
            <Button
              icon={<RightOutlined />}
              disabled={!hasNext}
              onClick={onNext}
            >
              Next
            </Button>
          </Space>
          <div className="text-xs text-slate-500">
            Use direct buttons on the right to save & advance to next image
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 pt-2">
        {/* Left Section: Image Preview with Zoom In / Zoom Out Controls */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="relative flex h-[510px] w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-900/5 p-2">
            {/* Floating Zoom Controls Bar */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 px-2 py-1 shadow-md backdrop-blur-xs">
              <Tooltip title="Zoom Out (-)">
                <Button
                  size="small"
                  type="text"
                  icon={<ZoomOutOutlined />}
                  disabled={zoom <= 0.5}
                  onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
                />
              </Tooltip>
              <span className="w-12 text-center text-xs font-mono font-semibold text-slate-700">
                {Math.round(zoom * 100)}%
              </span>
              <Tooltip title="Zoom In (+)">
                <Button
                  size="small"
                  type="text"
                  icon={<ZoomInOutlined />}
                  disabled={zoom >= 4.0}
                  onClick={() => setZoom((z) => Math.min(4.0, Math.round((z + 0.25) * 100) / 100))}
                />
              </Tooltip>
              <Divider type="vertical" className="my-0 h-4" />
              <Tooltip title="Reset Zoom to 1x">
                <Button
                  size="small"
                  type="text"
                  icon={<UndoOutlined />}
                  onClick={() => {
                    setZoom(1);
                    setIsAutoZoomed(false);
                  }}
                >
                  1x
                </Button>
              </Tooltip>
              {isAutoZoomed && (
                <Tag color="cyan" className="ml-1 text-[10px] leading-tight">
                  Auto-Zoomed
                </Tag>
              )}
            </div>

            {loading ? (
              <Spin tip="Loading image..." />
            ) : previewUrl ? (
              <OcrImageViewer
                className="h-full w-full"
                src={previewUrl}
                imageWidth={sample.width}
                imageHeight={sample.height}
                selected={activeBox}
                zoom={zoom}
                autoCenterSelected={true}
              />
            ) : (
              <PictureOutlined className="text-5xl text-slate-400" />
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-slate-500">
            <span>Dimensions: {sample.width ?? "—"} × {sample.height ?? "—"}</span>
            <span>Green rectangle highlights detected odometer boundary</span>
          </div>
        </div>

        {/* Right Section: Details, Ground Truth, and Direction Action Buttons */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            {/* Metadata Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <Typography.Text type="secondary">Category:</Typography.Text>
                <div>
                  {sample.category === "ready" ? (
                    <Tag color="green" className="font-semibold">Ready</Tag>
                  ) : sample.category === "failed" ? (
                    <Tag color="volcano" className="font-semibold">Failed</Tag>
                  ) : sample.category === "raw" || !sample.category ? (
                    <Tag color="cyan">Raw (Pending)</Tag>
                  ) : (
                    <Tag color="default" className="capitalize">{sample.category}</Tag>
                  )}
                  <Tag color={sample.review_status === "reviewed" ? "green" : "warning"}>
                    {sample.review_status === "reviewed" ? "Reviewed" : "Unreviewed"}
                  </Tag>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                <Typography.Text type="secondary">Filename:</Typography.Text>
                <Typography.Text strong className="font-mono text-slate-800 max-w-[200px] truncate" title={sample.filename}>
                  {sample.filename}
                </Typography.Text>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                <Typography.Text type="secondary">OCR Prediction:</Typography.Text>
                {sample.upload_predicted ? (
                  <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {sample.upload_predicted}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">None</span>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                <Typography.Text type="secondary">Bounding Box:</Typography.Text>
                {activeBox ? (
                  <Tag color="blue" className="font-mono text-xs">
                    [{Math.round(activeBox.x1)}, {Math.round(activeBox.y1)}, {Math.round(activeBox.x2)}, {Math.round(activeBox.y2)}]
                  </Tag>
                ) : (
                  <span className="text-slate-400 italic">None detected</span>
                )}
              </div>
            </div>

            {/* Ground Truth Input */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-800">
                  Ground Truth Value:
                </label>
                {sample.upload_predicted && sample.upload_predicted !== gtInput && (
                  <Button
                    type="link"
                    size="small"
                    className="p-0 text-xs text-blue-600 h-auto"
                    onClick={() => setGtInput(sample.upload_predicted || "")}
                  >
                    Copy from OCR
                  </Button>
                )}
              </div>
              <Input
                value={gtInput}
                onChange={(e) => setGtInput(e.target.value)}
                placeholder="Enter numeric reading (e.g. 124500)"
                size="large"
                className="font-mono font-bold text-base tracking-wider"
                allowClear
              />
              <div className="mt-1 text-[11px] text-slate-400">
                Corrected numeric digits only.
              </div>
            </div>

            {/* Gemini AI Extraction Button */}
            <Button
              type="dashed"
              icon={<ThunderboltOutlined className="text-amber-500" />}
              onClick={onOpenGetValue}
              block
              className="font-medium text-slate-700"
            >
              Get Value & BBox (Gemini AI)
            </Button>
          </div>

          {/* Direction / Action Buttons to Move + Save */}
          <div className="space-y-2 border-t border-slate-200 pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Save & Move Sample:
            </div>

            {/* 1. Primary: Save & Move to Ready */}
            <Button
              type="primary"
              loading={saveMutation.isPending && targetAction === "ready"}
              onClick={() => handleSaveAction("ready")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold h-11 w-full flex items-center justify-center gap-2 text-sm shadow-sm"
              icon={<CheckCircleOutlined />}
            >
              Save & Move to Ready
            </Button>

            {/* 2. Danger: Move to Failed */}
            <Button
              danger
              loading={saveMutation.isPending && targetAction === "failed"}
              onClick={() => handleSaveAction("failed")}
              className="h-10 w-full font-medium flex items-center justify-center gap-2"
              icon={<CloseCircleOutlined />}
            >
              Move to Failed
            </Button>

            {/* 3. Keep in current / raw */}
            <Button
              loading={saveMutation.isPending && targetAction === "keep"}
              onClick={() => handleSaveAction("keep")}
              className="h-9 w-full font-medium flex items-center justify-center gap-2 text-xs text-slate-600"
              icon={<SaveOutlined />}
            >
              Save Ground Truth Only (Keep Current)
            </Button>

            {/* 4. Other custom categories (if any) */}
            {otherCategories.length > 0 && (
              <div className="pt-1.5">
                <div className="text-[11px] font-medium text-slate-400 mb-1">
                  Or transfer to other category:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {otherCategories.map((c) => (
                    <Button
                      key={c.value}
                      size="small"
                      onClick={() => handleSaveAction(c.value)}
                      loading={saveMutation.isPending && targetAction === c.value}
                      className="text-xs capitalize"
                    >
                      {c.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
