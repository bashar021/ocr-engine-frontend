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
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import {
  bulkReviewEvaluationResults,
  exportHardCases,
  fetchSampleImageObjectUrl,
  listEvaluationResults,
  listEvaluations,
  reviewEvaluationResult,
} from "@/api/evaluation";
import { PageHeader } from "@/components/common/PageHeader";
import {
  BboxAnnotator,
  type DrawnBox,
} from "@/components/training/BboxAnnotator";
import type { EvaluationResult, EvaluationRun } from "@/types/evaluation";

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
  const [evaluationId, setEvaluationId] = useState<string | undefined>();
  const [failureFilter, setFailureFilter] = useState<string | undefined>();
  const [failStageFilter, setFailStageFilter] = useState<string | undefined>();
  const [active, setActive] = useState<EvaluationResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, LocalLabel>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const evalsQuery = useQuery({
    queryKey: ["evaluation", "runs", "completed-for-curation"],
    queryFn: () =>
      listEvaluations({
        status: "completed",
        limit: 100,
        include_metrics: true,
      }),
  });

  const resultsQuery = useQuery({
    queryKey: ["evaluation", "results", evaluationId, "curation"],
    queryFn: () =>
      listEvaluationResults(evaluationId!, { limit: 500, offset: 0 }),
    enabled: Boolean(evaluationId),
  });

  const failures = useMemo(() => {
    let rows = (resultsQuery.data?.results ?? []).filter(
      (r) =>
        r.is_correct === false || (r.failure_type && r.failure_type !== "OK"),
    );
    if (failureFilter) {
      rows = rows.filter((r) => (r.failure_type || "") === failureFilter);
    }
    if (failStageFilter) {
      rows = rows.filter((r) => (r.fail_stage || "") === failStageFilter);
    }
    return rows;
  }, [resultsQuery.data, failureFilter, failStageFilter]);

  // Seed local labels from existing review state when results load
  useEffect(() => {
    setLabels((prev) => {
      const next: Record<string, LocalLabel> = { ...prev };
      for (const r of resultsQuery.data?.results ?? []) {
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
  }, [resultsQuery.data?.results]);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    async function load() {
      if (!active?.dataset_id || !active.dataset_sample_id) {
        setPreviewUrl(null);
        return;
      }
      try {
        url = await fetchSampleImageObjectUrl(
          active.dataset_id,
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
  }, [active]);

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
      // advance to next pending failure
      const idx = failures.findIndex((f) => f.id === active.id);
      const next = failures
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
      title: "Failure",
      dataIndex: "failure_type",
      width: 150,
      render: (v) => (v ? <Tag color="orange">{v}</Tag> : "—"),
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

  const evalOptions = (evalsQuery.data?.evaluations ?? []).map(
    (e: EvaluationRun) => {
      const ds =
        e.dataset_name != null
          ? `${e.dataset_name}${e.dataset_version ? ` v${e.dataset_version}` : ""}`
          : e.dataset_id.slice(0, 8);
      return {
        value: e.id,
        label: `${ds} · ${e.model_ref ?? "eval"} · ${e.id.slice(0, 8)}`,
      };
    },
  );

  const currentLabel = active ? labels[active.id] : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: "Dashboard", path: "/" },
          { title: "Training", path: "/training" },
          { title: "Curate failures" },
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
          <div className="min-w-[280px] flex-1">
            <div className="mb-1 text-xs text-slate-500">
              Source evaluation (completed)
            </div>
            <Select
              className="w-full"
              showSearch
              optionFilterProp="label"
              placeholder="Select evaluation run"
              options={evalOptions}
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
            placeholder="Failure type"
            value={failureFilter}
            onChange={setFailureFilter}
            options={[
              "DETECTION_FAILURE",
              "MULTIPLE_DETECTIONS",
              "PARTIAL_DETECTION",
              "RECOGNITION_FAILURE",
              "MISMATCH",
              "INVALID_IMAGE",
            ].map((v) => ({ value: v, label: v }))}
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
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <Statistic title="Failed images" value={failures.length} />
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
          dataSource={failures}
          pagination={{ pageSize: 15 }}
        />
      </div>

      <Modal
        title={active?.filename || "Label failed image"}
        open={Boolean(active)}
        onCancel={() => setActive(null)}
        width={960}
        footer={null}
        destroyOnHidden
      >
        {active && currentLabel ? (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
            <div>
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
            <div className="space-y-3 text-sm">
              <div>
                <Tag color="orange">{active.failure_type || "FAIL"}</Tag>
                {active.fail_stage ? <Tag>{active.fail_stage}</Tag> : null}
              </div>
              <div>
                <div className="text-xs text-slate-500">
                  Original GT (immutable)
                </div>
                <div className="font-mono">
                  {active.ground_truth_normalized ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Predicted</div>
                <div className="font-mono">
                  {active.predicted_normalized ?? "—"}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-500">
                  Corrected ground truth
                </div>
                <Input
                  value={currentLabel.corrected_gt}
                  onChange={(e) =>
                    updateLabel(active.id, { corrected_gt: e.target.value })
                  }
                  placeholder="e.g. 123456"
                />
              </div>
              <div className="text-xs text-slate-500">
                Box:{" "}
                {currentLabel.bbox
                  ? `${Math.round(currentLabel.bbox.x1)},${Math.round(currentLabel.bbox.y1)} → ${Math.round(currentLabel.bbox.x2)},${Math.round(currentLabel.bbox.y2)}`
                  : "not set — drag on image"}
              </div>
              <Space direction="vertical" className="w-full">
                <Button
                  type="primary"
                  block
                  loading={saving}
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
                className="text-xs"
                message="Source dataset is never modified. Only the new copied dataset gets this image."
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
          message={`${labeledReady} labeled failed images will be copied`}
          description="Excluded images are left out. Original evaluation dataset stays unchanged."
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
