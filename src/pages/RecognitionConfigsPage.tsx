import {
  ArrowUpOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  CloseCircleOutlined,
  EditOutlined,
  ExperimentOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Radio,
  Select,
  Slider,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getApiErrorMessage } from "@/api/client";
import { listDatasets, listEvaluations } from "@/api/evaluation";
import {
  createRecognitionConfig,
  createRefFromRecognitionConfig,
  deleteRecognitionConfig,
  listArtifacts,
  listRecognitionConfigs,
  listRecognitionPreviewCases,
  previewRecognitionConfig,
  suggestModelRef,
  type RecognitionConfigArtifact,
  type RecognitionConfigBody,
  type RecognitionPreviewCase,
  type RecognitionPreviewResult,
} from "@/api/models";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusTag } from "@/components/common/StatusTag";
import { useTaskContext } from "@/features/tasks/TaskContext";
import { defaultRecognitionConfigName } from "@/features/tasks/taskOptions";
import { truncateDigest } from "@/utils/format";

const CANDIDATE_OPTIONS = [
  { value: "identity", label: "Original image", hint: "Raw cropped frame" },
  {
    value: "otsu_threshold",
    label: "Otsu's thresholding",
    hint: "Optimal global binarization",
    badge: "POPULAR",
  },
  {
    value: "adaptive_threshold",
    label: "Adaptive thresholding",
    hint: "Local neighborhood binarization",
    badge: "POPULAR",
  },
  { value: "clahe", label: "CLAHE contrast", hint: "Adaptive histogram eq." },
  { value: "contrast_stretch", label: "Contrast stretch", hint: "Min-max normalization" },
  {
    value: "morphology_close",
    label: "7-Segment Digital Bridge",
    hint: "Morphological close to connect broken LCD dots",
    badge: "NEW",
  },
  {
    value: "auto_orientation",
    label: "Auto-Orientation",
    hint: "Automatically horizontalizes vertical crops",
    badge: "NEW",
  },
  { value: "invert", label: "Invert (Negative)", hint: "Invert bright/dark for inverted LCDs" },
  { value: "rotate_90", label: "Rotate 90° CW", hint: "Clockwise rotation" },
  { value: "rotate_270", label: "Rotate 270° CW / 90° CCW", hint: "Counter-clockwise rotation" },
  { value: "denoise", label: "Denoise", hint: "Median blur filter" },
  { value: "sharpen", label: "Sharpen", hint: "Unsharp edge enhancement" },
  { value: "grayscale", label: "Grayscale", hint: "Luminance conversion" },
  { value: "resize", label: "Resize", hint: "Scale normalization" },
];

const STRATEGY_OPTIONS = [
  { value: "best_digit_confidence", label: "Best digit confidence (recommended)" },
  { value: "first_valid", label: "First valid" },
  { value: "fixed_single", label: "Fixed single" },
];

const PRESETS = [
  {
    name: "⚡ Otsu & Adaptive",
    tooltip: "Prioritize Otsu global and Adaptive local thresholding for digital odometer clusters",
    candidates: ["identity", "otsu_threshold", "adaptive_threshold", "clahe"],
    adaptive_block_size: 15,
    adaptive_c: 5,
    clahe_clip: 2,
    denoise_strength: 3,
    crop_rotation: "0",
    strategy: "best_digit_confidence",
  },
  {
    name: "🌙 Night & Glare",
    tooltip: "Strong contrast stretch and local adaptive window for low-light or glare-prone images",
    candidates: ["identity", "clahe", "contrast_stretch", "adaptive_threshold"],
    adaptive_block_size: 21,
    adaptive_c: 7,
    clahe_clip: 3.5,
    denoise_strength: 3,
    crop_rotation: "0",
    strategy: "best_digit_confidence",
  },
  {
    name: "✨ Denoise + Sharp",
    tooltip: "Smooth sensor noise and enhance character stroke edges before thresholding",
    candidates: ["identity", "denoise", "sharpen", "otsu_threshold"],
    adaptive_block_size: 15,
    adaptive_c: 5,
    clahe_clip: 2,
    denoise_strength: 6,
    crop_rotation: "0",
    strategy: "best_digit_confidence",
  },
  {
    name: "📟 7-Segment Digital LCD",
    tooltip: "Specially tuned for orange/green LCDs with broken dotted segments & rotation detection",
    candidates: [
      "identity",
      "contrast_stretch",
      "morphology_close",
      "otsu_threshold",
      "adaptive_threshold",
    ],
    adaptive_block_size: 15,
    adaptive_c: 5,
    clahe_clip: 2.5,
    denoise_strength: 2,
    crop_rotation: "auto",
    strategy: "best_digit_confidence",
  },
  {
    name: "🚀 Full Pipeline",
    tooltip: "Test all candidates to select the absolute highest confidence OCR digit reading",
    candidates: [
      "identity",
      "otsu_threshold",
      "adaptive_threshold",
      "clahe",
      "contrast_stretch",
      "morphology_close",
      "denoise",
      "sharpen",
    ],
    adaptive_block_size: 15,
    adaptive_c: 5,
    clahe_clip: 2,
    denoise_strength: 3,
    crop_rotation: "0",
    strategy: "best_digit_confidence",
  },
];

type EditorForm = {
  name: string;
  bump: "major" | "minor" | "patch";
  version?: string;
  strategy: string;
  candidates: string[];
  stop_on_first_valid: boolean;
  clahe_clip: number;
  denoise_strength: number;
  adaptive_block_size: number;
  adaptive_c: number;
  crop_rotation: string;
  padding_ratio: number;
  min_short_side: number;
  reject_too_small: boolean;
  strip_units: boolean;
  digits_only: boolean;
  min_digits: number;
  max_digits: number;
  lookalike: string;
  lang: string;
  use_textline_orientation: boolean;
  use_doc_orientation_classify: boolean;
  use_doc_unwarping: boolean;
  timeout_seconds: number;
  direct_crop_recognition_fallback: boolean;
  text_det_thresh: number;
  text_det_box_thresh: number;
  text_det_unclip_ratio: number;
};

const DEFAULT_FORM_VALUES: EditorForm = {
  name: "odometer-recognition",
  bump: "patch",
  strategy: "best_digit_confidence",
  candidates: ["identity", "otsu_threshold", "adaptive_threshold", "clahe"],
  stop_on_first_valid: false,
  clahe_clip: 2,
  denoise_strength: 3,
  adaptive_block_size: 15,
  adaptive_c: 5,
  crop_rotation: "0",
  padding_ratio: 0.05,
  min_short_side: 24,
  reject_too_small: true,
  strip_units: true,
  digits_only: true,
  min_digits: 1,
  max_digits: 9,
  lookalike: "O:0,I:1,l:1",
  lang: "en",
  use_textline_orientation: true,
  use_doc_orientation_classify: false,
  use_doc_unwarping: false,
  timeout_seconds: 120,
  direct_crop_recognition_fallback: true,
  text_det_thresh: 0.3,
  text_det_box_thresh: 0.6,
  text_det_unclip_ratio: 1.5,
};

interface SliderInputProps {
  value?: number;
  onChange?: (val: number | null) => void;
  min: number;
  max: number;
  step?: number;
  inputWidth?: string;
}

function SliderInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  inputWidth = "w-18",
}: SliderInputProps) {
  const numericVal = typeof value === "number" ? value : min;
  return (
    <div className="flex items-center gap-3">
      <Slider
        min={min}
        max={max}
        step={step}
        className="flex-1 m-0"
        value={numericVal}
        onChange={(v) => onChange?.(v)}
      />
      <InputNumber
        min={min}
        max={max}
        step={step}
        className={inputWidth}
        value={value}
        onChange={(v) => onChange?.(v)}
      />
    </div>
  );
}

function lookalikeToString(map: Record<string, string> | undefined): string {
  if (!map) return "O:0,I:1,l:1";
  return Object.entries(map)
    .map(([k, v]) => `${k}:${v}`)
    .join(",");
}

function parseLookalike(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (raw || "").split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [k, v] = trimmed.split(":");
    if (k && v) out[k] = v;
  }
  return out;
}

function configToForm(
  cfg: RecognitionConfigBody,
  name: string,
): EditorForm {
  const cs = (cfg.candidate_selection || {}) as Record<string, unknown>;
  const ip = (cfg.image_preprocessing || {}) as Record<string, unknown>;
  const cq = (cfg.crop_quality || {}) as Record<string, unknown>;
  const op = (cfg.odometer_postprocess || {}) as Record<string, unknown>;
  const pad = (cfg.paddle || {}) as Record<string, unknown>;
  return {
    name,
    bump: "patch",
    strategy: String(cs.strategy || "best_digit_confidence"),
    candidates: (cs.candidates as string[]) || ["identity", "otsu_threshold", "adaptive_threshold", "clahe"],
    stop_on_first_valid: Boolean(cs.stop_on_first_valid),
    clahe_clip: Number(ip.clahe_clip ?? 2),
    denoise_strength: Number(ip.denoise_strength ?? 3),
    adaptive_block_size: Number(ip.adaptive_block_size ?? 15),
    adaptive_c: Number(ip.adaptive_c ?? 5),
    crop_rotation: String(cq.crop_rotation ?? "0"),
    padding_ratio: Number(cq.padding_ratio ?? 0.05),
    min_short_side: Number(cq.min_short_side ?? 24),
    reject_too_small: cq.reject_too_small !== false,
    strip_units: op.strip_units !== false,
    digits_only: op.digits_only !== false,
    min_digits: Number(op.min_digits ?? 1),
    max_digits: Number(op.max_digits ?? 9),
    lookalike: lookalikeToString(
      op.lookalike_map as Record<string, string> | undefined,
    ),
    lang: String(pad.lang || "en"),
    use_textline_orientation: pad.use_textline_orientation !== false,
    use_doc_orientation_classify: Boolean(pad.use_doc_orientation_classify),
    use_doc_unwarping: Boolean(pad.use_doc_unwarping),
    timeout_seconds: Number(pad.timeout_seconds ?? 120),
    direct_crop_recognition_fallback: pad.direct_crop_recognition_fallback !== false,
    text_det_thresh: Number(pad.text_det_thresh ?? 0.3),
    text_det_box_thresh: Number(pad.text_det_box_thresh ?? 0.6),
    text_det_unclip_ratio: Number(pad.text_det_unclip_ratio ?? 1.5),
  };
}

function formToConfig(values: EditorForm): RecognitionConfigBody {
  return {
    candidate_selection: {
      strategy: values.strategy,
      candidates: values.candidates,
      stop_on_first_valid: values.stop_on_first_valid,
      tie_break: "prefer_earlier_candidate",
    },
    image_preprocessing: {
      clahe_clip: values.clahe_clip,
      denoise_strength: values.denoise_strength,
      adaptive_block_size: values.adaptive_block_size,
      adaptive_c: values.adaptive_c,
    },
    crop_quality: {
      crop_rotation: values.crop_rotation,
      padding_ratio: values.padding_ratio,
      min_short_side: values.min_short_side,
      reject_too_small: values.reject_too_small,
    },
    odometer_postprocess: {
      strip_units: values.strip_units,
      digits_only: values.digits_only,
      min_digits: values.min_digits,
      max_digits: values.max_digits,
      lookalike_map: parseLookalike(values.lookalike),
    },
    paddle: {
      lang: values.lang,
      use_textline_orientation: values.use_textline_orientation,
      use_doc_orientation_classify: values.use_doc_orientation_classify,
      use_doc_unwarping: values.use_doc_unwarping,
      timeout_seconds: values.timeout_seconds,
      direct_crop_recognition_fallback: values.direct_crop_recognition_fallback,
      text_det_thresh: values.text_det_thresh,
      text_det_box_thresh: values.text_det_box_thresh,
      text_det_unclip_ratio: values.text_det_unclip_ratio,
    },
  };
}

function PostprocessTester({
  stripUnits,
  digitsOnly,
  minDigits,
  maxDigits,
  lookalike,
}: {
  stripUnits: boolean;
  digitsOnly: boolean;
  minDigits: number;
  maxDigits: number;
  lookalike: string;
}) {
  const [testInput, setTestInput] = useState("1423 km");
  const lookalikeMap = useMemo(() => parseLookalike(lookalike), [lookalike]);

  const normalized = useMemo(() => {
    let s = testInput;
    if (stripUnits) {
      s = s.replace(/\s*(km\/h|kmh|km|mi\/h|mph|mi|m|k)\b/gi, "");
    }
    const chars = s.split("").map((ch) => lookalikeMap[ch] || ch);
    s = chars.join("");
    if (digitsOnly) {
      s = s.replace(/\D/g, "");
    }
    return s;
  }, [testInput, stripUnits, lookalikeMap, digitsOnly]);

  const isValid =
    normalized.length >= minDigits && normalized.length <= maxDigits;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs">
      <div className="font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
        <span>🧪 Interactive Post-Processing & Normalization Tester</span>
        <span className="text-[11px] text-slate-400">Live preview of validation logic</span>
      </div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Input
          size="small"
          placeholder="Type test text (e.g. 1423 km, E2H1 km, 887510)"
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          className="font-mono text-xs max-w-xs"
        />
        <span className="text-slate-400">→</span>
        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
          {normalized || "(empty)"}
        </span>
        <Tag color={isValid ? "green" : "red"} className="text-[10px] m-0 font-mono">
          {isValid
            ? `VALID (${normalized.length} digits)`
            : `INVALID (${normalized.length} digits)`}
        </Tag>
      </div>
      <div className="text-[11px] text-slate-500">
        Tests lookalike mapping, unit stripping, digit isolation, and length boundaries.
      </div>
    </div>
  );
}

function PreviewVisualImpact({ row }: { row: RecognitionPreviewResult }) {
  const v = row.visuals;
  if (!v) return null;
  const candMeta = new Map(
    (row.candidates || []).map((c) => [String(c.name), c]),
  );
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-start gap-4">
        {v.context_image ? (
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">
              Frame context · <span className="text-red-500 font-semibold">red</span> = detection box ·{" "}
              <span className="text-cyan-600 font-semibold">cyan</span> = padded crop
            </div>
            <img
              src={v.context_image}
              alt="context with boxes"
              className="max-h-36 rounded border border-slate-200 bg-white object-contain shadow-xs"
            />
          </div>
        ) : null}
        {v.crop_image ? (
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">
              Padded crop sent to recognizer
              {v.crop_size
                ? ` (${v.crop_size.width}×${v.crop_size.height}, pad ${v.padding_ratio ?? "—"})`
                : ""}
            </div>
            <img
              src={v.crop_image}
              alt="recognition crop"
              className="max-h-36 rounded border border-slate-200 bg-white object-contain shadow-xs"
            />
          </div>
        ) : null}
      </div>

      {(v.candidate_images || []).length > 0 ? (
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-700">
            <span>Preprocessed candidate variants (what OCR engine sees)</span>
            <span className="text-[11px] text-slate-400">
              · Blue border indicates the winning candidate chosen by selection strategy
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {(v.candidate_images || []).map((c) => {
              const meta = candMeta.get(c.name) || {};
              const text = String(meta.normalized || meta.text || "");
              const conf = meta.confidence;
              const isSelected = c.selected || row.selected_candidate === c.name;
              return (
                <div
                  key={c.name}
                  className={`w-40 rounded-md border p-2 transition-all ${
                    isSelected
                      ? "border-sky-500 bg-sky-50 shadow-sm ring-2 ring-sky-300"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <span className="truncate text-xs font-semibold text-slate-700">
                      {c.name}
                    </span>
                    {isSelected ? (
                      <Tag color="blue" className="m-0 px-1 py-0 text-[10px] leading-tight">
                        WINNER
                      </Tag>
                    ) : null}
                  </div>
                  {c.image ? (
                    <img
                      src={c.image}
                      alt={c.name}
                      className="mb-1 h-18 w-full rounded border border-slate-100 bg-slate-900 object-contain"
                    />
                  ) : (
                    <div className="mb-1 flex h-18 items-center justify-center rounded bg-slate-100 text-[10px] text-red-500">
                      {c.error || "n/a"}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="truncate font-mono font-medium text-slate-800">
                      {text || "(empty)"}
                    </span>
                    <span
                      className={`text-[10px] font-mono ${
                        typeof conf === "number" && conf >= 0.85
                          ? "text-emerald-600 font-semibold"
                          : "text-slate-400"
                      }`}
                    >
                      {typeof conf === "number" ? conf.toFixed(2) : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface RecognitionStudioModalProps {
  open: boolean;
  onClose: () => void;
  cloneFrom: RecognitionConfigArtifact | null;
  defaultConfig?: RecognitionConfigBody | null;
  draftConfig?: RecognitionConfigBody | null;
  activeTaskKey: string;
  onSuccessSave: (created: RecognitionConfigArtifact) => void;
  onOpenBench: (config: RecognitionConfigBody, name: string) => void;
}

function RecognitionStudioModal({
  open,
  onClose,
  cloneFrom,
  defaultConfig,
  draftConfig,
  activeTaskKey,
  onSuccessSave,
  onOpenBench,
}: RecognitionStudioModalProps) {
  const [form] = Form.useForm<EditorForm>();

  // Initialize form when opened or cloneFrom changes
  useEffect(() => {
    if (!open) return;
    const source = draftConfig || cloneFrom?.config || defaultConfig;
    if (source) {
      form.setFieldsValue(
        configToForm(
          source,
          cloneFrom?.name || defaultRecognitionConfigName(activeTaskKey),
        ),
      );
    } else {
      form.setFieldsValue({
        ...DEFAULT_FORM_VALUES,
        name: defaultRecognitionConfigName(activeTaskKey),
      });
    }
  }, [open, draftConfig, cloneFrom, defaultConfig, form, activeTaskKey]);

  const saveMutation = useMutation({
    mutationFn: createRecognitionConfig,
    onSuccess: (created) => {
      onSuccessSave(created);
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  const handleApplyPreset = (preset: (typeof PRESETS)[number]) => {
    form.setFieldsValue({
      candidates: preset.candidates,
      adaptive_block_size: preset.adaptive_block_size,
      adaptive_c: preset.adaptive_c,
      clahe_clip: preset.clahe_clip,
      denoise_strength: preset.denoise_strength,
      strategy: preset.strategy,
    });
    message.info(`Applied preset: ${preset.name}`);
  };

  const currentCandidates = Form.useWatch("candidates", form) || [];
  const watchStripUnits = Form.useWatch("strip_units", form) ?? true;
  const watchDigitsOnly = Form.useWatch("digits_only", form) ?? true;
  const watchMinDigits = Form.useWatch("min_digits", form) ?? 1;
  const watchMaxDigits = Form.useWatch("max_digits", form) ?? 9;
  const watchLookalike = Form.useWatch("lookalike", form) ?? "O:0,I:1,l:1";
  const toggleCandidate = (candName: string) => {
    const next = currentCandidates.includes(candName)
      ? currentCandidates.filter((c: string) => c !== candName)
      : [...currentCandidates, candName];
    if (next.length === 0) {
      message.warning("At least one candidate is required");
      return;
    }
    form.setFieldsValue({ candidates: next });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (values.strategy === "fixed_single" && values.candidates.length !== 1) {
        message.error("Strategy 'fixed_single' requires exactly one candidate");
        return;
      }
      await saveMutation.mutateAsync({
        ocr_type: activeTaskKey,
        name: values.name,
        version: values.version || undefined,
        bump: values.bump,
        config: formToConfig(values),
        clone_from_artifact_id: cloneFrom?.id,
      });
    } catch {
      message.error("Please correct the form fields before saving");
    }
  };

  const handleOpenBench = async () => {
    try {
      const values = await form.validateFields();
      if (values.strategy === "fixed_single" && values.candidates.length !== 1) {
        message.error("Strategy 'fixed_single' requires exactly one candidate");
        return;
      }
      onOpenBench(formToConfig(values), values.name);
    } catch {
      message.error("Please correct the form fields before opening Evaluation Bench");
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <ThunderboltOutlined className="text-base" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-800">
              {cloneFrom
                ? `Clone & Test: ${cloneFrom.name} (v${cloneFrom.version})`
                : "Recognition Config Studio"}
            </div>
            <div className="text-xs font-normal text-slate-500">
              Configure recognition pipeline, Otsu & Adaptive preprocessing, candidates, and post-processing.
            </div>
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={920}
      style={{ top: 24, maxWidth: "96vw" }}
      styles={{
        body: {
          padding: "16px 20px",
          maxHeight: "calc(86vh - 100px)",
          overflowY: "auto",
        },
      }}
      footer={
        <div className="flex items-center justify-between">
          <Button
            icon={<ExperimentOutlined />}
            onClick={handleOpenBench}
            className="border-indigo-300 text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 font-semibold"
          >
            Test in Evaluation Bench →
          </Button>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="primary"
              loading={saveMutation.isPending}
              onClick={handleSave}
            >
              Save Immutable Version
            </Button>
          </Space>
        </div>
      }
    >
      {/* Quick Presets Bar */}
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Quick Presets
          </span>
          <span className="text-[10px] text-slate-400">1-click tuning</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Tooltip key={p.name} title={p.tooltip}>
              <Button
                size="small"
                className="text-xs"
                onClick={() => handleApplyPreset(p)}
              >
                {p.name}
              </Button>
            </Tooltip>
          ))}
        </div>
      </div>

      <Form
        form={form}
        initialValues={DEFAULT_FORM_VALUES}
        layout="vertical"
        size="small"
      >
        {/* Top Identity Card */}
        <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-5">
              <Form.Item
                name="name"
                label="Config Name"
                rules={[{ required: true }]}
                className="mb-0"
              >
                <Input placeholder="e.g. odometer-recognition" />
              </Form.Item>
            </div>
            <div className="col-span-4">
              <Form.Item
                name="bump"
                label="SemVer Bump"
                rules={[{ required: true }]}
                className="mb-0"
              >
                <Select
                  options={[
                    { value: "patch", label: "patch (tune / additive change)" },
                    { value: "minor", label: "minor (candidate / preprocessing change)" },
                    { value: "major", label: "major (breaking pipeline change)" },
                  ]}
                />
              </Form.Item>
            </div>
            <div className="col-span-3">
              <Form.Item
                name="version"
                label="Explicit Version (Optional)"
                className="mb-0"
              >
                <Input placeholder="auto-bump" />
              </Form.Item>
            </div>
          </div>
        </div>

        {/* Sub-Tabs by Work Category */}
        <Tabs
          defaultActiveKey="filters"
          type="card"
          className="recognition-sub-tabs"
          items={[
            {
              key: "filters",
              label: (
                <span className="flex items-center gap-1.5 font-semibold text-xs">
                  <span>🧪</span>
                  <span>Preprocessing & Filters</span>
                </span>
              ),
              children: (
                <div className="space-y-3 pt-1">
                  {/* Candidate Selection & Order */}
                  <Card
                    size="small"
                    title={
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">
                          Preprocessing Candidates & Filter Pipeline
                        </span>
                        <Tag color="cyan" className="m-0 text-[10px]">
                          {currentCandidates.length} Active Candidates
                        </Tag>
                      </div>
                    }
                    className="shadow-2xs"
                  >
                    <Form.Item
                      name="candidates"
                      label="Active Preprocessing Candidates (Evaluated in Order)"
                      rules={[{ required: true, type: "array", min: 1 }]}
                      className="mb-2"
                    >
                      <Select
                        mode="multiple"
                        options={CANDIDATE_OPTIONS.map((c) => ({
                          value: c.value,
                          label: c.badge ? `${c.label} [${c.badge}]` : c.label,
                        }))}
                      />
                    </Form.Item>

                    {/* Fast Click-to-Toggle Chips */}
                    <div className="mb-2">
                      <div className="mb-1 text-[11px] font-medium text-slate-500">
                        1-Click Toggle Candidates:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {CANDIDATE_OPTIONS.map((c) => {
                          const isActive = currentCandidates.includes(c.value);
                          return (
                            <button
                              type="button"
                              key={c.value}
                              onClick={() => toggleCandidate(c.value)}
                              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition-all cursor-pointer ${
                                isActive
                                  ? "bg-sky-600 font-semibold text-white shadow-2xs"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              {isActive && <CheckOutlined className="text-[10px]" />}
                              <span>{c.label}</span>
                              {c.badge && (
                                <span className="rounded bg-amber-400 px-1 py-0 text-[9px] font-bold text-slate-900">
                                  {c.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </Card>

                  {/* Adaptive Thresholding Controls */}
                  <div className="rounded border border-indigo-100 bg-indigo-50/50 p-3 shadow-2xs">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-900">
                        Adaptive Thresholding (Local Window)
                      </span>
                      <Tag color="indigo" className="m-0 text-[10px]">
                        adaptive_threshold
                      </Tag>
                    </div>
                    <div className="text-[11px] text-slate-600 mb-2.5">
                      Calculates localized thresholding per pixel neighborhood. Ideal for uneven lighting, shadows, and glares across dashboard displays.
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Form.Item
                        name="adaptive_block_size"
                        label={
                          <div className="flex items-center justify-between w-full">
                            <span>Block Size (odd window 3–99)</span>
                            <span className="text-[10px] text-slate-400">Must be odd</span>
                          </div>
                        }
                        rules={[
                          { required: true },
                          {
                            validator: (_, value) => {
                              if (
                                value != null &&
                                (value % 2 === 0 || value < 3 || value > 99)
                              ) {
                                return Promise.reject(
                                  new Error("Block size must be an odd integer (3–99)"),
                                );
                              }
                              return Promise.resolve();
                            },
                          },
                        ]}
                        className="mb-0"
                      >
                        <SliderInput min={3} max={99} step={2} inputWidth="w-18" />
                      </Form.Item>

                      <Form.Item
                        name="adaptive_c"
                        label="Adaptive Offset C (-50 to 50)"
                        rules={[{ required: true }]}
                        className="mb-0"
                      >
                        <SliderInput min={-50} max={50} step={0.5} inputWidth="w-18" />
                      </Form.Item>
                    </div>
                  </div>

                  {/* Otsu Global Thresholding Card */}
                  <div className="rounded border border-emerald-100 bg-emerald-50/50 p-3 shadow-2xs">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900">
                        Otsu's Global Thresholding
                      </span>
                      <Tag color="emerald" className="m-0 text-[10px]">
                        otsu_threshold
                      </Tag>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Calculates the global binarization threshold mathematically by maximizing inter-class variance between background cluster and foreground digits. No manual threshold value needed.
                    </div>
                  </div>

                  {/* CLAHE & Denoise Parameters */}
                  <Card size="small" title="Contrast & Denoise Tuning" className="shadow-2xs">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">CLAHE Clip Limit</span>
                          <span className="text-[10px] text-slate-400">Contrast balance</span>
                        </div>
                        <Form.Item name="clahe_clip" className="mb-0">
                          <SliderInput min={0.5} max={40} step={0.5} inputWidth="w-18" />
                        </Form.Item>
                      </div>

                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">Denoise Strength</span>
                          <span className="text-[10px] text-slate-400">Median filter size</span>
                        </div>
                        <Form.Item name="denoise_strength" className="mb-0">
                          <SliderInput min={0} max={30} step={1} inputWidth="w-18" />
                        </Form.Item>
                      </div>
                    </div>
                  </Card>
                </div>
              ),
            },
            {
              key: "geometry",
              label: (
                <span className="flex items-center gap-1.5 font-semibold text-xs">
                  <span>📐</span>
                  <span>Crop Orientation & Geometry</span>
                </span>
              ),
              children: (
                <div className="space-y-3 pt-1">
                  <Alert
                    type="info"
                    showIcon
                    message="Orientation Control for Rotated / Vertical Displays"
                    description="Standard text recognition engines expect horizontal lines of characters. If an odometer crop is vertical (height > width, like 88×254 px clusters), rotate it to horizontal so character strokes can be identified."
                  />

                  <Card size="small" title="Rotation & Alignment" className="shadow-2xs">
                    <Form.Item
                      name="crop_rotation"
                      label="Crop Pre-Rotation Angle"
                      className="mb-2"
                    >
                      <Select
                        options={[
                          { value: "0", label: "0° (Default / Normal Horizontal Reading)" },
                          { value: "auto", label: "auto (Auto-Detect: Rotate 90° CCW if Crop is Vertical)" },
                          { value: "90", label: "90° (Rotate 90° Clockwise)" },
                          { value: "180", label: "180° (Rotate 180° Inverted)" },
                          { value: "270", label: "270° (Rotate 270° CW / 90° CCW)" },
                        ]}
                      />
                    </Form.Item>
                    <div className="text-[11px] text-slate-500">
                      Auto mode inspects aspect ratio: if height &gt; width * 1.25, it rotates 90° counter-clockwise to horizontalize digits.
                    </div>
                  </Card>

                  <Card size="small" title="Crop Margins & Minimum Dimensions" className="shadow-2xs">
                    <Form.Item
                      name="padding_ratio"
                      label="Crop Padding Ratio (0.00 – 0.50)"
                      className="mb-3"
                    >
                      <SliderInput min={0} max={0.5} step={0.01} inputWidth="w-18" />
                    </Form.Item>

                    <div className="grid grid-cols-2 gap-4">
                      <Form.Item
                        name="min_short_side"
                        label="Min Short Side Dimension (px)"
                        className="mb-0"
                      >
                        <InputNumber min={1} max={200} className="w-full" />
                      </Form.Item>
                      <Form.Item
                        name="reject_too_small"
                        label="Reject Crops Below Min Side"
                        valuePropName="checked"
                        className="mb-0"
                      >
                        <Switch />
                      </Form.Item>
                    </div>
                  </Card>
                </div>
              ),
            },
            {
              key: "engine",
              label: (
                <span className="flex items-center gap-1.5 font-semibold text-xs">
                  <span>🧠</span>
                  <span>Engine & Detection Fallbacks</span>
                </span>
              ),
              children: (
                <div className="space-y-3 pt-1">
                  {/* Direct Crop Recognition Fallback Card */}
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 shadow-2xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-amber-900">
                          Direct Crop Recognition Fallback (CRNN Bypass)
                        </span>
                        <Tag color="orange" className="text-[10px]">
                          CRITICAL FOR FAINT LCDs
                        </Tag>
                      </div>
                      <Form.Item
                        name="direct_crop_recognition_fallback"
                        valuePropName="checked"
                        className="mb-0"
                      >
                        <Switch />
                      </Form.Item>
                    </div>
                    <div className="text-[11px] text-amber-800 leading-relaxed">
                      When enabled: If Paddle's DBNet text detector finds 0 text boxes (due to tight crop margins or faint 7-segment dots), the engine falls back to running the recognition model directly on the full crop. Prevents total recognition failure on clear but faint LCD digits.
                    </div>
                  </div>

                  <Card size="small" title="DBNet Text Detection Sensitivity" className="shadow-2xs">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="mb-1 text-xs font-medium text-slate-700">
                          Det DB Thresh (0.05–0.95)
                        </div>
                        <Form.Item name="text_det_thresh" className="mb-0">
                          <SliderInput min={0.05} max={0.95} step={0.05} inputWidth="w-16" />
                        </Form.Item>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-medium text-slate-700">
                          Box Thresh (0.05–0.95)
                        </div>
                        <Form.Item name="text_det_box_thresh" className="mb-0">
                          <SliderInput min={0.05} max={0.95} step={0.05} inputWidth="w-16" />
                        </Form.Item>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-medium text-slate-700">
                          Unclip Ratio (1.0–3.0)
                        </div>
                        <Form.Item name="text_det_unclip_ratio" className="mb-0">
                          <SliderInput min={1.0} max={3.0} step={0.1} inputWidth="w-16" />
                        </Form.Item>
                      </div>
                    </div>
                  </Card>

                  <Card size="small" title="Paddle Runtime Options" className="shadow-2xs">
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <Form.Item name="lang" label="Recognition Language" className="mb-0">
                        <Input placeholder="en" />
                      </Form.Item>
                      <Form.Item name="timeout_seconds" label="Worker Timeout (seconds)" className="mb-0">
                        <InputNumber min={5} max={600} className="w-full" />
                      </Form.Item>
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2">
                      <Form.Item
                        name="use_textline_orientation"
                        label="Textline Orientation"
                        valuePropName="checked"
                        className="mb-0"
                      >
                        <Switch size="small" />
                      </Form.Item>
                      <Form.Item
                        name="use_doc_orientation_classify"
                        label="Doc Orientation Classify"
                        valuePropName="checked"
                        className="mb-0"
                      >
                        <Switch size="small" />
                      </Form.Item>
                      <Form.Item
                        name="use_doc_unwarping"
                        label="Doc Unwarping"
                        valuePropName="checked"
                        className="mb-0"
                      >
                        <Switch size="small" />
                      </Form.Item>
                    </div>
                  </Card>
                </div>
              ),
            },
            {
              key: "strategy",
              label: (
                <span className="flex items-center gap-1.5 font-semibold text-xs">
                  <span>🎯</span>
                  <span>Candidate Strategy & Flow</span>
                </span>
              ),
              children: (
                <div className="space-y-3 pt-1">
                  <Card size="small" title="Candidate Evaluation Logic" className="shadow-2xs">
                    <Form.Item
                      name="strategy"
                      label="Decision Strategy"
                      rules={[{ required: true }]}
                      className="mb-3"
                    >
                      <Select options={STRATEGY_OPTIONS} />
                    </Form.Item>

                    <Form.Item
                      name="stop_on_first_valid"
                      label="Stop on First Valid Candidate"
                      valuePropName="checked"
                      className="mb-0"
                    >
                      <Switch />
                    </Form.Item>
                    <div className="mt-1 text-[11px] text-slate-500">
                      When enabled, stops running remaining candidates as soon as a valid reading passes digit length constraints. Saves CPU/latency.
                    </div>
                  </Card>
                </div>
              ),
            },
            {
              key: "postprocess",
              label: (
                <span className="flex items-center gap-1.5 font-semibold text-xs">
                  <span>✨</span>
                  <span>Post-Processing & Validation</span>
                </span>
              ),
              children: (
                <div className="space-y-3 pt-1">
                  <Card size="small" title="Digit Rules & Unit Stripping" className="shadow-2xs">
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <Form.Item
                        name="strip_units"
                        label="Strip Units (km, mi, mph, etc.)"
                        valuePropName="checked"
                        className="mb-1"
                      >
                        <Switch />
                      </Form.Item>
                      <Form.Item
                        name="digits_only"
                        label="Enforce Digits Only"
                        valuePropName="checked"
                        className="mb-1"
                      >
                        <Switch />
                      </Form.Item>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">Min Digits Length</span>
                        </div>
                        <Form.Item name="min_digits" className="mb-0">
                          <SliderInput min={1} max={12} inputWidth="w-16" />
                        </Form.Item>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">Max Digits Length</span>
                        </div>
                        <Form.Item name="max_digits" className="mb-0">
                          <SliderInput min={1} max={12} inputWidth="w-16" />
                        </Form.Item>
                      </div>
                    </div>

                    <div className="mt-3">
                      <Form.Item
                        name="lookalike"
                        label="Lookalike Character Map (comma-separated Key:Value pairs)"
                        className="mb-0"
                      >
                        <Input placeholder="e.g. O:0,I:1,l:1,E:3,H:4" />
                      </Form.Item>
                      <div className="mt-1 text-[11px] text-slate-400">
                        Map character misrecognitions from 7-segment digital displays (e.g. O to 0, I/l to 1, E to 3, H to 4).
                      </div>
                    </div>
                  </Card>

                  {/* Interactive Live Normalization Tester */}
                  <PostprocessTester
                    stripUnits={watchStripUnits}
                    digitsOnly={watchDigitsOnly}
                    minDigits={watchMinDigits}
                    maxDigits={watchMaxDigits}
                    lookalike={watchLookalike}
                  />
                </div>
              ),
            },
          ]}
        />
      </Form>
    </Modal>
  );
}

interface RecognitionEvaluationBenchDrawerProps {
  open: boolean;
  onClose: () => void;
  config: RecognitionConfigBody | null;
  configName: string;
  activeTaskKey: string;
  cloneFrom?: RecognitionConfigArtifact | null;
  onSuccessSave: (created: RecognitionConfigArtifact) => void;
  onOpenStudio?: () => void;
}

function RecognitionEvaluationBenchDrawer({
  open,
  onClose,
  config,
  configName,
  activeTaskKey,
  cloneFrom,
  onSuccessSave,
  onOpenStudio,
}: RecognitionEvaluationBenchDrawerProps) {
  const [targetKey, setTargetKey] = useState<string>("");
  const [failureFilter, setFailureFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previews, setPreviews] = useState<RecognitionPreviewResult[] | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<
    "all" | "fixed" | "regressed" | "failed" | "correct"
  >("all");

  const selectedEvalId = targetKey.startsWith("eval:")
    ? targetKey.replace("eval:", "")
    : undefined;
  const selectedDatasetId = targetKey.startsWith("ds:")
    ? targetKey.replace("ds:", "")
    : undefined;

  const evalsQuery = useQuery({
    queryKey: ["evaluations", "for-bench", activeTaskKey],
    queryFn: () =>
      listEvaluations({
        ocr_type: activeTaskKey,
        status: "completed",
        limit: 30,
        include_metrics: true,
      }),
    enabled: open,
  });

  const datasetsQuery = useQuery({
    queryKey: ["datasets", "for-bench", activeTaskKey],
    queryFn: () => listDatasets({ ocr_type: activeTaskKey, limit: 30 }),
    enabled: open,
  });

  const selectedEval = useMemo(() => {
    if (!selectedEvalId) return null;
    return (
      evalsQuery.data?.evaluations?.find((e) => e.id === selectedEvalId) || null
    );
  }, [selectedEvalId, evalsQuery.data?.evaluations]);

  const selectedDataset = useMemo(() => {
    if (!selectedDatasetId) return null;
    return (
      datasetsQuery.data?.datasets?.find((d) => d.id === selectedDatasetId) ||
      null
    );
  }, [selectedDatasetId, datasetsQuery.data?.datasets]);

  // Auto-select first target when loaded
  useEffect(() => {
    if (!open) return;
    if (!targetKey) {
      if (evalsQuery.data?.evaluations?.length) {
        setTargetKey(`eval:${evalsQuery.data.evaluations[0].id}`);
      } else if (datasetsQuery.data?.datasets?.length) {
        setTargetKey(`ds:${datasetsQuery.data.datasets[0].id}`);
      }
    }
  }, [open, targetKey, evalsQuery.data, datasetsQuery.data]);

  const casesQuery = useQuery({
    queryKey: [
      "recognition-preview-cases",
      selectedEvalId,
      selectedDatasetId,
      failureFilter,
    ],
    queryFn: () =>
      listRecognitionPreviewCases({
        evaluation_id: selectedEvalId,
        dataset_id: selectedDatasetId,
        failures_only: failureFilter === "failures",
        failure_type: failureFilter,
        limit: 50,
      }),
    enabled: open && Boolean(selectedEvalId || selectedDatasetId),
  });

  const cases = useMemo(
    () => casesQuery.data?.cases || [],
    [casesQuery.data?.cases],
  );

  const failureTypeCounts = casesQuery.data?.failure_type_counts || {};
  const totalCount = casesQuery.data?.total ?? cases.length;
  const failureCount = Object.entries(failureTypeCounts)
    .filter(
      ([k]) =>
        k !== "OK" && k !== "labeled" && k !== "active" && k !== "UNTESTED",
    )
    .reduce((sum, [, v]) => sum + v, 0);
  const okCount =
    failureTypeCounts["OK"] ?? failureTypeCounts["labeled"] ?? 0;

  const availableFailureTypes = useMemo(() => {
    return Object.entries(failureTypeCounts)
      .filter(
        ([k]) =>
          k !== "OK" && k !== "labeled" && k !== "active" && k !== "UNTESTED",
      )
      .map(([type, count]) => ({ type, count }));
  }, [failureTypeCounts]);

  const failureFilterOptions = useMemo(() => {
    const opts = [
      {
        value: "all",
        label: `🎯 All Samples (${totalCount})`,
      },
      {
        value: "failures",
        label: `🔥 All Failures (Hard Cases) (${failureCount > 0 ? failureCount : "Hard cases"})`,
      },
      {
        value: "correct",
        label: `✅ Matches / OK (${okCount})`,
      },
    ];

    Object.entries(failureTypeCounts).forEach(([ft, count]) => {
      if (
        ft !== "OK" &&
        ft !== "labeled" &&
        ft !== "active" &&
        ft !== "UNTESTED"
      ) {
        opts.push({
          value: ft,
          label: `Failure: ${ft} (${count})`,
        });
      }
    });

    return opts;
  }, [failureTypeCounts, totalCount, failureCount, okCount]);

  // Auto-select initial samples for live test
  useEffect(() => {
    if (cases.length > 0 && selectedIds.length === 0) {
      setSelectedIds(cases.slice(0, Math.min(cases.length, 5)).map((c) => c.result_id));
    }
  }, [cases, selectedIds.length]);

  const previewMutation = useMutation({
    mutationFn: (data: {
      config: RecognitionConfigBody;
      result_ids: string[];
      evaluation_id?: string;
      dataset_id?: string;
    }) => previewRecognitionConfig(data),
    onSuccess: (res) => {
      const items = res.previews || [];
      setPreviews(items);
      if (items.length > 0) {
        setExpandedIds([items[0].result_id]);
      }
      message.success(
        `Evaluated ${res.summary?.attempted ?? items.length} samples live`,
      );
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  const runPreview = () => {
    if (!config) {
      message.warning("No configuration provided for preview");
      return;
    }
    if (selectedIds.length === 0) {
      message.warning("Select at least one sample to preview");
      return;
    }
    previewMutation.mutate({
      config,
      result_ids: selectedIds,
      evaluation_id: selectedEvalId,
      dataset_id: selectedDatasetId,
    });
  };

  const previewMetrics = useMemo(() => {
    if (!previews || previews.length === 0) return null;
    let matches = 0;
    let baselineMatches = 0;
    let fixed = 0;
    let regressed = 0;
    let maintained = 0;
    let confSum = 0;

    previews.forEach((p) => {
      const draftText = p.predicted;
      const baseText = p.prior_predicted;
      const draftMatch = Boolean(
        p.matches_gt ?? (draftText != null && draftText === p.ground_truth),
      );
      const baseMatch = Boolean(
        p.prior_correct ?? (baseText != null && baseText === p.ground_truth),
      );
      if (draftMatch) matches += 1;
      if (baseMatch) baselineMatches += 1;
      if (draftMatch && !baseMatch) fixed += 1;
      if (!draftMatch && baseMatch) regressed += 1;
      if (draftMatch && baseMatch) maintained += 1;
      confSum += p.confidence ?? 0;
    });

    const total = previews.length;
    return {
      total,
      matches,
      baselineMatches,
      matchRate: total > 0 ? matches / total : 0,
      baselineMatchRate: total > 0 ? baselineMatches / total : 0,
      fixed,
      regressed,
      maintained,
      failed: total - matches,
      avgConfidence: total > 0 ? confSum / total : 0,
    };
  }, [previews]);

  const filteredPreviews = useMemo(() => {
    if (!previews) return [];
    return previews.filter((p) => {
      const draftText = p.predicted;
      const baseText = p.prior_predicted;
      const draftMatch = Boolean(
        p.matches_gt ?? (draftText != null && draftText === p.ground_truth),
      );
      const baseMatch = Boolean(
        p.prior_correct ?? (baseText != null && baseText === p.ground_truth),
      );
      if (filterMode === "fixed") {
        if (!(draftMatch && !baseMatch)) return false;
      } else if (filterMode === "regressed") {
        if (!(!draftMatch && baseMatch)) return false;
      } else if (filterMode === "failed") {
        if (draftMatch) return false;
      } else if (filterMode === "correct") {
        if (!draftMatch) return false;
      }
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const fname = (p.filename || "").toLowerCase();
        const gt = (p.ground_truth || "").toLowerCase();
        const pred = (draftText || "").toLowerCase();
        if (!fname.includes(q) && !gt.includes(q) && !pred.includes(q)) return false;
      }
      return true;
    });
  }, [previews, filterMode, searchTerm]);

  const filteredCases = useMemo(() => {
    if (!searchTerm) return cases;
    const q = searchTerm.toLowerCase();
    return cases.filter(
      (c) =>
        (c.filename || "").toLowerCase().includes(q) ||
        (c.ground_truth || "").toLowerCase().includes(q),
    );
  }, [cases, searchTerm]);

  const saveMutation = useMutation({
    mutationFn: createRecognitionConfig,
    onSuccess: (created) => {
      onSuccessSave(created);
      onClose();
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  const handleSaveFromBench = async () => {
    if (!config) return;
    await saveMutation.mutateAsync({
      ocr_type: activeTaskKey,
      name: configName,
      bump: "patch",
      config,
      clone_from_artifact_id: cloneFrom?.id,
    });
  };

  const renderPriorPrediction = (
    baseText: string | null | undefined,
    gt: string | null | undefined,
    isCorrect?: boolean | null,
    confidence?: number | null,
    failureType?: string | null,
  ) => {
    const hasText = baseText !== null && baseText !== undefined && baseText !== "";
    if (hasText) {
      const match = Boolean(isCorrect ?? (gt != null && baseText === gt));
      return (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`font-mono text-xs px-1.5 py-0.5 rounded border ${
                match
                  ? "text-emerald-700 font-semibold bg-emerald-50 border-emerald-200"
                  : "text-rose-600 font-medium bg-rose-50 border-rose-200 line-through"
              }`}
            >
              {baseText}
            </span>
            {typeof confidence === "number" && (
              <span className="text-[10px] text-slate-400 font-mono">
                ({confidence.toFixed(2)})
              </span>
            )}
          </div>
          {!match && (
            <span className="text-[10px] text-rose-500 font-mono">
              (baseline miss)
            </span>
          )}
        </div>
      );
    }

    const ftUpper = (failureType || "").toUpperCase();
    const isDetFail = ftUpper.includes("DETECTION");
    const isEvaluated = Boolean(
      selectedEvalId ||
        (isCorrect !== null && isCorrect !== undefined) ||
        (failureType &&
          failureType !== "active" &&
          failureType !== "UNTESTED" &&
          failureType !== "sample"),
    );

    if (isEvaluated) {
      return (
        <div className="flex flex-col gap-0.5">
          <Tag
            color={isDetFail ? "magenta" : "error"}
            className="font-mono text-xs font-semibold m-0 w-fit"
          >
            {isDetFail ? "🎯 None (Detection Miss)" : "❌ None (Recognition Failed)"}
          </Tag>
          <span className="text-[10px] text-slate-400 italic">
            {isDetFail ? "No bounding box detected" : "0 digits extracted by baseline"}
          </span>
        </div>
      );
    }

    return <span className="text-slate-400 text-xs italic">— (Not evaluated)</span>;
  };

  const renderFailureStatus = (
    ft?: string | null,
    isCorrect?: boolean | null,
    failStage?: string | null,
    errorType?: string | null,
  ) => {
    if (isCorrect === true || ft === "OK" || ft === "MATCH") {
      return (
        <Tag color="green" className="text-xs font-mono font-semibold m-0">
          ✅ OK / MATCH
        </Tag>
      );
    }

    const ftUpper = (ft || "").toUpperCase();
    const isEvaluated = Boolean(
      selectedEvalId ||
        (isCorrect !== null && isCorrect !== undefined) ||
        (ft &&
          ft !== "active" &&
          ft !== "UNTESTED" &&
          ft !== "sample" &&
          ft !== "labeled"),
    );

    if (isEvaluated) {
      let color: "error" | "volcano" | "magenta" | "orange" = "volcano";
      let icon = "❌";
      if (ftUpper.includes("RECOGNITION")) {
        color = "error";
        icon = "❌";
      } else if (ftUpper.includes("DETECTION")) {
        color = "magenta";
        icon = "🎯";
      } else if (ftUpper.includes("CONFIDENCE") || ftUpper.includes("DIGIT_COUNT")) {
        color = "orange";
        icon = "⚠️";
      }

      return (
        <div className="flex flex-col gap-0.5">
          <Tag color={color} className="text-xs font-mono font-bold m-0 w-fit">
            {icon} {ft || "MISMATCH"}
          </Tag>
          {(failStage || errorType) && (
            <span className="text-[10px] text-slate-400 font-mono">
              {failStage ? `stage: ${failStage}` : errorType}
            </span>
          )}
        </div>
      );
    }

    return (
      <Tag className="text-xs font-mono text-slate-400 m-0">
        UNTESTED
      </Tag>
    );
  };

  const caseColumns: ColumnsType<RecognitionPreviewCase> = [
    {
      title: "Sample",
      key: "sample",
      width: 140,
      render: (_, r) => (
        <div>
          <div className="font-mono text-xs font-semibold text-slate-800 truncate" title={r.filename || r.result_id}>
            {r.filename || r.result_id.slice(0, 8)}
          </div>
          <div className="text-[10px] text-slate-400">
            Box: {r.bbox ? (Array.isArray(r.bbox) ? r.bbox.map(Math.round).join(",") : `${Math.round(r.bbox.x1)},${Math.round(r.bbox.y1)},${Math.round(r.bbox.x2)},${Math.round(r.bbox.y2)}`) : "—"}
          </div>
        </div>
      ),
    },
    {
      title: "Ground Truth (GT)",
      dataIndex: "ground_truth",
      width: 130,
      render: (gt) => (
        <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
          {gt || "(empty)"}
        </span>
      ),
    },
    {
      title: "Evaluation Predicted",
      key: "evaluation_predicted",
      width: 180,
      render: (_, r) =>
        renderPriorPrediction(
          r.predicted,
          r.ground_truth,
          r.is_correct,
          r.confidence,
          r.failure_type,
        ),
    },
    {
      title: "Original Evaluation Status",
      dataIndex: "failure_type",
      width: 170,
      render: (ft, r) =>
        renderFailureStatus(ft, r.is_correct, r.fail_stage, r.error_type),
    },
    {
      title: "Current Config Predicted",
      key: "current_predicted",
      width: 170,
      render: () => (
        <span className="text-slate-400 text-xs italic bg-slate-50 px-2 py-0.5 rounded border border-dashed border-slate-300">
          Pending Live Test (Select & Run)
        </span>
      ),
    },
  ];

  const previewColumns: ColumnsType<RecognitionPreviewResult> = [
    {
      title: "Sample",
      key: "sample",
      width: 130,
      render: (_, r) => (
        <div>
          <div className="font-mono text-xs font-semibold text-slate-800 truncate" title={r.filename || r.result_id}>
            {r.filename || r.result_id.slice(0, 8)}
          </div>
          <div className="text-[10px] text-slate-400">
            Box: {r.bbox ? (Array.isArray(r.bbox) ? r.bbox.map(Math.round).join(",") : `${Math.round(r.bbox.x1)},${Math.round(r.bbox.y1)},${Math.round(r.bbox.x2)},${Math.round(r.bbox.y2)}`) : "—"}
          </div>
        </div>
      ),
    },
    {
      title: "Ground Truth (GT)",
      dataIndex: "ground_truth",
      width: 130,
      render: (gt) => (
        <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
          {gt || "(empty)"}
        </span>
      ),
    },
    {
      title: "Evaluation Predicted",
      key: "evaluation_predicted",
      width: 180,
      render: (_, r) =>
        renderPriorPrediction(
          r.prior_predicted,
          r.ground_truth,
          r.prior_correct,
          r.prior_confidence,
          r.failure_type,
        ),
    },
    {
      title: "Original Evaluation Status",
      key: "evaluation_status",
      width: 170,
      render: (_, r) =>
        renderFailureStatus(
          r.failure_type,
          r.prior_correct,
          r.fail_stage,
          r.error_type,
        ),
    },
    {
      title: "Current Config Predicted",
      key: "current_predicted",
      width: 180,
      render: (_, r) => {
        if (!r.ok) {
          return (
            <span className="text-rose-600 text-xs italic font-medium">
              ❌ {r.error || "Preview failed"}
            </span>
          );
        }
        const draftText = r.predicted;
        const match = Boolean(r.matches_gt ?? (draftText != null && draftText === r.ground_truth));
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                match
                  ? "text-emerald-800 bg-emerald-50 border-emerald-300 shadow-2xs"
                  : "text-rose-700 bg-rose-50 border-rose-300"
              }`}
            >
              {draftText || "(empty)"}
            </span>
            {typeof r.confidence === "number" && (
              <span className="text-[10px] text-slate-400 font-mono">
                ({r.confidence.toFixed(2)})
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: "Impact / Delta",
      key: "status",
      width: 155,
      render: (_, r) => {
        if (!r.ok) {
          return <Tag color="error" className="text-xs">Error</Tag>;
        }
        const draftText = r.predicted;
        const baseText = r.prior_predicted;
        const dMatch = Boolean(r.matches_gt ?? (draftText != null && draftText === r.ground_truth));
        const bMatch = Boolean(r.prior_correct ?? (baseText != null && baseText === r.ground_truth));
        const hasBaseline = selectedEvalId || r.prior_correct !== undefined || Boolean(r.prior_predicted);

        if (hasBaseline) {
          if (dMatch && !bMatch) {
            return (
              <Tag color="cyan" className="font-semibold text-xs border-cyan-400">
                ✨ Fixed Prior Miss
              </Tag>
            );
          }
          if (dMatch && bMatch) {
            return (
              <Tag color="green" className="text-xs">
                ✅ Maintained Match
              </Tag>
            );
          }
          if (!dMatch && bMatch) {
            return (
              <Tag color="red" className="font-semibold text-xs border-rose-400">
                ⚠️ Regressed
              </Tag>
            );
          }
          return (
            <Tag color="volcano" className="text-xs">
              ❌ Still Incorrect
            </Tag>
          );
        }
        return dMatch ? (
          <Tag color="green" className="text-xs">✅ Match</Tag>
        ) : (
          <Tag color="orange" className="text-xs">❌ Miss</Tag>
        );
      },
    },
    {
      title: "Winning Preprocess",
      dataIndex: "selected_candidate",
      width: 145,
      render: (cand) => (
        <Tag
          color={cand?.includes("threshold") ? "cyan" : "blue"}
          className="font-mono text-xs"
        >
          {cand || "—"}
        </Tag>
      ),
    },
  ];

  return (
    <Drawer
      title={
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <ExperimentOutlined />
            </div>
            <div>
              <div className="font-bold text-slate-800 text-sm">
                Recognition Evaluation Bench
              </div>
              <div className="text-[11px] font-normal text-slate-500">
                Live sample evaluation for <span className="font-mono font-semibold text-indigo-700">{configName}</span>
              </div>
            </div>
          </div>
          {onOpenStudio && (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={onOpenStudio}
              className="text-xs font-medium"
            >
              Edit in Studio
            </Button>
          )}
        </div>
      }
      open={open}
      onClose={onClose}
      width={1060}
      placement="right"
      styles={{
        body: {
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
      }}
      footer={
        <div className="flex items-center justify-between">
          <Button icon={<EditOutlined />} onClick={onOpenStudio}>
            Back to Studio
          </Button>
          <Space>
            <Button onClick={onClose}>Close Bench</Button>
            <Button
              type="primary"
              loading={saveMutation.isPending}
              onClick={handleSaveFromBench}
            >
              Save Immutable Version
            </Button>
          </Space>
        </div>
      }
    >
      {/* Top Control Bar */}
      <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 shadow-2xs">
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-5">
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Target Evaluation or Dataset</span>
              <span className="text-[11px] text-slate-400">Real crops</span>
            </div>
            <Select
              className="w-full"
              showSearch
              optionFilterProp="label"
              placeholder="Select completed evaluation run or dataset"
              value={targetKey}
              onChange={(v) => {
                setTargetKey(v);
                setSelectedIds([]);
                setPreviews(null);
              }}
              options={[
                {
                  label: "Completed Evaluation Runs",
                  options: (evalsQuery.data?.evaluations ?? []).map((e) => ({
                    value: `eval:${e.id}`,
                    label: `Eval: ${e.dataset_name || "dataset"} ${e.dataset_version || ""} · ${e.model_ref || "ref"} · ${dayjs(e.created_at).format("MM-DD HH:mm")}`,
                  })),
                },
                {
                  label: "Evaluation Datasets (Verified Labeled Data)",
                  options: (datasetsQuery.data?.datasets ?? []).map((d) => ({
                    value: `ds:${d.id}`,
                    label: `Dataset: ${d.name} ${d.version ? `v${d.version}` : ""}`,
                  })),
                },
              ]}
            />
          </div>

          <div className="col-span-4">
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Sample Data / Failure Filter</span>
              <span className="text-[11px] text-slate-400">Flexibility</span>
            </div>
            <Select
              className="w-full"
              value={failureFilter}
              onChange={(val) => {
                setFailureFilter(val);
                setSelectedIds([]);
              }}
              options={failureFilterOptions}
            />
          </div>

          <div className="col-span-3 flex items-center justify-end">
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              size="middle"
              loading={previewMutation.isPending}
              disabled={(!selectedEvalId && !selectedDatasetId) || selectedIds.length === 0}
              onClick={runPreview}
              className="bg-indigo-600 hover:bg-indigo-500 font-semibold w-full"
            >
              Run Live Test ({selectedIds.length})
            </Button>
          </div>
        </div>

        {/* Quick Failure Type Filter Pills */}
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap border-t border-slate-200/60 pt-2 text-xs">
          <span className="font-semibold text-slate-500 mr-1 text-[11px] uppercase tracking-wider">
            Failure Cohorts:
          </span>
          <button
            type="button"
            onClick={() => {
              setFailureFilter("all");
              setSelectedIds([]);
            }}
            className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs transition-all ${
              failureFilter === "all"
                ? "bg-slate-800 text-white shadow-xs font-semibold"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 font-medium"
            }`}
          >
            🎯 All ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setFailureFilter("failures");
              setSelectedIds([]);
            }}
            className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs transition-all ${
              failureFilter === "failures"
                ? "bg-rose-600 text-white shadow-xs font-semibold"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-medium"
            }`}
          >
            🔥 All Failures ({failureCount})
          </button>
          {availableFailureTypes.map(({ type, count }) => {
            const isSelected = failureFilter.toUpperCase() === type.toUpperCase();
            let colorClass =
              "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 font-medium";
            let activeColorClass =
              "bg-amber-600 text-white shadow-xs font-semibold";
            if (type.toUpperCase().includes("RECOGNITION")) {
              colorClass =
                "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 font-medium";
              activeColorClass =
                "bg-rose-600 text-white shadow-xs font-semibold";
            } else if (type.toUpperCase().includes("DETECTION")) {
              colorClass =
                "bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 font-medium";
              activeColorClass =
                "bg-purple-600 text-white shadow-xs font-semibold";
            } else if (type.toUpperCase().includes("MISMATCH")) {
              colorClass =
                "bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100 font-medium";
              activeColorClass =
                "bg-orange-600 text-white shadow-xs font-semibold";
            }
            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setFailureFilter(type);
                  setSelectedIds([]);
                }}
                className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs transition-all ${
                  isSelected ? activeColorClass : colorClass
                }`}
              >
                {type} ({count})
              </button>
            );
          })}
          {okCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setFailureFilter("correct");
                setSelectedIds([]);
              }}
              className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs transition-all ${
                failureFilter === "correct"
                  ? "bg-emerald-600 text-white shadow-xs font-semibold"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-medium"
              }`}
            >
              ✅ OK ({okCount})
            </button>
          )}
        </div>

        {/* Quick Sample Selector Bar */}
        <div className="mt-2.5 flex items-center justify-between border-t border-slate-200/60 pt-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Quick Pick:</span>
            <Button
              size="small"
              onClick={() => setSelectedIds(cases.slice(0, 5).map((c) => c.result_id))}
            >
              Pick 5
            </Button>
            <Button
              size="small"
              onClick={() => setSelectedIds(cases.slice(0, 10).map((c) => c.result_id))}
            >
              Pick 10
            </Button>
            <Button
              size="small"
              onClick={() => setSelectedIds(cases.slice(0, 20).map((c) => c.result_id))}
            >
              Pick 20
            </Button>
            <Button
              size="small"
              onClick={() => setSelectedIds(cases.slice(0, 20).map((c) => c.result_id))}
            >
              Select All
            </Button>
            {selectedIds.length > 0 && (
              <Button size="small" type="text" danger onClick={() => setSelectedIds([])}>
                Clear
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Input.Search
              placeholder="Filter by filename, GT, or failure"
              size="small"
              className="w-56"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
            />
            <span className="font-mono text-[11px] text-slate-500">
              {selectedIds.length}/20 selected ({cases.length} available)
            </span>
          </div>
        </div>
      </div>

      {/* Selected Target Overview Banner */}
      {selectedEval && (
        <div className="mb-3 rounded-lg border border-indigo-100 bg-linear-to-r from-slate-50 via-indigo-50/20 to-slate-50 p-3 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100/70 pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700">Original Evaluation Run:</span>
              <Tag
                color={
                  selectedEval.status === "completed"
                    ? "green"
                    : selectedEval.status === "failed"
                    ? "red"
                    : selectedEval.status === "running"
                    ? "processing"
                    : "default"
                }
                className="font-mono text-xs uppercase font-bold"
              >
                Status: {selectedEval.status}
              </Tag>
              <Tag color="blue" className="font-mono text-xs font-semibold">
                Model: {selectedEval.model_ref || "Baseline"}
              </Tag>
              {selectedEval.dataset_name && (
                <Tag color="geekblue" className="text-xs">
                  Dataset: {selectedEval.dataset_name} {selectedEval.dataset_version ? `v${selectedEval.dataset_version}` : ""}
                </Tag>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              Evaluated: {dayjs(selectedEval.created_at).format("YYYY-MM-DD HH:mm")} · ID: {selectedEval.id.slice(0, 8)}
            </div>
          </div>
          <div className="mt-2.5 grid grid-cols-4 gap-2.5 text-center text-xs">
            <div className="rounded-md bg-white p-2 border border-slate-200/70 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">Baseline Exact Match</div>
              <div className="text-base font-bold text-slate-800">
                {selectedEval.metrics?.exact_match_accuracy != null
                  ? `${(selectedEval.metrics.exact_match_accuracy * 100).toFixed(1)}%`
                  : "—"}
              </div>
            </div>
            <div className="rounded-md bg-white p-2 border border-slate-200/70 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">End-to-End Acc</div>
              <div className="text-base font-bold text-slate-800">
                {selectedEval.metrics?.end_to_end_accuracy != null
                  ? `${(selectedEval.metrics.end_to_end_accuracy * 100).toFixed(1)}%`
                  : "—"}
              </div>
            </div>
            <div className="rounded-md bg-white p-2 border border-slate-200/70 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">Recognition Success</div>
              <div className="text-base font-bold text-slate-800">
                {selectedEval.metrics?.recognition_success_rate != null
                  ? `${(selectedEval.metrics.recognition_success_rate * 100).toFixed(1)}%`
                  : "—"}
              </div>
            </div>
            <div className="rounded-md bg-white p-2 border border-slate-200/70 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">Evaluation Samples</div>
              <div className="text-base font-bold text-slate-800">
                {selectedEval.total_samples} total ({cases.length} in view)
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedDataset && !selectedEval && (
        <div className="mb-3 rounded-lg border border-cyan-100 bg-cyan-50/30 p-2.5 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Target Dataset:</span>
            <Tag color="cyan" className="font-semibold text-xs">
              {selectedDataset.name} {selectedDataset.version ? `v${selectedDataset.version}` : ""}
            </Tag>
            <Tag color="purple" className="text-xs">
              {selectedDataset.sample_count} Samples
            </Tag>
          </div>
          <span className="text-[11px] text-slate-500 italic">
            Direct Dataset Mode (Ground Truth verified; run live test to evaluate recognition config)
          </span>
        </div>
      )}

      {/* Live Metrics Banner if tested */}
      {previewMetrics ? (
        <div className="mb-3 space-y-2">
          <div className="rounded-lg border border-slate-200 bg-linear-to-r from-slate-50 to-indigo-50/40 p-3 shadow-2xs">
            <div className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-3 border-r border-slate-200 pr-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Draft Match Rate
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-800">
                    {(previewMetrics.matchRate * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs text-slate-500">
                    ({previewMetrics.matches} / {previewMetrics.total} match GT)
                  </span>
                </div>
                <Progress
                  percent={Math.round(previewMetrics.matchRate * 100)}
                  size="small"
                  strokeColor={previewMetrics.matchRate >= 0.8 ? "#10b981" : "#f59e0b"}
                  showInfo={false}
                  className="m-0"
                />
              </div>

              <div className="col-span-6 flex items-center justify-around gap-2 px-2">
                <div className="text-center">
                  <div className="text-xs text-slate-500">Fixed Prior Misses</div>
                  <div className="flex items-center justify-center gap-1 text-lg font-bold text-emerald-600">
                    <ArrowUpOutlined />
                    <span>+{previewMetrics.fixed}</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500">Regressions</div>
                  <div className="flex items-center justify-center gap-1 text-lg font-bold text-rose-500">
                    <CloseCircleOutlined />
                    <span>{previewMetrics.regressed}</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500">Maintained OK</div>
                  <div className="flex items-center justify-center gap-1 text-lg font-bold text-sky-600">
                    <CheckCircleOutlined />
                    <span>{previewMetrics.maintained}</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500">Avg Confidence</div>
                  <div className="text-lg font-bold text-slate-700">
                    {previewMetrics.avgConfidence.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="col-span-3 border-l border-slate-200 pl-3">
                {previewMetrics.fixed > 0 && previewMetrics.regressed === 0 ? (
                  <div className="text-xs font-medium text-emerald-700 leading-tight">
                    🎉 Excellent! +{previewMetrics.fixed} hard cases resolved with zero regressions.
                  </div>
                ) : previewMetrics.regressed > 0 ? (
                  <div className="text-xs font-medium text-amber-700 leading-tight">
                    ⚠️ {previewMetrics.regressed} regression(s) detected. Adjust block size or candidates.
                  </div>
                ) : (
                  <div className="text-xs font-medium text-slate-600 leading-tight">
                    Draft evaluated. Expand rows to compare candidate visuals side-by-side.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center justify-between">
            <Radio.Group
              size="small"
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
            >
              <Radio.Button value="all">All Tested ({previewMetrics.total})</Radio.Button>
              <Radio.Button value="fixed">
                ✨ Fixed ({previewMetrics.fixed})
              </Radio.Button>
              <Radio.Button value="regressed">
                ⚠️ Regressed ({previewMetrics.regressed})
              </Radio.Button>
              <Radio.Button value="failed">
                ❌ Failing ({previewMetrics.failed})
              </Radio.Button>
              <Radio.Button value="correct">
                ✅ Matches ({previewMetrics.matches})
              </Radio.Button>
            </Radio.Group>
            <span className="text-[11px] text-slate-400">
              Showing {filteredPreviews.length} items
            </span>
          </div>
        </div>
      ) : null}

      {/* Table Area */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {previews ? (
          <Table
            size="small"
            rowKey="result_id"
            dataSource={filteredPreviews}
            columns={previewColumns}
            pagination={false}
            scroll={{ y: "calc(86vh - 360px)" }}
            expandable={{
              expandedRowKeys: expandedIds,
              onExpandedRowsChange: (keys) => setExpandedIds(keys as string[]),
              expandedRowRender: (record) => <PreviewVisualImpact row={record} />,
              rowExpandable: (record) => Boolean(record.visuals),
            }}
            locale={{
              emptyText: "No results matching current filter",
            }}
          />
        ) : (
          <div className="flex h-full flex-col">
            <Alert
              type="info"
              showIcon
              className="mb-2"
              message="Select evaluation cases and click 'Run Live Test'"
              description="No re-detection needed — crops are processed with Otsu, Adaptive thresholding, and your draft settings to give immediate visual feedback."
            />
            <div className="flex-1 min-h-0">
              <Table
                size="small"
                rowKey="result_id"
                loading={casesQuery.isLoading || casesQuery.isFetching}
                dataSource={filteredCases}
                columns={caseColumns}
                pagination={false}
                scroll={{ y: "calc(86vh - 350px)" }}
                rowSelection={{
                  selectedRowKeys: selectedIds,
                  onChange: (keys) => setSelectedIds((keys as string[]).slice(0, 20)),
                  getCheckboxProps: (record) => ({
                    disabled:
                      selectedIds.length >= 20 &&
                      !selectedIds.includes(record.result_id),
                  }),
                  preserveSelectedRowKeys: true,
                }}
                locale={{
                  emptyText: selectedEvalId || selectedDatasetId
                    ? "No samples matching filters in this target"
                    : "Select an evaluation run or dataset above",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

export function RecognitionConfigsPage() {
  const { activeTaskKey } = useTaskContext();
  const queryClient = useQueryClient();
  const [studioOpen, setStudioOpen] = useState(false);
  const [benchOpen, setBenchOpen] = useState(false);
  const [benchConfig, setBenchConfig] = useState<RecognitionConfigBody | null>(null);
  const [benchConfigName, setBenchConfigName] = useState<string>("odometer-recognition");
  const [cloneFrom, setCloneFrom] = useState<RecognitionConfigArtifact | null>(null);
  const [savedArtifact, setSavedArtifact] = useState<RecognitionConfigArtifact | null>(null);
  const [refOpen, setRefOpen] = useState(false);
  const [refForm] = Form.useForm<{
    detection_artifact_id: string;
    activate: boolean;
    set_default: boolean;
  }>();

  const query = useQuery({
    queryKey: ["models", "recognition-configs", activeTaskKey],
    queryFn: () =>
      listRecognitionConfigs({ ocr_type: activeTaskKey, limit: 100 }),
  });

  const detectionQuery = useQuery({
    queryKey: ["models", "artifacts", "detection", "for-recog-ref", activeTaskKey],
    queryFn: () =>
      listArtifacts({
        ocr_type: activeTaskKey,
        role: "detection",
        include_metrics: false,
        limit: 200,
      }),
    enabled: refOpen,
  });

  const refMutation = useMutation({
    mutationFn: createRefFromRecognitionConfig,
    onSuccess: async (ref) => {
      message.success(
        `Model ref ${ref.model_ref} ${ref.status === "active" ? "activated" : "created"}`,
      );
      setRefOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["models", "refs"] });
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  const refSuggestQuery = useQuery({
    queryKey: ["models", "refs", "suggest", activeTaskKey, refOpen],
    queryFn: () => suggestModelRef(activeTaskKey),
    enabled: refOpen,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRecognitionConfig(id),
    onSuccess: async (result) => {
      if (result.deleted) {
        message.success(`Deleted ${result.name} v${result.version}`);
      } else if (result.retired) {
        message.warning(
          result.message ||
            `Retired ${result.name} v${result.version} — still referenced elsewhere`,
        );
      } else {
        message.info(result.message || "Recognition config removed");
      }
      await queryClient.invalidateQueries({
        queryKey: ["models", "recognition-configs"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["models", "artifacts"],
      });
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  const handleSavedSuccess = async (created: RecognitionConfigArtifact) => {
    message.success(`Saved ${created.name} v${created.version} (immutable)`);
    setSavedArtifact(created);
    setStudioOpen(false);
    await queryClient.invalidateQueries({
      queryKey: ["models", "recognition-configs"],
    });
    await queryClient.invalidateQueries({
      queryKey: ["models", "artifacts"],
    });
  };

  const columns: ColumnsType<RecognitionConfigArtifact> = useMemo(
    () => [
      {
        title: "Name / version",
        key: "nv",
        render: (_, r) => {
          const cfg = (r.config || {}) as Record<string, unknown>;
          const cs = (cfg.candidate_selection || {}) as Record<string, unknown>;
          const cands = (cs.candidates as string[]) || [];
          return (
            <div>
              <div className="font-semibold text-slate-800">
                {r.name} <span className="text-slate-500 font-normal">v{r.version}</span>
              </div>
              <div className="text-xs text-slate-400">
                {r.pipeline_impl_version || "—"} · {r.selection_strategy || "—"}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {cands.map((c) => (
                  <Tag
                    key={c}
                    color={c.includes("threshold") ? "cyan" : "default"}
                    className="m-0 text-[10px]"
                  >
                    {c}
                  </Tag>
                ))}
              </div>
            </div>
          );
        },
      },
      {
        title: "Status",
        dataIndex: "status",
        width: 120,
        render: (s: string) => <StatusTag status={s} />,
      },
      {
        title: "Preprocessing Details",
        key: "params",
        width: 220,
        render: (_, r) => {
          const cfg = (r.config || {}) as Record<string, unknown>;
          const ip = (cfg.image_preprocessing || {}) as Record<string, unknown>;
          return (
            <div className="text-xs text-slate-600 space-y-0.5">
              <div>Adaptive block: <span className="font-mono">{String(ip.adaptive_block_size ?? 15)}</span> · C: <span className="font-mono">{String(ip.adaptive_c ?? 5)}</span></div>
              <div>CLAHE clip: <span className="font-mono">{String(ip.clahe_clip ?? 2)}</span> · Denoise: <span className="font-mono">{String(ip.denoise_strength ?? 3)}</span></div>
            </div>
          );
        },
      },
      {
        title: "Digest",
        dataIndex: "artifact_digest",
        width: 130,
        render: (d: string) => (
          <Tooltip title={d}>
            <span className="font-mono text-xs text-slate-600">{truncateDigest(d)}</span>
          </Tooltip>
        ),
      },
      {
        title: "Last eval link",
        key: "eval",
        width: 140,
        render: (_, r) => {
          const id = r.evaluation_linkage?.last_evaluation_id;
          if (!id) return <span className="text-slate-400">—</span>;
          return (
            <Tooltip title="Navigation shortcut — not performance source of truth">
              <Link
                to="/evaluation/runs"
                className="font-mono text-xs text-sky-700"
              >
                {id.slice(0, 8)}…
              </Link>
            </Tooltip>
          );
        },
      },
      {
        title: "Created",
        dataIndex: "created_at",
        width: 130,
        render: (v: string | null) =>
          v ? dayjs(v).format("YYYY-MM-DD HH:mm") : "—",
      },
      {
        title: "Actions",
        key: "actions",
        width: 380,
        render: (_, r) => (
          <Space size="small" wrap>
            <Button
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => {
                setCloneFrom(r);
                setBenchConfig(r.config as RecognitionConfigBody);
                setBenchConfigName(r.name);
                setStudioOpen(true);
              }}
            >
              Clone & Tune
            </Button>
            <Button
              size="small"
              icon={<ExperimentOutlined />}
              onClick={() => {
                setCloneFrom(r);
                setBenchConfig(r.config as RecognitionConfigBody);
                setBenchConfigName(r.name);
                setBenchOpen(true);
              }}
            >
              Evaluation Bench
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={() => {
                setSavedArtifact(r);
                setRefOpen(true);
                refForm.setFieldsValue({
                  activate: true,
                  set_default: false,
                });
              }}
            >
              Create model ref
            </Button>
            <Button
              size="small"
              danger
              loading={
                deleteMutation.isPending && deleteMutation.variables === r.id
              }
              onClick={() => {
                Modal.confirm({
                  title: "Delete recognition config?",
                  content: `Permanently deletes ${r.name} v${r.version}. Blocked if a pipeline ref, evaluation, or training run still references it.`,
                  okText: "Delete forever",
                  okButtonProps: { danger: true },
                  onOk: () => deleteMutation.mutateAsync(r.id),
                });
              }}
            >
              Delete
            </Button>
          </Space>
        ),
      },
    ],
    [deleteMutation.isPending, deleteMutation.variables, refForm],
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: "Dashboard", path: "/" },
          { title: "Models", path: "/models/list" },
          { title: "Recognition configs" },
        ]}
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setCloneFrom(null);
              setBenchConfig(null);
              setBenchConfigName(defaultRecognitionConfigName(activeTaskKey));
              setStudioOpen(true);
            }}
          >
            New config version
          </Button>
        }
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-6">
        {savedArtifact ? (
          <Alert
            type="success"
            showIcon
            closable
            onClose={() => setSavedArtifact(null)}
            message={`Ready: ${savedArtifact.name} v${savedArtifact.version}`}
            description="Recognition configuration successfully created. Connect it with a detection model to create an active model reference."
            action={
              <Space>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => {
                    setRefOpen(true);
                    refForm.setFieldsValue({
                      activate: true,
                      set_default: false,
                    });
                  }}
                >
                  Create model ref
                </Button>
                <Link to="/evaluation/runs">
                  <Button size="small" icon={<ExperimentOutlined />}>
                    Evaluate
                  </Button>
                </Link>
              </Space>
            }
          />
        ) : null}

        <Table
          rowKey="id"
          loading={query.isLoading || query.isFetching}
          dataSource={query.data?.configs ?? []}
          columns={columns}
          pagination={{ pageSize: 20 }}
        />
      </div>

      <RecognitionStudioModal
        open={studioOpen}
        onClose={() => setStudioOpen(false)}
        cloneFrom={cloneFrom}
        defaultConfig={query.data?.defaults}
        draftConfig={benchConfig}
        activeTaskKey={activeTaskKey}
        onSuccessSave={handleSavedSuccess}
        onOpenBench={(cfg, name) => {
          setBenchConfig(cfg);
          setBenchConfigName(name);
          setStudioOpen(false);
          setBenchOpen(true);
        }}
      />

      <RecognitionEvaluationBenchDrawer
        open={benchOpen}
        onClose={() => setBenchOpen(false)}
        config={benchConfig}
        configName={benchConfigName}
        activeTaskKey={activeTaskKey}
        cloneFrom={cloneFrom}
        onSuccessSave={handleSavedSuccess}
        onOpenStudio={() => {
          setBenchOpen(false);
          setStudioOpen(true);
        }}
      />

      <Modal
        title="Create model ref with provenance"
        open={refOpen}
        onCancel={() => setRefOpen(false)}
        confirmLoading={refMutation.isPending}
        okText="Create ref"
        onOk={async () => {
          if (!savedArtifact) return;
          const values = await refForm.validateFields();
          await refMutation.mutateAsync({
            ocr_type: activeTaskKey,
            detection_artifact_id: values.detection_artifact_id,
            recognition_artifact_id: savedArtifact.id,
            activate: values.activate,
            set_default: values.set_default,
          });
        }}
      >
        {savedArtifact ? (
          <Alert
            className="mb-3"
            type="info"
            showIcon
            message="Provenance"
            description={
              <div className="text-xs">
                Recognition: {savedArtifact.name} v{savedArtifact.version} (
                {truncateDigest(savedArtifact.artifact_digest)})
                <br />
                created_from: recognition_config_dashboard
              </div>
            }
          />
        ) : null}
        <Form form={refForm} layout="vertical">
          {refSuggestQuery.data?.suggested_model_ref ? (
            <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
              <div className="text-xs text-slate-500">Will be assigned</div>
              <div className="font-mono font-semibold text-sky-900">
                {refSuggestQuery.data.suggested_model_ref}
              </div>
            </div>
          ) : null}
          <Form.Item
            name="detection_artifact_id"
            label="Detection artifact"
            rules={[{ required: true }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={(detectionQuery.data?.artifacts ?? [])
                .filter((a) => a.status !== "retired")
                .map((a) => ({
                  value: a.id,
                  label: `${a.name} v${a.version} · ${a.runtime}`,
                }))}
            />
          </Form.Item>
          <Form.Item name="activate" valuePropName="checked">
            <Checkbox>Activate after create</Checkbox>
          </Form.Item>
          <Form.Item name="set_default" valuePropName="checked">
            <Checkbox>Set as default</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
