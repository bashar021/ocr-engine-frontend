import {
  CheckOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeInvisibleOutlined,
  InboxOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  App,
  Alert,
  Button,
  Dropdown,
  Form,
  Input,
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
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
  uploadToDatabank,
} from "@/api/databank";
import { DataTableToolbar } from "@/components/common/DataTableToolbar";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchInput } from "@/components/common/SearchInput";
import { OcrImageViewer } from "@/components/ocr/OcrImageViewer";
import { useDebounce } from "@/hooks/useDebounce";
import type { DatabankMetrics, DatabankSample } from "@/types/databank";
import type { OcrBoundingBox } from "@/types/ocr";

const OCR_TYPES = [
  { value: "odometer", label: "Odometer" },
  { value: "number_plate", label: "Number plate" },
  { value: "bill", label: "Bill" },
  { value: "vin", label: "VIN" },
  { value: "document", label: "Document" },
];

type FilenameGtFilter = "all" | "yes" | "no";
type PredictedFilter = "all" | "has" | "missing" | "error";
type MatchFilter = "all" | "yes" | "no" | "none";
type FinalGtFilter = "all" | "yes" | "no";
type RerunFilter = "all" | "has" | "missing" | "ok" | "miss";

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
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
  if (!metrics || metrics.comparable_samples === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <Typography.Text strong>{title}</Typography.Text>
        <div className="mt-1 text-sm text-slate-500">{emptyHint}</div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <Typography.Text strong>{title}</Typography.Text>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Statistic
          title="Accuracy"
          value={formatPct(metrics.exact_match_accuracy)}
        />
        <Statistic title="Matches" value={metrics.exact_matches} />
        <Statistic title="Mismatches" value={metrics.mismatches} />
        <Statistic title="Compared" value={metrics.comparable_samples} />
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
  const { modal, message: appMessage } = App.useApp();
  const queryClient = useQueryClient();
  const [ocrType, setOcrType] = useState("odometer");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reviewTab, setReviewTab] = useState<string>("unreviewed");
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
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
  const [imgBrightness, setImgBrightness] = useState(1);
  const [imgContrast, setImgContrast] = useState(1.15);
  const [imgZoom, setImgZoom] = useState(1);
  const [imgSharpen, setImgSharpen] = useState(0.2);
  const [imgInvert, setImgInvert] = useState(false);
  const [hideBbox, setHideBbox] = useState(false);
  const [reviewForm] = Form.useForm<{
    corrected_gt: string;
    review_notes?: string;
  }>();

  const bankQuery = useQuery({
    queryKey: ["databank", "bank", ocrType],
    queryFn: () => getDatabank(ocrType),
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

  const samplesQuery = useQuery({
    queryKey: [
      "databank",
      "samples",
      datasetId,
      reviewTab,
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

  useEffect(() => {
    if (!reviewSample) return;
    setImgBrightness(1);
    setImgContrast(1.15);
    setImgZoom(1);
    setImgSharpen(0.2);
    setImgInvert(false);
    setHideBbox(Boolean(reviewSample.bbox_cleared));
    reviewForm.setFieldsValue({
      corrected_gt:
        reviewSample.corrected_gt ||
        reviewSample.ground_truth_normalized ||
        reviewSample.upload_predicted ||
        "",
      review_notes: reviewSample.review_notes || "",
    });
  }, [reviewSample, reviewForm]);

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

  const reviewMutation = useMutation({
    mutationFn: (body: {
      corrected_gt?: string;
      accept_prediction?: boolean;
      review_notes?: string;
      clear_bbox?: boolean;
    }) => reviewDatabankSample(datasetId!, reviewSample!.id, body),
    onSuccess: () => {
      message.success(
        "Ground truth saved — category kept (use Move to Reviewed to clear)",
      );
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
    mutationFn: () => rerunDatabankReviewed(datasetId!),
    onSuccess: () => {
      message.success("Re-running default model on reviewed samples");
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  });

  const syncReviewedMutation = useMutation({
    mutationFn: () => syncDatabankReviewedEval(datasetId!),
    onSuccess: (ds) => {
      const parts = Object.entries(ds).map(
        ([key, v]) =>
          `${key}: ${v.sample_count ?? 0} → ${v.name ?? key}@${v.version ?? "1.0.0"}`,
      );
      message.success(`Synced mirrors — ${parts.join("; ")}`);
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
    onSuccess: (_data, vars) => {
      message.success(
        vars.category
          ? `Moved to ${vars.category}`
          : "Cleared category (normal)",
      );
      if (reviewSample?.id === vars.sampleId) setReviewSample(null);
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
    onSuccess: () => {
      message.success("Moved to Reviewed (cleared category)");
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

  const addCategoryMutation = useMutation({
    mutationFn: (name: string) => addDatabankCategory(datasetId!, name),
    onSuccess: (ds) => {
      message.success("Category added");
      setAddCategoryOpen(false);
      setNewCategoryName("");
      void queryClient.invalidateQueries({ queryKey: ["databank"] });
      const customs = ds.custom_categories ?? [];
      if (customs.length) setReviewTab(customs[customs.length - 1]!);
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  });

  const reanalyzeMutation = useMutation({
    mutationFn: () => reanalyzeDatabankUnreviewed(datasetId!),
    onSuccess: (ds) => {
      message.success(
        ds.message ?? "Re-analyzing unreviewed samples with default model",
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
    setReviewSample(null);
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
        v || row.is_blurry ? (
          <Tag color={v === "dead" ? "red" : "orange"}>{v || "blurry"}</Tag>
        ) : (
          "—"
        ),
    },
    {
      title: "",
      key: "actions",
      width: 320,
      render: (_, row) => {
        const cat = row.category || (row.is_blurry ? "blurry" : "");
        const customCats = (dataset?.custom_categories ?? []).filter(
          (c) => c !== cat,
        );
        return (
          <Space size={4} wrap>
            <Button size="small" onClick={() => setReviewSample(row)}>
              {row.review_status === "reviewed" ? "View" : "Review"}
            </Button>
            {cat !== "blurry" ? (
              <Button
                size="small"
                icon={<EyeInvisibleOutlined />}
                loading={categoryMutation.isPending}
                onClick={() =>
                  categoryMutation.mutate({
                    sampleId: row.id,
                    category: "blurry",
                  })
                }
              >
                Blurry
              </Button>
            ) : null}
            {cat !== "dead" ? (
              <Button
                size="small"
                loading={categoryMutation.isPending}
                onClick={() =>
                  categoryMutation.mutate({
                    sampleId: row.id,
                    category: "dead",
                  })
                }
              >
                Dead
              </Button>
            ) : null}
            {customCats.length ? (
              <Dropdown
                menu={{
                  items: customCats.map((c) => ({
                    key: c,
                    label: `Mark ${c}`,
                    onClick: () =>
                      categoryMutation.mutate({
                        sampleId: row.id,
                        category: c,
                      }),
                  })),
                }}
              >
                <Button size="small">More…</Button>
              </Dropdown>
            ) : null}
            {cat ? (
              <Button
                size="small"
                type="primary"
                loading={moveToReviewedMutation.isPending}
                onClick={() => moveToReviewedMutation.mutate(row.id)}
              >
                Move to Reviewed
              </Button>
            ) : null}
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                confirmDelete(row);
              }}
            >
              Delete
            </Button>
          </Space>
        );
      },
    },
  ];

  const selectedBox =
    hideBbox || reviewSample?.bbox_cleared
      ? null
      : toViewerBox(reviewSample?.display_bbox);
  const busy =
    jobRunning ||
    ["predicting", "processing", "rerunning"].includes(dataset?.status ?? "");

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: "Dashboard", path: "/" },
          { title: "Dataset", path: "/evaluation/datasets" },
          { title: "Dataset list" },
        ]}
        actions={
          <Space>
            <Select
              value={ocrType}
              onChange={(v) => {
                setOcrType(v);
                setSamplePage(1);
                setReviewTab("unreviewed");
                setFilenameGtFilter("all");
                setPredictedFilter("all");
                setMatchFilter("all");
                setFinalGtFilter("all");
                setRerunFilter("all");
              }}
              options={OCR_TYPES}
              style={{ width: 160 }}
            />
            <Button
              type="primary"
              onClick={() => setUploadOpen(true)}
              disabled={busy}
            >
              Upload to data bank
            </Button>
          </Space>
        }
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-6 pb-6 pt-4">
        <Alert
          type="info"
          showIcon
          message="Single shared data bank"
          description="Categories (blurry / dead / custom) stay after you save ground truth. Only reviewed images sync to Dataset tab — one fixed dataset per category (data-bank-reviewed, data-bank-blurry, data-bank-dead, …). Use “Move to Reviewed” to clear a category."
        />

        {dataset?.error_message ? (
          <Alert type="error" showIcon message={dataset.error_message} />
        ) : null}

        {uploadProgress?.status === "completed" && uploadProgress.message ? (
          <Alert
            type="success"
            showIcon
            closable
            message={uploadProgress.message}
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Space wrap>
            <Tag>{dataset?.status ?? "loading"}</Tag>
            <Typography.Text type="secondary">
              {dataset?.sample_count ?? 0} total ·{" "}
              {dataset?.reviewed_count ?? 0} reviewed ·{" "}
              {dataset?.unreviewed_count ?? 0} unreviewed ·{" "}
              {dataset?.blurry_count ?? 0} blurry
            </Typography.Text>
            <Typography.Text type="secondary">
              Model ref in use:{" "}
              <Tag color="teal">
                {dataset?.model_ref ?? "default (resolving…)"}
              </Tag>
            </Typography.Text>
          </Space>
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
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <MetricsStrip
            title="Upload prediction vs final GR (after review)"
            metrics={dataset?.upload_metrics}
            emptyHint="Review samples to compute upload-time accuracy against final ground truth."
          />
          <MetricsStrip
            title="Manual re-run on reviewed data"
            metrics={dataset?.rerun_metrics}
            emptyHint="Use “Re-run default model” on the Reviewed tab to measure accuracy again."
          />
        </div>

        <Tabs
          activeKey={reviewTab}
          onChange={(key) => {
            setReviewTab(key);
            setSamplePage(1);
          }}
          tabBarExtraContent={
            <Space wrap>
              <Button
                icon={<ReloadOutlined />}
                loading={syncReviewedMutation.isPending}
                disabled={!datasetId}
                onClick={() => syncReviewedMutation.mutate()}
              >
                Sync categories to Dataset tab
              </Button>
              {reviewTab === "unreviewed" ? (
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  loading={
                    reanalyzeMutation.isPending ||
                    dataset?.status === "predicting"
                  }
                  disabled={(dataset?.unreviewed_count ?? 0) === 0 || busy}
                  onClick={() => reanalyzeMutation.mutate()}
                >
                  Re-analyze unreviewed
                </Button>
              ) : null}
              {reviewTab === "reviewed" ? (
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  loading={
                    rerunMutation.isPending || dataset?.status === "rerunning"
                  }
                  disabled={(dataset?.reviewed_count ?? 0) === 0}
                  onClick={() => rerunMutation.mutate()}
                >
                  Re-run default model
                </Button>
              ) : null}
              <Button
                disabled={!datasetId}
                onClick={() => setAddCategoryOpen(true)}
              >
                Add category
              </Button>
            </Space>
          }
          items={[
            {
              key: "unreviewed",
              label: `Unreviewed (${dataset?.unreviewed_count ?? 0})`,
            },
            {
              key: "reviewed",
              label: `Reviewed (${dataset?.reviewed_count ?? 0})`,
            },
            {
              key: "blurry",
              label: `Blurry (${dataset?.category_counts?.blurry?.reviewed ?? 0}/${dataset?.category_counts?.blurry?.total ?? dataset?.blurry_count ?? 0})`,
            },
            {
              key: "dead",
              label: `Dead (${dataset?.category_counts?.dead?.reviewed ?? 0}/${dataset?.category_counts?.dead?.total ?? 0})`,
            },
            ...((dataset?.custom_categories ?? []) as string[]).map((c) => ({
              key: c,
              label: `${c} (${dataset?.category_counts?.[c]?.reviewed ?? 0}/${dataset?.category_counts?.[c]?.total ?? 0})`,
            })),
          ]}
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
        ocrType={ocrType}
        confirmLoading={uploadMutation.isPending}
        onClose={() => setUploadOpen(false)}
        onSubmit={(values) => uploadMutation.mutate(values)}
      />

      <Modal
        title={
          reviewSample ? `Review · ${reviewSample.filename}` : "Review sample"
        }
        open={!!reviewSample}
        onCancel={() => setReviewSample(null)}
        width={880}
        destroyOnHidden
        footer={
          <Space wrap>
            <Button onClick={() => setReviewSample(null)}>Close</Button>
            {reviewSample ? (
              <>
                {(reviewSample.category ||
                  (reviewSample.is_blurry ? "blurry" : "")) !== "blurry" ? (
                  <Button
                    icon={<EyeInvisibleOutlined />}
                    loading={categoryMutation.isPending}
                    onClick={() =>
                      categoryMutation.mutate({
                        sampleId: reviewSample.id,
                        category: "blurry",
                      })
                    }
                  >
                    Mark blurry
                  </Button>
                ) : null}
                {(reviewSample.category || "") !== "dead" ? (
                  <Button
                    loading={categoryMutation.isPending}
                    onClick={() =>
                      categoryMutation.mutate({
                        sampleId: reviewSample.id,
                        category: "dead",
                      })
                    }
                  >
                    Mark dead
                  </Button>
                ) : null}
                {(dataset?.custom_categories ?? []).filter(
                  (c) => c !== (reviewSample.category || ""),
                ).length ? (
                  <Dropdown
                    menu={{
                      items: (dataset?.custom_categories ?? [])
                        .filter((c) => c !== (reviewSample.category || ""))
                        .map((c) => ({
                          key: c,
                          label: `Mark ${c}`,
                          onClick: () =>
                            categoryMutation.mutate({
                              sampleId: reviewSample.id,
                              category: c,
                            }),
                        })),
                    }}
                  >
                    <Button loading={categoryMutation.isPending}>
                      Mark category…
                    </Button>
                  </Dropdown>
                ) : null}
                {reviewSample.category || reviewSample.is_blurry ? (
                  <Button
                    type="primary"
                    ghost
                    loading={moveToReviewedMutation.isPending}
                    onClick={() =>
                      moveToReviewedMutation.mutate(reviewSample.id)
                    }
                  >
                    Move to Reviewed
                  </Button>
                ) : null}
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  loading={deleteMutation.isPending}
                  onClick={() => confirmDelete(reviewSample)}
                >
                  Delete
                </Button>
              </>
            ) : null}
            {reviewSample && reviewSample.review_status !== "reviewed" ? (
              <>
                <Button
                  icon={<CheckOutlined />}
                  onClick={() =>
                    reviewMutation.mutate({
                      accept_prediction: true,
                      review_notes: reviewForm.getFieldValue("review_notes"),
                      clear_bbox: hideBbox,
                    })
                  }
                  loading={reviewMutation.isPending}
                >
                  Accept prediction
                </Button>
                <Button
                  type="primary"
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
                  Save corrected GR
                </Button>
              </>
            ) : null}
          </Space>
        }
      >
        {reviewSample ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              {previewUrl ? (
                <OcrImageViewer
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
                />
              ) : (
                <div className="rounded-lg bg-slate-100 p-8 text-center text-slate-500">
                  Loading image…
                </div>
              )}
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <div className="mb-2 font-medium text-slate-700">
                  Image quality (helps read blurry digits)
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
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <span className="text-slate-500">Invert</span>
                    <Switch
                      checked={imgInvert}
                      onChange={setImgInvert}
                      size="small"
                    />
                    <Button
                      size="small"
                      onClick={() => {
                        setImgBrightness(1);
                        setImgContrast(1.15);
                        setImgZoom(1);
                        setImgSharpen(0.2);
                        setImgInvert(false);
                      }}
                    >
                      Reset view
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
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
              </div>
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
