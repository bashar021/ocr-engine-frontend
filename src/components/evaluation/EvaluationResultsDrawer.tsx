import {
  DownloadOutlined,
  ExportOutlined,
  EyeOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorCode, getApiErrorMessage } from "@/api/client";
import {
  downloadFilteredCropsZip,
  exportHardCases,
  exportTrainingDataset,
  fetchEvaluationResultImageObjectUrl,
  fetchSampleImageObjectUrl,
  listAllEvaluationResults,
  reviewEvaluationResult,
} from "@/api/evaluation";
import { SearchInput } from "@/components/common/SearchInput";
import { OcrImageViewer } from "@/components/ocr/OcrImageViewer";
import type { EvaluationResult } from "@/types/evaluation";
import type { OcrBoundingBox } from "@/types/ocr";
import { formatMs, formatPercent } from "@/utils/format";
import {
  FAILURE_TYPES,
  FAILURE_TYPE_DESCRIPTIONS,
  formatDetectionOutcome,
  formatDiagnostic,
  formatFailureType,
} from "@/utils/failureTaxonomy";

interface EvaluationResultsDrawerProps {
  evaluationId: string | null;
  open: boolean;
  onClose: () => void;
}

const REVIEW_STATUSES = [
  { value: "confirmed_bug", label: "Confirmed bug" },
  { value: "bad_gt", label: "Bad GT" },
  { value: "skip", label: "Skip" },
];

function toCsv(rows: EvaluationResult[]): string {
  const headers = [
    "filename",
    "ground_truth",
    "predicted",
    "is_correct",
    "failure_type",
    "detection_outcome",
    "quality_flags",
    "detection_diagnostics",
    "taxonomy_version",
    "review_status",
    "confidence",
    "processing_time_ms",
    "fail_stage",
    "error_type",
    "error_message",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    const values = [
      row.filename,
      row.ground_truth_normalized,
      row.predicted_normalized,
      row.is_correct,
      row.failure_type,
      row.detection_outcome,
      (row.quality_flags ?? []).join("|"),
      (row.detection_diagnostics ?? row.quality_flags ?? []).join("|"),
      row.taxonomy_version,
      row.review_status,
      row.confidence,
      row.processing_time_ms,
      row.fail_stage,
      row.error_type,
      row.error_message,
    ].map((v) => {
      const s = v == null ? "" : String(v);
      return `"${s.replaceAll('"', '""')}"`;
    });
    lines.push(values.join(","));
  }
  return lines.join("\n");
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function failLabel(row: EvaluationResult): string {
  if (row.failure_type && row.failure_type !== "OK") return row.failure_type;
  if (row.is_correct) return "ok";
  if (row.fail_stage === "detection") return "detection failed";
  if (row.fail_stage === "recognition") return "recognition failed";
  if (row.error_type) return row.error_type;
  return "incorrect";
}

function asBoxes(row: EvaluationResult): OcrBoundingBox[] {
  return (row.detections ?? []).map((b) => ({
    x1: b.x1,
    y1: b.y1,
    x2: b.x2,
    y2: b.y2,
    confidence: b.confidence,
    label: b.label,
  }));
}

export function EvaluationResultsDrawer({
  evaluationId,
  open,
  onClose,
}: EvaluationResultsDrawerProps) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [correctFilter, setCorrectFilter] = useState<string | undefined>();
  const [failureFilter, setFailureFilter] = useState<string | undefined>();
  const [failStageFilter, setFailStageFilter] = useState<string | undefined>();
  const [reviewFilter, setReviewFilter] = useState<string | undefined>();
  const [preview, setPreview] = useState<EvaluationResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewMissing, setPreviewMissing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [trainingExportOpen, setTrainingExportOpen] = useState(false);
  const [exportForm] = Form.useForm();
  const [trainingExportForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [cropsDownloading, setCropsDownloading] = useState(false);
  const [trainingExporting, setTrainingExporting] = useState(false);

  const resultsQuery = useQuery({
    queryKey: ["evaluation", "results", evaluationId, "all"],
    queryFn: () => listAllEvaluationResults(evaluationId!),
    enabled: Boolean(open && evaluationId),
  });

  const applyFilters = (rows: EvaluationResult[]) => {
    let filteredRows = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      filteredRows = filteredRows.filter(
        (r) =>
          (r.filename ?? "").toLowerCase().includes(q) ||
          (r.ground_truth_normalized ?? "").toLowerCase().includes(q) ||
          (r.predicted_normalized ?? "").toLowerCase().includes(q) ||
          (r.failure_type ?? "").toLowerCase().includes(q) ||
          (r.error_type ?? "").toLowerCase().includes(q) ||
          (r.fail_stage ?? "").toLowerCase().includes(q),
      );
    }
    if (correctFilter === "correct") {
      filteredRows = filteredRows.filter((r) => r.is_correct === true);
    } else if (correctFilter === "incorrect") {
      filteredRows = filteredRows.filter((r) => r.is_correct === false);
    }
    if (failureFilter) {
      filteredRows = filteredRows.filter(
        (r) => (r.failure_type || "") === failureFilter,
      );
    }
    if (failStageFilter) {
      filteredRows = filteredRows.filter(
        (r) => (r.fail_stage || "") === failStageFilter,
      );
    }
    if (reviewFilter === "unreviewed") {
      filteredRows = filteredRows.filter((r) => !r.review_status);
    } else if (reviewFilter) {
      filteredRows = filteredRows.filter(
        (r) => r.review_status === reviewFilter,
      );
    }
    return filteredRows;
  };

  const filtered = useMemo(
    () => applyFilters(resultsQuery.data ?? []),
    [
      resultsQuery.data,
      search,
      correctFilter,
      failureFilter,
      failStageFilter,
      reviewFilter,
    ],
  );

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    async function load() {
      if (!preview) {
        setPreviewUrl(null);
        setPreviewError(null);
        setPreviewMissing(false);
        return;
      }
      setPreviewLoading(true);
      setPreviewError(null);
      setPreviewMissing(false);
      try {
        let url: string;
        if (preview.evaluation_id && preview.id) {
          try {
            url = await fetchEvaluationResultImageObjectUrl(
              preview.evaluation_id,
              preview.id,
            );
          } catch (primaryError) {
            if (
              preview.dataset_id &&
              preview.dataset_sample_id &&
              preview.dataset_sample_id !== "None"
            ) {
              url = await fetchSampleImageObjectUrl(
                preview.dataset_id,
                preview.dataset_sample_id,
              );
            } else {
              throw primaryError;
            }
          }
        } else if (
          preview.dataset_id &&
          preview.dataset_sample_id &&
          preview.dataset_sample_id !== "None"
        ) {
          url = await fetchSampleImageObjectUrl(
            preview.dataset_id,
            preview.dataset_sample_id,
          );
        } else {
          setPreviewUrl(null);
          setPreviewMissing(true);
          setPreviewError(
            "This result isn't linked to a dataset sample, so its image can't be located.",
          );
          return;
        }
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        createdUrl = url;
        setPreviewUrl(url);
      } catch (error) {
        if (!cancelled) {
          setPreviewUrl(null);
          const code = getApiErrorCode(error);
          const missing =
            code === "SAMPLE_IMAGE_MISSING" || code === "SAMPLE_NOT_FOUND";
          setPreviewMissing(missing);
          setPreviewError(
            missing
              ? "Original image no longer available for this run (the dataset was regenerated or the sample wasn't retained)."
              : getApiErrorMessage(error),
          );
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [preview]);

  useEffect(() => {
    if (preview) {
      reviewForm.setFieldsValue({
        review_status: preview.review_status ?? undefined,
        review_notes: preview.review_notes ?? "",
        corrected_gt: preview.corrected_gt ?? "",
      });
    }
  }, [preview, reviewForm]);

  const columns: ColumnsType<EvaluationResult> = [
    {
      title: "Filename",
      dataIndex: "filename",
      width: 160,
      fixed: "left",
      render: (v: string | null, row) => v || row.relative_path || "—",
    },
    { title: "Ground truth", dataIndex: "ground_truth_normalized", width: 110 },
    { title: "Predicted", dataIndex: "predicted_normalized", width: 110 },
    {
      title: "Correct",
      dataIndex: "is_correct",
      width: 80,
      render: (v: boolean | null) =>
        v == null ? (
          "—"
        ) : (
          <Tag color={v ? "green" : "red"}>{v ? "yes" : "no"}</Tag>
        ),
    },
    {
      title: "Failure type",
      dataIndex: "failure_type",
      width: 150,
      render: (v: string | null | undefined) =>
        v ? (
          <Tag
            color={v === "OK" ? "green" : "orange"}
            title={FAILURE_TYPE_DESCRIPTIONS[v]}
          >
            {formatFailureType(v)}
          </Tag>
        ) : (
          "—"
        ),
    },
    {
      title: "Detection",
      dataIndex: "detection_outcome",
      width: 140,
      render: (v: string | null | undefined) =>
        v ? <Tag color="blue">{formatDetectionOutcome(v)}</Tag> : "—",
    },
    {
      title: "Fail stage",
      dataIndex: "fail_stage",
      width: 110,
      render: (v: string | null | undefined) => (v ? <Tag>{v}</Tag> : "—"),
    },
    {
      title: "Review",
      dataIndex: "review_status",
      width: 120,
      render: (v: string | null | undefined) =>
        v ? <Tag>{v}</Tag> : <Tag color="default">unreviewed</Tag>,
    },
    {
      title: "Confidence",
      dataIndex: "confidence",
      width: 100,
      render: (v: number | null) => formatPercent(v),
    },
    {
      title: "Latency",
      dataIndex: "processing_time_ms",
      width: 90,
      render: (v: number | null) => formatMs(v),
    },
    {
      title: "Preview",
      key: "preview",
      width: 90,
      fixed: "right",
      render: (_, row) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => setPreview(row)}
          disabled={!row.image_available && !row.dataset_sample_id}
        >
          View
        </Button>
      ),
    },
  ];

  const onReview = async () => {
    if (!evaluationId || !preview) return;
    try {
      const values = await reviewForm.validateFields();
      await reviewEvaluationResult(evaluationId, preview.id, {
        review_status: values.review_status,
        corrected_gt: values.corrected_gt || null,
        review_notes: values.review_notes || null,
      });
      message.success("Review saved");
      await queryClient.invalidateQueries({
        queryKey: ["evaluation", "results", evaluationId],
      });
      setPreview(null);
    } catch (error) {
      if ((error as { errorFields?: unknown }).errorFields) return;
      message.error(getApiErrorMessage(error));
    }
  };

  const onExportTrainingDataset = async () => {
    if (!evaluationId) return;
    try {
      const values = await trainingExportForm.validateFields();
      setTrainingExporting(true);
      const result = await exportTrainingDataset(evaluationId, {
        pack: values.pack,
        result_ids: filtered.map((r) => r.id),
      });
      message.success(
        `Training dataset ${result.name} v${result.version} (${result.exported_sample_count ?? result.sample_count ?? filtered.length} samples) — see Dataset → Training datasets`,
      );
      setTrainingExportOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["evaluation", "datasets"],
      });
    } catch (error) {
      if ((error as { errorFields?: unknown }).errorFields) return;
      message.error(getApiErrorMessage(error));
    } finally {
      setTrainingExporting(false);
    }
  };

  const onExport = async () => {
    if (!evaluationId) return;
    try {
      const values = await exportForm.validateFields();
      const result = await exportHardCases(evaluationId, {
        pack: values.pack,
        failure_types: values.failure_types,
        review_statuses: values.review_statuses ?? ["confirmed_bug"],
        include_correct: false,
      });
      message.success(
        `Exported ${result.name} v${result.version} (${result.exported_sample_count ?? result.sample_count ?? "?"} samples)`,
      );
      setExportOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["evaluation", "datasets"],
      });
    } catch (error) {
      if ((error as { errorFields?: unknown }).errorFields) return;
      message.error(getApiErrorMessage(error));
    }
  };

  const onDownloadFilteredCrops = async () => {
    if (!evaluationId) return;
    if (filtered.length === 0) {
      message.warning("No rows match the current filters");
      return;
    }
    setCropsDownloading(true);
    try {
      const filterParts: string[] = [];
      if (search.trim()) filterParts.push(`search=${search.trim()}`);
      if (correctFilter) filterParts.push(`correct=${correctFilter}`);
      if (failureFilter) filterParts.push(`failure=${failureFilter}`);
      if (failStageFilter) filterParts.push(`stage=${failStageFilter}`);
      if (reviewFilter) filterParts.push(`review=${reviewFilter}`);
      const { blob, filename, imageCount } = await downloadFilteredCropsZip(
        evaluationId,
        {
          result_ids: filtered.map((r) => r.id),
          filter_label:
            filterParts.length > 0
              ? filterParts.join(",")
              : "all_loaded_results",
        },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      message.success(
        imageCount != null
          ? `Downloaded ${imageCount} crop image${imageCount === 1 ? "" : "s"} (from ${filtered.length} filtered result${filtered.length === 1 ? "" : "s"})`
          : "Downloaded crop images",
      );
    } catch (error) {
      message.error(getApiErrorMessage(error));
    } finally {
      setCropsDownloading(false);
    }
  };

  return (
    <>
      <Drawer
        title="Evaluation results"
        open={open}
        onClose={() => {
          setPage(1);
          setSearch("");
          setCorrectFilter(undefined);
          setFailureFilter(undefined);
          setFailStageFilter(undefined);
          setReviewFilter(undefined);
          setPreview(null);
          onClose();
        }}
        width={1180}
        destroyOnHidden
        extra={
          <Space>
            <Button
              icon={<DownloadOutlined />}
              loading={cropsDownloading}
              onClick={() => void onDownloadFilteredCrops()}
              disabled={!evaluationId || filtered.length === 0}
              title="ZIP of detection crops for rows matching the current table filters. Named {name}-crop.{ext}"
            >
              Download crops ({filtered.length})
            </Button>
            <Button
              icon={<ExportOutlined />}
              onClick={() => {
                trainingExportForm.setFieldsValue({
                  pack: "recognition_crops",
                });
                setTrainingExportOpen(true);
              }}
              disabled={!evaluationId || filtered.length === 0}
            >
              Export as training dataset ({filtered.length})
            </Button>
            <Button
              icon={<ExportOutlined />}
              onClick={() => {
                exportForm.setFieldsValue({
                  pack: "eval_zip",
                  review_statuses: ["confirmed_bug"],
                  failure_types: failureFilter ? [failureFilter] : undefined,
                });
                setExportOpen(true);
              }}
              disabled={!evaluationId}
            >
              Export hard cases
            </Button>
            <Button
              icon={<DownloadOutlined />}
              disabled={filtered.length === 0}
              onClick={() =>
                downloadCsv(
                  `evaluation-${evaluationId?.slice(0, 8) ?? "results"}-filtered.csv`,
                  toCsv(filtered),
                )
              }
            >
              Download CSV
            </Button>
          </Space>
        }
      >
        <div className="mb-4 flex flex-wrap gap-3">
          <SearchInput
            className="w-full max-w-xs"
            placeholder="Search filename, GT, predicted…"
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
          />
          <Select
            allowClear
            placeholder="Correctness"
            className="w-36"
            value={correctFilter}
            options={[
              { value: "correct", label: "Correct" },
              { value: "incorrect", label: "Incorrect" },
            ]}
            onChange={(v) => {
              setCorrectFilter(v);
              setPage(1);
            }}
          />
          <Select
            allowClear
            placeholder="Failure type"
            className="w-48"
            value={failureFilter}
            options={FAILURE_TYPES.map((v) => ({
              value: v,
              label: formatFailureType(v),
              title: FAILURE_TYPE_DESCRIPTIONS[v],
            }))}
            onChange={(v) => {
              setFailureFilter(v);
              setPage(1);
            }}
          />
          <Select
            allowClear
            placeholder="Fail stage"
            className="w-40"
            value={failStageFilter}
            options={[
              { value: "quality", label: "Quality" },
              { value: "detection", label: "Detection" },
              { value: "recognition", label: "Recognition" },
            ]}
            onChange={(v) => {
              setFailStageFilter(v);
              setPage(1);
            }}
          />
          <Select
            allowClear
            placeholder="Review"
            className="w-40"
            value={reviewFilter}
            options={[
              { value: "unreviewed", label: "Unreviewed" },
              ...REVIEW_STATUSES,
            ]}
            onChange={(v) => {
              setReviewFilter(v);
              setPage(1);
            }}
          />
          <span className="self-center text-sm text-slate-500">
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        <Table
          rowKey="id"
          size="small"
          loading={resultsQuery.isLoading || resultsQuery.isFetching}
          columns={columns}
          dataSource={paged}
          scroll={{ x: 1180 }}
          pagination={{
            current: page,
            pageSize,
            total: filtered.length,
            showSizeChanger: true,
            onChange: (p, s) => {
              setPage(p);
              setPageSize(s);
            },
          }}
        />
      </Drawer>

      <Modal
        title={preview?.filename || "Sample preview"}
        open={Boolean(preview)}
        onCancel={() => {
          setPreview(null);
          setPreviewUrl(null);
          setPreviewError(null);
        }}
        footer={null}
        width={900}
        destroyOnHidden
      >
        {preview ? (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-h-[240px] rounded-xl border border-slate-200 bg-slate-50 p-3">
              {previewLoading ? (
                <div className="flex h-60 items-center justify-center text-sm text-slate-500">
                  Loading image…
                </div>
              ) : previewError ? (
                <div
                  className={`flex h-60 flex-col items-center justify-center gap-1 px-6 text-center text-sm ${
                    previewMissing ? "text-slate-500" : "text-red-600"
                  }`}
                >
                  {previewMissing ? (
                    <PictureOutlined className="text-2xl text-slate-400" />
                  ) : null}
                  <span>{previewError}</span>
                </div>
              ) : previewUrl ? (
                <OcrImageViewer
                  src={previewUrl}
                  boxes={asBoxes(preview)}
                  selected={
                    preview.selected_detection
                      ? {
                          ...preview.selected_detection,
                          label: preview.selected_detection.label,
                        }
                      : null
                  }
                  imageWidth={preview.image_size?.width}
                  imageHeight={preview.image_size?.height}
                />
              ) : null}
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Primary outcome
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Tag
                    color={preview.is_correct ? "green" : "red"}
                    title={
                      preview.failure_type
                        ? FAILURE_TYPE_DESCRIPTIONS[preview.failure_type]
                        : undefined
                    }
                  >
                    {formatFailureType(preview.failure_type) || failLabel(preview)}
                  </Tag>
                </div>
                {preview.taxonomy_version ? (
                  <div className="mt-1 text-[11px] text-slate-400">
                    Taxonomy: {preview.taxonomy_version}
                  </div>
                ) : null}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Detection
                </div>
                <div className="mt-1">
                  <Tag color="blue">
                    {formatDetectionOutcome(preview.detection_outcome)}
                  </Tag>
                </div>
                {preview.detection_metrics &&
                typeof preview.detection_metrics.gt_coverage === "number" ? (
                  <div className="mt-1 space-y-0.5 font-mono text-[11px] text-slate-600">
                    <div>
                      IoU:{" "}
                      {Number(preview.detection_metrics.iou ?? 0).toFixed(3)}
                    </div>
                    <div>
                      GT coverage:{" "}
                      {Number(preview.detection_metrics.gt_coverage).toFixed(3)}
                    </div>
                    <div>
                      Pred coverage:{" "}
                      {Number(
                        preview.detection_metrics.prediction_coverage ?? 0,
                      ).toFixed(3)}
                    </div>
                  </div>
                ) : null}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Diagnostics
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(
                    preview.detection_diagnostics ??
                    preview.quality_flags ??
                    []
                  ).length === 0 ? (
                    <span className="text-slate-400">None</span>
                  ) : (
                    (
                      preview.detection_diagnostics ??
                      preview.quality_flags ??
                      []
                    ).map((f) => (
                      <Tag key={f} color="gold">
                        {formatDiagnostic(f)}
                      </Tag>
                    ))
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Ground truth</div>
                <div className="font-mono font-medium">
                  {preview.ground_truth_normalized ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Predicted</div>
                <div className="font-mono font-medium">
                  {preview.predicted_normalized ?? "—"}
                </div>
              </div>
              <Form form={reviewForm} layout="vertical" className="pt-2">
                <Form.Item
                  name="review_status"
                  label="Review"
                  rules={[{ required: true }]}
                >
                  <Select options={REVIEW_STATUSES} />
                </Form.Item>
                <Form.Item name="corrected_gt" label="Corrected GT (additive)">
                  <Input placeholder="Optional" />
                </Form.Item>
                <Form.Item name="review_notes" label="Notes">
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Button type="primary" block onClick={() => void onReview()}>
                  Save review
                </Button>
              </Form>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="Export curated hard cases"
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        onOk={() => void onExport()}
        okText="Create dataset version"
      >
        <Form form={exportForm} layout="vertical" className="pt-2">
          <Alert
            className="mb-3"
            type="info"
            showIcon
            message="Name is automatic ({source}-hardcases + version bump)"
          />
          <Form.Item name="pack" label="Pack" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "eval_zip", label: "eval_zip" },
                { value: "recognition_crops", label: "recognition_crops" },
                {
                  value: "detection_full",
                  label: "detection_full (weak bbox)",
                },
              ]}
            />
          </Form.Item>
          <Form.Item name="review_statuses" label="Review statuses">
            <Select mode="multiple" options={REVIEW_STATUSES} />
          </Form.Item>
          <Form.Item name="failure_types" label="Failure types">
            <Select
              mode="multiple"
              allowClear
              options={FAILURE_TYPES.filter((t) => t !== "OK").map((v) => ({
                value: v,
                label: formatFailureType(v),
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Export as training dataset"
        open={trainingExportOpen}
        onCancel={() => setTrainingExportOpen(false)}
        onOk={() => void onExportTrainingDataset()}
        okText="Create training dataset"
        confirmLoading={trainingExporting}
      >
        <Form form={trainingExportForm} layout="vertical" className="pt-2">
          <Alert
            className="mb-3"
            type="info"
            showIcon
            message={`Exports ${filtered.length} result${filtered.length === 1 ? "" : "s"} matching current table filters`}
            description="No default review filter — only the rows visible under your active filters are included."
          />
          <Form.Item name="pack" label="Pack" rules={[{ required: true }]}>
            <Select
              options={[
                {
                  value: "recognition_crops",
                  label: "recognition_crops (cropped digits)",
                },
                {
                  value: "detection_full",
                  label: "detection_full (full image + bbox)",
                },
                { value: "eval_zip", label: "eval_zip (images named by GT)" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
