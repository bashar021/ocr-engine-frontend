import {
  Alert,
  Button,
  Card,
  Drawer,
  Progress,
  Radio,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  StarFilled,
  SwapOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import { compareEvaluations } from "@/api/evaluation";
import { PageHeader } from "@/components/common/PageHeader";
import { useEvaluationsQuery } from "@/features/evaluation/useEvaluationsQuery";
import { useModelRefsQuery } from "@/features/models/useModelRefsQuery";
import { useTaskContext } from "@/features/tasks/TaskContext";
import type {
  EvaluationComparisonResponse,
  EvaluationRun,
} from "@/types/evaluation";
import {
  DECISION_CRITERIA_OPTIONS,
  buildComparisonMetricRows,
  computeModelVerdict,
  formatMetricDelta,
  type ComparisonMetricRow,
  type DecisionCriteriaKey,
  type MetricCategory,
} from "@/utils/evaluationComparisonMetrics";
import { formatPercent } from "@/utils/format";
import { isCategoryDatasetName } from "@/utils/datasetFilters";

function evalLabel(run: EvaluationRun, isDefault = false): string {
  const model = run.model_ref ? `${run.model_ref}${isDefault ? " ★ Default" : ""}` : "Unnamed";
  const acc =
    typeof run.metrics?.end_to_end_accuracy === "number"
      ? ` · ${formatPercent(run.metrics.end_to_end_accuracy)}`
      : "";
  return `${model} · ${run.total_samples} samples${acc} (${run.id.slice(0, 8)}…)`;
}

export function EvaluationComparisonPage() {
  const { activeTaskKey } = useTaskContext();
  const [datasetId, setDatasetId] = useState<string | undefined>();
  const [leftId, setLeftId] = useState<string | undefined>();
  const [rightId, setRightId] = useState<string | undefined>();
  const [criteria, setCriteria] = useState<DecisionCriteriaKey>("client_value");
  const [categoryFilter, setCategoryFilter] = useState<"all" | MetricCategory>("all");
  const [samplesOpen, setSamplesOpen] = useState(false);
  const [sampleStatusFilter, setSampleStatusFilter] = useState<"all" | "improved" | "regressed" | "still_failing">("all");

  // 1. Fetch completed evaluation runs
  const completedQuery = useEvaluationsQuery(
    {
      ocr_type: activeTaskKey,
      status: "completed",
      limit: 500,
      include_metrics: true,
    },
    Boolean(activeTaskKey),
  );

  const completed = completedQuery.data?.evaluations ?? [];

  // 2. Fetch model refs to identify default model
  const modelRefsQuery = useModelRefsQuery(
    { ocr_type: activeTaskKey, include_metrics: false },
    Boolean(activeTaskKey),
  );

  const defaultModelRef = useMemo(() => {
    const refs = modelRefsQuery.data?.refs ?? [];
    return refs.find((r) => r.is_default)?.model_ref;
  }, [modelRefsQuery.data?.refs]);

  // 3. Auto-populate with default model comparison by default
  useEffect(() => {
    if (completed.length === 0) return;
    if (datasetId && leftId && rightId) return;

    // Group runs by dataset_id, skipping any category dataset runs
    const runsByDataset = new Map<string, EvaluationRun[]>();
    for (const r of completed) {
      if (!r.dataset_id) continue;
      if (isCategoryDatasetName(r.dataset_name)) continue;
      const list = runsByDataset.get(r.dataset_id) || [];
      list.push(r);
      runsByDataset.set(r.dataset_id, list);
    }

    let targetDs: string | undefined;
    let targetLeft: string | undefined;
    let targetRight: string | undefined;

    // Preference 1: dataset that has default model evaluation AND at least one other run
    if (defaultModelRef) {
      for (const [dsId, runs] of runsByDataset.entries()) {
        const defaultRun = runs.find((r) => r.model_ref === defaultModelRef);
        if (defaultRun && runs.length > 1) {
          const otherRun = runs.find((r) => r.id !== defaultRun.id);
          if (otherRun) {
            targetDs = dsId;
            targetLeft = defaultRun.id;
            targetRight = otherRun.id;
            break;
          }
        }
      }
    }

    // Preference 2: any dataset that has >= 2 completed runs
    if (!targetDs) {
      for (const [dsId, runs] of runsByDataset.entries()) {
        if (runs.length >= 2) {
          targetDs = dsId;
          const defRun = defaultModelRef ? runs.find((r) => r.model_ref === defaultModelRef) : null;
          targetLeft = defRun ? defRun.id : runs[0].id;
          targetRight = runs.find((r) => r.id !== targetLeft)?.id;
          break;
        }
      }
    }

    // Preference 3: fallback
    if (!targetDs) {
      const firstValidRun = completed.find((r) => !isCategoryDatasetName(r.dataset_name));
      if (firstValidRun) {
        targetDs = firstValidRun.dataset_id;
        targetLeft = firstValidRun.id;
      }
    }

    if (targetDs && !datasetId) setDatasetId(targetDs);
    if (targetLeft && !leftId) setLeftId(targetLeft);
    if (targetRight && !rightId) setRightId(targetRight);
  }, [completed, defaultModelRef, datasetId, leftId, rightId]);

  // Unique datasets list (strictly real label datasets, no category datasets)
  const datasetOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const run of completed) {
      if (!run.dataset_id) continue;
      if (isCategoryDatasetName(run.dataset_name)) continue;
      const label = run.dataset_name
        ? `${run.dataset_name}${run.dataset_version ? ` v${run.dataset_version}` : ""}`
        : run.dataset_id.slice(0, 8);
      seen.set(run.dataset_id, label);
    }
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [completed]);

  const datasetRuns = useMemo(
    () => (datasetId ? completed.filter((r) => r.dataset_id === datasetId) : []),
    [completed, datasetId],
  );

  const leftOptions = useMemo(
    () =>
      datasetRuns.map((r) => ({
        value: r.id,
        label: evalLabel(r, r.model_ref === defaultModelRef),
      })),
    [datasetRuns, defaultModelRef],
  );

  const rightOptions = useMemo(
    () =>
      datasetRuns
        .filter((r) => r.id !== leftId)
        .map((r) => ({
          value: r.id,
          label: evalLabel(r, r.model_ref === defaultModelRef),
        })),
    [datasetRuns, leftId, defaultModelRef],
  );

  const leftRun = completed.find((r) => r.id === leftId);
  const rightRun = completed.find((r) => r.id === rightId);

  const leftIsDefault = leftRun?.model_ref === defaultModelRef;
  const rightIsDefault = rightRun?.model_ref === defaultModelRef;

  const compareQuery = useQuery({
    queryKey: ["evaluation", "compare", leftId, rightId],
    queryFn: () => compareEvaluations(leftId!, rightId!),
    enabled: Boolean(leftId && rightId && leftId !== rightId),
  });

  const handleSwap = () => {
    if (leftId && rightId) {
      const prevLeft = leftId;
      setLeftId(rightId);
      setRightId(prevLeft);
    }
  };

  // Verdict and winner calculation
  const verdict = useMemo(() => {
    if (!compareQuery.data) return null;
    return computeModelVerdict(
      compareQuery.data,
      leftRun,
      rightRun,
      criteria,
    );
  }, [compareQuery.data, leftRun, rightRun, criteria]);

  // Metric rows calculation
  const allMetricRows = useMemo(() => {
    if (!compareQuery.data) return [];
    return buildComparisonMetricRows(
      compareQuery.data,
      leftRun,
      rightRun,
    );
  }, [compareQuery.data, leftRun, rightRun]);

  const filteredMetricRows = useMemo(() => {
    if (categoryFilter === "all") return allMetricRows;
    return allMetricRows.filter((r) => r.category === categoryFilter);
  }, [allMetricRows, categoryFilter]);

  const leftModelLabel = leftRun?.model_ref ?? compareQuery.data?.left.model_ref ?? "Baseline";
  const rightModelLabel = rightRun?.model_ref ?? compareQuery.data?.right.model_ref ?? "Candidate";

  type CompareSample = EvaluationComparisonResponse["samples"][number];

  const changedSamples = useMemo(() => {
    const samples = compareQuery.data?.samples ?? [];
    return samples.filter((s) => s.status !== "unchanged");
  }, [compareQuery.data?.samples]);

  const filteredSamples = useMemo(() => {
    if (sampleStatusFilter === "all") return changedSamples;
    return changedSamples.filter((s) => s.status === sampleStatusFilter);
  }, [changedSamples, sampleStatusFilter]);

  const sampleColumns: ColumnsType<CompareSample> = useMemo(
    () => [
      {
        title: "Status",
        dataIndex: "status",
        width: 140,
        render: (v: string) => {
          if (v === "improved") {
            return (
              <Tag color="green" icon={<CheckCircleOutlined />}>
                Improved (Fixed)
              </Tag>
            );
          }
          if (v === "regressed") {
            return (
              <Tag color="red" icon={<CloseCircleOutlined />}>
                Regressed (Broken)
              </Tag>
            );
          }
          if (v === "still_failing") {
            return <Tag color="orange">Still Failing</Tag>;
          }
          return <Tag>{v}</Tag>;
        },
      },
      {
        title: "Matrix",
        dataIndex: "matrix",
        width: 80,
        align: "center",
        render: (m: string) => <Tag className="font-mono">{m}</Tag>,
      },
      {
        title: "Ground Truth",
        dataIndex: "ground_truth",
        width: 160,
        render: (text) => <span className="font-mono font-semibold text-slate-800">{text || "—"}</span>,
      },
      {
        title: `${leftModelLabel} (Baseline)`,
        dataIndex: "left_predicted",
        width: 170,
        render: (text, row) => (
          <div>
            <span className={`font-mono ${row.left_correct ? "text-emerald-700 font-medium" : "text-rose-600 line-through"}`}>
              {text || "—"}
            </span>
            {row.left_failure_type ? (
              <div className="text-[10px] text-slate-400">{row.left_failure_type}</div>
            ) : null}
          </div>
        ),
      },
      {
        title: `${rightModelLabel} (Candidate)`,
        dataIndex: "right_predicted",
        width: 170,
        render: (text, row) => (
          <div>
            <span className={`font-mono ${row.right_correct ? "text-emerald-700 font-medium" : "text-rose-600 line-through"}`}>
              {text || "—"}
            </span>
            {row.right_failure_type ? (
              <div className="text-[10px] text-slate-400">{row.right_failure_type}</div>
            ) : null}
          </div>
        ),
      },
    ],
    [leftModelLabel, rightModelLabel],
  );

  const metricsTableColumns: ColumnsType<ComparisonMetricRow> = useMemo(
    () => [
      {
        title: "Client Metric",
        dataIndex: "label",
        width: 260,
        render: (label, row) => (
          <div>
            <div className="font-medium text-slate-900">{label}</div>
            {row.description ? (
              <div className="text-[11px] text-slate-500 leading-tight mt-0.5">{row.description}</div>
            ) : null}
          </div>
        ),
      },
      {
        title: (
          <div className="flex items-center gap-1.5">
            <span>{leftModelLabel}</span>
            {leftIsDefault ? <Tag color="blue" className="!mr-0 text-[10px]">Default</Tag> : null}
          </div>
        ),
        key: "left",
        width: 140,
        align: "right",
        render: (_, row) => (
          <span className={`font-mono ${row.winner === "left" ? "font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded" : "text-slate-700"}`}>
            {row.format(row.left)}
          </span>
        ),
      },
      {
        title: (
          <div className="flex items-center gap-1.5 justify-end">
            <span>{rightModelLabel}</span>
            {rightIsDefault ? <Tag color="blue" className="!mr-0 text-[10px]">Default</Tag> : null}
          </div>
        ),
        key: "right",
        width: 140,
        align: "right",
        render: (_, row) => (
          <span className={`font-mono ${row.winner === "right" ? "font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded" : "text-slate-700"}`}>
            {row.format(row.right)}
          </span>
        ),
      },
      {
        title: "Delta",
        key: "delta",
        width: 130,
        align: "center",
        render: (_, row) => {
          const text = formatMetricDelta(row.left, row.right, row.format);
          if (row.indicator === "better") {
            return (
              <Tag color="green" icon={<ArrowUpOutlined />} className="font-mono">
                {text}
              </Tag>
            );
          }
          if (row.indicator === "worse") {
            return (
              <Tag color="red" icon={<ArrowDownOutlined />} className="font-mono">
                {text}
              </Tag>
            );
          }
          return <span className="text-slate-400 font-mono text-xs">{text}</span>;
        },
      },
      {
        title: "Metric Winner",
        key: "winner",
        width: 150,
        align: "center",
        render: (_, row) => {
          if (row.winner === "right") {
            return (
              <Tag color="green" icon={<CheckCircleOutlined />}>
                {rightModelLabel} wins
              </Tag>
            );
          }
          if (row.winner === "left") {
            return (
              <Tag color="blue" icon={<CheckCircleOutlined />}>
                {leftModelLabel} wins
              </Tag>
            );
          }
          if (row.winner === "tie") {
            return <Tag color="default">Tie / Equal</Tag>;
          }
          return <span className="text-slate-400 text-xs">—</span>;
        },
      },
    ],
    [leftModelLabel, rightModelLabel, leftIsDefault, rightIsDefault],
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-50/50">
      <PageHeader
        title="Model Comparison & Champion Benchmarking"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Evaluate & decide:</span>
            <Select
              className="w-[280px]"
              value={criteria}
              onChange={(val: DecisionCriteriaKey) => setCriteria(val)}
              options={DECISION_CRITERIA_OPTIONS.map((c) => ({
                value: c.key,
                label: (
                  <div className="flex items-center justify-between">
                    <span>{c.label}</span>
                    <span className="text-[10px] text-slate-400">{c.badge}</span>
                  </div>
                ),
              }))}
            />
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6">
        {/* Selection Bar */}
        <Card size="small" className="border-slate-200/80 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-600">Dataset:</span>
                <Select
                  placeholder="Select Dataset"
                  className="min-w-[240px]"
                  showSearch
                  optionFilterProp="label"
                  value={datasetId}
                  options={datasetOptions}
                  loading={completedQuery.isLoading}
                  onChange={(v) => {
                    setDatasetId(v);
                    setLeftId(undefined);
                    setRightId(undefined);
                  }}
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-600">Baseline (Left):</span>
                <Select
                  placeholder="Select Baseline Model"
                  className="min-w-[280px]"
                  showSearch
                  optionFilterProp="label"
                  value={leftId}
                  options={leftOptions}
                  disabled={!datasetId || leftOptions.length === 0}
                  onChange={setLeftId}
                />
              </div>

              <Button
                icon={<SwapOutlined />}
                onClick={handleSwap}
                disabled={!leftId || !rightId}
                title="Swap Baseline and Candidate"
              >
                Swap
              </Button>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-600">Candidate (Right):</span>
                <Select
                  placeholder="Select Candidate Model"
                  className="min-w-[280px]"
                  showSearch
                  optionFilterProp="label"
                  value={rightId}
                  options={rightOptions}
                  disabled={!datasetId || rightOptions.length === 0}
                  onChange={setRightId}
                />
              </div>
            </div>

            {defaultModelRef ? (
              <Tag color="cyan" icon={<StarFilled />} className="text-xs py-0.5">
                Default Pipeline: {defaultModelRef}
              </Tag>
            ) : null}
          </div>
        </Card>

        {compareQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Comparison failed"
            description={getApiErrorMessage(compareQuery.error)}
          />
        ) : null}

        {compareQuery.isFetching ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Spin size="large" />
            <span className="text-sm text-slate-500">Computing differential metrics & sample matrix…</span>
          </div>
        ) : null}

        {compareQuery.data && verdict ? (
          <>
            {!compareQuery.data.benchmark_compatible ? (
              <Alert
                type="warning"
                showIcon
                message={compareQuery.data.warning}
                className="shadow-2xs"
              />
            ) : null}

            {/* 1. Grand Winner Hero Announcement Card */}
            <div
              className={`rounded-2xl border p-5 shadow-xs transition-all ${
                verdict.winner === "right"
                  ? "bg-gradient-to-r from-emerald-950/5 via-teal-900/5 to-emerald-950/10 border-emerald-300 dark:border-emerald-800"
                  : verdict.winner === "left"
                    ? "bg-gradient-to-r from-blue-950/5 via-indigo-900/5 to-blue-950/10 border-blue-300 dark:border-blue-800"
                    : "bg-slate-50 border-slate-300 dark:border-slate-700"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl shadow-inner ${
                      verdict.winner === "right"
                        ? "bg-emerald-600 text-white shadow-emerald-400"
                        : verdict.winner === "left"
                          ? "bg-blue-600 text-white shadow-blue-400"
                          : "bg-slate-500 text-white"
                    }`}
                  >
                    <TrophyOutlined />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Model Verdict · Based on {verdict.criteriaLabel}
                      </span>
                      {verdict.winner !== "tie" ? (
                        <Tag
                          color={verdict.winner === "right" ? "green" : "blue"}
                          className="font-bold uppercase text-[11px] px-2 py-0.5"
                        >
                          🏆 Winner: {verdict.winnerModelRef}
                        </Tag>
                      ) : (
                        <Tag color="default" className="font-bold text-[11px]">
                          ⚖️ Tied
                        </Tag>
                      )}
                    </div>

                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                      {verdict.verdictTitle}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed max-w-3xl">
                      {verdict.verdictDescription}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Tag color="gold" className="font-semibold text-xs py-0.5 px-2">
                        Margin: {verdict.winnerMargin}
                      </Tag>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {verdict.clientRecommendation}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Scorecards summary badge */}
                <div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-center dark:border-slate-700 dark:bg-slate-900/80 min-w-[200px]">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Comparative Score
                  </span>
                  <div className="mt-1 flex items-center justify-center gap-3 text-lg font-bold">
                    <span className={verdict.winner === "left" ? "text-blue-600" : "text-slate-700"}>
                      {leftModelLabel}: {verdict.scoreLeft}
                    </span>
                    <span className="text-slate-300">vs</span>
                    <span className={verdict.winner === "right" ? "text-emerald-600" : "text-slate-700"}>
                      {rightModelLabel}: {verdict.scoreRight}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Side-by-Side Model Scorecards */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Baseline Card */}
              <Card
                size="small"
                className={`relative overflow-hidden border transition-all ${
                  verdict.winner === "left"
                    ? "border-blue-400 bg-blue-50/20 shadow-md ring-1 ring-blue-400"
                    : "border-slate-200 bg-white shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Space align="center" size={6}>
                    <span className="text-xs font-semibold text-slate-500 uppercase">Baseline Model</span>
                    {leftIsDefault ? <Tag color="blue" className="text-[10px] font-bold">★ Default</Tag> : null}
                    {verdict.winner === "left" ? <Tag color="green">🏆 WINNER</Tag> : null}
                  </Space>
                  <span className="text-xs text-slate-400 font-mono">{leftRun?.id.slice(0, 10)}…</span>
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <h3 className="text-2xl font-black text-slate-900">{leftModelLabel}</h3>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">End-to-End Accuracy</span>
                    <span className="text-2xl font-extrabold text-slate-800">
                      {formatPercent(compareQuery.data.aggregates.left_end_to_end_accuracy)}
                    </span>
                  </div>
                </div>

                <Progress
                  percent={Math.round((compareQuery.data.aggregates.left_end_to_end_accuracy ?? 0) * 1000) / 10}
                  strokeColor="#2563eb"
                  size="small"
                  className="!my-2"
                />

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Passed</span>
                    <span className="font-semibold text-slate-800">
                      {leftRun?.successful_samples?.toLocaleString() ?? "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Detection</span>
                    <span className="font-semibold text-slate-800">
                      {formatPercent(leftRun?.metrics?.detection_success_rate ?? null)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Median Latency</span>
                    <span className="font-semibold text-slate-800">
                      {leftRun?.metrics?.latency_p50_ms ? `${leftRun.metrics.latency_p50_ms}ms` : "—"}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Candidate Card */}
              <Card
                size="small"
                className={`relative overflow-hidden border transition-all ${
                  verdict.winner === "right"
                    ? "border-emerald-400 bg-emerald-50/20 shadow-md ring-1 ring-emerald-400"
                    : "border-slate-200 bg-white shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Space align="center" size={6}>
                    <span className="text-xs font-semibold text-slate-500 uppercase">Candidate Model</span>
                    {rightIsDefault ? <Tag color="blue" className="text-[10px] font-bold">★ Default</Tag> : null}
                    {verdict.winner === "right" ? <Tag color="green">🏆 WINNER</Tag> : null}
                  </Space>
                  <span className="text-xs text-slate-400 font-mono">{rightRun?.id.slice(0, 10)}…</span>
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <h3 className="text-2xl font-black text-slate-900">{rightModelLabel}</h3>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">End-to-End Accuracy</span>
                    <span className="text-2xl font-extrabold text-emerald-700">
                      {formatPercent(compareQuery.data.aggregates.right_end_to_end_accuracy)}
                    </span>
                  </div>
                </div>

                <Progress
                  percent={Math.round((compareQuery.data.aggregates.right_end_to_end_accuracy ?? 0) * 1000) / 10}
                  strokeColor="#059669"
                  size="small"
                  className="!my-2"
                />

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Passed</span>
                    <span className="font-semibold text-slate-800">
                      {rightRun?.successful_samples?.toLocaleString() ?? "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Detection</span>
                    <span className="font-semibold text-slate-800">
                      {formatPercent(rightRun?.metrics?.detection_success_rate ?? null)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Median Latency</span>
                    <span className="font-semibold text-slate-800">
                      {rightRun?.metrics?.latency_p50_ms ? `${rightRun.metrics.latency_p50_ms}ms` : "—"}
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* 3. Client Impact Transition Summary (Net Gain Bar & Matrix) */}
            <Card
              size="small"
              title={
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Client Real-World Sample Transition Matrix</span>
                  <Tag
                    color={verdict.deltaNetImprovement >= 0 ? "green" : "red"}
                    className="font-bold text-xs"
                  >
                    Net Gain: {verdict.deltaNetImprovement > 0 ? `+${verdict.deltaNetImprovement}` : verdict.deltaNetImprovement} images
                  </Tag>
                </div>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5">
                  <span className="text-[11px] font-semibold text-emerald-800 uppercase block">
                    🟢 Improved (Fixed by Candidate)
                  </span>
                  <div className="text-2xl font-bold text-emerald-700 mt-1">
                    +{compareQuery.data.aggregates.improved}
                  </div>
                  <div className="text-xs text-emerald-600 mt-0.5">
                    Images baseline failed but candidate successfully resolved.
                  </div>
                </div>

                <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3.5">
                  <span className="text-[11px] font-semibold text-rose-800 uppercase block">
                    🔴 Regressed (Broken by Candidate)
                  </span>
                  <div className="text-2xl font-bold text-rose-700 mt-1">
                    −{compareQuery.data.aggregates.regressed}
                  </div>
                  <div className="text-xs text-rose-600 mt-0.5">
                    Images baseline passed but candidate failed.
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <span className="text-[11px] font-semibold text-slate-600 uppercase block">
                    ⚪ Unchanged Passed (CC)
                  </span>
                  <div className="text-2xl font-bold text-slate-700 mt-1">
                    {compareQuery.data.matrix.CC}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Images both models correctly recognized.
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5">
                  <span className="text-[11px] font-semibold text-amber-800 uppercase block">
                    🟠 Still Failing (WW)
                  </span>
                  <div className="text-2xl font-bold text-amber-700 mt-1">
                    {compareQuery.data.matrix.WW}
                  </div>
                  <div className="text-xs text-amber-600 mt-0.5">
                    Hard cases where both models currently fail.
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500">
                  Total Evaluated: {((leftRun?.total_samples || compareQuery.data.left.total_samples) || 0).toLocaleString()} images
                </span>
                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  disabled={changedSamples.length === 0}
                  onClick={() => setSamplesOpen(true)}
                  className="bg-teal-700 hover:bg-teal-800 text-white font-medium"
                >
                  Inspect Sample Differences ({changedSamples.length})
                </Button>
              </div>
            </Card>

            {/* 4. Categorized Detailed Metrics Comparison Table */}
            <Card
              size="small"
              title={
                <div className="flex flex-wrap items-center justify-between gap-3 py-1">
                  <span className="font-semibold text-slate-800 text-sm">
                    Detailed Client Metrics & Taxonomy Comparison
                  </span>
                  <Radio.Group
                    size="small"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    buttonStyle="solid"
                  >
                    <Radio.Button value="all">All Metrics</Radio.Button>
                    <Radio.Button value="core">Client Core KPIs</Radio.Button>
                    <Radio.Button value="failure">Failure Taxonomy</Radio.Button>
                    <Radio.Button value="latency">Speed & Latency</Radio.Button>
                  </Radio.Group>
                </div>
              }
            >
              <Table
                rowKey="key"
                size="small"
                pagination={false}
                columns={metricsTableColumns}
                dataSource={filteredMetricRows}
                scroll={{ x: 700 }}
              />
            </Card>
          </>
        ) : null}

        {!compareQuery.data &&
        !compareQuery.isFetching &&
        leftId &&
        rightId &&
        leftId === rightId ? (
          <Alert
            type="info"
            showIcon
            message="Please select two different completed evaluation runs to compare."
          />
        ) : null}
      </div>

      {/* Drawer to Inspect Changed Samples */}
      <Drawer
        title={
          <div className="flex items-center justify-between pr-4">
            <span>Sample Differences ({filteredSamples.length} of {changedSamples.length})</span>
            <Radio.Group
              size="small"
              value={sampleStatusFilter}
              onChange={(e) => setSampleStatusFilter(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="all">All ({changedSamples.length})</Radio.Button>
              <Radio.Button value="improved">
                Improved ({changedSamples.filter((s) => s.status === "improved").length})
              </Radio.Button>
              <Radio.Button value="regressed">
                Regressed ({changedSamples.filter((s) => s.status === "regressed").length})
              </Radio.Button>
              <Radio.Button value="still_failing">
                Still Failing ({changedSamples.filter((s) => s.status === "still_failing").length})
              </Radio.Button>
            </Radio.Group>
          </div>
        }
        width={1000}
        open={samplesOpen}
        onClose={() => setSamplesOpen(false)}
        destroyOnClose
      >
        <Table
          rowKey="dataset_sample_id"
          size="small"
          columns={sampleColumns}
          dataSource={filteredSamples}
          pagination={{ pageSize: 25, showSizeChanger: true }}
          scroll={{ x: 800 }}
        />
      </Drawer>
    </div>
  );
}
