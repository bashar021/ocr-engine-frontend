import { Alert, Card, Radio, Select, Spin, Statistic, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import { compareEvaluations } from "@/api/evaluation";
import { PageHeader } from "@/components/common/PageHeader";
import { useEvaluationsQuery } from "@/features/evaluation/useEvaluationsQuery";
import { useTaskContext } from "@/features/tasks/TaskContext";
import type {
  EvaluationComparisonResponse,
  EvaluationRun,
} from "@/types/evaluation";
import { formatPercent } from "@/utils/format";

type CompareMode = "models" | "datasets";

function evalLabel(run: EvaluationRun): string {
  const ds = run.dataset_name
    ? `${run.dataset_name}${run.dataset_version ? ` v${run.dataset_version}` : ""}`
    : run.dataset_id.slice(0, 8);
  return `${run.model_ref ?? "—"} · ${ds} · ${run.id.slice(0, 8)}…`;
}

export function EvaluationComparisonPage() {
  const { activeTaskKey } = useTaskContext();
  const [mode, setMode] = useState<CompareMode>("models");
  const [anchorDatasetId, setAnchorDatasetId] = useState<string | undefined>();
  const [anchorModelRef, setAnchorModelRef] = useState<string | undefined>();
  const [leftId, setLeftId] = useState<string | undefined>();
  const [rightId, setRightId] = useState<string | undefined>();

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

  const datasetOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const run of completed) {
      if (!run.dataset_id) continue;
      const label = run.dataset_name
        ? `${run.dataset_name}${run.dataset_version ? ` v${run.dataset_version}` : ""}`
        : run.dataset_id.slice(0, 8);
      seen.set(run.dataset_id, label);
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [completed]);

  const modelRefOptions = useMemo(() => {
    const refs = new Set<string>();
    for (const run of completed) {
      if (run.model_ref) refs.add(run.model_ref);
    }
    return [...refs].sort().map((r) => ({ value: r, label: r }));
  }, [completed]);

  const leftOptions = useMemo(() => {
    let pool = completed;
    if (mode === "models") {
      if (!anchorDatasetId) return [];
      pool = pool.filter((r) => r.dataset_id === anchorDatasetId);
    } else {
      if (!anchorModelRef) return [];
      pool = pool.filter((r) => r.model_ref === anchorModelRef);
    }
    return pool.map((r) => ({ value: r.id, label: evalLabel(r) }));
  }, [completed, mode, anchorDatasetId, anchorModelRef]);

  const rightOptions = useMemo(() => {
    return leftOptions.filter((o) => o.value !== leftId);
  }, [leftOptions, leftId]);

  const compareQuery = useQuery({
    queryKey: ["evaluation", "compare", leftId, rightId],
    queryFn: () => compareEvaluations(leftId!, rightId!),
    enabled: Boolean(leftId && rightId && leftId !== rightId),
  });

  type CompareSample = EvaluationComparisonResponse["samples"][number];

  const sampleColumns: ColumnsType<CompareSample> = useMemo(
      () => [
        {
          title: "Status",
          dataIndex: "status",
          width: 120,
          render: (v: string) => {
            const color =
              v === "improved"
                ? "green"
                : v === "regressed"
                  ? "red"
                  : v === "still_failing"
                    ? "orange"
                    : "default";
            return <Tag color={color}>{v}</Tag>;
          },
        },
        { title: "Matrix", dataIndex: "matrix", width: 80 },
        {
          title: "Ground truth",
          dataIndex: "ground_truth",
          ellipsis: true,
        },
        {
          title: "Left pred.",
          dataIndex: "left_predicted",
          ellipsis: true,
        },
        {
          title: "Right pred.",
          dataIndex: "right_predicted",
          ellipsis: true,
        },
        {
          title: "Left failure",
          dataIndex: "left_failure_type",
          width: 140,
        },
        {
          title: "Right failure",
          dataIndex: "right_failure_type",
          width: 140,
        },
      ],
      [],
    );

  const changedSamples = useMemo(() => {
    const samples = compareQuery.data?.samples ?? [];
    return samples.filter((s) => s.status !== "unchanged");
  }, [compareQuery.data?.samples]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader title="Evaluation comparison" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6">
        <Card size="small" title="Compare mode">
          <Radio.Group
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as CompareMode);
              setAnchorDatasetId(undefined);
              setAnchorModelRef(undefined);
              setLeftId(undefined);
              setRightId(undefined);
            }}
          >
            <Radio.Button value="models">By model refs (same dataset)</Radio.Button>
            <Radio.Button value="datasets">
              By datasets (same model ref)
            </Radio.Button>
          </Radio.Group>
        </Card>

        <Card size="small" title="Select evaluations">
          <div className="flex flex-wrap items-center gap-3">
            {mode === "models" ? (
              <Select
                placeholder="Dataset"
                className="min-w-[220px]"
                showSearch
                optionFilterProp="label"
                value={anchorDatasetId}
                options={datasetOptions}
                loading={completedQuery.isLoading}
                onChange={(v) => {
                  setAnchorDatasetId(v);
                  setLeftId(undefined);
                  setRightId(undefined);
                }}
              />
            ) : (
              <Select
                placeholder="Model ref"
                className="w-48"
                showSearch
                optionFilterProp="label"
                value={anchorModelRef}
                options={modelRefOptions}
                loading={completedQuery.isLoading}
                onChange={(v) => {
                  setAnchorModelRef(v);
                  setLeftId(undefined);
                  setRightId(undefined);
                }}
              />
            )}
            <Select
              placeholder="Left (champion)"
              className="min-w-[280px]"
              showSearch
              optionFilterProp="label"
              value={leftId}
              options={leftOptions}
              disabled={leftOptions.length === 0}
              onChange={setLeftId}
            />
            <Select
              placeholder="Right (candidate)"
              className="min-w-[280px]"
              showSearch
              optionFilterProp="label"
              value={rightId}
              options={rightOptions}
              disabled={rightOptions.length === 0}
              onChange={setRightId}
            />
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
          <div className="flex justify-center py-8">
            <Spin />
          </div>
        ) : null}

        {compareQuery.data ? (
          <>
            {!compareQuery.data.benchmark_compatible ? (
              <Alert type="warning" showIcon message={compareQuery.data.warning} />
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card size="small">
                <Statistic
                  title="Left E2E accuracy"
                  value={formatPercent(
                    compareQuery.data.aggregates.left_end_to_end_accuracy,
                  )}
                />
              </Card>
              <Card size="small">
                <Statistic
                  title="Right E2E accuracy"
                  value={formatPercent(
                    compareQuery.data.aggregates.right_end_to_end_accuracy,
                  )}
                />
              </Card>
              <Card size="small">
                <Statistic
                  title="Improved"
                  value={compareQuery.data.aggregates.improved}
                  valueStyle={{ color: "#16a34a" }}
                />
              </Card>
              <Card size="small">
                <Statistic
                  title="Regressed"
                  value={compareQuery.data.aggregates.regressed}
                  valueStyle={{ color: "#dc2626" }}
                />
              </Card>
            </div>

            <Card size="small" title="CC / CW / WC / WW matrix">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(["CC", "CW", "WC", "WW"] as const).map((key) => (
                  <div
                    key={key}
                    className="rounded border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="text-2xl font-semibold">
                      {compareQuery.data!.matrix[key]}
                    </div>
                    <div className="text-xs text-slate-500">
                      {compareQuery.data!.matrix.definitions[key]}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-sm text-slate-600">
                Unchanged: {compareQuery.data.aggregates.unchanged} · Still
                failing: {compareQuery.data.aggregates.still_failing}
              </div>
            </Card>

            <Card size="small" title="Changed samples">
              <Table
                rowKey="dataset_sample_id"
                size="small"
                columns={sampleColumns}
                dataSource={changedSamples}
                pagination={{ pageSize: 20, showSizeChanger: true }}
                scroll={{ x: 900 }}
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
            message="Select two different completed evaluations to compare."
          />
        ) : null}
      </div>
    </div>
  );
}
