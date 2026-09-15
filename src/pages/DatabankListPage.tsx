import {
  CheckOutlined,
  DeleteOutlined,
  DownloadOutlined,
  InboxOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  App,
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Space,
  Slider,
  Switch,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadFile } from "antd/es/upload/interface";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { getApiErrorMessage } from "@/api/client";
import {
  deleteDatabankSample,
  downloadDatabankCsv,
  fetchDatabankSampleImageUrl,
  getDatabank,
  listDatabankSamples,
  addDatabankCategory,
  clearDatabankSampleBbox,
  moveDatabankSampleToReviewed,
  reanalyzeDatabankUnreviewed,
  rerunDatabankReviewed,
  reviewDatabankSample,
  setDatabankSampleCategory,
  syncDatabankReviewedEval,
  uploadRawToDatabank,
  uploadToDatabank,
} from "@/api/databank";
import { DataTableToolbar } from "@/components/common/DataTableToolbar";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchInput } from "@/components/common/SearchInput";
import {
  DEFAULT_ENHANCE,
  enhanceFromPreset,
  OcrImageViewer,
  type ImageEnhancePreset,
} from "@/components/ocr/OcrImageViewer";
import { RecognitionBuildModal } from "@/components/training/RecognitionBuildModal";
import { useTaskContext } from "@/features/tasks/TaskContext";
import { useDebounce } from "@/hooks/useDebounce";
import type {
  DatabankDataset,
  DatabankMetrics,
  DatabankSample,
} from "@/types/databank";
import type { OcrBoundingBox } from "@/types/ocr";

type FilenameGtFilter = "all" | "yes" | "no";
type PredictedFilter = "all" | "has" | "missing" | "error";
type MatchFilter = "all" | "yes" | "no" | "none";
type FinalGtFilter = "all" | "yes" | "no";
type RerunFilter = "all" | "has" | "missing" | "ok" | "miss";
type WithinReviewStatusFilter = "all" | "reviewed" | "unreviewed";

const ENHANCE_PRESETS: { key: ImageEnhancePreset; label: string }[] = [
  { key: "identity", label: "Identity" },
  { key: "invert", label: "Invert" },
  { key: "grayscale", label: "Grayscale" },
  { key: "clarity", label: "Clarity" },
  { key: "contrast_stretch", label: "Contrast stretch" },
  { key: "denoise", label: "Denoise" },
];

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
}

function tabCategoryScope(tabKey: string): string {
  if (tabKey === "general" || tabKey === "raw") return "";
  return tabKey;
}

function tabDisplayName(tabKey: string): string {
  if (tabKey === "general") return "General";
  if (tabKey === "raw") return "Raw Data";
  if (tabKey === "blurry") return "Blurry";
  if (tabKey === "dead") return "Dead";
  return tabKey;
}

function isRawSample(sample: DatabankSample | null | undefined): boolean {
  if (!sample) return false;
  if (sample.category === "raw") return true;
  return Boolean(sample.metadata && sample.metadata.raw_pending === true);
}

function isKnownReviewTab(tabKey: string, customCategories: string[]): boolean {
  return (
    tabKey === "general" ||
    tabKey === "raw" ||
    tabKey === "blurry" ||
    tabKey === "dead" ||
    customCategories.includes(tabKey)
  );
}

function sampleCategoryLabel(category: string): string {
  if (!category) return "General";
  return tabDisplayName(category);
}

function pickTabMetrics(
  dataset: DatabankDataset | undefined,
  tabKey: string,
): DatabankMetrics | null | undefined {
  const fromTab = dataset?.tab_metrics?.[tabKey]?.latest;
  if (fromTab && Number(fromTab.comparable_samples ?? 0) > 0) {
    return fromTab;
  }
  const upload = dataset?.upload_metrics;
  const rerun = dataset?.rerun_metrics;
  if (!upload && !rerun) return fromTab ?? null;
  const uploadAt = upload?.computed_at ?? dataset?.last_predict_at ?? "";
  const rerunAt = rerun?.computed_at ?? dataset?.last_rerun_at ?? "";
  if (rerunAt && (!uploadAt || rerunAt >= uploadAt)) {
    return rerun ?? fromTab ?? null;
  }
  return upload ?? fromTab ?? null;
}

function MetricsStrip({
  title,
  metrics,
  emptyHint,
}: {
  title: string;
  metrics?: DatabankMetrics | null;
  emptyHint: string;
}) {
  const comparable = Number(metrics?.comparable_samples ?? 0);
  if (!metrics || comparable === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <Typography.Text strong>{title}</Typography.Text>
        <div className="mt-1 text-sm text-slate-500">{emptyHint}</div>
      </div>
    );
  }
  const accuracy =
    metrics.exact_match_accuracy == null ||
    Number.isNaN(Number(metrics.exact_match_accuracy))
      ? null
      : Number(metrics.exact_match_accuracy) * 100;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <Typography.Text strong>{title}</Typography.Text>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Statistic
          title="Accuracy"
          value={accuracy ?? "—"}
          precision={accuracy == null ? undefined : 1}
          suffix={accuracy == null ? undefined : "%"}
        />
        <Statistic title="Matches" value={Number(metrics.exact_matches) || 0} />
        <Statistic title="Mismatches" value={Number(metrics.mismatches) || 0} />
        <Statistic title="Compared" value={comparable} />
      </div>
    </div>
  );
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

export function DatabankListPage() {
  const { activeTaskKey } = useTaskContext();
  const { modal, message: appMessage } = App.useApp();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [rawUploadOpen, setRawUploadOpen] = useState(false);
  const [reviewTab, setReviewTab] = useState<string>(() =>
    tabFromUrl === "raw" ? "raw" : "general",
  );
  const [moveTargetCategory, setMoveTargetCategory] = useState<string>("");
  const [withinReviewStatus, setWithinReviewStatus] =
    useState<WithinReviewStatusFilter>("all");
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [recognitionBuildOpen, setRecognitionBuildOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncChunkCount, setSyncChunkCount] = useState(1);
  const [sampleSearch, setSampleSearch] = useState("");
  const [samplePage, setSamplePage] = useState(1);
  const [samplePageSize, setSamplePageSize] = useState(20);
  const [filenameGtFilter, setFilenameGtFilter] =
    useState<FilenameGtFilter>("all");
  const [predictedFilter, setPredictedFilter] =
    useState<PredictedFilter>("all");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [finalGtFilter, setFinalGtFilter] = useState<FinalGtFilter>("all");
  const [rerunFilter, setRerunFilter] = useState<RerunFilter>("all");
  const debouncedSampleSearch = useDebounce(sampleSearch, 300);
  const [reviewSample, setReviewSample] = useState<DatabankSample | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imgBrightness, setImgBrightness] = useState(
    DEFAULT_ENHANCE.brightness,
  );
  const [imgContrast, setImgContrast] = useState(DEFAULT_ENHANCE.contrast);
  const [imgZoom, setImgZoom] = useState(DEFAULT_ENHANCE.zoom);
  const [imgSharpen, setImgSharpen] = useState(DEFAULT_ENHANCE.sharpen);
  const [imgInvert, setImgInvert] = useState(DEFAULT_ENHANCE.invert);
  const [imgGrayscale, setImgGrayscale] = useState(DEFAULT_ENHANCE.grayscale);
  const [imgSaturate, setImgSaturate] = useState(DEFAULT_ENHANCE.saturate);
  const [imgBlur, setImgBlur] = useState(DEFAULT_ENHANCE.blur);
  const [hideBbox, setHideBbox] = useState(false);
  const [reviewForm] = Form.useForm<{
    corrected_gt: string;
    review_notes?: string;
  }>();
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);

  const bankQuery = useQuery({
    queryKey: ["databank", "bank", activeTaskKey],
    queryFn: () => getDatabank(activeTaskKey),
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

  const dataset = bankQuery.data;
  const datasetId = dataset?.id;
  const uploadProgress = dataset?.upload_progress;
  const jobRunning = uploadProgress?.status === "running";
  const customCategories = useMemo(
    () => asStringList(dataset?.custom_categories),
    [dataset?.custom_categories],
  );

  useEffect(() => {
    if (uploadProgress?.status === "completed" && uploadProgress.message) {
      setShowUploadSuccess(true);
      const timer = window.setTimeout(() => setShowUploadSuccess(false), 4500);
      return () => window.clearTimeout(timer);
    }
    setShowUploadSuccess(false);
  }, [uploadProgress?.status, uploadProgress?.message]);

  useEffect(() => {
    const known = new Set([
      "general",
      "raw",
      "blurry",
      "dead",
      ...customCategories,
    ]);
    if (
      reviewTab === "unreviewed" ||
      reviewTab === "reviewed" ||
      !known.has(reviewTab)
    ) {
      setReviewTab("general");
      setSamplePage(1);
    }
  }, [customCategories, reviewTab]);

  useEffect(() => {
    if (tabFromUrl === "raw" && reviewTab !== "raw") {
      setReviewTab("raw");
      setSamplePage(1);
      return;
    }
    if (
      tabFromUrl &&
      tabFromUrl !== "raw" &&
      isKnownReviewTab(tabFromUrl, customCategories) &&
      reviewTab !== tabFromUrl
    ) {
      setReviewTab(tabFromUrl);
      setSamplePage(1);
    }
  }, [tabFromUrl, customCategories, reviewTab]);

  const syncTabToUrl = (key: string) => {
    setReviewTab(key);
    setSamplePage(1);
    const next = new URLSearchParams(searchParams);
    if (key === "raw") {
      next.set("tab", "raw");
    } else {
      next.delete("tab");
    }
    setSearchParams(next, { replace: true });
  };

  const samplesQuery = useQuery({
    queryKey: [
      "databank",
      "samples",
      datasetId,
      reviewTab,
      withinReviewStatus,
      debouncedSampleSearch,
      filenameGtFilter,
      predictedFilter,
      matchFilter,
      finalGtFilter,
      rerunFilter,
      samplePage,
      samplePageSize,
    ],
    queryFn: () =>
      listDatabankSamples(datasetId!, {
        review_status: reviewTab,
        within_review_status:
          withinReviewStatus === "all" ? undefined : withinReviewStatus,
        search: debouncedSampleSearch || undefined,
        has_filename_gt:
          filenameGtFilter === "all" ? undefined : filenameGtFilter === "yes",
        has_prediction: predictedFilter === "all" ? undefined : predictedFilter,
        upload_match: matchFilter === "all" ? undefined : matchFilter,
        has_final_gt:
          finalGtFilter === "all" ? undefined : finalGtFilter === "yes",
        has_rerun: rerunFilter === "all" ? undefined : rerunFilter,
        limit: samplePageSize,
        offset: (samplePage - 1) * samplePageSize,
      }),
    enabled: !!datasetId,
    refetchInterval:
      jobRunning ||
      ["predicting", "processing", "rerunning"].includes(dataset?.status ?? "")
        ? 2000
        : false,
  });

  useEffect(() => {
    let revoked: string | null = null;
    if (!datasetId || !reviewSample) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    void fetchDatabankSampleImageUrl(datasetId, reviewSample.id).then((url) => {
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
  }, [datasetId, reviewSample]);

  const applyEnhancePreset = (preset: ImageEnhancePreset) => {
    const s = enhanceFromPreset(preset);
    setImgBrightness(s.brightness);
    setImgContrast(s.contrast);
    setImgZoom(s.zoom);
    setImgSharpen(s.sharpen);
    setImgInvert(s.invert);
    setImgGrayscale(s.grayscale);
    setImgSaturate(s.saturate);
    setImgBlur(s.blur);
  };

  useEffect(() => {
    if (!reviewSample) return;
    setImgBrightness(DEFAULT_ENHANCE.brightness);
    setImgContrast(DEFAULT_ENHANCE.contrast);
    setImgZoom(DEFAULT_ENHANCE.zoom);
    setImgSharpen(DEFAULT_ENHANCE.sharpen);
    setImgInvert(DEFAULT_ENHANCE.invert);
    setImgGrayscale(DEFAULT_ENHANCE.grayscale);
    setImgSaturate(DEFAULT_ENHANCE.saturate);
    setImgBlur(DEFAULT_ENHANCE.blur);
    setHideBbox(Boolean(reviewSample.bbox_cleared));
    setMoveTargetCategory("");
    reviewForm.setFieldsValue({
      corrected_gt:
        reviewSample.corrected_gt ||
        reviewSample.ground_truth_normalized ||
        reviewSample.upload_predicted ||
        "",
      review_notes: reviewSample.review_notes || "",
    });
  }, [reviewSample, reviewForm]);

  const tabScopeCategory = tabCategoryScope(reviewTab);

  const tabUnreviewedCount =
    reviewTab === "general"
      ? (dataset?.unreviewed_count ?? 0)
      : reviewTab === "raw"
        ? Math.max(
            0,
            (dataset?.raw_pending_count ??
              dataset?.category_counts?.raw?.total ??
              0) - (dataset?.category_counts?.raw?.reviewed ?? 0),
          )
        : Math.max(
            0,
            (dataset?.category_counts?.[reviewTab]?.total ?? 0) -
              (dataset?.category_counts?.[reviewTab]?.reviewed ?? 0),
          );

  const tabReviewedCount =
    reviewTab === "general"
      ? (dataset?.reviewed_count ?? 0)
      : reviewTab === "raw"
        ? (dataset?.category_counts?.raw?.reviewed ?? 0)
        : (dataset?.category_counts?.[reviewTab]?.reviewed ?? 0);

  const currentTabMetrics = pickTabMetrics(dataset, reviewTab);

  const uploadMutation = useMutation({
    mutationFn: (payload: { ocr_type: string; file: File }) =>
      uploadToDatabank(payload.ocr_type, payload.file),
    onSuccess: (ds) => {
      message.success(
        ds.message ?? "Upload accepted — processing in background",
      );
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
      setUploadOpen(false);
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  });

  const rawUploadMutation = useMutation({
    mutationFn: (payload: { ocr_type: string; file: File }) =>
      uploadRawToDatabank(payload.ocr_type, payload.file),
    onSuccess: (ds) => {
      message.success(
        ds.message ?? "Raw upload accepted — predicting in background",
      );
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
      setRawUploadOpen(false);
      syncTabToUrl("raw");
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  });

  const reviewMutation = useMutation({
    mutationFn: (body: {
      corrected_gt?: string;
      accept_prediction?: boolean;
      review_notes?: string;
      clear_bbox?: boolean;
      target_category?: string | null;
    }) => reviewDatabankSample(datasetId!, reviewSample!.id, body),
    onSuccess: (sample) => {
      const match = sample.match_after_save ?? sample.upload_match;
      const matchLabel =
        match == null
          ? ""
          : match
            ? " — prediction matched GT"
            : " — prediction mismatched GT";
      if (sample.promoted) {
        message.success(`Saved GT and moved to Dataset list${matchLabel}`);
      } else if (isRawSample(sample)) {
        message.success(`Ground truth saved (still in Raw Data)${matchLabel}`);
      } else {
        const wasReviewed = reviewSample?.review_status === "reviewed";
        message.success(
          wasReviewed
            ? `Ground truth updated${matchLabel}`
            : `Ground truth saved${matchLabel}`,
        );
      }
      setReviewSample(null);
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
      window.setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: ["evaluation", "datasets"],
        });
      }, 1500);
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  });

  const clearBboxMutation = useMutation({
    mutationFn: () => clearDatabankSampleBbox(datasetId!, reviewSample!.id),
    onSuccess: (sample) => {
      message.success("Bounding box cleared");
      setHideBbox(true);
      setReviewSample(sample);
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  });

  const rerunMutation = useMutation({
    mutationFn: () =>
      rerunDatabankReviewed(datasetId!, { category: tabScopeCategory }),
    onSuccess: () => {
      message.success(
        tabScopeCategory
          ? `Re-running default model on reviewed ${tabDisplayName(reviewTab)} samples`
          : "Re-running default model on reviewed samples",
      );
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  });

  const syncReviewedMutation = useMutation({
    mutationFn: (chunkCount: number) => {
      if (tabScopeCategory) {
        return syncDatabankReviewedEval(datasetId!, {
          category: tabScopeCategory,
        });
      }
      return syncDatabankReviewedEval(datasetId!, {
        reviewed_chunk_count: chunkCount,
      });
    },
    onSuccess: (ds) => {
      const parts: string[] = [];
      for (const [key, v] of Object.entries(ds ?? {})) {
        if (!v || typeof v !== "object") continue;
        if (
          "chunks" in v &&
          Array.isArray((v as { chunks?: unknown }).chunks)
        ) {
          const chunked = v as {
            chunk_count?: number;
            chunks: Array<{
              name?: string;
              version?: string;
              sample_count?: number;
            }>;
          };
          const chunkParts = chunked.chunks.map(
            (c) =>
              `${c.name ?? key}@${c.version ?? "1.0.0"} (${c.sample_count ?? 0})`,
          );
          parts.push(
            `${key}: ${chunked.chunk_count ?? chunkParts.length} chunks → ${chunkParts.join(", ")}`,
          );
          continue;
        }
        const info = v as {
          sample_count?: number;
          name?: string;
          version?: string;
        };
        if (info.sample_count == null && !info.name) continue;
        parts.push(
          `${key}: ${info.sample_count ?? 0} → ${info.name ?? key}@${info.version ?? "1.0.0"}`,
        );
      }
      message.success(
        parts.length
          ? `Synced mirrors — ${parts.join("; ")}`
          : "Synced mirrors",
      );
      setSyncOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
      void queryClient.invalidateQueries({
        queryKey: ["evaluation", "datasets"],
      });
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  });

  const categoryMutation = useMutation({
    mutationFn: (payload: { sampleId: string; category: string }) =>
      setDatabankSampleCategory(datasetId!, payload.sampleId, payload.category),
    onSuccess: (sample, vars) => {
      message.success(`Moved to ${sampleCategoryLabel(vars.category)}`);
      if (reviewSample?.id === vars.sampleId) setReviewSample(sample);
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
      window.setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: ["evaluation", "datasets"],
        });
      }, 1500);
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  });

  const moveToReviewedMutation = useMutation({
    mutationFn: (sampleId: string) =>
      moveDatabankSampleToReviewed(datasetId!, sampleId),
    onSuccess: (sample) => {
      message.success("Moved to General (cleared category)");
      setReviewSample(sample);
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
      window.setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: ["evaluation", "datasets"],
        });
      }, 1500);
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  });

  const addCategoryMutation = useMutation({
    mutationFn: (name: string) => addDatabankCategory(datasetId!, name),
    onSuccess: (ds) => {
      message.success("Category added");
      setAddCategoryOpen(false);
      setNewCategoryName("");
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
      const customs = asStringList(ds.custom_categories);
      if (customs.length) setReviewTab(customs[customs.length - 1]!);
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  });

  const reanalyzeMutation = useMutation({
    mutationFn: () =>
      reanalyzeDatabankUnreviewed(datasetId!, { category: tabScopeCategory }),
    onSuccess: (ds) => {
      message.success(
        ds.message ??
          (tabScopeCategory
            ? `Re-analyzing unreviewed ${tabDisplayName(reviewTab)} samples`
            : "Re-analyzing unreviewed samples with default model"),
      );
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (payload: { datasetId: string; sampleId: string }) =>
      deleteDatabankSample(payload.datasetId, payload.sampleId),
    onSuccess: (res) => {
      appMessage.success(`Deleted ${res.filename}`);
      setReviewSample(null);
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
      window.setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: ["evaluation", "datasets"],
        });
      }, 1500);
    },
    onError: (error) => appMessage.error(getApiErrorMessage(error)),
  });

  const confirmDelete = (row: DatabankSample) => {
    if (!datasetId) {
      appMessage.error("Data bank is still loading");
      return;
    }
    const id = datasetId;
    modal.confirm({
      title: "Permanently delete image?",
      content: (
        <div className="text-sm text-slate-600">
          Deletes <strong>{row.filename}</strong> from the data bank and removes
          the file from disk. This cannot be undone.
        </div>
      ),
      okText: "Delete forever",
      okButtonProps: { danger: true },
      centered: true,
      zIndex: 1100,
      onOk: () =>
        deleteMutation.mutateAsync({ datasetId: id, sampleId: row.id }),
    });
  };

  const sampleColumns: ColumnsType<DatabankSample> = [
    { title: "File", dataIndex: "filename", ellipsis: true },
    {
      title: "Filename GR",
      dataIndex: "ground_truth_normalized",
      width: 120,
      render: (v, row) =>
        row.has_ground_truth ? (v ?? "—") : <Tag>no GT</Tag>,
    },
    {
      title: "Predicted",
      dataIndex: "upload_predicted",
      width: 120,
      render: (v) => v ?? "—",
    },
    {
      title: "Match",
      dataIndex: "upload_match",
      width: 80,
      render: (v: boolean | null) =>
        v == null ? (
          "—"
        ) : v ? (
          <Tag color="success">yes</Tag>
        ) : (
          <Tag color="error">no</Tag>
        ),
    },
    {
      title: "Final GT",
      dataIndex: "final_gt",
      width: 110,
      render: (v) => v ?? "—",
    },
    {
      title: "Re-run",
      dataIndex: "rerun_predicted",
      width: 110,
      render: (v, row) =>
        v == null ? (
          "—"
        ) : (
          <span>
            {v}{" "}
            {row.rerun_match == null ? null : row.rerun_match ? (
              <Tag color="success">ok</Tag>
            ) : (
              <Tag color="error">miss</Tag>
            )}
          </span>
        ),
    },
    {
      title: "Category",
      dataIndex: "category",
      width: 90,
      render: (v: string | undefined, row) =>
        isRawSample(row) ? (
          <Tag color="blue">raw</Tag>
        ) : v || row.is_blurry ? (
          <Tag color={v === "dead" ? "red" : "orange"}>{v || "blurry"}</Tag>
        ) : (
          "—"
        ),
    },
    {
      title: "",
      key: "actions",
      width: 100,
      render: (_, row) => (
        <Button size="small" onClick={() => setReviewSample(row)}>
          {row.review_status === "reviewed" ? "View" : "Review"}
        </Button>
      ),
    },
  ];

  const selectedBox =
    hideBbox || reviewSample?.bbox_cleared
      ? null
      : toViewerBox(reviewSample?.display_bbox);
  const busy =
    jobRunning ||
    ["predicting", "processing", "rerunning"].includes(dataset?.status ?? "");

  const reviewSampleCategory =
    reviewSample?.category || (reviewSample?.is_blurry ? "blurry" : "");

  const categorySelectOptions = useMemo(
    () => [
      { value: "", label: "General" },
      { value: "blurry", label: "Blurry" },
      { value: "dead", label: "Dead" },
      ...customCategories.map((c) => ({ value: c, label: c })),
    ],
    [customCategories],
  );

  const categoryMutationBusy =
    categoryMutation.isPending || moveToReviewedMutation.isPending;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden ">
      <PageHeader
        title={"Model ref in use: " + dataset?.model_ref}
        actions={
          <Space wrap>
            <Button
              type="primary"
              onClick={() =>
                reviewTab === "raw"
                  ? setRawUploadOpen(true)
                  : setUploadOpen(true)
              }
              disabled={busy}
            >
              {reviewTab === "raw" ? "Upload raw data" : "Upload to data bank"}
            </Button>
            {reviewTab !== "raw" ? (
              <Button
                onClick={() => setRawUploadOpen(true)}
                disabled={busy || !datasetId}
              >
                Upload raw data
              </Button>
            ) : null}
            <Button
              disabled={!datasetId}
              onClick={() => setAddCategoryOpen(true)}
            >
              Add category
            </Button>
            <Button
              icon={<DownloadOutlined />}
              disabled={!datasetId}
              onClick={async () => {
                try {
                  const { blob, filename } = await downloadDatabankCsv(
                    datasetId!,
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = filename;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (error) {
                  message.error(getApiErrorMessage(error));
                }
              }}
            >
              Download CSV
            </Button>
            <Button
              icon={<ReloadOutlined />}
              loading={syncReviewedMutation.isPending}
              disabled={!datasetId || reviewTab === "raw"}
              onClick={() => {
                setSyncChunkCount(
                  Math.max(1, dataset?.reviewed_eval_chunk_count ?? 1),
                );
                setSyncOpen(true);
              }}
            >
              {tabScopeCategory
                ? `Sync ${tabDisplayName(reviewTab)} to Dataset tab`
                : "Sync to Dataset tab"}
            </Button>
            {reviewTab !== "raw" && tabUnreviewedCount > 0 ? (
              <Button
                icon={<ReloadOutlined />}
                loading={
                  reanalyzeMutation.isPending ||
                  dataset?.status === "predicting"
                }
                disabled={busy}
                onClick={() => reanalyzeMutation.mutate()}
              >
                Re-analyze
              </Button>
            ) : null}
            {reviewTab !== "raw" && tabReviewedCount > 0 ? (
              <Button
                icon={<ReloadOutlined />}
                loading={
                  rerunMutation.isPending || dataset?.status === "rerunning"
                }
                disabled={busy}
                onClick={() => rerunMutation.mutate()}
              >
                Re-run
              </Button>
            ) : null}
            <Button
              disabled={!datasetId || busy}
              onClick={() => setRecognitionBuildOpen(true)}
            >
              Build recognition pack
            </Button>
          </Space>
        }
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-6 pb-6 pt-4">
        {dataset?.error_message ? (
          <Alert type="error" showIcon message={dataset.error_message} />
        ) : null}

        {bankQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Failed to load data bank"
            description={getApiErrorMessage(bankQuery.error)}
            action={
              <Button size="small" onClick={() => void bankQuery.refetch()}>
                Retry
              </Button>
            }
          />
        ) : null}

        {showUploadSuccess && uploadProgress?.message ? (
          <Alert
            type="success"
            showIcon
            closable
            message={uploadProgress.message}
            onClose={() => setShowUploadSuccess(false)}
          />
        ) : null}

        {uploadProgress?.status === "failed" ? (
          <Alert
            type="error"
            showIcon
            message={uploadProgress.message ?? "Upload failed"}
            description={uploadProgress.error ?? undefined}
          />
        ) : null}

        {jobRunning ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <Typography.Text strong>
                {uploadProgress.message ?? "Processing upload…"}
              </Typography.Text>
              <Typography.Text type="secondary" className="text-sm">
                {uploadProgress.phase === "predicting" &&
                uploadProgress.total_samples > 0
                  ? `${uploadProgress.processed_samples}/${uploadProgress.total_samples} images`
                  : uploadProgress.phase}
              </Typography.Text>
            </div>
            <Progress
              percent={Math.round(uploadProgress.progress_pct ?? 0)}
              status="active"
              strokeColor="#0f766e"
            />
          </div>
        ) : null}

        {/* <div className="flex flex-wrap items-center gap-3">
          <Tag>{dataset?.status ?? "loading"}</Tag>
          <Typography.Text type="secondary">
            {dataset?.sample_count ?? 0} total · {dataset?.reviewed_count ?? 0}{" "}
            reviewed · {dataset?.unreviewed_count ?? 0} unreviewed ·{" "}
            {dataset?.blurry_count ?? 0} blurry
          </Typography.Text>
          <Typography.Text type="secondary">
            Model ref in use:{" "}
            <Tag color="teal">
              {dataset?.model_ref ?? "default (resolving…)"}
            </Tag>
          </Typography.Text>
        </div> */}

        <MetricsStrip
          title={`Latest accuracy — ${tabDisplayName(reviewTab)}`}
          metrics={currentTabMetrics}
          emptyHint={
            reviewTab === "raw"
              ? "Upload raw images, save ground truth, then accuracy (predicted vs GT) appears here."
              : "Review samples or run re-analyze / re-run to compute accuracy for this tab."
          }
        />

        <DataTableToolbar
          left={
            <Space wrap size={[8, 8]}>
              <SearchInput
                value={sampleSearch}
                onChange={(v) => {
                  setSampleSearch(v);
                  setSamplePage(1);
                }}
                placeholder="Filter file / GT / prediction…"
              />
              <Select
                value={withinReviewStatus}
                onChange={(v: WithinReviewStatusFilter) => {
                  setWithinReviewStatus(v);
                  setSamplePage(1);
                }}
                style={{ width: 160 }}
                options={[
                  { value: "all", label: "Review status: all" },
                  { value: "reviewed", label: "Review status: reviewed" },
                  { value: "unreviewed", label: "Review status: unreviewed" },
                ]}
              />
              <Select
                value={filenameGtFilter}
                onChange={(v: FilenameGtFilter) => {
                  setFilenameGtFilter(v);
                  setSamplePage(1);
                }}
                style={{ width: 150 }}
                options={[
                  { value: "all", label: "Filename GT: all" },
                  { value: "yes", label: "Filename GT: yes" },
                  { value: "no", label: "Filename GT: no" },
                ]}
              />
              <Select
                value={predictedFilter}
                onChange={(v: PredictedFilter) => {
                  setPredictedFilter(v);
                  setSamplePage(1);
                }}
                style={{ width: 160 }}
                options={[
                  { value: "all", label: "Predicted: all" },
                  { value: "has", label: "Predicted: has" },
                  { value: "missing", label: "Predicted: missing" },
                  { value: "error", label: "Predicted: error" },
                ]}
              />
              <Select
                value={matchFilter}
                onChange={(v: MatchFilter) => {
                  setMatchFilter(v);
                  setSamplePage(1);
                }}
                style={{ width: 130 }}
                options={[
                  { value: "all", label: "Match: all" },
                  { value: "yes", label: "Match: yes" },
                  { value: "no", label: "Match: no" },
                  { value: "none", label: "Match: —" },
                ]}
              />
              <Select
                value={finalGtFilter}
                onChange={(v: FinalGtFilter) => {
                  setFinalGtFilter(v);
                  setSamplePage(1);
                }}
                style={{ width: 140 }}
                options={[
                  { value: "all", label: "Final GT: all" },
                  { value: "yes", label: "Final GT: yes" },
                  { value: "no", label: "Final GT: no" },
                ]}
              />
              <Select
                value={rerunFilter}
                onChange={(v: RerunFilter) => {
                  setRerunFilter(v);
                  setSamplePage(1);
                }}
                style={{ width: 150 }}
                options={[
                  { value: "all", label: "Re-run: all" },
                  { value: "has", label: "Re-run: has" },
                  { value: "missing", label: "Re-run: missing" },
                  { value: "ok", label: "Re-run: ok" },
                  { value: "miss", label: "Re-run: miss" },
                ]}
              />
            </Space>
          }
        />

        <Tabs
          activeKey={reviewTab}
          onChange={(key) => {
            syncTabToUrl(key);
          }}
          items={[
            {
              key: "raw",
              label: `Raw Data (${dataset?.raw_pending_count ?? dataset?.category_counts?.raw?.total ?? 0})`,
            },
            {
              key: "general",
              label: `General (${dataset?.reviewed_count ?? 0}/${dataset?.unreviewed_count ?? 0})`,
            },
            {
              key: "blurry",
              label: `Blurry (${dataset?.category_counts?.blurry?.reviewed ?? 0}/${dataset?.category_counts?.blurry?.total ?? dataset?.blurry_count ?? 0})`,
            },
            {
              key: "dead",
              label: `Dead (${dataset?.category_counts?.dead?.reviewed ?? 0}/${dataset?.category_counts?.dead?.total ?? 0})`,
            },
            ...customCategories.map((c) => ({
              key: c,
              label: `${c} (${dataset?.category_counts?.[c]?.reviewed ?? 0}/${dataset?.category_counts?.[c]?.total ?? 0})`,
            })),
          ]}
        />

        <Table
          rowKey="id"
          loading={bankQuery.isLoading || samplesQuery.isLoading}
          columns={sampleColumns}
          dataSource={samplesQuery.data?.samples ?? []}
          pagination={{
            current: samplePage,
            pageSize: samplePageSize,
            total: samplesQuery.data?.total ?? 0,
            onChange: (p, ps) => {
              setSamplePage(p);
              setSamplePageSize(ps);
            },
          }}
        />
      </div>

      <UploadDatabankModal
        open={uploadOpen}
        ocrType={activeTaskKey}
        confirmLoading={uploadMutation.isPending}
        onClose={() => setUploadOpen(false)}
        onSubmit={(values) => uploadMutation.mutate(values)}
      />

      <UploadRawDatabankModal
        open={rawUploadOpen}
        ocrType={activeTaskKey}
        confirmLoading={rawUploadMutation.isPending}
        onClose={() => setRawUploadOpen(false)}
        onSubmit={(values) => rawUploadMutation.mutate(values)}
      />

      <Modal
        title={
          reviewSample ? `Review · ${reviewSample.filename}` : "Review sample"
        }
        open={!!reviewSample}
        onCancel={() => setReviewSample(null)}
        width="100%"
        style={{ top: 0, padding: 0, maxWidth: "100vw" }}
        classNames={{
          content: "!h-screen !max-h-screen flex flex-col !p-0",
          body: "flex-1 min-h-0 overflow-hidden !p-0",
        }}
        destroyOnHidden
        footer={null}
      >
        {reviewSample ? (
          <div className="flex h-full min-h-0">
            <div className="flex min-w-0 flex-1 flex-col bg-slate-100 p-4">
              {previewUrl ? (
                <OcrImageViewer
                  className="h-full"
                  src={previewUrl}
                  selected={selectedBox}
                  boxes={selectedBox ? [selectedBox] : []}
                  imageWidth={reviewSample.width}
                  imageHeight={reviewSample.height}
                  brightness={imgBrightness}
                  contrast={imgContrast}
                  zoom={imgZoom}
                  sharpen={imgSharpen}
                  invert={imgInvert}
                  grayscale={imgGrayscale}
                  saturate={imgSaturate}
                  blur={imgBlur}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-lg bg-slate-200 text-slate-500">
                  Loading image…
                </div>
              )}
            </div>

            <div
              className="flex shrink-0 flex-col gap-3 overflow-y-auto border-l border-slate-200 bg-white p-4"
              style={{ width: "40%" }}
            >
              <div className="text-sm">
                <div>
                  <Typography.Text type="secondary">
                    Filename GR:{" "}
                  </Typography.Text>
                  {reviewSample.has_ground_truth
                    ? reviewSample.ground_truth_normalized
                    : "— (none)"}
                </div>
                <div>
                  <Typography.Text type="secondary">
                    Predicted:{" "}
                  </Typography.Text>
                  {reviewSample.upload_predicted ?? "—"}
                  {reviewSample.upload_confidence != null
                    ? ` (${(reviewSample.upload_confidence * 100).toFixed(0)}%)`
                    : ""}
                </div>
                {reviewSample.rerun_predicted ? (
                  <div>
                    <Typography.Text type="secondary">Re-run: </Typography.Text>
                    {reviewSample.rerun_predicted}
                  </div>
                ) : null}
                {reviewSample.upload_error ? (
                  <Alert
                    className="mt-2"
                    type="warning"
                    showIcon
                    message={reviewSample.upload_error}
                  />
                ) : null}
                <div className="mt-2">
                  <Typography.Text type="secondary">Category: </Typography.Text>
                  <Tag
                    color={
                      isRawSample(reviewSample)
                        ? "blue"
                        : reviewSampleCategory === "dead"
                          ? "red"
                          : reviewSampleCategory
                            ? "orange"
                            : "default"
                    }
                  >
                    {isRawSample(reviewSample)
                      ? "Raw Data (pending)"
                      : sampleCategoryLabel(reviewSampleCategory)}
                  </Tag>
                  {reviewSample.upload_match == null ? null : (
                    <Tag
                      className="ml-1"
                      color={reviewSample.upload_match ? "success" : "error"}
                    >
                      {reviewSample.upload_match
                        ? "pred matches GT"
                        : "pred ≠ GT"}
                    </Tag>
                  )}
                </div>
                {typeof reviewSample.metadata?.original_filename ===
                "string" ? (
                  <div className="mt-1 text-xs text-slate-500">
                    Original file: {reviewSample.metadata.original_filename}
                  </div>
                ) : null}
              </div>

              {isRawSample(reviewSample) ? (
                <div>
                  <div className="mb-1 text-sm text-slate-600">
                    Move into Dataset list category
                  </div>
                  <Select
                    className="w-full"
                    value={moveTargetCategory}
                    options={categorySelectOptions}
                    onChange={(value: string) => setMoveTargetCategory(value)}
                  />
                  <Typography.Paragraph
                    type="secondary"
                    className="!mb-0 !mt-2 text-xs"
                  >
                    Save GT to stay in Raw, or Save &amp; move to send this
                    image into General / Blurry / Dead / a custom category.
                  </Typography.Paragraph>
                </div>
              ) : (
                <div>
                  <div className="mb-1 text-sm text-slate-600">
                    Dataset category
                  </div>
                  <Select
                    className="w-full"
                    value={reviewSampleCategory}
                    loading={categoryMutationBusy}
                    disabled={categoryMutationBusy}
                    options={categorySelectOptions}
                    onChange={(value: string) => {
                      if (value === reviewSampleCategory) return;
                      if (!value) {
                        moveToReviewedMutation.mutate(reviewSample.id);
                        return;
                      }
                      categoryMutation.mutate({
                        sampleId: reviewSample.id,
                        category: value,
                      });
                    }}
                  />
                </div>
              )}

              <Space wrap>
                <Button size="small" onClick={() => setHideBbox((v) => !v)}>
                  {hideBbox ? "Show bbox" : "Hide bbox"}
                </Button>
                <Button
                  size="small"
                  danger
                  loading={clearBboxMutation.isPending}
                  disabled={!selectedBox && !reviewSample.display_bbox}
                  onClick={() => clearBboxMutation.mutate()}
                >
                  Clear bbox
                </Button>
              </Space>

              <Form form={reviewForm} layout="vertical">
                <Form.Item
                  name="corrected_gt"
                  label="Ground truth (final)"
                  rules={[
                    { required: true, message: "Enter the correct value" },
                  ]}
                >
                  <Input placeholder="e.g. 887512" />
                </Form.Item>
                <Form.Item name="review_notes" label="Notes">
                  <Input.TextArea rows={2} />
                </Form.Item>
              </Form>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <div className="mb-2 font-medium text-slate-700">
                  Image quality (helps read blurry digits)
                </div>
                <div className="mb-2 flex flex-wrap gap-1">
                  {ENHANCE_PRESETS.map(({ key, label }) => (
                    <Button
                      key={key}
                      size="small"
                      onClick={() => applyEnhancePreset(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="mb-1 text-slate-500">Brightness</div>
                    <Slider
                      min={0.5}
                      max={2}
                      step={0.05}
                      value={imgBrightness}
                      onChange={setImgBrightness}
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-slate-500">Contrast</div>
                    <Slider
                      min={0.5}
                      max={2.5}
                      step={0.05}
                      value={imgContrast}
                      onChange={setImgContrast}
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-slate-500">Zoom</div>
                    <Slider
                      min={0.8}
                      max={3}
                      step={0.1}
                      value={imgZoom}
                      onChange={setImgZoom}
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-slate-500">Sharpen</div>
                    <Slider
                      min={0}
                      max={1}
                      step={0.05}
                      value={imgSharpen}
                      onChange={setImgSharpen}
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-slate-500">Saturate</div>
                    <Slider
                      min={0}
                      max={2}
                      step={0.05}
                      value={imgSaturate}
                      onChange={setImgSaturate}
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-slate-500">Blur</div>
                    <Slider
                      min={0}
                      max={2}
                      step={0.05}
                      value={imgBlur}
                      onChange={setImgBlur}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <span className="text-slate-500">Invert</span>
                    <Switch
                      checked={imgInvert}
                      onChange={setImgInvert}
                      size="small"
                    />
                    <span className="text-slate-500">Grayscale</span>
                    <Switch
                      checked={imgGrayscale}
                      onChange={setImgGrayscale}
                      size="small"
                    />
                    <Button
                      size="small"
                      onClick={() => applyEnhancePreset("identity")}
                    >
                      Reset view
                    </Button>
                  </div>
                </div>
              </div>

              <Space wrap className="mt-auto border-t border-slate-200 pt-3">
                <Button onClick={() => setReviewSample(null)}>Close</Button>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  loading={deleteMutation.isPending}
                  onClick={() => confirmDelete(reviewSample)}
                >
                  Delete
                </Button>
                <Button
                  icon={<CheckOutlined />}
                  onClick={() =>
                    reviewMutation.mutate({
                      accept_prediction: true,
                      review_notes: reviewForm.getFieldValue("review_notes"),
                      clear_bbox: hideBbox,
                      ...(isRawSample(reviewSample)
                        ? { target_category: moveTargetCategory }
                        : {}),
                    })
                  }
                  loading={reviewMutation.isPending}
                >
                  {isRawSample(reviewSample)
                    ? "Accept pred & move"
                    : "Accept prediction"}
                </Button>
                <Button
                  type={isRawSample(reviewSample) ? "default" : "primary"}
                  loading={reviewMutation.isPending}
                  onClick={async () => {
                    const values = await reviewForm.validateFields();
                    reviewMutation.mutate({
                      corrected_gt: values.corrected_gt,
                      review_notes: values.review_notes,
                      clear_bbox: hideBbox,
                    });
                  }}
                >
                  Save GT
                </Button>
                {isRawSample(reviewSample) ? (
                  <Button
                    type="primary"
                    loading={reviewMutation.isPending}
                    onClick={async () => {
                      const values = await reviewForm.validateFields();
                      reviewMutation.mutate({
                        corrected_gt: values.corrected_gt,
                        review_notes: values.review_notes,
                        clear_bbox: hideBbox,
                        target_category: moveTargetCategory,
                      });
                    }}
                  >
                    Save GT &amp; move
                  </Button>
                ) : null}
              </Space>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="Add category"
        open={addCategoryOpen}
        onCancel={() => {
          setAddCategoryOpen(false);
          setNewCategoryName("");
        }}
        okText="Add"
        confirmLoading={addCategoryMutation.isPending}
        onOk={() => {
          const name = newCategoryName.trim();
          if (!name) {
            message.error("Enter a category name");
            return;
          }
          addCategoryMutation.mutate(name);
        }}
      >
        <Typography.Paragraph type="secondary" className="!mb-3">
          Custom categories work like Blurry and Dead: images stay in the
          category after you save ground truth, and only reviewed images sync to
          a Dataset-tab mirror (<code>data-bank-&lt;name&gt;@1.0.0</code>).
        </Typography.Paragraph>
        <Input
          placeholder="e.g. cropped, glare, partial"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          onPressEnter={() => {
            const name = newCategoryName.trim();
            if (name) addCategoryMutation.mutate(name);
          }}
        />
      </Modal>

      <Modal
        title={
          tabScopeCategory
            ? `Sync ${tabDisplayName(reviewTab)} to Dataset tab`
            : "Sync to Dataset tab"
        }
        open={syncOpen}
        onCancel={() => setSyncOpen(false)}
        okText="Sync now"
        confirmLoading={syncReviewedMutation.isPending}
        onOk={() => syncReviewedMutation.mutate(syncChunkCount)}
      >
        {tabScopeCategory ? (
          <Typography.Paragraph type="secondary" className="!mb-0">
            Rebuilds the evaluation mirror for reviewed samples in the{" "}
            <strong>{tabDisplayName(reviewTab)}</strong> category (
            <code>data-bank-{tabScopeCategory}@1.0.0</code>).
          </Typography.Paragraph>
        ) : (
          <>
            <Typography.Paragraph type="secondary" className="!mb-3">
              Blurry / dead / custom categories stay as one dataset each. Normal
              reviewed images can be split into N evaluation datasets (e.g.{" "}
              <code>data-bank-reviewed-01</code> …{" "}
              <code>data-bank-reviewed-0N</code>). Use 1 for a single{" "}
              <code>data-bank-reviewed</code> mirror.
            </Typography.Paragraph>
            <div className="mb-1 text-sm text-slate-600">
              Reviewed images chunks
            </div>
            <InputNumber
              min={1}
              max={50}
              value={syncChunkCount}
              onChange={(v) => setSyncChunkCount(Math.max(1, Number(v) || 1))}
              className="w-full"
            />
          </>
        )}
      </Modal>

      <RecognitionBuildModal
        open={recognitionBuildOpen}
        onClose={() => setRecognitionBuildOpen(false)}
        ocrType={activeTaskKey}
        databankDatasetId={datasetId}
      />
    </div>
  );
}

function UploadDatabankModal({
  open,
  ocrType,
  onClose,
  onSubmit,
  confirmLoading,
}: {
  open: boolean;
  ocrType: string;
  confirmLoading: boolean;
  onClose: () => void;
  onSubmit: (values: { ocr_type: string; file: File }) => void;
}) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const handleOk = () => {
    const file = fileList[0]?.originFileObj;
    if (!file) {
      message.error("Please choose a ZIP file");
      return;
    }
    onSubmit({ ocr_type: ocrType, file });
    setFileList([]);
  };

  return (
    <Modal
      title="Upload to data bank"
      open={open}
      onCancel={() => {
        setFileList([]);
        onClose();
      }}
      onOk={handleOk}
      okText="Upload & predict"
      confirmLoading={confirmLoading}
      destroyOnHidden
      width={560}
    >
      <Alert
        className="mb-3"
        type="info"
        showIcon
        message="Appends to the shared bank"
        description={
          <>
            Images are stored as <code>{`{seq}-{value}.jpg`}</code> with a
            single increasing sequence. Upload names may be{" "}
            <code>{`{value}.jpg`}</code> or{" "}
            <code>{`{old-seq}-{value}.jpg`}</code>— the sequence is reassigned.
            Ground truth is read from the value segment when it contains digits.
          </>
        }
      />
      <Upload.Dragger
        maxCount={1}
        beforeUpload={() => false}
        fileList={fileList}
        onChange={({ fileList: next }) => setFileList(next)}
        accept=".zip,application/zip"
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Drop a ZIP, or click to browse</p>
      </Upload.Dragger>
    </Modal>
  );
}

function UploadRawDatabankModal({
  open,
  ocrType,
  onClose,
  onSubmit,
  confirmLoading,
}: {
  open: boolean;
  ocrType: string;
  confirmLoading: boolean;
  onClose: () => void;
  onSubmit: (values: { ocr_type: string; file: File }) => void;
}) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const handleOk = () => {
    const file = fileList[0]?.originFileObj;
    if (!file) {
      message.error("Please choose an image or ZIP file");
      return;
    }
    onSubmit({ ocr_type: ocrType, file });
    setFileList([]);
  };

  return (
    <Modal
      title="Upload raw data"
      open={open}
      onCancel={() => {
        setFileList([]);
        onClose();
      }}
      onOk={handleOk}
      okText="Upload & predict"
      confirmLoading={confirmLoading}
      destroyOnHidden
      width={560}
    >
      <Alert
        className="mb-3"
        type="info"
        showIcon
        message="Pending review queue"
        description={
          <>
            Filenames can be anything — no ground truth is inferred from the
            name. Images land in <strong>Raw Data</strong>, the default model
            runs a prediction, then you set GT and move them into General /
            Blurry / Dead / a custom category.
          </>
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
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          Drop a single image or a ZIP of images
        </p>
      </Upload.Dragger>
    </Modal>
  );
}
