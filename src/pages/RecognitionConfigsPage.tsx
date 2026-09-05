import { ExperimentOutlined, PlusOutlined } from "@ant-design/icons";
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
  Select,
  Space,
  Switch,
  Table,
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
import { listEvaluations } from "@/api/evaluation";
import {
  createRecognitionConfig,
  createRefFromRecognitionConfig,
  deleteRecognitionConfig,
  listArtifacts,
  listRecognitionConfigs,
  listRecognitionPreviewCases,
  previewRecognitionConfig,
  type RecognitionConfigArtifact,
  type RecognitionConfigBody,
  type RecognitionPreviewCase,
  type RecognitionPreviewResult,
} from "@/api/models";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusTag } from "@/components/common/StatusTag";
import { truncateDigest } from "@/utils/format";

const CANDIDATE_OPTIONS = [
  "identity",
  "grayscale",
  "clahe",
  "contrast_stretch",
  "denoise",
  "sharpen",
  "adaptive_threshold",
  "resize",
].map((v) => ({ value: v, label: v }));

const STRATEGY_OPTIONS = [
  { value: "best_digit_confidence", label: "Best digit confidence" },
  { value: "first_valid", label: "First valid" },
  { value: "fixed_single", label: "Fixed single" },
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
};

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
  name = "odometer-recognizer-paddle",
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
    candidates: (cs.candidates as string[]) || ["identity"],
    stop_on_first_valid: Boolean(cs.stop_on_first_valid),
    clahe_clip: Number(ip.clahe_clip ?? 2),
    denoise_strength: Number(ip.denoise_strength ?? 3),
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
    },
    crop_quality: {
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
    },
  };
}

function PreviewVisualImpact({ row }: { row: RecognitionPreviewResult }) {
  const v = row.visuals;
  if (!v) return null;
  const candMeta = new Map(
    (row.candidates || []).map((c) => [String(c.name), c]),
  );
  return (
    <div className="space-y-3 bg-slate-50 p-3">
      <div className="flex flex-wrap gap-4">
        {v.context_image ? (
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">
              Frame · red = detection · cyan = padded crop
            </div>
            <img
              src={v.context_image}
              alt="context with boxes"
              className="max-h-40 rounded border border-slate-200 bg-white object-contain"
            />
          </div>
        ) : null}
        {v.crop_image ? (
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">
              Crop sent to OCR
              {v.crop_size
                ? ` (${v.crop_size.width}×${v.crop_size.height}, pad ${v.padding_ratio ?? "—"})`
                : ""}
            </div>
            <img
              src={v.crop_image}
              alt="recognition crop"
              className="max-h-40 rounded border border-slate-200 bg-white object-contain"
            />
          </div>
        ) : null}
      </div>
      {(v.candidate_images || []).length > 0 ? (
        <div>
          <div className="mb-2 text-xs font-medium text-slate-600">
            Preprocess candidates (what Paddle sees)
          </div>
          <div className="flex flex-wrap gap-3">
            {(v.candidate_images || []).map((c) => {
              const meta = candMeta.get(c.name) || {};
              const text = String(meta.normalized || meta.text || "");
              const conf = meta.confidence;
              return (
                <div
                  key={c.name}
                  className={`w-36 rounded border p-2 ${
                    c.selected
                      ? "border-sky-500 bg-sky-50 ring-1 ring-sky-300"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <span className="truncate text-xs font-medium">
                      {c.name}
                    </span>
                    {c.selected ? (
                      <Tag color="blue" className="m-0 text-[10px]">
                        picked
                      </Tag>
                    ) : null}
                  </div>
                  {c.image ? (
                    <img
                      src={c.image}
                      alt={c.name}
                      className="mb-1 h-20 w-full object-contain"
                    />
                  ) : (
                    <div className="mb-1 flex h-20 items-center justify-center text-[10px] text-red-500">
                      {c.error || "n/a"}
                    </div>
                  )}
                  <div className="truncate font-mono text-[10px] text-slate-700">
                    {text || "—"}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    conf {typeof conf === "number" ? conf.toFixed(2) : "—"}
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

function DraftPreviewDrawer({
  open,
  onClose,
  draftConfig,
}: {
  open: boolean;
  onClose: () => void;
  draftConfig: RecognitionConfigBody | null;
}) {
  const [evaluationId, setEvaluationId] = useState<string | undefined>();
  const [failuresOnly, setFailuresOnly] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [previews, setPreviews] = useState<RecognitionPreviewResult[] | null>(
    null,
  );
  const [summary, setSummary] = useState<{
    attempted: number;
    matches_gt: number;
    match_rate: number | null;
  } | null>(null);

  const evalsQuery = useQuery({
    queryKey: ["evaluations", "for-recog-preview"],
    queryFn: () =>
      listEvaluations({
        status: "completed",
        limit: 50,
        include_metrics: false,
      }),
    enabled: open,
  });

  const casesQuery = useQuery({
    queryKey: ["recognition-preview-cases", evaluationId, failuresOnly],
    queryFn: () =>
      listRecognitionPreviewCases({
        evaluation_id: evaluationId!,
        failures_only: failuresOnly,
        limit: 40,
      }),
    enabled: open && Boolean(evaluationId),
  });

  useEffect(() => {
    if (!open) {
      setSelectedIds([]);
      setExpandedIds([]);
      setPreviews(null);
      setSummary(null);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIds([]);
    setExpandedIds([]);
    setPreviews(null);
    setSummary(null);
  }, [evaluationId, failuresOnly]);

  const previewMutation = useMutation({
    mutationFn: previewRecognitionConfig,
    onSuccess: (data) => {
      setPreviews(data.previews);
      setSummary(data.summary);
      // Auto-expand rows that have visuals so impact is immediately visible
      setExpandedIds(
        data.previews
          .filter((p) => p.visuals)
          .map((p) => p.result_id)
          .slice(0, 5),
      );
      message.success(
        `Preview done — ${data.summary.matches_gt}/${data.summary.attempted} match GT`,
      );
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  const cases = casesQuery.data?.cases ?? [];

  const caseColumns: ColumnsType<RecognitionPreviewCase> = [
    {
      title: "File",
      dataIndex: "filename",
      ellipsis: true,
      render: (v: string | null) => v || "—",
    },
    {
      title: "GT",
      dataIndex: "ground_truth",
      width: 90,
      render: (v: string | null) => (
        <span className="font-mono text-xs">{v || "—"}</span>
      ),
    },
    {
      title: "Prior",
      dataIndex: "predicted",
      width: 90,
      render: (v: string | null, r) => (
        <span className="font-mono text-xs">
          {v || "—"}{" "}
          {r.is_correct === true ? (
            <Tag color="green">ok</Tag>
          ) : r.is_correct === false ? (
            <Tag color="red">miss</Tag>
          ) : null}
        </span>
      ),
    },
    {
      title: "Box",
      dataIndex: "bbox_source",
      width: 110,
      render: (v: string) => (
        <span className="text-xs text-slate-500">{v}</span>
      ),
    },
  ];

  const previewColumns: ColumnsType<RecognitionPreviewResult> = [
    {
      title: "File",
      dataIndex: "filename",
      width: 140,
      ellipsis: true,
    },
    {
      title: "Crop",
      key: "crop_thumb",
      width: 88,
      render: (_, r) =>
        r.visuals?.crop_image ? (
          <img
            src={r.visuals.crop_image}
            alt="crop"
            className="h-12 w-16 rounded border border-slate-200 object-contain"
          />
        ) : (
          "—"
        ),
    },
    {
      title: "GT",
      dataIndex: "ground_truth",
      width: 80,
      render: (v) => <span className="font-mono text-xs">{v || "—"}</span>,
    },
    {
      title: "Draft predicted",
      key: "pred",
      width: 120,
      render: (_, r) =>
        r.ok === false ? (
          <span className="text-xs text-red-600">{r.error || "failed"}</span>
        ) : (
          <span className="font-mono text-xs">
            {r.predicted || r.raw_text || "—"}
            {r.matches_gt ? (
              <Tag color="green" className="ml-1">
                match
              </Tag>
            ) : (
              <Tag color="orange" className="ml-1">
                miss
              </Tag>
            )}
          </span>
        ),
    },
    {
      title: "Candidate",
      dataIndex: "selected_candidate",
      width: 100,
      render: (v) => <span className="text-xs">{v || "—"}</span>,
    },
    {
      title: "Conf",
      dataIndex: "confidence",
      width: 70,
      render: (v: number | undefined) => (v != null ? v.toFixed(2) : "—"),
    },
    {
      title: "Candidates tried",
      key: "cands",
      render: (_, r) => {
        const list = r.candidates || [];
        if (!list.length) return "—";
        return (
          <div className="flex flex-wrap gap-1">
            {list.map((c) => {
              const name = String(c.name ?? "?");
              const text = String(c.normalized || c.text || "");
              const ok = Boolean(c.valid ?? c.ok);
              return (
                <Tooltip
                  key={name}
                  title={`${name}: ${text || "(empty)"} · conf=${c.confidence ?? "—"}`}
                >
                  <Tag color={ok ? "blue" : "default"}>{name}</Tag>
                </Tooltip>
              );
            })}
          </div>
        );
      },
    },
  ];

  return (
    <Drawer
      title="Try draft config on existing detections"
      open={open}
      onClose={onClose}
      width={1080}
      destroyOnClose
    >
      <Alert
        className="mb-4"
        type="info"
        showIcon
        message="No re-detection — uses boxes from a completed evaluation"
        description="After OCR runs, expand a row to see padded crop + preprocess candidates (visual impact of this draft). Nothing is saved until you click Save immutable version."
      />

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 text-xs font-medium text-slate-600">
            Completed evaluation
          </div>
          <Select
            className="w-full"
            showSearch
            optionFilterProp="label"
            placeholder="Pick an evaluation run"
            value={evaluationId}
            onChange={setEvaluationId}
            options={(evalsQuery.data?.evaluations ?? []).map((e) => ({
              value: e.id,
              label: `${e.dataset_name || "dataset"} ${e.dataset_version || ""} · ${e.model_ref || "ref"} · ${dayjs(e.created_at).format("MM-DD HH:mm")} · ${e.id.slice(0, 8)}`,
            }))}
          />
        </div>
        <div className="flex items-end gap-3 pb-1">
          <Checkbox
            checked={failuresOnly}
            onChange={(e) => setFailuresOnly(e.target.checked)}
          >
            Failures only
          </Checkbox>
          <Button
            type="primary"
            disabled={!draftConfig || selectedIds.length === 0}
            loading={previewMutation.isPending}
            onClick={() => {
              if (!draftConfig || !evaluationId) return;
              previewMutation.mutate({
                config: draftConfig,
                evaluation_id: evaluationId,
                result_ids: selectedIds,
                include_images: true,
              });
            }}
          >
            Run draft OCR ({selectedIds.length})
          </Button>
        </div>
      </div>

      <Table
        size="small"
        rowKey="result_id"
        loading={casesQuery.isLoading || casesQuery.isFetching}
        dataSource={cases}
        columns={caseColumns}
        pagination={false}
        scroll={{ y: 200 }}
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
          emptyText: evaluationId
            ? "No samples with a detection box in this filter"
            : "Select an evaluation first",
        }}
      />
      <div className="mb-4 mt-1 text-xs text-slate-500">
        Select up to 20 samples. Total with boxes: {casesQuery.data?.total ?? 0}
      </div>

      {summary ? (
        <Alert
          className="mb-3"
          type={
            summary.match_rate != null && summary.match_rate >= 0.8
              ? "success"
              : "warning"
          }
          showIcon
          message={`Draft match GT: ${summary.matches_gt}/${summary.attempted}${
            summary.match_rate != null
              ? ` (${(summary.match_rate * 100).toFixed(0)}%)`
              : ""
          }`}
          description="Expand rows below to inspect crop padding and preprocess impact. Still run a full Evaluation after you finalize."
        />
      ) : null}

      {previews ? (
        <Table
          size="small"
          rowKey="result_id"
          dataSource={previews}
          columns={previewColumns}
          pagination={false}
          scroll={{ y: 420 }}
          expandable={{
            expandedRowKeys: expandedIds,
            onExpandedRowsChange: (keys) => setExpandedIds(keys as string[]),
            expandedRowRender: (record) => <PreviewVisualImpact row={record} />,
            rowExpandable: (record) => Boolean(record.visuals),
          }}
        />
      ) : null}
    </Drawer>
  );
}

export function RecognitionConfigsPage() {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [draftConfig, setDraftConfig] = useState<RecognitionConfigBody | null>(
    null,
  );
  const [refOpen, setRefOpen] = useState(false);
  const [cloneFrom, setCloneFrom] = useState<RecognitionConfigArtifact | null>(
    null,
  );
  const [savedArtifact, setSavedArtifact] =
    useState<RecognitionConfigArtifact | null>(null);
  const [form] = Form.useForm<EditorForm>();
  const [refForm] = Form.useForm<{
    model_ref: string;
    detection_artifact_id: string;
    activate: boolean;
    set_default: boolean;
  }>();

  const query = useQuery({
    queryKey: ["models", "recognition-configs"],
    queryFn: () => listRecognitionConfigs({ ocr_type: "odometer", limit: 100 }),
  });

  const detectionQuery = useQuery({
    queryKey: ["models", "artifacts", "detection", "for-recog-ref"],
    queryFn: () =>
      listArtifacts({
        ocr_type: "odometer",
        role: "detection",
        include_metrics: false,
        limit: 200,
      }),
    enabled: refOpen,
  });

  const saveMutation = useMutation({
    mutationFn: createRecognitionConfig,
    onSuccess: async (created) => {
      message.success(`Saved ${created.name} v${created.version} (immutable)`);
      setSavedArtifact(created);
      setEditorOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["models", "recognition-configs"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["models", "artifacts"],
      });
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRecognitionConfig(id),
    onSuccess: async (art) => {
      message.success(`Deleted ${art.name} v${art.version}`);
      await queryClient.invalidateQueries({
        queryKey: ["models", "recognition-configs"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["models", "artifacts"],
      });
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  const defaults = query.data?.defaults;

  useEffect(() => {
    if (!editorOpen) return;
    const source = cloneFrom?.config || defaults;
    if (!source) return;
    form.setFieldsValue(
      configToForm(source, cloneFrom?.name || "odometer-recognizer-paddle"),
    );
  }, [editorOpen, cloneFrom, defaults, form]);

  const openPreviewFromForm = async () => {
    try {
      const values = await form.validateFields([
        "strategy",
        "candidates",
        "stop_on_first_valid",
        "clahe_clip",
        "denoise_strength",
        "padding_ratio",
        "min_short_side",
        "reject_too_small",
        "strip_units",
        "digits_only",
        "min_digits",
        "max_digits",
        "lookalike",
        "lang",
        "use_textline_orientation",
        "use_doc_orientation_classify",
        "use_doc_unwarping",
        "timeout_seconds",
      ]);
      if (
        values.strategy === "fixed_single" &&
        values.candidates.length !== 1
      ) {
        message.error("fixed_single requires exactly one candidate");
        return;
      }
      const all = form.getFieldsValue(true) as EditorForm;
      setDraftConfig(formToConfig({ ...all, ...values }));
      setPreviewOpen(true);
    } catch {
      message.error("Fix config fields before preview");
    }
  };

  const columns: ColumnsType<RecognitionConfigArtifact> = useMemo(
    () => [
      {
        title: "Name / version",
        key: "nv",
        render: (_, r) => (
          <div>
            <div className="font-medium">
              {r.name} <span className="text-slate-500">v{r.version}</span>
            </div>
            <div className="text-xs text-slate-400">
              {r.pipeline_impl_version || "—"} · {r.selection_strategy || "—"}
            </div>
          </div>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        width: 120,
        render: (s: string) => <StatusTag status={s} />,
      },
      {
        title: "Digest",
        dataIndex: "artifact_digest",
        width: 140,
        render: (d: string) => (
          <Tooltip title={d}>
            <span className="font-mono text-xs">{truncateDigest(d)}</span>
          </Tooltip>
        ),
      },
      {
        title: "Last eval (link only)",
        key: "eval",
        width: 160,
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
        width: 140,
        render: (v: string | null) =>
          v ? dayjs(v).format("YYYY-MM-DD HH:mm") : "—",
      },
      {
        title: "Actions",
        key: "actions",
        width: 340,
        render: (_, r) => (
          <Space size="small" wrap>
            <Button
              size="small"
              onClick={() => {
                setCloneFrom(r);
                setEditorOpen(true);
              }}
            >
              Clone → new version
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={() => {
                setSavedArtifact(r);
                setRefOpen(true);
                refForm.setFieldsValue({
                  model_ref: "",
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

  const openNew = () => {
    setCloneFrom(null);
    setEditorOpen(true);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: "Dashboard", path: "/" },
          { title: "Models", path: "/models/list" },
          { title: "Recognition configs" },
        ]}
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
            New config version
          </Button>
        }
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-6">
        <Alert
          type="info"
          showIcon
          message="Immutable Paddle recognition configs"
          description={
            <>
              Draft a config, try it on existing detections (no re-detect), then
              save a SemVer when it looks good. Official metrics still come from{" "}
              <Link to="/evaluation/runs">Evaluation runs</Link>.
            </>
          }
        />
        {savedArtifact ? (
          <Alert
            type="success"
            showIcon
            closable
            onClose={() => setSavedArtifact(null)}
            message={`Ready: ${savedArtifact.name} v${savedArtifact.version}`}
            action={
              <Space>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => {
                    setRefOpen(true);
                    refForm.setFieldsValue({
                      model_ref: "",
                      activate: true,
                      set_default: false,
                    });
                  }}
                >
                  Create model ref
                </Button>
                <Link to="/evaluation/runs">
                  <Button size="small" icon={<ExperimentOutlined />}>
                    Evaluate (manual)
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

      <Modal
        title={
          cloneFrom
            ? `Clone ${cloneFrom.name} v${cloneFrom.version} → new version`
            : "New recognition config version"
        }
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        width={720}
        confirmLoading={saveMutation.isPending}
        footer={
          <Space>
            <Button onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button icon={<ExperimentOutlined />} onClick={openPreviewFromForm}>
              Try on detections
            </Button>
            <Button
              type="primary"
              loading={saveMutation.isPending}
              onClick={async () => {
                const values = await form.validateFields();
                if (
                  values.strategy === "fixed_single" &&
                  values.candidates.length !== 1
                ) {
                  message.error("fixed_single requires exactly one candidate");
                  return;
                }
                await saveMutation.mutateAsync({
                  ocr_type: "odometer",
                  name: values.name,
                  version: values.version || undefined,
                  bump: values.bump,
                  config: formToConfig(values),
                  clone_from_artifact_id: cloneFrom?.id,
                });
              }}
            >
              Save immutable version
            </Button>
          </Space>
        }
      >
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          message="Create only — never overwrites an existing version"
          description="Use “Try on detections” to smoke-test the draft before saving."
        />
        <Form
          form={form}
          layout="vertical"
          className="max-h-[60vh] overflow-auto"
        >
          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              name="name"
              label="Artifact name"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="bump"
              label="Auto SemVer bump"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { value: "patch", label: "patch (additive)" },
                  { value: "minor", label: "minor (preprocess change)" },
                  { value: "major", label: "major (breaking)" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="version"
              label="Or set version explicitly"
              className="col-span-2"
            >
              <Input placeholder="leave blank to auto-bump" />
            </Form.Item>
          </div>

          <Card size="small" title="Candidate selection" className="mb-3">
            <Form.Item
              name="strategy"
              label="Strategy"
              rules={[{ required: true }]}
            >
              <Select options={STRATEGY_OPTIONS} />
            </Form.Item>
            <Form.Item
              name="candidates"
              label="Preprocessing candidates (order matters)"
              rules={[{ required: true, type: "array", min: 1 }]}
            >
              <Select mode="multiple" options={CANDIDATE_OPTIONS} />
            </Form.Item>
            <Form.Item
              name="stop_on_first_valid"
              label="Stop on first valid"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Card>

          <Card size="small" title="Image preprocessing" className="mb-3">
            <div className="grid grid-cols-2 gap-3">
              <Form.Item name="clahe_clip" label="CLAHE clip">
                <InputNumber min={0.5} max={40} step={0.5} className="w-full" />
              </Form.Item>
              <Form.Item name="denoise_strength" label="Denoise strength">
                <InputNumber min={0} max={30} className="w-full" />
              </Form.Item>
            </div>
          </Card>

          <Card
            size="small"
            title="Crop quality (recognition-owned)"
            className="mb-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <Form.Item name="padding_ratio" label="Padding ratio">
                <InputNumber min={0} max={0.5} step={0.01} className="w-full" />
              </Form.Item>
              <Form.Item name="min_short_side" label="Min short side">
                <InputNumber min={1} className="w-full" />
              </Form.Item>
              <Form.Item
                name="reject_too_small"
                label="Reject too-small crops"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </div>
          </Card>

          <Card size="small" title="Odometer post-process" className="mb-3">
            <div className="grid grid-cols-2 gap-3">
              <Form.Item
                name="strip_units"
                label="Strip units"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Form.Item
                name="digits_only"
                label="Digits only"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Form.Item name="min_digits" label="Min digits">
                <InputNumber min={1} max={12} className="w-full" />
              </Form.Item>
              <Form.Item name="max_digits" label="Max digits">
                <InputNumber min={1} max={12} className="w-full" />
              </Form.Item>
              <Form.Item
                name="lookalike"
                label="Lookalike map (e.g. O:0,I:1)"
                className="col-span-2"
              >
                <Input />
              </Form.Item>
            </div>
          </Card>

          <Card size="small" title="Paddle OCR settings">
            <div className="grid grid-cols-2 gap-3">
              <Form.Item name="lang" label="Language">
                <Input />
              </Form.Item>
              <Form.Item name="timeout_seconds" label="Timeout (s)">
                <InputNumber min={5} max={600} className="w-full" />
              </Form.Item>
              <Form.Item
                name="use_textline_orientation"
                label="Textline orientation"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Form.Item
                name="use_doc_orientation_classify"
                label="Doc orientation"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Form.Item
                name="use_doc_unwarping"
                label="Doc unwarping"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </div>
          </Card>
        </Form>
      </Modal>

      <DraftPreviewDrawer
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        draftConfig={draftConfig}
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
            ocr_type: "odometer",
            model_ref: values.model_ref,
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
          <Form.Item
            name="model_ref"
            label="Model ref"
            rules={[{ required: true }]}
          >
            <Input placeholder="e.g. v3" />
          </Form.Item>
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
