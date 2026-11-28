import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  message,
} from "antd";
import {
  ClearOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import {
  bulkReviewEvaluationResults,
  exportHardCases,
  extractEvaluationSampleWithGemini,
  fetchSampleImageObjectUrl,
  listAllEvaluationResults,
  listEvaluations,
  reviewEvaluationResult,
} from "@/api/evaluation";
import { getGeminiConfig, getGeminiPrompts } from "@/api/scraper";
import { PageHeader } from "@/components/common/PageHeader";
import { useTaskContext } from "@/features/tasks/TaskContext";
import { FAILURE_TYPES, formatFailureType } from "@/utils/failureTaxonomy";
import {
  BboxAnnotator,
  type DrawnBox,
} from "@/components/training/BboxAnnotator";
import type { EvaluationResult, EvaluationRun } from "@/types/evaluation";

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

function boxPayload(box: DrawnBox | null): Record<string, number> | null {
  if (!box) return null;
  return { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2 };
}

type CurationDecision = "include" | "exclude" | "pending";

interface LocalLabel {
  decision: CurationDecision;
  corrected_gt: string;
  bbox: DrawnBox | null;
  notes?: string;
}

export function TrainingCurationPage() {
  const queryClient = useQueryClient();
  const { activeTaskKey } = useTaskContext();
  const [modelRef, setModelRef] = useState<string | undefined>();
  const [evaluationId, setEvaluationId] = useState<string | undefined>();
  const [failureFilter, setFailureFilter] = useState<string | undefined>();
  const [failStageFilter, setFailStageFilter] = useState<string | undefined>();
  const [correctFilter, setCorrectFilter] = useState<
    "all" | "correct" | "incorrect"
  >("all");
  const [active, setActive] = useState<EvaluationResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, LocalLabel>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [saving, setSaving] = useState(false);

  // Gemini AI state
  const [selectedPromptId, setSelectedPromptId] = useState<string>("odometer_reading");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem("gemini_api_key") || "",
  );
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [geminiSuccess, setGeminiSuccess] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

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

  const serverHasKey = Boolean(configQuery.data?.has_api_key);

  const modelOptions =
    configQuery.data?.available_models && configQuery.data.available_models.length > 0
      ? configQuery.data.available_models.map((m) => ({ label: m.name, value: m.id }))
      : [
          { label: "Gemini 3.5 Flash Lite (Fastest & Stable)", value: "gemini-3.5-flash-lite" },
          { label: "Gemini 3.5 Flash", value: "gemini-3.5-flash" },
          { label: "Gemini 3 Flash Preview", value: "gemini-3-flash-preview" },
          { label: "Gemini 3 Flash Live", value: "gemini-3-flash-live" },
          { label: "Gemma 4 31B", value: "gemma-4-31b-it" },
        ];

  const evalsQuery = useQuery({
    queryKey: ["evaluation", "runs", "completed-for-curation", activeTaskKey],
    queryFn: () =>
      listEvaluations({
        ocr_type: activeTaskKey,
        status: "completed",
        limit: 200,
        include_metrics: true,
      }),
  });

  const completedEvals = evalsQuery.data?.evaluations ?? [];

  const modelRefOptions = useMemo(() => {
    const refs = new Set<string>();
    for (const e of completedEvals) {
      if (e.model_ref) refs.add(e.model_ref);
    }
    return [...refs].sort().map((r) => ({ value: r, label: r }));
  }, [completedEvals]);

  const evaluationsForModel = useMemo(() => {
    if (!modelRef) return [];
    return completedEvals.filter((e) => e.model_ref === modelRef);
  }, [completedEvals, modelRef]);

  const evaluationOptions = useMemo(
    () =>
      evaluationsForModel.map((e: EvaluationRun) => {
        const ds =
          e.dataset_name != null
            ? `${e.dataset_name}${e.dataset_version ? ` v${e.dataset_version}` : ""}`
            : e.dataset_id.slice(0, 8);
        return {
          value: e.id,
          label: `${ds}${e.completed_at ? ` · ${e.completed_at.slice(0, 10)}` : ""}`,
        };
      }),
    [evaluationsForModel],
  );

  useEffect(() => {
    if (!modelRef) {
      setEvaluationId(undefined);
      return;
    }
    const match = evaluationsForModel.find((e) => e.id === evaluationId);
    if (!match) {
      setEvaluationId(evaluationsForModel[0]?.id);
    }
  }, [modelRef, evaluationsForModel, evaluationId]);

  const resultsQuery = useQuery({
    queryKey: ["evaluation", "results", evaluationId, "curation-all"],
    queryFn: () => listAllEvaluationResults(evaluationId!),
    enabled: Boolean(evaluationId),
  });

  const allResults = resultsQuery.data ?? [];

  /** All evaluation entries; only user-selected filters applied. */
  const visibleRows = useMemo(() => {
    let rows = allResults;
    if (failureFilter) {
      rows = rows.filter((r) => (r.failure_type || "") === failureFilter);
    }
    if (failStageFilter) {
      rows = rows.filter((r) => (r.fail_stage || "") === failStageFilter);
    }
    if (correctFilter === "correct") {
      rows = rows.filter((r) => r.is_correct === true);
    } else if (correctFilter === "incorrect") {
      rows = rows.filter((r) => r.is_correct === false);
    }
    return rows;
  }, [allResults, failureFilter, failStageFilter, correctFilter]);

  // Seed local labels from existing review state when results load
  useEffect(() => {
    setLabels((prev) => {
      const next: Record<string, LocalLabel> = { ...prev };
      for (const r of allResults) {
        if (next[r.id]) continue;
        const box = (r.corrected_bbox ||
          r.selected_detection) as DrawnBox | null;
        let decision: CurationDecision = "pending";
        if (r.review_status === "confirmed_bug") decision = "include";
        if (
          r.review_status === "exclude" ||
          r.review_status === "skip" ||
          r.review_status === "bad_gt"
        ) {
          decision = "exclude";
        }
        next[r.id] = {
          decision,
          corrected_gt: r.corrected_gt || r.ground_truth_normalized || "",
          bbox: box
            ? {
                x1: Number(box.x1),
                y1: Number(box.y1),
                x2: Number(box.x2),
                y2: Number(box.y2),
              }
            : null,
          notes: r.review_notes || undefined,
        };
      }
      return next;
    });
  }, [allResults]);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    async function load() {
      const targetDsId =
        active?.dataset_id ||
        completedEvals.find((e) => e.id === evaluationId)?.dataset_id;
      if (!targetDsId || !active?.dataset_sample_id) {
        setPreviewUrl(null);
        return;
      }
      try {
        url = await fetchSampleImageObjectUrl(
          targetDsId,
          active.dataset_sample_id,
        );
        if (!cancelled) setPreviewUrl(url);
      } catch (e) {
        if (!cancelled) {
          setPreviewUrl(null);
          message.error(getApiErrorMessage(e));
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [active, completedEvals, evaluationId]);

  useEffect(() => {
    setGeminiError(null);
    setGeminiSuccess(null);
  }, [active]);

  const handleGeminiExtract = async () => {
    if (!active) return;
    const targetDatasetId =
      active.dataset_id ||
      completedEvals.find((e) => e.id === evaluationId)?.dataset_id;
    if (!targetDatasetId || !active.dataset_sample_id) {
      message.error("Sample dataset ID or sample ID is missing.");
      return;
    }

    setGeminiLoading(true);
    setGeminiError(null);
    setGeminiSuccess(null);
    if (apiKey) {
      localStorage.setItem("gemini_api_key", apiKey.trim());
    }

    try {
      const res = await extractEvaluationSampleWithGemini(
        targetDatasetId,
        active.dataset_sample_id,
        {
          prompt: activePromptText.trim(),
          api_key: apiKey.trim() || undefined,
          model: effectiveModel,
        },
      );

      const patch: Partial<LocalLabel> = {};
      if (res.extracted_value !== undefined && res.extracted_value !== null) {
        patch.corrected_gt = res.extracted_value;
      }
      if (res.bbox) {
        patch.bbox = {
          x1: Number(res.bbox.x1),
          y1: Number(res.bbox.y1),
          x2: Number(res.bbox.x2),
          y2: Number(res.bbox.y2),
        };
      }

      updateLabel(active.id, patch);

      const details: string[] = [];
      if (res.extracted_value) {
        details.push(`GT: "${res.extracted_value}"`);
      }
      if (res.bbox) {
        details.push(
          `BBox: [${Math.round(res.bbox.x1)}, ${Math.round(res.bbox.y1)}, ${Math.round(res.bbox.x2)}, ${Math.round(res.bbox.y2)}]`,
        );
      }
      const summary =
        details.length > 0 ? details.join(" & ") : "Extracted successfully";
      setGeminiSuccess(`Gemini fetched: ${summary}`);
      message.success(`Gemini auto-detected ${summary}!`);
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setGeminiError(msg);
      message.error(msg);
    } finally {
      setGeminiLoading(false);
    }
  };

  const includedIds = useMemo(
    () =>
      Object.entries(labels)
        .filter(([, v]) => v.decision === "include")
        .map(([id]) => id),
    [labels],
  );
  const excludedCount = useMemo(
    () => Object.values(labels).filter((v) => v.decision === "exclude").length,
    [labels],
  );
  const labeledReady = useMemo(
    () =>
      includedIds.filter((id) => {
        const L = labels[id];
        return L?.corrected_gt && L.bbox;
      }).length,
    [includedIds, labels],
  );

  const updateLabel = (id: string, patch: Partial<LocalLabel>) => {
    setLabels((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const saveCurrent = async (decision: CurationDecision) => {
    if (!evaluationId || !active) return;
    const L = labels[active.id];
    if (!L) return;
    if (decision === "include" && (!L.corrected_gt || !L.bbox)) {
      message.warning(
        "Set ground truth and draw a bounding box before including",
      );
      return;
    }
    setSaving(true);
    try {
      const review_status =
        decision === "include"
          ? "confirmed_bug"
          : decision === "exclude"
            ? "exclude"
            : "skip";
      await reviewEvaluationResult(evaluationId, active.id, {
        review_status,
        corrected_gt: L.corrected_gt || null,
        corrected_bbox: boxPayload(L.bbox),
        review_notes: L.notes || null,
      });
      updateLabel(active.id, { decision });
      message.success(
        decision === "include"
          ? "Included in curated training copy"
          : "Excluded from training copy (source dataset unchanged)",
      );
      // advance to next pending row in the current view
      const idx = visibleRows.findIndex((f) => f.id === active.id);
      const next = visibleRows
        .slice(idx + 1)
        .find((f) => labels[f.id]?.decision === "pending");
      setActive(next ?? null);
      await queryClient.invalidateQueries({
        queryKey: ["evaluation", "results", evaluationId],
      });
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const saveAllAndCreate = async () => {
    if (!evaluationId) return;
    try {
      const values = await createForm.validateFields();
      const items = includedIds.map((id) => {
        const L = labels[id];
        return {
          result_id: id,
          review_status: "confirmed_bug",
          corrected_gt: L.corrected_gt,
          corrected_bbox: boxPayload(L.bbox),
        };
      });
      const missing = items.filter((i) => !i.corrected_gt || !i.corrected_bbox);
      if (missing.length) {
        message.error(
          `${missing.length} included image(s) still need GT + bbox. Finish labeling first.`,
        );
        return;
      }
      setSaving(true);
      await bulkReviewEvaluationResults(evaluationId, items);
      // also persist excludes
      const excludeItems = Object.entries(labels)
        .filter(([, v]) => v.decision === "exclude")
        .map(([id, v]) => ({
          result_id: id,
          review_status: "exclude" as const,
          corrected_gt: v.corrected_gt || null,
          corrected_bbox: boxPayload(v.bbox),
          review_notes: "excluded_from_training_copy",
        }));
      if (excludeItems.length) {
        await bulkReviewEvaluationResults(evaluationId, excludeItems);
      }

      const created = await exportHardCases(evaluationId, {
        pack: values.pack || "detection_full",
        result_ids: includedIds,
        require_corrected_bbox: true,
        review_statuses: ["confirmed_bug"],
      });
      message.success(
        `Created ${created.name} v${created.version} with ${created.exported_sample_count ?? includedIds.length} copied images. Source dataset unmodified.`,
      );
      setCreateOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["evaluation", "datasets"],
      });
    } catch (e) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      message.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<EvaluationResult> = [
    {
      title: "File",
      dataIndex: "filename",
      width: 160,
      render: (v, r) => v || r.relative_path || "—",
    },
    {
      title: "Outcome",
      dataIndex: "failure_type",
      width: 150,
      render: (v: string | null | undefined) =>
        v ? (
          <Tag color={v === "OK" ? "green" : "orange"}>
            {formatFailureType(v)}
          </Tag>
        ) : (
          "—"
        ),
    },
    {
      title: "Correct",
      dataIndex: "is_correct",
      width: 90,
      render: (v: boolean | null) =>
        v == null ? (
          "—"
        ) : (
          <Tag color={v ? "green" : "red"}>{v ? "yes" : "no"}</Tag>
        ),
    },
    {
      title: "Stage",
      dataIndex: "fail_stage",
      width: 100,
    },
    {
      title: "GT / Pred",
      key: "gt",
      render: (_, r) => (
        <span className="font-mono text-xs">
          {r.ground_truth_normalized ?? "—"} → {r.predicted_normalized ?? "—"}
        </span>
      ),
    },
    {
      title: "Curation",
      key: "curation",
      width: 120,
      render: (_, r) => {
        const d = labels[r.id]?.decision ?? "pending";
        if (d === "include") return <Tag color="green">include</Tag>;
        if (d === "exclude") return <Tag color="red">exclude</Tag>;
        return <Tag>pending</Tag>;
      },
    },
    {
      title: "",
      key: "act",
      width: 90,
      render: (_, r) => (
        <Button size="small" onClick={() => setActive(r)}>
          Label
        </Button>
      ),
    },
  ];

  const currentLabel = active ? labels[active.id] : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: "Dashboard", path: "/" },
          { title: "Training", path: "/training" },
          { title: "Curate & Label Failures" },
        ]}
        actions={
          <Button
            type="primary"
            disabled={labeledReady === 0}
            onClick={() => {
              createForm.setFieldsValue({
                pack: "detection_full",
              });
              setCreateOpen(true);
            }}
          >
            Create training dataset copy ({labeledReady})
          </Button>
        }
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-6">
        <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="min-w-[200px] flex-1">
            <div className="mb-1 text-xs text-slate-500">Model ref</div>
            <Select
              className="w-full"
              showSearch
              optionFilterProp="label"
              placeholder="Select model ref"
              options={modelRefOptions}
              value={modelRef}
              loading={evalsQuery.isLoading}
              onChange={(v) => {
                setModelRef(v);
                setEvaluationId(undefined);
                setActive(null);
                setLabels({});
              }}
            />
          </div>
          <div className="min-w-[280px] flex-1">
            <div className="mb-1 text-xs text-slate-500">
              Dataset evaluation
            </div>
            <Select
              className="w-full"
              showSearch
              optionFilterProp="label"
              placeholder={
                modelRef
                  ? "Select dataset evaluation"
                  : "Choose model ref first"
              }
              disabled={!modelRef}
              options={evaluationOptions}
              value={evaluationId}
              onChange={(v) => {
                setEvaluationId(v);
                setActive(null);
                setLabels({});
              }}
            />
          </div>
          <Select
            allowClear
            className="w-48"
            placeholder="Outcome type"
            value={failureFilter}
            onChange={setFailureFilter}
            options={FAILURE_TYPES.map((v) => ({
              value: v,
              label: formatFailureType(v),
            }))}
          />
          <Select
            allowClear
            className="w-40"
            placeholder="Fail stage"
            value={failStageFilter}
            onChange={setFailStageFilter}
            options={[
              { value: "quality", label: "Quality" },
              { value: "detection", label: "Detection" },
              { value: "recognition", label: "Recognition" },
            ]}
          />
          <Select
            className="w-40"
            value={correctFilter}
            onChange={setCorrectFilter}
            options={[
              { value: "all", label: "All correctness" },
              { value: "correct", label: "Correct only" },
              { value: "incorrect", label: "Incorrect only" },
            ]}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <Statistic
              title={
                failureFilter || failStageFilter || correctFilter !== "all"
                  ? "Showing (filtered)"
                  : "Evaluation samples"
              }
              value={visibleRows.length}
              suffix={
                allResults.length > 0 &&
                visibleRows.length !== allResults.length
                  ? `/ ${allResults.length}`
                  : undefined
              }
            />
          </Card>
          <Card>
            <Statistic title="Included (labeled)" value={labeledReady} />
          </Card>
          <Card>
            <Statistic title="Excluded (false/bad)" value={excludedCount} />
          </Card>
        </div>

        <Table
          rowKey="id"
          size="small"
          loading={resultsQuery.isLoading}
          columns={columns}
          dataSource={visibleRows}
          pagination={{ pageSize: 15, showSizeChanger: true }}
        />
      </div>

      <Modal
        title={
          <div className="flex items-center gap-2">
            <span className="font-semibold">{active?.filename || "Label sample"}</span>
            <Tag color="blue">Curate & Label</Tag>
          </div>
        }
        open={Boolean(active)}
        onCancel={() => setActive(null)}
        width={1060}
        footer={null}
        destroyOnHidden
      >
        {active && currentLabel ? (
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_340px]">
            {/* Left side: Annotation Canvas & Box controls */}
            <div className="flex flex-col space-y-2">
              <div className="rounded-lg border border-slate-200 bg-slate-900/5 p-1 overflow-hidden flex items-center justify-center min-h-[380px]">
                {previewUrl ? (
                  <BboxAnnotator
                    src={previewUrl}
                    value={currentLabel.bbox}
                    onChange={(box) => updateLabel(active.id, { bbox: box })}
                    imageWidth={active.image_size?.width}
                    imageHeight={active.image_size?.height}
                  />
                ) : (
                  <div className="flex h-60 items-center justify-center text-slate-500">
                    Loading image…
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>
                  {currentLabel.bbox ? (
                    <span className="font-mono text-slate-700">
                      BBox: [{Math.round(currentLabel.bbox.x1)}, {Math.round(currentLabel.bbox.y1)}, {Math.round(currentLabel.bbox.x2)}, {Math.round(currentLabel.bbox.y2)}]
                    </span>
                  ) : (
                    <span>Click and drag on the image to draw bounding box</span>
                  )}
                </span>
                {currentLabel.bbox && (
                  <Button
                    size="small"
                    type="link"
                    icon={<ClearOutlined />}
                    className="p-0 text-xs text-red-600 hover:text-red-700"
                    onClick={() => updateLabel(active.id, { bbox: null })}
                  >
                    Clear box
                  </Button>
                )}
              </div>
            </div>

            {/* Right side: Information, Gemini AI Auto-Detect, and Ground Truth Labeling */}
            <div className="space-y-3.5 text-sm">
              {/* Failure metadata & predictions */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Tag color={active.failure_type === "OK" ? "green" : "orange"}>
                    {formatFailureType(active.failure_type) || "—"}
                  </Tag>
                  {active.fail_stage ? <Tag>{active.fail_stage}</Tag> : null}
                  {active.is_correct != null ? (
                    <Tag color={active.is_correct ? "green" : "red"}>
                      {active.is_correct ? "correct" : "incorrect"}
                    </Tag>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200">
                  <div>
                    <span className="text-slate-500 block">Original GT:</span>
                    <span className="font-mono font-medium text-slate-700">
                      {active.ground_truth_normalized ?? "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Predicted:</span>
                    <span className="font-mono font-medium text-blue-700">
                      {active.predicted_normalized ?? "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Gemini AI Auto-Detect Card */}
              <div className="rounded-xl border border-amber-200 bg-linear-to-b from-amber-50/70 to-orange-50/40 p-3 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ThunderboltOutlined className="text-amber-500 text-base" />
                    <span className="font-semibold text-slate-800 text-xs tracking-tight">
                      Gemini AI Auto-Detect
                    </span>
                  </div>
                  <Button
                    type="link"
                    size="small"
                    icon={<SettingOutlined />}
                    className="p-0 text-xs text-amber-800 hover:text-amber-900"
                    onClick={() => setShowConfig(!showConfig)}
                  >
                    {showConfig ? "Hide Config" : "Config"}
                  </Button>
                </div>

                {showConfig && (
                  <div className="space-y-2 rounded-lg border border-amber-200 bg-white p-2.5 text-xs">
                    <div>
                      <label className="mb-0.5 block font-medium text-slate-600 text-[11px]">
                        Prompt Preset:
                      </label>
                      <Select
                        size="small"
                        className="w-full text-xs"
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
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block font-medium text-slate-600 text-[11px]">
                        Gemini Model:
                      </label>
                      <Select
                        size="small"
                        className="w-full text-xs"
                        value={effectiveModel}
                        onChange={setSelectedModel}
                        loading={configQuery.isLoading}
                        options={modelOptions}
                      />
                    </div>
                    <div>
                      <div className="mb-0.5 flex items-center justify-between text-[11px]">
                        <span className="font-medium text-slate-600">Gemini API Key:</span>
                        {serverHasKey ? (
                          <Tag color="success" className="mr-0 text-[10px] leading-4">
                            Server key set
                          </Tag>
                        ) : null}
                      </div>
                      <Input.Password
                        size="small"
                        placeholder={
                          serverHasKey
                            ? "Optional custom override API key"
                            : "Enter Gemini API key (saved in browser)"
                        }
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                      />
                    </div>
                    {customPrompt !== null && (
                      <div>
                        <div className="mb-0.5 flex items-center justify-between text-[11px]">
                          <span className="font-medium text-slate-600">Custom Prompt:</span>
                          <Button
                            type="link"
                            size="small"
                            className="p-0 text-[10px]"
                            onClick={() => setCustomPrompt(null)}
                          >
                            Reset
                          </Button>
                        </div>
                        <Input.TextArea
                          rows={3}
                          value={activePromptText}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          className="font-mono text-[11px]"
                        />
                      </div>
                    )}
                  </div>
                )}

                <Button
                  type="primary"
                  block
                  icon={<ThunderboltOutlined />}
                  loading={geminiLoading}
                  onClick={handleGeminiExtract}
                  className="bg-amber-600 hover:bg-amber-500 border-amber-600 text-xs font-medium"
                >
                  {geminiLoading ? "Detecting GT & BBox..." : "Auto-Detect GT & BBox (Gemini)"}
                </Button>

                {geminiSuccess && (
                  <Alert
                    type="success"
                    showIcon
                    message={geminiSuccess}
                    className="text-xs p-2"
                  />
                )}
                {geminiError && (
                  <Alert
                    type="error"
                    showIcon
                    closable
                    onClose={() => setGeminiError(null)}
                    message={geminiError}
                    className="text-xs p-2"
                  />
                )}
              </div>

              {/* Ground Truth Editor */}
              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Corrected Ground Truth:
                  </span>
                  {active.predicted_normalized && (
                    <Button
                      type="link"
                      size="small"
                      className="p-0 text-[11px] text-blue-600"
                      onClick={() =>
                        updateLabel(active.id, {
                          corrected_gt: active.predicted_normalized || "",
                        })
                      }
                    >
                      Copy Pred
                    </Button>
                  )}
                </div>
                <Input
                  value={currentLabel.corrected_gt}
                  onChange={(e) =>
                    updateLabel(active.id, { corrected_gt: e.target.value })
                  }
                  placeholder="e.g. 123456"
                  className="font-mono font-medium"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>
                    BBox:{" "}
                    {currentLabel.bbox ? (
                      <Tag color="cyan" className="font-mono mr-0 text-[10px]">
                        ✓ Set
                      </Tag>
                    ) : (
                      <Tag color="default" className="mr-0 text-[10px]">
                        Not set
                      </Tag>
                    )}
                  </span>
                  <span>
                    GT:{" "}
                    {currentLabel.corrected_gt ? (
                      <Tag color="cyan" className="font-mono mr-0 text-[10px]">
                        ✓ Set
                      </Tag>
                    ) : (
                      <Tag color="default" className="mr-0 text-[10px]">
                        Empty
                      </Tag>
                    )}
                  </span>
                </div>
              </div>

              {/* Inclusion and Exclusion buttons */}
              <Space direction="vertical" className="w-full" size="small">
                <Button
                  type="primary"
                  block
                  loading={saving}
                  disabled={!currentLabel.corrected_gt || !currentLabel.bbox}
                  onClick={() => void saveCurrent("include")}
                >
                  Include in training copy
                </Button>
                <Button
                  danger
                  block
                  loading={saving}
                  onClick={() => void saveCurrent("exclude")}
                >
                  Exclude (false / bad image)
                </Button>
              </Space>

              <Alert
                type="warning"
                showIcon
                className="text-[11px] leading-tight"
                message="Source dataset is never modified. Only the new copied training dataset gets this curated sample."
              />
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="Create copied training dataset"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void saveAllAndCreate()}
        okText="Create copy"
        confirmLoading={saving}
      >
        <Alert
          className="mb-3"
          type="success"
          showIcon
          message={`${labeledReady} labeled sample(s) will be copied`}
          description="Excluded images are left out. Original evaluation dataset stays unchanged. Apply filters in the table to narrow what you curate."
        />
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ pack: "detection_full" }}
        >
          <Alert
            className="mb-3"
            type="info"
            showIcon
            message="Name is automatic"
            description="System names curated sets as {source}-hardcases with an auto-bumped version."
          />
          <Form.Item
            name="pack"
            label="Pack format"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                {
                  value: "detection_full",
                  label: "detection_full (image + human bbox + GT)",
                },
                {
                  value: "recognition_crops",
                  label: "recognition_crops (cropped)",
                },
                { value: "eval_zip", label: "eval_zip (images named by GT)" },
              ]}
            />
          </Form.Item>
        </Form>
        <Link to="/evaluation/training-datasets" className="text-sm">
          View training datasets →
        </Link>
      </Modal>
    </div>
  );
}
