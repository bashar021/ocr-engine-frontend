import {
  AppstoreOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  ClearOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  InboxOutlined,
  LeftOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
  SwapOutlined,
  TableOutlined,
  TagOutlined,
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
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { MenuProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import {
  addDatabankCategory,
  batchMoveDatabankSamples,
  batchSetDatabankSampleCategory,
  createDatabankDataset,
  deleteDatabankSample,
  downloadDatabankCsv,
  fetchDatabankSampleImageUrl,
  getDatabank,
  getDatabankCategoryCounts,
  getDatabankDataset,
  listDatabankDatasets,
  listDatabankSamples,
  reviewDatabankSample,
  setDatabankSampleCategory,
  uploadToDatabank,
} from "@/api/databank";
import {
  DEFAULT_ENHANCE,
  enhanceFromPreset,
  OcrImageViewer,
  type ImageEnhancePreset,
} from "@/components/ocr/OcrImageViewer";
import { useTaskContext } from "@/features/tasks/TaskContext";
import { useDebounce } from "@/hooks/useDebounce";
import type { DatabankDataset, DatabankSample } from "@/types/databank";
import type { OcrBoundingBox } from "@/types/ocr";

// ---------------------------------------------------------------------------
// Types & Helper Functions
// ---------------------------------------------------------------------------

type FilenameGtFilter = "all" | "yes" | "no";
type PredictedFilter = "all" | "has" | "missing" | "error";
type MatchFilter = "all" | "yes" | "no" | "none";
type FinalGtFilter = "all" | "yes" | "no";
type RerunFilter = "all" | "has" | "missing" | "ok" | "miss";
type ReviewStatusFilter = "all" | "reviewed" | "unreviewed";

const ENHANCE_PRESETS: { key: ImageEnhancePreset; label: string }[] = [
  { key: "identity", label: "Identity" },
  { key: "invert", label: "Invert" },
  { key: "grayscale", label: "Grayscale" },
  { key: "clarity", label: "Clarity" },
  { key: "contrast_stretch", label: "Contrast stretch" },
  { key: "denoise", label: "Denoise" },
];

// Zoom bounds mirror the clamp inside OcrImageViewer (0.5x – 4x).
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;
const clampZoom = (z: number) =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));

function categoryTagColor(category: string): string {
  const norm = (category || "").trim().toLowerCase();
  if (!norm || norm === "general") return "blue";
  if (norm === "blurry") return "orange";
  if (norm === "dead") return "red";
  if (norm === "night" || norm === "dark") return "purple";
  if (norm === "glare" || norm === "reflective") return "cyan";
  if (norm === "partial" || norm === "cropped") return "magenta";
  return "geekblue";
}

function categoryDisplayLabel(category: string): string {
  const norm = (category || "").trim().toLowerCase();
  if (!norm || norm === "general") return "General";
  if (norm === "blurry") return "Blurry";
  if (norm === "dead") return "Dead";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function toViewerBox(
  box: DatabankSample["display_bbox"],
): OcrBoundingBox | null {
  if (!box) return null;
  return {
    x1: box.x1,
    y1: box.y1,
    x2: box.x2,
    y2: box.y2,
    confidence: box.confidence ?? 0,
    label: box.label ?? "det",
  };
}

// ---------------------------------------------------------------------------
// Cached Sample Thumbnail Component
// ---------------------------------------------------------------------------

function LabelSampleThumbnail({
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
// Main LabelDataPage Component
// ---------------------------------------------------------------------------

export function LabelDataPage() {
  const { modal, message: appMessage } = App.useApp();
  const queryClient = useQueryClient();
  const { activeTaskKey } = useTaskContext();
  const [searchParams, setSearchParams] = useSearchParams();

  // 1. Datasets query for dropdown - strictly Label Data datasets
  const datasetsQuery = useQuery({
    queryKey: ["databank", "datasets-list", activeTaskKey, "label"],
    queryFn: () => listDatabankDatasets(activeTaskKey, { dataset_type: "label" }),
  });

  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(
    () => searchParams.get("dataset_id") || "",
  );

  // Fallback default label bank query
  const defaultBankQuery = useQuery({
    queryKey: ["databank", "default-label-bank", activeTaskKey],
    queryFn: () => getDatabank(activeTaskKey, "label"),
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
    refetchInterval: (q) => {
      const data = q.state.data;
      const status = data?.status;
      const jobRunning = data?.upload_progress?.status === "running";
      if (
        jobRunning ||
        (status && ["predicting", "processing", "rerunning"].includes(status))
      ) {
        return 2000;
      }
      return false;
    },
  });

  const dataset: DatabankDataset | undefined =
    activeDatasetQuery.data || defaultBankQuery.data;
  const datasetId = dataset?.id;

  // Custom categories for this dataset
  const customCategories = useMemo(() => {
    const raw = dataset?.custom_categories;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0 && v !== "raw",
    );
  }, [dataset?.custom_categories]);

  // All available categories for this dataset (no raw)
  const availableCategories = useMemo(() => {
    return [
      { key: "general", label: "General", value: "" },
      { key: "blurry", label: "Blurry", value: "blurry" },
      { key: "dead", label: "Dead", value: "dead" },
      ...customCategories.map((c) => ({
        key: c,
        label: categoryDisplayLabel(c),
        value: c,
      })),
    ];
  }, [customCategories]);

  // Active category short tab (defaults to "general")
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>(() => {
    return searchParams.get("category") || "general";
  });

  // Keep category tab valid if custom categories update
  useEffect(() => {
    const validKeys = ["general", "blurry", "dead", ...customCategories];
    if (!validKeys.includes(activeCategoryTab)) {
      setActiveCategoryTab("general");
    }
  }, [customCategories, activeCategoryTab]);

  // Filters State
  const [withinReviewStatus, setWithinReviewStatus] =
    useState<ReviewStatusFilter>(
      (searchParams.get("review_status") as ReviewStatusFilter) || "all",
    );
  const [filenameGtFilter, setFilenameGtFilter] = useState<FilenameGtFilter>(
    (searchParams.get("has_gt") as FilenameGtFilter) || "all",
  );
  const [predictedFilter, setPredictedFilter] = useState<PredictedFilter>(
    (searchParams.get("predicted") as PredictedFilter) || "all",
  );
  const [matchFilter, setMatchFilter] = useState<MatchFilter>(
    (searchParams.get("match") as MatchFilter) || "all",
  );
  const [finalGtFilter, setFinalGtFilter] = useState<FinalGtFilter>(
    (searchParams.get("final_gt") as FinalGtFilter) || "all",
  );
  const [rerunFilter, setRerunFilter] = useState<RerunFilter>(
    (searchParams.get("rerun") as RerunFilter) || "all",
  );
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const debouncedSearch = useDebounce(searchInput, 300);

  // Pagination & Layout
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [viewMode, setViewMode] = useState<"table" | "gallery">("table");

  // Selection
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchTargetCategory, setBatchTargetCategory] = useState<string>("general");

  // Modals state
  const [createDatasetModalOpen, setCreateDatasetModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [addCategoryModalOpen, setAddCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveTargetDatasetId, setMoveTargetDatasetId] = useState<string>("");
  const [moveTargetCategory, setMoveTargetCategory] = useState<string>("general");
  const [reviewSample, setReviewSample] = useState<DatabankSample | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Review Form & Image Enhance State
  const [reviewForm] = Form.useForm<{
    corrected_gt: string;
    review_notes?: string;
    target_category?: string;
  }>();
  const [imgBrightness, setImgBrightness] = useState(DEFAULT_ENHANCE.brightness);
  const [imgContrast, setImgContrast] = useState(DEFAULT_ENHANCE.contrast);
  const [imgZoom, setImgZoom] = useState(DEFAULT_ENHANCE.zoom);
  const [imgSharpen, setImgSharpen] = useState(DEFAULT_ENHANCE.sharpen);
  const [imgInvert, setImgInvert] = useState(DEFAULT_ENHANCE.invert);
  const [imgGrayscale, setImgGrayscale] = useState(DEFAULT_ENHANCE.grayscale);
  const [imgSaturate, setImgSaturate] = useState(DEFAULT_ENHANCE.saturate);
  const [imgBlur, setImgBlur] = useState(DEFAULT_ENHANCE.blur);

  // Sync state to URL search params
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedDatasetId) next.set("dataset_id", selectedDatasetId);
    else next.delete("dataset_id");

    if (activeCategoryTab !== "general") next.set("category", activeCategoryTab);
    else next.delete("category");

    if (withinReviewStatus !== "all") next.set("review_status", withinReviewStatus);
    else next.delete("review_status");

    if (debouncedSearch) next.set("search", debouncedSearch);
    else next.delete("search");

    if (filenameGtFilter !== "all") next.set("has_gt", filenameGtFilter);
    else next.delete("has_gt");

    if (predictedFilter !== "all") next.set("predicted", predictedFilter);
    else next.delete("predicted");

    if (matchFilter !== "all") next.set("match", matchFilter);
    else next.delete("match");

    if (finalGtFilter !== "all") next.set("final_gt", finalGtFilter);
    else next.delete("final_gt");

    if (rerunFilter !== "all") next.set("rerun", rerunFilter);
    else next.delete("rerun");

    setSearchParams(next, { replace: true });
  }, [
    selectedDatasetId,
    activeCategoryTab,
    withinReviewStatus,
    debouncedSearch,
    filenameGtFilter,
    predictedFilter,
    matchFilter,
    finalGtFilter,
    rerunFilter,
    setSearchParams,
    searchParams,
  ]);

  // Query Samples for Active Category Tab & Filters
  const samplesQuery = useQuery({
    queryKey: [
      "databank",
      "label-samples",
      datasetId,
      activeCategoryTab,
      withinReviewStatus,
      debouncedSearch,
      filenameGtFilter,
      predictedFilter,
      matchFilter,
      finalGtFilter,
      rerunFilter,
      page,
      pageSize,
    ],
    enabled: Boolean(datasetId),
    queryFn: () =>
      listDatabankSamples(datasetId!, {
        review_status: activeCategoryTab,
        within_review_status:
          withinReviewStatus === "all" ? undefined : withinReviewStatus,
        search: debouncedSearch.trim() || undefined,
        has_filename_gt:
          filenameGtFilter === "all" ? undefined : filenameGtFilter === "yes",
        has_prediction: predictedFilter === "all" ? undefined : predictedFilter,
        upload_match: matchFilter === "all" ? undefined : matchFilter,
        has_final_gt:
          finalGtFilter === "all" ? undefined : finalGtFilter === "yes",
        has_rerun: rerunFilter === "all" ? undefined : rerunFilter,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
  });

  // Calculate Category Counts
  const categoryCounts = useMemo(() => {
    const rawCounts = dataset?.category_counts || {};
    const res: Record<
      string,
      {
        total: number;
        reviewed: number;
        unreviewed: number;
        has_gt: number;
        no_gt: number;
      }
    > = {};

    // General
    const genRaw = rawCounts["general"] || rawCounts[""];
    const genTotal =
      genRaw?.total ??
      Math.max(
        0,
        (dataset?.sample_count ?? 0) -
          (dataset?.blurry_count ?? 0) -
          (dataset?.raw_pending_count ?? 0),
      );
    const genReviewed = genRaw?.reviewed ?? (dataset?.reviewed_count ?? 0);
    const genUnreviewed =
      genRaw?.unreviewed ?? Math.max(0, genTotal - genReviewed);
    const genHasGt =
      genRaw?.has_gt ??
      Math.max(
        0,
        (dataset?.has_gt_count ?? 0) - (rawCounts["blurry"]?.has_gt ?? 0),
      );
    const genNoGt = genRaw?.no_gt ?? Math.max(0, genTotal - genHasGt);

    res["general"] = {
      total: genTotal,
      reviewed: genReviewed,
      unreviewed: genUnreviewed,
      has_gt: genHasGt,
      no_gt: genNoGt,
    };

    // Blurry
    const blurryRaw = rawCounts["blurry"];
    const blurryTotal = blurryRaw?.total ?? (dataset?.blurry_count ?? 0);
    const blurryReviewed = blurryRaw?.reviewed ?? 0;
    res["blurry"] = {
      total: blurryTotal,
      reviewed: blurryReviewed,
      unreviewed: blurryRaw?.unreviewed ?? Math.max(0, blurryTotal - blurryReviewed),
      has_gt: blurryRaw?.has_gt ?? 0,
      no_gt: blurryRaw?.no_gt ?? Math.max(0, blurryTotal - (blurryRaw?.has_gt ?? 0)),
    };

    // Dead
    const deadRaw = rawCounts["dead"];
    const deadTotal = deadRaw?.total ?? 0;
    const deadReviewed = deadRaw?.reviewed ?? 0;
    res["dead"] = {
      total: deadTotal,
      reviewed: deadReviewed,
      unreviewed: deadRaw?.unreviewed ?? Math.max(0, deadTotal - deadReviewed),
      has_gt: deadRaw?.has_gt ?? 0,
      no_gt: deadRaw?.no_gt ?? Math.max(0, deadTotal - (deadRaw?.has_gt ?? 0)),
    };

    // Custom categories
    for (const cat of customCategories) {
      const cRaw = rawCounts[cat];
      const cTotal = cRaw?.total ?? 0;
      const cReviewed = cRaw?.reviewed ?? 0;
      res[cat] = {
        total: cTotal,
        reviewed: cReviewed,
        unreviewed: cRaw?.unreviewed ?? Math.max(0, cTotal - cReviewed),
        has_gt: cRaw?.has_gt ?? 0,
        no_gt: cRaw?.no_gt ?? Math.max(0, cTotal - (cRaw?.has_gt ?? 0)),
      };
    }

    return res;
  }, [dataset, customCategories]);

  // Dynamic Category Counts Query for active filters
  const categoryCountsQuery = useQuery({
    queryKey: [
      "databank",
      "category-counts",
      datasetId,
      withinReviewStatus,
      filenameGtFilter,
      debouncedSearch,
      predictedFilter,
      matchFilter,
      finalGtFilter,
      rerunFilter,
    ],
    enabled: Boolean(datasetId),
    queryFn: () =>
      getDatabankCategoryCounts(datasetId!, {
        within_review_status:
          withinReviewStatus === "all" ? undefined : withinReviewStatus,
        search: debouncedSearch.trim() || undefined,
        has_filename_gt:
          filenameGtFilter === "all" ? undefined : filenameGtFilter === "yes",
        has_prediction: predictedFilter === "all" ? undefined : predictedFilter,
        upload_match: matchFilter === "all" ? undefined : matchFilter,
        has_final_gt:
          finalGtFilter === "all" ? undefined : finalGtFilter === "yes",
        has_rerun: rerunFilter === "all" ? undefined : rerunFilter,
      }),
  });

  // Category badge count that dynamically adapts to active filters
  const getCategoryBadgeCount = (catKey: string): number => {
    // If backend dynamic category counts are available for this key, use them
    if (categoryCountsQuery.data && catKey in categoryCountsQuery.data) {
      return categoryCountsQuery.data[catKey] ?? 0;
    }
    // Instant fallback from dataset metadata category counts according to active stat filter
    const stats = categoryCounts[catKey];
    if (!stats) return 0;
    if (withinReviewStatus === "reviewed") return stats.reviewed;
    if (withinReviewStatus === "unreviewed") return stats.unreviewed;
    if (filenameGtFilter === "yes") return stats.has_gt;
    if (filenameGtFilter === "no") return stats.no_gt;
    return stats.total;
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchInput("");
    setWithinReviewStatus("all");
    setFilenameGtFilter("all");
    setPredictedFilter("all");
    setMatchFilter("all");
    setFinalGtFilter("all");
    setRerunFilter("all");
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    withinReviewStatus !== "all" ||
    filenameGtFilter !== "all" ||
    predictedFilter !== "all" ||
    matchFilter !== "all" ||
    finalGtFilter !== "all" ||
    rerunFilter !== "all";

  // Mutations
  const createDatasetMutation = useMutation({
    mutationFn: (values: { name: string; description?: string }) =>
      createDatabankDataset({
        ocr_type: activeTaskKey,
        name: values.name,
        description: values.description,
        dataset_type: "label",
      }),
    onSuccess: (newDs) => {
      appMessage.success(`Created dataset "${newDs.name}"`);
      setCreateDatasetModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["databank", "datasets-list"] });
      setSelectedDatasetId(newDs.id);
      setSelectedRowKeys([]);
      setPage(1);
    },
    onError: (error) => appMessage.error(getApiErrorMessage(error)),
  });

  const uploadMutation = useMutation({
    mutationFn: (values: { ocr_type: string; file: File; dataset_id?: string }) =>
      uploadToDatabank(values.ocr_type, values.file, values.dataset_id),
    onSuccess: (data) => {
      appMessage.success(
        `Upload complete: added ${data.added_samples ?? 0} samples`,
      );
      setUploadModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
    },
    onError: (error) => appMessage.error(getApiErrorMessage(error)),
  });

  const addCategoryMutation = useMutation({
    mutationFn: (name: string) => addDatabankCategory(datasetId!, name),
    onSuccess: () => {
      appMessage.success(`Category "${newCategoryName}" added successfully`);
      setAddCategoryModalOpen(false);
      setNewCategoryName("");
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
      setActiveCategoryTab(newCategoryName.trim().toLowerCase());
    },
    onError: (error) => appMessage.error(getApiErrorMessage(error)),
  });

  const setCategoryMutation = useMutation({
    mutationFn: ({ sampleId, category }: { sampleId: string; category: string }) =>
      setDatabankSampleCategory(datasetId!, sampleId, category),
    onSuccess: (sample) => {
      appMessage.success(`Updated sample category to ${categoryDisplayLabel(sample.category || "General")}`);
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
    },
    onError: (error) => appMessage.error(getApiErrorMessage(error)),
  });

  const deleteSampleMutation = useMutation({
    mutationFn: (sampleId: string) => deleteDatabankSample(datasetId!, sampleId),
    onSuccess: (res) => {
      appMessage.success(`Deleted sample ${res.filename}`);
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
    },
    onError: (error) => appMessage.error(getApiErrorMessage(error)),
  });

  // Batch Tagging Handler
  const handleBatchTagCategory = async (targetCatKey: string) => {
    if (!datasetId || selectedRowKeys.length === 0) return;
    const count = selectedRowKeys.length;
    const catValue = targetCatKey === "general" ? "" : targetCatKey;
    const catLabel = categoryDisplayLabel(targetCatKey);

    modal.confirm({
      title: `Tag ${count} sample${count > 1 ? "s" : ""} as ${catLabel}?`,
      content: `This will update the category of ${count} selected item${count > 1 ? "s" : ""} to "${catLabel}".`,
      okText: `Tag as ${catLabel}`,
      centered: true,
      onOk: async () => {
        try {
          const res = await batchSetDatabankSampleCategory(
            datasetId,
            selectedRowKeys as string[],
            catValue,
          );
          appMessage.success(`Categorized ${res.count} samples as ${catLabel}`);
          setSelectedRowKeys([]);
          void queryClient.invalidateQueries({ queryKey: ["databank"] });
        } catch (err) {
          appMessage.error(getApiErrorMessage(err));
        }
      },
    });
  };

  // Batch Delete Handler
  const handleBatchDelete = async () => {
    if (!datasetId || selectedRowKeys.length === 0) return;
    const count = selectedRowKeys.length;

    modal.confirm({
      title: `Delete ${count} selected sample${count > 1 ? "s" : ""}?`,
      content: "This action cannot be undone and will permanently remove these samples from the dataset.",
      okText: "Delete",
      okType: "danger",
      centered: true,
      onOk: async () => {
        try {
          let deletedCount = 0;
          for (const key of selectedRowKeys) {
            await deleteDatabankSample(datasetId, String(key));
            deletedCount++;
          }
          appMessage.success(`Successfully deleted ${deletedCount} samples`);
          setSelectedRowKeys([]);
          void queryClient.invalidateQueries({ queryKey: ["databank"] });
        } catch (err) {
          appMessage.error(getApiErrorMessage(err));
        }
      },
    });
  };

  // Batch Move Target Dataset Object & Available Categories
  const targetDatasetObj = useMemo(() => {
    return (
      datasetsQuery.data?.datasets?.find((d) => d.id === moveTargetDatasetId) ||
      dataset
    );
  }, [datasetsQuery.data?.datasets, moveTargetDatasetId, dataset]);

  const targetAvailableCategories = useMemo(() => {
    const customCats = Array.isArray(targetDatasetObj?.custom_categories)
      ? targetDatasetObj.custom_categories.filter(
          (v): v is string =>
            typeof v === "string" && v.trim().length > 0 && v !== "raw",
        )
      : [];
    return [
      { value: "general", label: "General" },
      { value: "blurry", label: "Blurry" },
      { value: "dead", label: "Dead" },
      ...customCats.map((c) => ({
        value: c,
        label: categoryDisplayLabel(c),
      })),
    ];
  }, [targetDatasetObj]);

  useEffect(() => {
    const valid = targetAvailableCategories.map((c) => c.value);
    if (!valid.includes(moveTargetCategory)) {
      setMoveTargetCategory("general");
    }
  }, [targetAvailableCategories, moveTargetCategory]);

  const handleOpenMoveModal = () => {
    setMoveTargetDatasetId(effectiveDatasetId);
    setMoveTargetCategory("general");
    setMoveModalOpen(true);
  };

  const batchMoveMutation = useMutation({
    mutationFn: (values: {
      target_dataset_id: string;
      target_category: string;
    }) =>
      batchMoveDatabankSamples(datasetId!, {
        sample_ids: selectedRowKeys as string[],
        target_dataset_id: values.target_dataset_id,
        target_category:
          values.target_category === "general" ? "" : values.target_category,
      }),
    onSuccess: (res) => {
      appMessage.success(`Moved ${res.moved_count} sample(s) successfully`);
      setSelectedRowKeys([]);
      setMoveModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
    },
    onError: (err) => {
      appMessage.error(getApiErrorMessage(err));
    },
  });

  // Review Modal Handling
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    if (datasetId && reviewSample) {
      void fetchDatabankSampleImageUrl(datasetId, reviewSample.id)
        .then((u) => {
          if (!cancelled) {
            url = u;
            setPreviewUrl(u);
          } else {
            URL.revokeObjectURL(u);
          }
        })
        .catch(() => {
          if (!cancelled) setPreviewUrl(null);
        });

      reviewForm.setFieldsValue({
        corrected_gt: reviewSample.final_gt ?? reviewSample.ground_truth ?? "",
        review_notes: reviewSample.review_notes ?? "",
        target_category: reviewSample.category || (reviewSample.is_blurry ? "blurry" : "general"),
      });
    } else {
      setPreviewUrl(null);
    }

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [datasetId, reviewSample, reviewForm]);

  const handleSaveReview = async () => {
    if (!datasetId || !reviewSample) return;
    try {
      const values = await reviewForm.validateFields();
      const cat = values.target_category === "general" ? "" : values.target_category;
      await reviewDatabankSample(datasetId, reviewSample.id, {
        corrected_gt: values.corrected_gt.trim(),
        review_notes: values.review_notes?.trim() || null,
        target_category: cat,
      });
      appMessage.success(`Saved review for ${reviewSample.filename}`);
      void queryClient.invalidateQueries({ queryKey: ["databank"] });

      // Navigate to next unreviewed sample if available
      const currentList = samplesQuery.data?.samples || [];
      const currentIndex = currentList.findIndex((s) => s.id === reviewSample.id);
      if (currentIndex >= 0 && currentIndex < currentList.length - 1) {
        setReviewSample(currentList[currentIndex + 1]);
      } else {
        setReviewSample(null);
      }
    } catch (err) {
      appMessage.error(getApiErrorMessage(err));
    }
  };

  const handleNextSample = () => {
    const currentList = samplesQuery.data?.samples || [];
    const currentIndex = currentList.findIndex((s) => s.id === reviewSample?.id);
    if (currentIndex >= 0 && currentIndex < currentList.length - 1) {
      setReviewSample(currentList[currentIndex + 1]);
    }
  };

  const handlePrevSample = () => {
    const currentList = samplesQuery.data?.samples || [];
    const currentIndex = currentList.findIndex((s) => s.id === reviewSample?.id);
    if (currentIndex > 0) {
      setReviewSample(currentList[currentIndex - 1]);
    }
  };

  // Zoom controls for the review-modal image viewer
  const handleZoomIn = () => setImgZoom((z) => clampZoom(z + ZOOM_STEP));
  const handleZoomOut = () => setImgZoom((z) => clampZoom(z - ZOOM_STEP));
  const handleZoomReset = () => setImgZoom(DEFAULT_ENHANCE.zoom);

  // Table Columns
  const sampleColumns: ColumnsType<DatabankSample> = [
    {
      title: "Thumbnail",
      key: "thumbnail",
      width: 70,
      render: (_, row) => (
        <LabelSampleThumbnail
          datasetId={datasetId!}
          sampleId={row.id}
          filename={row.filename}
          className="h-12 w-12 cursor-pointer rounded border border-slate-200 object-cover"
          onClick={() => setReviewSample(row)}
        />
      ),
    },
    {
      title: "Filename",
      dataIndex: "filename",
      key: "filename",
      ellipsis: true,
      render: (text: string, row) => (
        <div>
          <Typography.Text
            strong
            className="cursor-pointer hover:text-blue-600"
            onClick={() => setReviewSample(row)}
          >
            {text}
          </Typography.Text>
          <div className="text-xs text-slate-400">
            {row.width && row.height ? `${row.width}×${row.height} px` : ""}
            {row.size_bytes ? ` • ${Math.round(row.size_bytes / 1024)} KB` : ""}
          </div>
        </div>
      ),
    },
    {
      title: "Filename GT",
      dataIndex: "ground_truth_normalized",
      key: "ground_truth_normalized",
      width: 130,
      render: (v, row) =>
        row.has_ground_truth ? (
          <Typography.Text code copyable={{ text: String(v ?? row.ground_truth) }}>
            {v ?? row.ground_truth ?? "—"}
          </Typography.Text>
        ) : (
          <Tag className="text-slate-400">No GT</Tag>
        ),
    },
    {
      title: "Predicted",
      dataIndex: "upload_predicted",
      key: "upload_predicted",
      width: 130,
      render: (v, row) =>
        v ? (
          <Space direction="vertical" size={2}>
            <Typography.Text code copyable={{ text: String(v) }}>
              {v}
            </Typography.Text>
            {row.upload_confidence != null && (
              <span className="text-xs text-slate-400">
                {(Number(row.upload_confidence) * 100).toFixed(1)}% conf
              </span>
            )}
          </Space>
        ) : row.upload_error ? (
          <Tooltip title={row.upload_error}>
            <Tag color="error">Error</Tag>
          </Tooltip>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      title: "Bounding Box",
      key: "bounding_box",
      width: 150,
      render: (_, row) => {
        const box = row.display_bbox || row.corrected_bbox || row.upload_bbox || row.bbox;
        if (!box) {
          return <span className="text-slate-400">—</span>;
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
      title: "Match",
      dataIndex: "upload_match",
      key: "upload_match",
      width: 90,
      render: (v: boolean | null) =>
        v == null ? (
          <span className="text-slate-400">—</span>
        ) : v ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Match
          </Tag>
        ) : (
          <Tag color="error" icon={<CloseCircleOutlined />}>
            Mismatch
          </Tag>
        ),
    },
    {
      title: "Final GT",
      dataIndex: "final_gt",
      key: "final_gt",
      width: 120,
      render: (v, row) =>
        v ? (
          <Typography.Text
            strong
            className={row.corrected_gt ? "text-emerald-600" : "text-slate-800"}
          >
            {v}
          </Typography.Text>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      title: "Category",
      key: "category",
      width: 130,
      render: (_, row) => {
        const catKey = row.category || (row.is_blurry ? "blurry" : "general");
        const menuItems: MenuProps["items"] = availableCategories.map((c) => ({
          key: c.key,
          label: (
            <Space size={6}>
              <Tag color={categoryTagColor(c.key)}>{c.label}</Tag>
              {c.key === catKey && <CheckOutlined className="text-blue-500" />}
            </Space>
          ),
          onClick: () => {
            setCategoryMutation.mutate({
              sampleId: row.id,
              category: c.key === "general" ? "" : c.key,
            });
          },
        }));

        return (
          <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
            <Tag
              color={categoryTagColor(catKey)}
              className="cursor-pointer select-none transition hover:opacity-80"
            >
              {categoryDisplayLabel(catKey)} ▾
            </Tag>
          </Dropdown>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "review_status",
      key: "review_status",
      width: 105,
      render: (status: string) =>
        status === "reviewed" ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Reviewed
          </Tag>
        ) : (
          <Tag color="default" className="text-slate-500">
            Unreviewed
          </Tag>
        ),
    },
    {
      title: "Re-run",
      dataIndex: "rerun_predicted",
      key: "rerun_predicted",
      width: 110,
      render: (v, row) =>
        v == null ? (
          <span className="text-slate-400">—</span>
        ) : (
          <Space size={4}>
            <Typography.Text code>{v}</Typography.Text>
            {row.rerun_match == null ? null : row.rerun_match ? (
              <Tag color="success">ok</Tag>
            ) : (
              <Tag color="error">miss</Tag>
            )}
          </Space>
        ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 110,
      fixed: "right",
      render: (_, row) => (
        <Space size={6}>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<EditOutlined />}
            onClick={() => setReviewSample(row)}
          >
            Review
          </Button>
          <Popconfirm
            title="Delete sample"
            description="Are you sure you want to delete this sample?"
            okText="Delete"
            cancelText="Cancel"
            okType="danger"
            onConfirm={() => deleteSampleMutation.mutate(row.id)}
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Options for Datasets Dropdown
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

  // Selected Box for Image Viewer
  const selectedBox = toViewerBox(
    reviewSample?.display_bbox ||
      reviewSample?.corrected_bbox ||
      reviewSample?.upload_bbox ||
      reviewSample?.bbox,
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50/50">
      <div className="flex-1 space-y-4 p-6">
        {/* ------------------------------------------------------------------ */}
        {/* Top Header Bar: Dataset Switcher + Upload + New Dataset Actions     */}
        {/* ------------------------------------------------------------------ */}
        <Card
          variant="borderless"
          className="rounded-xl border border-slate-200/80 bg-white shadow-xs"
          styles={{ body: { padding: "16px 20px" } }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Dataset Switcher & Details */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <DatabaseOutlined className="text-xl text-blue-600" />
                <Typography.Title level={4} className="!mb-0 font-bold tracking-tight text-slate-800">
                  Label Data
                </Typography.Title>
              </div>

              <div className="h-5 w-px bg-slate-200" />

              <div className="flex items-center gap-2">
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
                  loading={datasetsQuery.isLoading}
                  options={datasetOptions}
                  className="w-64"
                  popupMatchSelectWidth={false}
                />
              </div>

              <Button
                icon={<PlusOutlined />}
                onClick={() => setCreateDatasetModalOpen(true)}
                className="border-slate-300 font-medium text-slate-700 hover:border-blue-500 hover:text-blue-600"
              >
                New Dataset
              </Button>
            </div>

            {/* Right Header Actions: Upload, Add Category, Export, Refresh */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={() => setUploadModalOpen(true)}
                className="bg-teal-700 font-medium shadow-xs hover:bg-teal-800 text-white"
              >
                Upload Data
              </Button>

              <Button
                icon={<TagOutlined />}
                onClick={() => setAddCategoryModalOpen(true)}
                className="border-slate-300 text-slate-700"
              >
                Add Category
              </Button>

              <Button
                icon={<DownloadOutlined />}
                onClick={async () => {
                  if (!datasetId) return;
                  try {
                    const { blob, filename } = await downloadDatabankCsv(datasetId);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                    appMessage.success("Exported CSV successfully");
                  } catch (err) {
                    appMessage.error(getApiErrorMessage(err));
                  }
                }}
                className="border-slate-300 text-slate-700"
              >
                Export CSV
              </Button>

              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  void queryClient.invalidateQueries({ queryKey: ["databank"] });
                  appMessage.info("Refreshed databank");
                }}
                className="border-slate-300 text-slate-600"
              />
            </div>
          </div>

          {/* Dataset Metadata Sub-strip with Clickable Filters */}
          {dataset && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <button
                type="button"
                onClick={() => {
                  setWithinReviewStatus("all");
                  setFilenameGtFilter("all");
                  setPage(1);
                }}
                className="group flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-slate-100"
                title="Click to reset review and GT filters"
              >
                <span>Total Dataset Samples:</span>
                <strong className="text-slate-800 underline-offset-2 group-hover:underline">
                  {dataset.sample_count ?? 0}
                </strong>
              </button>

              <span>•</span>

              <button
                type="button"
                onClick={() => {
                  setFilenameGtFilter("all");
                  setWithinReviewStatus((prev) => (prev === "reviewed" ? "all" : "reviewed"));
                  setPage(1);
                }}
                className={`group flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 transition ${
                  withinReviewStatus === "reviewed"
                    ? "bg-emerald-50 font-semibold text-emerald-800 ring-1 ring-emerald-300"
                    : "hover:bg-slate-100"
                }`}
                title={
                  withinReviewStatus === "reviewed"
                    ? "Filtered by Reviewed. Click to clear."
                    : "Click to filter by Reviewed"
                }
              >
                <span>Reviewed:</span>
                <strong className="text-emerald-600 underline-offset-2 group-hover:underline">
                  {dataset.reviewed_count ?? 0}
                </strong>
              </button>

              <span>•</span>

              <button
                type="button"
                onClick={() => {
                  setFilenameGtFilter("all");
                  setWithinReviewStatus((prev) => (prev === "unreviewed" ? "all" : "unreviewed"));
                  setPage(1);
                }}
                className={`group flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 transition ${
                  withinReviewStatus === "unreviewed"
                    ? "bg-amber-50 font-semibold text-amber-800 ring-1 ring-amber-300"
                    : "hover:bg-slate-100"
                }`}
                title={
                  withinReviewStatus === "unreviewed"
                    ? "Filtered by Unreviewed. Click to clear."
                    : "Click to filter by Unreviewed"
                }
              >
                <span>Unreviewed:</span>
                <strong className="text-amber-600 underline-offset-2 group-hover:underline">
                  {dataset.unreviewed_count ?? 0}
                </strong>
              </button>

              <span>•</span>

              <button
                type="button"
                onClick={() => {
                  setWithinReviewStatus("all");
                  setFilenameGtFilter((prev) => (prev === "yes" ? "all" : "yes"));
                  setPage(1);
                }}
                className={`group flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 transition ${
                  filenameGtFilter === "yes"
                    ? "bg-indigo-50 font-semibold text-indigo-800 ring-1 ring-indigo-300"
                    : "hover:bg-slate-100"
                }`}
                title={
                  filenameGtFilter === "yes"
                    ? "Filtered by Has GT. Click to clear."
                    : "Click to filter by Has GT"
                }
              >
                <span>Has GT:</span>
                <strong className="text-emerald-600 underline-offset-2 group-hover:underline">
                  {dataset.has_gt_count ?? 0}
                </strong>
              </button>

              <span>•</span>

              <button
                type="button"
                onClick={() => {
                  setWithinReviewStatus("all");
                  setFilenameGtFilter((prev) => (prev === "no" ? "all" : "no"));
                  setPage(1);
                }}
                className={`group flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 transition ${
                  filenameGtFilter === "no"
                    ? "bg-rose-50 font-semibold text-rose-800 ring-1 ring-rose-300"
                    : "hover:bg-slate-100"
                }`}
                title={
                  filenameGtFilter === "no"
                    ? "Filtered by No GT. Click to clear."
                    : "Click to filter by No GT"
                }
              >
                <span>No GT:</span>
                <strong className="text-rose-600 underline-offset-2 group-hover:underline">
                  {dataset.no_gt_count ?? Math.max(0, (dataset.sample_count ?? 0) - (dataset.has_gt_count ?? 0))}
                </strong>
              </button>

              {dataset.description && (
                <>
                  <span>•</span>
                  <span className="italic text-slate-400">{dataset.description}</span>
                </>
              )}
            </div>
          )}
        </Card>

        {/* ------------------------------------------------------------------ */}
        {/* Comprehensive Filter Toolbar (matches Databank List Tab)           */}
        {/* ------------------------------------------------------------------ */}
        <Card
          variant="borderless"
          className="rounded-xl border border-slate-200/80 bg-white shadow-xs"
          styles={{ body: { padding: "16px 20px" } }}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Search Input */}
              <div className="flex flex-1 items-center gap-3">
                <Input
                  placeholder="Search filename, ground truth, or predicted..."
                  prefix={<SearchOutlined className="text-slate-400" />}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  allowClear
                  className="max-w-md rounded-lg"
                />
                {hasActiveFilters && (
                  <Button
                    icon={<ClearOutlined />}
                    onClick={handleResetFilters}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Reset Filters
                  </Button>
                )}
              </div>

              {/* View Switcher: Table vs Gallery */}
              <div className="flex items-center gap-2">
                <Segmented
                  value={viewMode}
                  onChange={(v) => setViewMode(v as "table" | "gallery")}
                  options={[
                    { value: "table", icon: <TableOutlined /> },
                    { value: "gallery", icon: <AppstoreOutlined /> },
                  ]}
                />
              </div>
            </div>

            {/* Filter Dropdowns Grid */}
            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
              <span className="font-semibold text-slate-500">Filters:</span>

              {/* Review Status Filter */}
              <Select
                size="small"
                value={withinReviewStatus}
                onChange={(val) => {
                  setWithinReviewStatus(val);
                  setPage(1);
                }}
                style={{ width: 130 }}
                options={[
                  { value: "all", label: "Status: All" },
                  { value: "reviewed", label: "Status: Reviewed" },
                  { value: "unreviewed", label: "Status: Unreviewed" },
                ]}
              />

              {/* Filename GT Filter */}
              <Select
                size="small"
                value={filenameGtFilter}
                onChange={(val) => {
                  setFilenameGtFilter(val);
                  setPage(1);
                }}
                style={{ width: 135 }}
                options={[
                  { value: "all", label: "Filename GT: All" },
                  { value: "yes", label: "Has GT" },
                  { value: "no", label: "No GT" },
                ]}
              />

              {/* Predicted Filter */}
              <Select
                size="small"
                value={predictedFilter}
                onChange={(val) => {
                  setPredictedFilter(val);
                  setPage(1);
                }}
                style={{ width: 140 }}
                options={[
                  { value: "all", label: "Predicted: All" },
                  { value: "has", label: "Has prediction" },
                  { value: "missing", label: "Missing prediction" },
                  { value: "error", label: "Prediction error" },
                ]}
              />

              {/* Match Filter */}
              <Select
                size="small"
                value={matchFilter}
                onChange={(val) => {
                  setMatchFilter(val);
                  setPage(1);
                }}
                style={{ width: 130 }}
                options={[
                  { value: "all", label: "Match: All" },
                  { value: "yes", label: "Exact match" },
                  { value: "no", label: "Mismatch" },
                  { value: "none", label: "No comparison" },
                ]}
              />

              {/* Final GT Filter */}
              <Select
                size="small"
                value={finalGtFilter}
                onChange={(val) => {
                  setFinalGtFilter(val);
                  setPage(1);
                }}
                style={{ width: 130 }}
                options={[
                  { value: "all", label: "Final GT: All" },
                  { value: "yes", label: "Has final GT" },
                  { value: "no", label: "No final GT" },
                ]}
              />

              {/* Re-run Filter */}
              <Select
                size="small"
                value={rerunFilter}
                onChange={(val) => {
                  setRerunFilter(val);
                  setPage(1);
                }}
                style={{ width: 130 }}
                options={[
                  { value: "all", label: "Re-run: All" },
                  { value: "has", label: "Has re-run" },
                  { value: "missing", label: "No re-run" },
                  { value: "ok", label: "Re-run match" },
                  { value: "miss", label: "Re-run miss" },
                ]}
              />
            </div>
          </div>
        </Card>

        {/* ------------------------------------------------------------------ */}
        {/* Category Short Tabs (Moved after the Table Toolbar)                */}
        {/* ------------------------------------------------------------------ */}
        <Card
          variant="borderless"
          className="rounded-xl border border-slate-200/80 bg-white shadow-xs"
          styles={{ body: { padding: "12px 20px 0px 20px" } }}
        >
          <Tabs
            activeKey={activeCategoryTab}
            onChange={(key) => {
              setActiveCategoryTab(key);
              setPage(1);
              setSelectedRowKeys([]);
            }}
            type="line"
            items={availableCategories.map((c) => {
              const count = getCategoryBadgeCount(c.key);
              return {
                key: c.key,
                label: (
                  <Space size={6} className="py-1">
                    <span>{c.label}</span>
                    <Badge
                      count={count}
                      overflowCount={9999}
                      className="site-badge-count-4"
                      style={{
                        backgroundColor:
                          activeCategoryTab === c.key ? "#0f766e" : "#f1f5f9",
                        color: activeCategoryTab === c.key ? "#ffffff" : "#64748b",
                        boxShadow: "none",
                        fontSize: 11,
                      }}
                    />
                  </Space>
                ),
              };
            })}
          />
        </Card>

        {/* ------------------------------------------------------------------ */}
        {/* Batch Action Toolbar (When rows are selected)                      */}
        {/* ------------------------------------------------------------------ */}
        {selectedRowKeys.length > 0 && (
          <div className="flex flex-wrap items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 shadow-xs">
            <div className="flex items-center gap-3">
              <Badge count={selectedRowKeys.length} style={{ backgroundColor: "#0f766e" }} />
              <Typography.Text strong className="text-sm text-slate-800">
                {selectedRowKeys.length} sample{selectedRowKeys.length > 1 ? "s" : ""} selected
              </Typography.Text>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="small"
                icon={<SwapOutlined />}
                onClick={handleOpenMoveModal}
                className="border-blue-300 bg-white font-medium text-blue-700 hover:border-blue-500 hover:text-blue-600"
              >
                Move to Data Bank
              </Button>

              <div className="h-4 w-px bg-slate-200" />

              <span className="text-xs font-semibold text-teal-900">Tag as Category:</span>
              <Select
                size="small"
                value={batchTargetCategory}
                onChange={(val) => setBatchTargetCategory(val)}
                style={{ width: 150 }}
                options={availableCategories.map((c) => ({
                  value: c.key,
                  label: c.label,
                }))}
              />
              <Button
                size="small"
                type="primary"
                className="bg-teal-700 hover:bg-teal-800 text-white"
                onClick={() => handleBatchTagCategory(batchTargetCategory)}
              >
                Apply Category
              </Button>

              <div className="h-4 w-px bg-slate-200" />

              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={handleBatchDelete}
              >
                Delete Selected
              </Button>

              <Button
                size="small"
                type="text"
                onClick={() => setSelectedRowKeys([])}
                className="text-slate-600"
              >
                Deselect All
              </Button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Main Content: Table or Gallery View                                */}
        {/* ------------------------------------------------------------------ */}
        {viewMode === "table" ? (
          <Card
            variant="borderless"
            className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs"
            styles={{ body: { padding: 0 } }}
          >
            <Table<DatabankSample>
              rowKey="id"
              loading={samplesQuery.isLoading}
              dataSource={samplesQuery.data?.samples || []}
              columns={sampleColumns}
              scroll={{ x: 1200 }}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
            pagination={{
              current: page,
              pageSize,
              total: samplesQuery.data?.total ?? 0,
              showSizeChanger: true,
              pageSizeOptions: ["15", "25", "50", "100", "500", "1000", "10000"],
              onChange: (p, s) => {
                setPage(p);
                setPageSize(s);
              },
              showTotal: (total) => `Total ${total} samples`,
            }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <div className="py-6 text-center">
                      <p className="text-base font-medium text-slate-700">
                        No samples found in category &ldquo;{categoryDisplayLabel(activeCategoryTab)}&rdquo;
                      </p>
                      <p className="text-xs text-slate-400">
                        {hasActiveFilters
                          ? "Try clearing filters to see more results."
                          : "Upload new data or tag samples into this category."}
                      </p>
                      <Space className="mt-3">
                        {hasActiveFilters && (
                          <Button size="small" onClick={handleResetFilters}>
                            Clear Filters
                          </Button>
                        )}
                        <Button
                          size="small"
                          type="primary"
                          icon={<UploadOutlined />}
                          onClick={() => setUploadModalOpen(true)}
                        >
                          Upload Data
                        </Button>
                      </Space>
                    </div>
                  }
                />
              ),
            }}
          />
        </Card>
      ) : (
        /* Gallery View */
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {(samplesQuery.data?.samples || []).map((sample) => {
              const isSelected = selectedRowKeys.includes(sample.id);
              const catKey = sample.category || (sample.is_blurry ? "blurry" : "general");

              return (
                <Card
                  key={sample.id}
                  hoverable
                  className={`relative overflow-hidden rounded-xl border transition ${
                    isSelected
                      ? "border-teal-500 bg-teal-50/30 shadow-md ring-2 ring-teal-400/40"
                      : "border-slate-200 bg-white"
                  }`}
                  styles={{ body: { padding: "10px" } }}
                >
                  {/* Select Checkbox */}
                  <div className="absolute right-2 top-2 z-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRowKeys((prev) => [...prev, sample.id]);
                        } else {
                          setSelectedRowKeys((prev) => prev.filter((k) => k !== sample.id));
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>

                  {/* Image Thumbnail */}
                  <div className="mb-2 flex items-center justify-center">
                    <LabelSampleThumbnail
                      datasetId={datasetId!}
                      sampleId={sample.id}
                      filename={sample.filename}
                      className="h-32 w-full cursor-pointer rounded-lg object-contain"
                      onClick={() => setReviewSample(sample)}
                    />
                  </div>

                  {/* Sample Details */}
                  <div className="space-y-1">
                    <div className="truncate text-xs font-semibold text-slate-800" title={sample.filename}>
                      {sample.filename}
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">GT:</span>
                      <strong className="text-slate-700">
                        {sample.final_gt || sample.ground_truth || "—"}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Pred:</span>
                      <span className="font-mono text-blue-600">
                        {sample.upload_predicted || "—"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <Tag color={categoryTagColor(catKey)} className="m-0 text-[10px]">
                        {categoryDisplayLabel(catKey)}
                      </Tag>

                      {sample.review_status === "reviewed" ? (
                        <CheckCircleOutlined className="text-emerald-500" />
                      ) : (
                        <span className="text-[10px] text-slate-400">Unreviewed</span>
                      )}
                    </div>

                    <div className="pt-2">
                      <Button
                        size="small"
                        block
                        type="default"
                        icon={<EditOutlined />}
                        onClick={() => setReviewSample(sample)}
                        className="text-xs"
                      >
                        Review
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Gallery Pagination */}
          <div className="flex justify-end pt-2">
            <Pagination
              current={page}
              pageSize={pageSize}
              total={samplesQuery.data?.total ?? 0}
              showSizeChanger
              pageSizeOptions={["18", "36", "60", "100", "500", "1000", "10000"]}
              onChange={(p, s) => {
                setPage(p);
                setPageSize(s);
              }}
              showTotal={(total) => `Total ${total} samples`}
            />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modal: Create New Dataset                                          */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        title="Create New Dataset"
        open={createDatasetModalOpen}
        onCancel={() => setCreateDatasetModalOpen(false)}
        footer={null}
        destroyOnClose
        centered
      >
        <Form
          layout="vertical"
          onFinish={(values) => createDatasetMutation.mutate(values)}
          initialValues={{ version: "v1" }}
        >
          <Form.Item
            name="name"
            label="Dataset Name"
            rules={[{ required: true, message: "Please provide a dataset name" }]}
          >
            <Input placeholder="e.g. Odometer-Night-Batch, Field-Labels-v2" />
          </Form.Item>

          <Form.Item name="description" label="Description (optional)">
            <Input.TextArea rows={3} placeholder="Brief description of this dataset" />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setCreateDatasetModalOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createDatasetMutation.isPending}
            >
              Create Dataset
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Modal: Upload Data into Selected Dataset                           */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        title={`Upload Data to "${dataset?.name || "Selected Dataset"}"`}
        open={uploadModalOpen}
        onCancel={() => setUploadModalOpen(false)}
        footer={null}
        destroyOnClose
        centered
      >
        <div className="space-y-4">
          <Alert
            type="info"
            showIcon
            message="Upload Archive"
            description="Select a ZIP archive containing images with filename ground truth or images to ingest into this dataset. Processing will run automatically."
          />

          <Upload.Dragger
            name="file"
            multiple={false}
            accept=".zip"
            beforeUpload={(file) => {
              uploadMutation.mutate({
                ocr_type: activeTaskKey,
                file,
                dataset_id: datasetId,
              });
              return false;
            }}
            showUploadList={false}
            className="p-6"
          >
            <p className="ant-upload-drag-icon text-center text-3xl text-blue-500">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text text-center font-medium text-slate-700">
              Click or drag ZIP file here to upload
            </p>
            <p className="ant-upload-hint text-center text-xs text-slate-400">
              ZIP archives with image files (.png, .jpg, .jpeg)
            </p>
          </Upload.Dragger>

          {uploadMutation.isPending && (
            <div className="space-y-2 text-center">
              <Spin />
              <div className="text-xs text-slate-500">
                Uploading and extracting data into dataset…
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Modal: Add Category to Dataset                                     */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        title={`Add Category to "${dataset?.name || "Dataset"}"`}
        open={addCategoryModalOpen}
        onCancel={() => setAddCategoryModalOpen(false)}
        footer={null}
        destroyOnClose
        centered
      >
        <div className="space-y-4">
          <Typography.Paragraph className="text-xs text-slate-500">
            Create a custom category for this dataset (e.g., &ldquo;night&rdquo;, &ldquo;glare&rdquo;, &ldquo;partial&rdquo;, &ldquo;low-light&rdquo;). Samples can then be tagged into this category.
          </Typography.Paragraph>

          <Form
            layout="vertical"
            onFinish={() => {
              const name = newCategoryName.trim().toLowerCase();
              if (name) addCategoryMutation.mutate(name);
            }}
          >
            <Form.Item
              label="Category Name"
              required
              rules={[{ required: true, message: "Please enter a category name" }]}
            >
              <Input
                placeholder="e.g. night, glare, high-contrast"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </Form.Item>

            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => setAddCategoryModalOpen(false)}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={addCategoryMutation.isPending}
                disabled={!newCategoryName.trim()}
              >
                Add Category
              </Button>
            </div>
          </Form>
        </div>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Modal: Move Selected Entries to Different Data Bank / Category     */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        title={`Move ${selectedRowKeys.length} Selected Entr${selectedRowKeys.length === 1 ? "y" : "ies"} to Data Bank`}
        open={moveModalOpen}
        onCancel={() => setMoveModalOpen(false)}
        onOk={() => {
          if (!moveTargetDatasetId) {
            appMessage.warning("Please select a target data bank");
            return;
          }
          batchMoveMutation.mutate({
            target_dataset_id: moveTargetDatasetId,
            target_category: moveTargetCategory,
          });
        }}
        confirmLoading={batchMoveMutation.isPending}
        okText="Move Entries"
        okButtonProps={{ className: "bg-teal-700 hover:bg-teal-800 text-white" }}
        destroyOnClose
        centered
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-slate-500">
            Transfer selected entries into another data bank and assign them to an available category.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="target-databank-select" className="text-xs font-semibold text-slate-700">
              Target Data Bank:
            </label>
            <Select
              id="target-databank-select"
              value={moveTargetDatasetId}
              onChange={(val) => setMoveTargetDatasetId(val)}
              options={datasetOptions}
              className="w-full"
              placeholder="Select target data bank"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="target-category-select" className="text-xs font-semibold text-slate-700">
              Available Category in Data Bank:
            </label>
            <Select
              id="target-category-select"
              value={moveTargetCategory}
              onChange={(val) => setMoveTargetCategory(val)}
              options={targetAvailableCategories}
              className="w-full"
              placeholder="Select available category"
            />
          </div>
        </div>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Modal: Interactive Sample Review & Category Tagging                */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        title={
          <div className="flex items-center justify-between pr-8">
            <span className="font-semibold text-slate-800">
              Review: {reviewSample?.filename}
            </span>
            <Space size={4}>
              <Button
                size="small"
                icon={<LeftOutlined />}
                onClick={handlePrevSample}
                title="Previous sample"
              />
              <Button
                size="small"
                icon={<RightOutlined />}
                onClick={handleNextSample}
                title="Next sample"
              />
            </Space>
          </div>
        }
        open={Boolean(reviewSample)}
        onCancel={() => setReviewSample(null)}
        width={950}
        footer={null}
        destroyOnClose
        centered
      >
        {reviewSample && (
          <div className="space-y-4 pt-2">
            {/* Viewer + Controls Row */}
            <Row gutter={[16, 16]}>
              <Col xs={24} md={14}>
                <div className="flex flex-col gap-2">
                  {/* High Quality Image Viewer */}
                  <div className="relative flex min-h-[300px] max-h-[460px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                    {previewUrl ? (
                      <OcrImageViewer
                        src={previewUrl}
                        brightness={imgBrightness}
                        contrast={imgContrast}
                        zoom={imgZoom}
                        sharpen={imgSharpen}
                        invert={imgInvert}
                        grayscale={imgGrayscale}
                        saturate={imgSaturate}
                        blur={imgBlur}
                        selected={selectedBox}
                        className="max-h-[440px] w-full object-contain"
                      />
                    ) : (
                      <Spin />
                    )}

                    {/* Floating zoom controls */}
                    {previewUrl && (
                      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-slate-900/70 px-1.5 py-1 backdrop-blur-sm">
                        <Tooltip title="Zoom out">
                          <Button
                            size="small"
                            type="text"
                            icon={<ZoomOutOutlined />}
                            disabled={imgZoom <= ZOOM_MIN}
                            onClick={handleZoomOut}
                            className="text-white hover:!text-blue-300"
                          />
                        </Tooltip>
                        <Tooltip title="Reset zoom">
                          <button
                            type="button"
                            onClick={handleZoomReset}
                            className="min-w-[44px] cursor-pointer select-none rounded px-1 text-center text-xs font-medium text-white tabular-nums hover:text-blue-300"
                          >
                            {Math.round(imgZoom * 100)}%
                          </button>
                        </Tooltip>
                        <Tooltip title="Zoom in">
                          <Button
                            size="small"
                            type="text"
                            icon={<ZoomInOutlined />}
                            disabled={imgZoom >= ZOOM_MAX}
                            onClick={handleZoomIn}
                            className="text-white hover:!text-blue-300"
                          />
                        </Tooltip>
                      </div>
                    )}
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <Space size={4} wrap>
                      {ENHANCE_PRESETS.map((p) => (
                        <Button
                          key={p.key}
                          size="small"
                          onClick={() => {
                            const next = enhanceFromPreset(p.key);
                            setImgBrightness(next.brightness);
                            setImgContrast(next.contrast);
                            setImgZoom(next.zoom);
                            setImgSharpen(next.sharpen);
                            setImgInvert(next.invert);
                            setImgGrayscale(next.grayscale);
                            setImgSaturate(next.saturate);
                            setImgBlur(next.blur);
                          }}
                          className="text-xs"
                        >
                          {p.label}
                        </Button>
                      ))}
                    </Space>

                    <Button
                      size="small"
                      type="text"
                      onClick={() => {
                        setImgBrightness(DEFAULT_ENHANCE.brightness);
                        setImgContrast(DEFAULT_ENHANCE.contrast);
                        setImgZoom(DEFAULT_ENHANCE.zoom);
                        setImgSharpen(DEFAULT_ENHANCE.sharpen);
                        setImgInvert(DEFAULT_ENHANCE.invert);
                        setImgGrayscale(DEFAULT_ENHANCE.grayscale);
                        setImgSaturate(DEFAULT_ENHANCE.saturate);
                        setImgBlur(DEFAULT_ENHANCE.blur);
                      }}
                      className="text-xs text-slate-500"
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </Col>

              {/* Right Inspection & Tagging Form */}
              <Col xs={24} md={10}>
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  {/* Current Metadata Inspection */}
                  <div className="space-y-1.5 border-b border-slate-200 pb-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Filename GT:</span>
                      <strong className="text-slate-800">
                        {reviewSample.ground_truth || reviewSample.ground_truth_normalized || "None"}
                      </strong>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500">Predicted:</span>
                      <span className="font-mono text-blue-600">
                        {reviewSample.upload_predicted || "—"}
                      </span>
                    </div>

                    {reviewSample.upload_confidence != null && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Confidence:</span>
                        <span>{(Number(reviewSample.upload_confidence) * 100).toFixed(1)}%</span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-slate-500">Match Status:</span>
                      <span>
                        {reviewSample.upload_match == null ? (
                          "—"
                        ) : reviewSample.upload_match ? (
                          <Tag color="success">Match</Tag>
                        ) : (
                          <Tag color="error">Mismatch</Tag>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Review Form */}
                  <Form form={reviewForm} layout="vertical" onFinish={handleSaveReview}>
                    <Form.Item
                      name="corrected_gt"
                      label={
                        <div className="flex items-center justify-between w-full">
                          <span className="font-semibold text-slate-700">Final Ground Truth</span>
                          {reviewSample.upload_predicted && (
                            <Button
                              type="link"
                              size="small"
                              className="p-0 text-xs text-blue-600"
                              onClick={() => {
                                reviewForm.setFieldValue(
                                  "corrected_gt",
                                  reviewSample.upload_predicted,
                                );
                              }}
                            >
                              Accept Pred
                            </Button>
                          )}
                        </div>
                      }
                      rules={[{ required: true, message: "Please provide ground truth" }]}
                    >
                      <Input
                        placeholder="Enter verified ground truth"
                        className="font-mono font-bold text-slate-800"
                        onPressEnter={handleSaveReview}
                        autoFocus
                      />
                    </Form.Item>

                    {/* Category Selection in Review Modal */}
                    <Form.Item
                      name="target_category"
                      label={<span className="font-semibold text-slate-700">Category</span>}
                    >
                      <Select
                        options={availableCategories.map((c) => ({
                          value: c.key,
                          label: (
                            <Space size={6}>
                              <Tag color={categoryTagColor(c.key)}>{c.label}</Tag>
                            </Space>
                          ),
                        }))}
                      />
                    </Form.Item>

                    <Form.Item
                      name="review_notes"
                      label={<span className="text-xs text-slate-500">Review Notes (optional)</span>}
                    >
                      <Input.TextArea rows={2} placeholder="Optional annotations or notes" />
                    </Form.Item>

                    <div className="flex justify-between pt-2">
                      <Button
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => {
                          modal.confirm({
                            title: `Delete ${reviewSample.filename}?`,
                            okText: "Delete",
                            okType: "danger",
                            onOk: async () => {
                              await deleteSampleMutation.mutateAsync(reviewSample.id);
                              setReviewSample(null);
                            },
                          });
                        }}
                      >
                        Delete
                      </Button>

                      <Space size={6}>
                        <Button onClick={() => setReviewSample(null)}>Cancel</Button>
                        <Button type="primary" htmlType="submit">
                          Save & Next
                        </Button>
                      </Space>
                    </div>
                  </Form>
                </div>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
      </div>
    </div>
  );
}
