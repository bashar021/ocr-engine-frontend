import {
  Alert,
  Button,
  Modal,
  Select,
  Space,
  Statistic,
  Tag,
  message,
} from "antd";
import { useMemo, useState } from "react";

import { getApiErrorMessage } from "@/api/client";
import { compareEvaluations } from "@/api/evaluation";
import { DataTableToolbar } from "@/components/common/DataTableToolbar";
import { PageHeader } from "@/components/common/PageHeader";
import { EvaluationResultsDrawer } from "@/components/evaluation/EvaluationResultsDrawer";
import { EvaluationsTable } from "@/components/evaluation/EvaluationsTable";
import { EVALUATION_POLL_INTERVAL_MS } from "@/constants/polling";
import { useCancelEvaluation } from "@/features/evaluation/useEvaluationMutations";
import { useEvaluationsQuery } from "@/features/evaluation/useEvaluationsQuery";
import type { EvaluationRun } from "@/types/evaluation";

const RUN_STATUSES = [
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

type ComparePayload = {
  benchmark_compatible: boolean;
  warning: string | null;
  aggregates: {
    left_end_to_end_accuracy: number | null;
    right_end_to_end_accuracy: number | null;
    improved: number;
    regressed: number;
    unchanged: number;
    still_failing: number;
  };
  promotion?: { status: string; reasons: string[] };
};

export function EvaluationRunsPage() {
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [resultsRunId, setResultsRunId] = useState<string | null>(null);
  const [compareLeft, setCompareLeft] = useState<string | undefined>();
  const [compareRight, setCompareRight] = useState<string | undefined>();
  const [compareResult, setCompareResult] = useState<ComparePayload | null>(
    null,
  );
  const [compareOpen, setCompareOpen] = useState(false);
  const [comparing, setComparing] = useState(false);
  const cancelMutation = useCancelEvaluation();

  const params = useMemo(
    () => ({
      status,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      include_metrics: true,
    }),
    [status, page, pageSize],
  );

  const query = useEvaluationsQuery(params);
  const completedOptions = useMemo(
    () =>
      (query.data?.evaluations ?? [])
        .filter((r) => r.status === "completed")
        .map((r) => ({
          value: r.id,
          label: `${r.model_ref ?? "eval"} · ${r.id.slice(0, 8)}`,
        })),
    [query.data?.evaluations],
  );

  const handleCancel = async (run: EvaluationRun) => {
    try {
      await cancelMutation.mutateAsync(run.id);
      message.success("Evaluation cancelled");
    } catch (error) {
      message.error(getApiErrorMessage(error));
    }
  };

  const runCompare = async () => {
    if (!compareLeft || !compareRight) {
      message.warning("Select baseline and candidate evaluations");
      return;
    }
    setComparing(true);
    try {
      const data = (await compareEvaluations(
        compareLeft,
        compareRight,
      )) as ComparePayload;
      setCompareResult(data);
      setCompareOpen(true);
    } catch (error) {
      message.error(getApiErrorMessage(error));
    } finally {
      setComparing(false);
    }
  };

  const promotionColor =
    compareResult?.promotion?.status === "PASS"
      ? "green"
      : compareResult?.promotion?.status === "WARNING"
        ? "gold"
        : "red";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: "Dashboard", path: "/" },
          { title: "Dataset", path: "/evaluation/datasets" },
          { title: "Evaluation runs" },
        ]}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        <DataTableToolbar
          left={
            <>
              <Select
                allowClear
                placeholder="Status"
                className="w-40"
                options={RUN_STATUSES}
                value={status}
                onChange={(v) => {
                  setStatus(v);
                  setPage(1);
                }}
              />
              <span className="text-xs text-slate-400">
                Polling every {EVALUATION_POLL_INTERVAL_MS / 1000}s while active
              </span>
            </>
          }
          right={
            <span className="text-sm text-slate-500">
              {query.data?.total ?? 0} run
              {(query.data?.total ?? 0) === 1 ? "" : "s"}
            </span>
          }
        />

        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="min-w-[200px] flex-1">
            <div className="mb-1 text-xs text-slate-500">Baseline (left)</div>
            <Select
              className="w-full"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Select evaluation"
              options={completedOptions}
              value={compareLeft}
              onChange={setCompareLeft}
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <div className="mb-1 text-xs text-slate-500">Candidate (right)</div>
            <Select
              className="w-full"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Select evaluation"
              options={completedOptions}
              value={compareRight}
              onChange={setCompareRight}
            />
          </div>
          <Button
            type="primary"
            loading={comparing}
            onClick={() => void runCompare()}
          >
            Compare & promotion gate
          </Button>
        </div>

        {query.isError ? (
          <Alert
            type="error"
            showIcon
            message="Failed to load evaluation runs"
            description={getApiErrorMessage(query.error)}
            action={
              <Button size="small" onClick={() => void query.refetch()}>
                Retry
              </Button>
            }
          />
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto">
          <EvaluationsTable
            data={query.data?.evaluations ?? []}
            loading={query.isLoading || query.isFetching}
            total={query.data?.total ?? 0}
            page={page}
            pageSize={pageSize}
            onPageChange={(p, s) => {
              setPage(p);
              setPageSize(s);
            }}
            onViewResults={(run) => setResultsRunId(run.id)}
            onCancel={(run) => void handleCancel(run)}
          />
        </div>
      </div>
      <EvaluationResultsDrawer
        open={Boolean(resultsRunId)}
        evaluationId={resultsRunId}
        onClose={() => setResultsRunId(null)}
      />

      <Modal
        title="Evaluation compare"
        open={compareOpen}
        onCancel={() => setCompareOpen(false)}
        footer={
          <Button type="primary" onClick={() => setCompareOpen(false)}>
            Close
          </Button>
        }
        width={640}
      >
        {compareResult ? (
          <div className="space-y-4">
            {!compareResult.benchmark_compatible ? (
              <Alert
                type="warning"
                showIcon
                message="Not a direct benchmark"
                description={compareResult.warning}
              />
            ) : null}
            <div>
              Promotion:{" "}
              <Tag color={promotionColor}>
                {compareResult.promotion?.status ?? "—"}
              </Tag>
            </div>
            <ul className="list-disc pl-5 text-sm text-slate-600">
              {(compareResult.promotion?.reasons ?? []).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <Space size="large" wrap>
              <Statistic
                title="Baseline acc"
                value={
                  compareResult.aggregates.left_end_to_end_accuracy == null
                    ? "—"
                    : `${(compareResult.aggregates.left_end_to_end_accuracy * 100).toFixed(1)}%`
                }
              />
              <Statistic
                title="Candidate acc"
                value={
                  compareResult.aggregates.right_end_to_end_accuracy == null
                    ? "—"
                    : `${(compareResult.aggregates.right_end_to_end_accuracy * 100).toFixed(1)}%`
                }
              />
              <Statistic
                title="Improved"
                value={compareResult.aggregates.improved}
              />
              <Statistic
                title="Regressed"
                value={compareResult.aggregates.regressed}
              />
              <Statistic
                title="Still failing"
                value={compareResult.aggregates.still_failing}
              />
            </Space>
            <Alert
              type="info"
              showIcon
              message="Activation is human-only"
              description="Create or activate a model ref manually after reviewing this gate. Candidates are never auto-promoted."
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
