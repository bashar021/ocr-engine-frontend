import {
  Alert,
  Button,
  Input,
  Modal,
  Select,
  Spin,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  AlertOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  ClearOutlined,
  EditOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import {
  extractEvaluationSampleWithGemini,
  fetchEvaluationResultImageObjectUrl,
  fetchSampleImageObjectUrl,
  listEvaluationHardFailures,
  reviewEvaluationResult,
  updateDatasetSample,
} from "@/api/evaluation";
import { getGeminiConfig, getGeminiPrompts } from "@/api/scraper";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchInput } from "@/components/common/SearchInput";
import {
  BboxAnnotator,
  type DrawnBox,
} from "@/components/training/BboxAnnotator";
import { useDatasetsQuery } from "@/features/evaluation/useDatasetsQuery";
import { useEvaluationsQuery } from "@/features/evaluation/useEvaluationsQuery";
import { useTaskContext } from "@/features/tasks/TaskContext";
import type { EvaluationResult } from "@/types/evaluation";
import { formatPercent } from "@/utils/format";
import {
  FAILURE_TYPE_DESCRIPTIONS,
  HARD_FAILURE_TYPES,
  formatFailureType,
} from "@/utils/failureTaxonomy";
import { isRealLabelDataset } from "@/utils/datasetFilters";

const DEFAULT_ODOMETER_PROMPT = `1 - Does this image relate to a car dashboard?
2 - Does this image relate to an odometer?
3 - Is this image natural?
If all 3 points are true, read the odometer digits from this image and detect the 2D boundary / bounding box of the odometer digits or display area.
Return JSON ONLY in this format:
{
  "ground_truth": "<numeric digits>",
  "box_2d": [ymin, xmin, ymax, xmax]
}
where box_2d is [ymin, xmin, ymax, xmax] in normalized coordinates from 0 to 1000.
If any point fails from the 3, or if the digits/odometer are unreadable, return {"ground_truth": null, "box_2d": null}.`;

const FAILURE_TYPES = [...HARD_FAILURE_TYPES, "UNKNOWN"];

function FailureMetricsStrip({
  counts,
  selectedType,
  onSelectType,
}: {
  counts: Record<string, number>;
  selectedType?: string;
  onSelectType: (type?: string) => void;
}) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const totalFailures = entries.reduce((acc, [, count]) => acc + count, 0);

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-500">
        No failure categories recorded for this model evaluation.
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-xs">
      <span className="text-xs font-semibold text-slate-500 mr-1">
        Failures ({totalFailures}):
      </span>
      {entries.map(([type, count]) => {
        const isSelected = selectedType === type;
        return (
          <Tag
            key={type}
            color={isSelected ? "orange" : "volcano"}
            className={`cursor-pointer transition-all hover:scale-105 ${
              isSelected ? "border-2 border-orange-500 font-bold shadow-xs" : ""
            }`}
            onClick={() => onSelectType(isSelected ? undefined : type)}
          >
            {type === "UNKNOWN" ? "Unknown" : formatFailureType(type)}: {count}
          </Tag>
        );
      })}
    </div>
  );
}

function SampleReviewModal({
  open,
  result,
  datasetId,
  modelRef,
  onClose,
  onSaved,
}: {
  open: boolean;
  result: EvaluationResult | null;
  datasetId?: string;
  modelRef?: string;
  onClose: () => void;
  onSaved: (sampleId: string, newGt: string, newBbox?: DrawnBox | null) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editedGt, setEditedGt] = useState("");
  const [currentGt, setCurrentGt] = useState("");
  const [editedBbox, setEditedBbox] = useState<DrawnBox | null>(null);
  const [currentBbox, setCurrentBbox] = useState<DrawnBox | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

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
    enabled: open,
  });

  const configQuery = useQuery({
    queryKey: ["scraper", "gemini-config"],
    queryFn: getGeminiConfig,
    enabled: open,
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
        ];

  const sampleKey = result
    ? `${result.dataset_id}-${result.dataset_sample_id}-${result.id}`
    : null;

  useEffect(() => {
    if (!open || !result) {
      setUrl(null);
      setSavedSuccess(false);
      setGeminiError(null);
      setGeminiSuccess(null);
      setEditedBbox(null);
      setCurrentBbox(null);
      return;
    }
    const initialGt = result.ground_truth ?? result.ground_truth_normalized ?? "";
    setCurrentGt(initialGt);
    setEditedGt(initialGt);
    setSavedSuccess(false);
    setGeminiError(null);
    setGeminiSuccess(null);

    const initialBox = (result.corrected_bbox || result.selected_detection) as DrawnBox | null;
    const initialBoxNormalized = initialBox
      ? {
          x1: Number(initialBox.x1),
          y1: Number(initialBox.y1),
          x2: Number(initialBox.x2),
          y2: Number(initialBox.y2),
        }
      : null;
    setEditedBbox(initialBoxNormalized);
    setCurrentBbox(initialBoxNormalized);

    let revoked: string | null = null;
    let cancelled = false;
    setLoading(true);

    const targetDatasetId = result.dataset_id || datasetId;
    const targetSampleId = result.dataset_sample_id;

    const loadImg = async () => {
      try {
        if (targetDatasetId && targetSampleId) {
          const u = await fetchSampleImageObjectUrl(targetDatasetId, targetSampleId);
          if (!cancelled) {
            revoked = u;
            setUrl(u);
            return;
          }
        }
      } catch {
        // Fallback to evaluation result image endpoint
      }
      if (result.evaluation_id && result.id) {
        try {
          const fallbackUrl = await fetchEvaluationResultImageObjectUrl(
            result.evaluation_id,
            result.id,
          );
          if (!cancelled) {
            revoked = fallbackUrl;
            setUrl(fallbackUrl);
          }
        } catch {
          // Both endpoints failed
        }
      }
    };

    void loadImg().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [open, sampleKey, datasetId]);

  const handleGeminiExtract = async () => {
    if (!result) return;
    const targetDatasetId = result.dataset_id || datasetId;
    const targetSampleId = result.dataset_sample_id;
    if (!targetDatasetId || !targetSampleId) {
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
        targetSampleId,
        {
          prompt: activePromptText.trim(),
          api_key: apiKey.trim() || undefined,
          model: effectiveModel,
        },
      );

      if (res.extracted_value !== undefined && res.extracted_value !== null) {
        setEditedGt(res.extracted_value);
      }
      if (res.bbox) {
        setEditedBbox({
          x1: Number(res.bbox.x1),
          y1: Number(res.bbox.y1),
          x2: Number(res.bbox.x2),
          y2: Number(res.bbox.y2),
        });
      }

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

  const handleSaveGt = async () => {
    if (!result) return;
    const newGt = editedGt.trim();
    if (!newGt) {
      message.warning("Ground truth value cannot be empty.");
      return;
    }
    const targetDatasetId = result.dataset_id || datasetId;
    const targetSampleId = result.dataset_sample_id;

    if (!targetDatasetId || !targetSampleId) {
      message.error("Cannot locate original dataset sample ID to save ground truth.");
      return;
    }

    setSaving(true);
    try {
      // 1. Save directly to original dataset sample
      await updateDatasetSample(targetDatasetId, targetSampleId, {
        ground_truth: newGt,
        bbox: editedBbox
          ? {
              x1: Math.round(editedBbox.x1),
              y1: Math.round(editedBbox.y1),
              x2: Math.round(editedBbox.x2),
              y2: Math.round(editedBbox.y2),
            }
          : undefined,
      });

      // 2. Also register review on evaluation result if available
      if (result.evaluation_id && result.id) {
        try {
          await reviewEvaluationResult(result.evaluation_id, result.id, {
            review_status: "corrected",
            corrected_gt: newGt,
            corrected_bbox: editedBbox
              ? {
                  x1: Math.round(editedBbox.x1),
                  y1: Math.round(editedBbox.y1),
                  x2: Math.round(editedBbox.x2),
                  y2: Math.round(editedBbox.y2),
                }
              : undefined,
          });
        } catch {
          // non-fatal if evaluation result review record fails
        }
      }

      setCurrentGt(newGt);
      setCurrentBbox(editedBbox);
      setSavedSuccess(true);
      message.success("Ground truth & bounding box successfully saved to original dataset!");
      onSaved(targetSampleId, newGt, editedBbox);
    } catch (err) {
      message.error(getApiErrorMessage(err) || "Failed to save ground truth.");
    } finally {
      setSaving(false);
    }
  };

  const predicted = result?.predicted_normalized || result?.predicted_value || "";
  const isMatch = editedGt.trim() && predicted && editedGt.trim() === predicted.trim();

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 flex-wrap pr-6">
          <span className="font-semibold text-slate-800">
            {result?.filename ?? "Sample Review"}
          </span>
          {result?.failure_type ? (
            <Tag color="volcano">{formatFailureType(result.failure_type)}</Tag>
          ) : null}
          {modelRef ? <Tag color="blue">{modelRef}</Tag> : null}
          <Tag color={result?.is_correct ? "green" : "red"}>
            {result?.is_correct ? "Match" : "Failure"}
          </Tag>
          <Tag color="purple">Gemini Assisted</Tag>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={1060}
      destroyOnHidden
    >
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_370px] gap-5 pt-3">
        {/* Left Column: Image & Annotation Canvas */}
        <div className="flex flex-col gap-2">
          <div className="relative flex min-h-[340px] max-h-[500px] items-center justify-center rounded-lg border border-slate-200 bg-slate-900 p-2 overflow-hidden shadow-inner">
            <Spin spinning={loading}>
              {url ? (
                <BboxAnnotator
                  src={url}
                  value={editedBbox}
                  onChange={setEditedBbox}
                  imageWidth={result?.image_size?.width}
                  imageHeight={result?.image_size?.height}
                />
              ) : (
                <div className="text-sm text-slate-400">
                  {loading ? "Loading image…" : "No image preview available"}
                </div>
              )}
            </Spin>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              {editedBbox ? (
                <span className="font-mono text-slate-700">
                  BBox: [{Math.round(editedBbox.x1)}, {Math.round(editedBbox.y1)}, {Math.round(editedBbox.x2)}, {Math.round(editedBbox.y2)}]
                </span>
              ) : (
                <span>Click and drag on the image to draw bounding box</span>
              )}
            </span>
            {editedBbox && (
              <Button
                size="small"
                type="link"
                icon={<ClearOutlined />}
                className="p-0 text-xs text-red-600 hover:text-red-700"
                onClick={() => setEditedBbox(null)}
              >
                Clear box
              </Button>
            )}
          </div>
        </div>

        {/* Right Column: Prediction, Gemini AI Auto-Detect, and Ground Truth Review */}
        <div className="flex flex-col gap-3.5">
          {/* Model Prediction Card */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
              Model Prediction
            </div>
            <div className="font-mono text-xl font-bold tracking-wider text-slate-800 break-all select-all">
              {result?.predicted_value || result?.predicted_normalized || "(no text detected)"}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>
                Confidence: <strong>{formatPercent(result?.confidence)}</strong>
              </span>
              <span>•</span>
              <span>
                Det:{" "}
                {result?.detection_success ? (
                  <Tag color="green" className="mr-0 text-[10px]">
                    OK
                  </Tag>
                ) : (
                  <Tag color="red" className="mr-0 text-[10px]">
                    Fail
                  </Tag>
                )}
              </span>
              <span>•</span>
              <span>
                Rec:{" "}
                {result?.recognition_success ? (
                  <Tag color="green" className="mr-0 text-[10px]">
                    OK
                  </Tag>
                ) : (
                  <Tag color="red" className="mr-0 text-[10px]">
                    Fail
                  </Tag>
                )}
              </span>
              {result?.processing_time_ms ? (
                <span>• {result.processing_time_ms} ms</span>
              ) : null}
            </div>
          </div>

          {/* Gemini AI Auto-Detect Card */}
          <div className="rounded-xl border border-amber-200 bg-linear-to-b from-amber-50/70 to-orange-50/40 p-3 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ThunderboltOutlined className="text-amber-500 text-base" />
                <span className="font-semibold text-slate-800 text-xs tracking-tight">
                  Gemini AI Auto-Detect (GT & BBox)
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

          {/* Ground Truth Review & Edit Box */}
          <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-900">
                Ground Truth (Original Dataset)
              </div>
              {result?.predicted_normalized &&
                editedGt !== result.predicted_normalized && (
                  <Button
                    type="link"
                    size="small"
                    className="p-0 h-auto text-xs text-blue-600 font-medium"
                    onClick={() => {
                      setEditedGt(
                        result.predicted_normalized || result.predicted_value || "",
                      );
                      setSavedSuccess(false);
                    }}
                  >
                    Copy predicted to GT
                  </Button>
                )}
            </div>

            <div className="text-xs text-slate-600">
              Current label:{" "}
              <span className="font-mono font-bold text-slate-800">
                {currentGt || "(none)"}
              </span>
              {currentBbox && (
                <span className="ml-2 font-mono text-[11px] text-slate-500">
                  BBox: [{Math.round(currentBbox.x1)}, {Math.round(currentBbox.y1)}, {Math.round(currentBbox.x2)}, {Math.round(currentBbox.y2)}]
                </span>
              )}
            </div>

            <Input
              value={editedGt}
              onChange={(e) => {
                setEditedGt(e.target.value);
                setSavedSuccess(false);
              }}
              placeholder="Enter correct ground truth value..."
              className="font-mono text-base font-semibold tracking-wider py-1.5"
              allowClear
            />

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
              <span>
                BBox:{" "}
                {editedBbox ? (
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
                {editedGt ? (
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

            <Button
              type="primary"
              icon={<CheckOutlined />}
              loading={saving}
              disabled={!editedGt.trim()}
              onClick={handleSaveGt}
              className="w-full bg-blue-600 hover:bg-blue-500"
            >
              Save GT to Original Dataset
            </Button>

            {savedSuccess && (
              <Alert
                type="success"
                showIcon
                message="Saved to Original Dataset"
                description={`Ground truth successfully updated to "${currentGt}". The dataset sample now reflects this correction.`}
                className="mt-1"
              />
            )}
          </div>

          {/* Comparison Status / Verdict */}
          {editedGt.trim() &&
            (isMatch ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircleOutlined className="text-emerald-600 text-sm mt-0.5 shrink-0" />
                <div>
                  <strong>Prediction Matches Ground Truth:</strong>
                  <div className="text-emerald-700 mt-0.5">
                    The model recognized the image accurately. Saving will fix the original
                    dataset label and resolve the false failure.
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 flex items-start gap-2">
                <AlertOutlined className="text-amber-600 text-sm mt-0.5 shrink-0" />
                <div>
                  <strong>
                    Failure: {formatFailureType(result?.failure_type || "UNKNOWN")}
                  </strong>
                  <div className="text-amber-700 mt-0.5">
                    {FAILURE_TYPE_DESCRIPTIONS[result?.failure_type || "UNKNOWN"] ||
                      "Model prediction differs from the ground truth."}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </Modal>
  );
}

export function EvaluatedHardDatasetPage() {
  const { activeTaskKey } = useTaskContext();
  const queryClient = useQueryClient();

  // Exactly 2 fields for selecting evaluation data: Dataset and Model Version
  const [datasetId, setDatasetId] = useState<string | undefined>();
  const [modelRef, setModelRef] = useState<string | undefined>();
  const [evaluationId, setEvaluationId] = useState<string | undefined>();

  // Filter & Search controls
  const [failureType, setFailureType] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Review modal state
  const [preview, setPreview] = useState<EvaluationResult | null>(null);
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  // Datasets query — exclude category slices and request ready evaluation datasets
  const datasetsQuery = useDatasetsQuery({
    scope: "evaluation",
    ocr_type: activeTaskKey,
    status: "ready",
    exclude_categories: true,
    limit: 200,
  });

  // Completed evaluations query for the selected dataset
  const evalsQuery = useEvaluationsQuery(
    {
      ocr_type: activeTaskKey,
      dataset_id: datasetId,
      status: "completed",
      limit: 200,
      include_metrics: false,
    },
    Boolean(datasetId),
  );

  // Strictly only real label datasets appear in the dropdown (no category slices or raw datasets)
  const datasetOptions = useMemo(
    () =>
      (datasetsQuery.data?.datasets ?? [])
        .filter(isRealLabelDataset)
        .map((d) => ({
          value: d.id,
          label: `${d.name} v${d.version}`,
        })),
    [datasetsQuery.data?.datasets],
  );

  // Extract unique model versions evaluated on the chosen dataset
  const modelVersionOptions = useMemo(() => {
    const evals = evalsQuery.data?.evaluations ?? [];
    const seen = new Map<
      string,
      { modelRef: string; evalId: string; completedAt?: string }
    >();
    for (const e of evals) {
      const ref = e.model_ref || "Default";
      if (!seen.has(ref)) {
        seen.set(ref, {
          modelRef: ref,
          evalId: e.id,
          completedAt: e.completed_at ? e.completed_at.slice(0, 10) : undefined,
        });
      }
    }
    return Array.from(seen.values()).map((item) => ({
      value: item.modelRef,
      label: item.completedAt
        ? `${item.modelRef} (${item.completedAt})`
        : item.modelRef,
      evalId: item.evalId,
    }));
  }, [evalsQuery.data?.evaluations]);

  // Default to first valid label dataset once available
  useEffect(() => {
    if (defaultsApplied || datasetsQuery.isLoading) return;
    const first = (datasetsQuery.data?.datasets ?? []).find(isRealLabelDataset);
    if (first) {
      setDatasetId(first.id);
      setDefaultsApplied(true);
    }
  }, [datasetsQuery.data?.datasets, datasetsQuery.isLoading, defaultsApplied]);

  // Synchronize model version when dataset changes
  useEffect(() => {
    if (!datasetId || evalsQuery.isLoading) return;
    if (modelVersionOptions.length === 0) {
      setModelRef(undefined);
      setEvaluationId(undefined);
      return;
    }
    const currentValid = modelVersionOptions.find((o) => o.value === modelRef);
    if (!currentValid) {
      const first = modelVersionOptions[0];
      setModelRef(first.value);
      setEvaluationId(first.evalId);
    } else {
      setEvaluationId(currentValid.evalId);
    }
  }, [datasetId, modelVersionOptions, modelRef, evalsQuery.isLoading]);

  // Query hard failures and review data
  const failuresQuery = useQuery({
    queryKey: [
      "evaluation",
      "hard-failures",
      datasetId,
      evaluationId,
      modelRef,
      failureType,
      search,
      page,
      pageSize,
    ],
    queryFn: () =>
      listEvaluationHardFailures({
        dataset_id: datasetId!,
        evaluation_id: evaluationId,
        model_ref: modelRef,
        failure_type: failureType,
        search: search || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
    enabled: Boolean(datasetId && (evaluationId || modelRef)),
  });

  const handleSavedGt = (
    updatedSampleId: string,
    newGt: string,
    newBbox?: DrawnBox | null,
  ) => {
    // Invalidate failures query so table refetches
    void queryClient.invalidateQueries({
      queryKey: ["evaluation", "hard-failures"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["evaluation", "datasets"],
    });

    // Update local preview state
    setPreview((prev) => {
      if (!prev || prev.dataset_sample_id !== updatedSampleId) return prev;
      const pred = prev.predicted_normalized || prev.predicted_value || "";
      return {
        ...prev,
        ground_truth: newGt,
        ground_truth_normalized: newGt,
        corrected_gt: newGt,
        corrected_bbox: newBbox
          ? {
              x1: newBbox.x1,
              y1: newBbox.y1,
              x2: newBbox.x2,
              y2: newBbox.y2,
            }
          : prev.corrected_bbox,
        is_correct: bool(pred && pred.trim() === newGt.trim()),
      };
    });
  };

  const columns: ColumnsType<EvaluationResult> = [
    {
      title: "Failure type",
      dataIndex: "failure_type",
      width: 170,
      render: (v: string | null | undefined) =>
        v ? (
          <Tag title={FAILURE_TYPE_DESCRIPTIONS[v]}>{formatFailureType(v)}</Tag>
        ) : (
          <Tag color="green">Resolved</Tag>
        ),
    },
    {
      title: "Filename",
      dataIndex: "filename",
      ellipsis: true,
      width: 190,
    },
    {
      title: "Ground truth",
      key: "ground_truth",
      ellipsis: true,
      width: 140,
      render: (_, row) => {
        const gt = row.ground_truth_normalized || row.ground_truth;
        return (
          <div className="flex items-center gap-1.5 font-mono">
            <span className="font-semibold text-slate-800">{gt || "—"}</span>
            {row.corrected_gt ? (
              <Tag color="blue" className="text-[10px] px-1 py-0 leading-none">
                edited
              </Tag>
            ) : null}
          </div>
        );
      },
    },
    {
      title: "Predicted",
      key: "predicted",
      ellipsis: true,
      width: 140,
      render: (_, row) => {
        const pred = row.predicted_normalized || row.predicted_value;
        const gt = row.ground_truth_normalized || row.ground_truth;
        const match = row.is_correct || (pred && gt && pred.trim() === gt.trim());
        return (
          <span
            className={`font-mono font-semibold ${
              match ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {pred || "—"}
          </span>
        );
      },
    },
    {
      title: "Confidence",
      dataIndex: "confidence",
      width: 100,
      render: (v: number | null) => formatPercent(v),
    },
    {
      title: "Det.",
      dataIndex: "detection_success",
      width: 75,
      render: (v: boolean | null) =>
        v == null ? "—" : v ? <Tag color="green">yes</Tag> : <Tag color="red">no</Tag>,
    },
    {
      title: "Rec.",
      dataIndex: "recognition_success",
      width: 75,
      render: (v: boolean | null) =>
        v == null ? "—" : v ? <Tag color="green">yes</Tag> : <Tag color="red">no</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 110,
      render: (_, row) => (
        <Button
          size="small"
          type="primary"
          ghost
          icon={<EditOutlined />}
          onClick={() => setPreview(row)}
        >
          Review
        </Button>
      ),
    },
  ];

  function bool(val: unknown): boolean {
    return Boolean(val);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Evaluation Review"
        description="Inspect evaluation failures, review model predictions, and correct ground truth labels in original datasets."
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        {/* Single-line Toolbar with exactly 2 selection fields + filters + search */}
        <div className="flex flex-nowrap items-center gap-3 overflow-x-auto pb-1">
          {/* Field 1: Dataset */}
          <Select
            placeholder="Select dataset"
            className="w-64 shrink-0"
            showSearch
            optionFilterProp="label"
            value={datasetId}
            options={datasetOptions}
            loading={datasetsQuery.isLoading}
            onChange={(v) => {
              setDatasetId(v);
              setModelRef(undefined);
              setEvaluationId(undefined);
              setPage(1);
            }}
          />

          {/* Field 2: Model Version */}
          <Select
            placeholder="Select model version"
            className="w-56 shrink-0"
            showSearch
            optionFilterProp="label"
            value={modelRef}
            options={modelVersionOptions}
            loading={evalsQuery.isLoading}
            disabled={!datasetId || modelVersionOptions.length === 0}
            onChange={(v) => {
              setModelRef(v);
              const match = modelVersionOptions.find((o) => o.value === v);
              setEvaluationId(match?.evalId);
              setPage(1);
            }}
          />

          {/* Failure Type Filter */}
          <Select
            allowClear
            placeholder="All failure types"
            className="w-48 shrink-0"
            options={FAILURE_TYPES.map((t) => ({
              value: t,
              label: t === "UNKNOWN" ? "Unknown failure" : formatFailureType(t),
            }))}
            value={failureType}
            onChange={(v) => {
              setFailureType(v);
              setPage(1);
            }}
          />

          {/* Search Input */}
          <div className="min-w-[200px] flex-1">
            <SearchInput
              className="w-full"
              placeholder="Search filename, GT, prediction..."
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
            />
          </div>

          {/* Reset Filters Button */}
          {(failureType || search) && (
            <Button
              icon={<UndoOutlined />}
              onClick={() => {
                setFailureType(undefined);
                setSearch("");
                setPage(1);
              }}
              size="middle"
              className="shrink-0"
            >
              Reset
            </Button>
          )}
        </div>

        {/* Failure Breakdown Strip */}
        {failuresQuery.data ? (
          <FailureMetricsStrip
            counts={failuresQuery.data.failure_type_counts}
            selectedType={failureType}
            onSelectType={(type) => {
              setFailureType(type);
              setPage(1);
            }}
          />
        ) : null}

        {failuresQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Failed to load evaluation review data"
            description={getApiErrorMessage(failuresQuery.error)}
          />
        ) : null}

        {/* Evaluation Results / Failures Table */}
        <div className="min-h-0 flex-1 overflow-auto">
          <Table
            rowKey="id"
            size="middle"
            className="rounded-lg border border-slate-200 bg-white shadow-xs"
            columns={columns}
            dataSource={failuresQuery.data?.results ?? []}
            loading={failuresQuery.isLoading || failuresQuery.isFetching}
            scroll={{ x: 1000 }}
            pagination={{
              current: page,
              pageSize,
              total: failuresQuery.data?.total ?? 0,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
              onChange: (p, s) => {
                setPage(p);
                setPageSize(s);
              },
            }}
          />
        </div>
      </div>

      {/* Sample Review & GT Correction Modal */}
      <SampleReviewModal
        open={Boolean(preview)}
        result={preview}
        datasetId={datasetId}
        modelRef={modelRef}
        onClose={() => setPreview(null)}
        onSaved={handleSavedGt}
      />
    </div>
  );
}
