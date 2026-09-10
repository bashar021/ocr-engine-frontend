import { Alert, App, Button, Popconfirm, Select } from "antd";
import { useMemo, useState } from "react";

import { getApiErrorMessage } from "@/api/client";
import { DataTableToolbar } from "@/components/common/DataTableToolbar";
import { PageHeader } from "@/components/common/PageHeader";
import { EvaluationResultsDrawer } from "@/components/evaluation/EvaluationResultsDrawer";
import { EvaluationsTable } from "@/components/evaluation/EvaluationsTable";
import { EVALUATION_POLL_INTERVAL_MS } from "@/constants/polling";
import {
  useCancelEvaluation,
  useDeleteAllEvaluations,
  useDeleteEvaluation,
  useReEvaluate,
} from "@/features/evaluation/useEvaluationMutations";
import { useEvaluationsQuery } from "@/features/evaluation/useEvaluationsQuery";
import { useDatasetsQuery } from "@/features/evaluation/useDatasetsQuery";
import { useTaskContext } from "@/features/tasks/TaskContext";
import type { EvaluationRun } from "@/types/evaluation";

const RUN_STATUSES = [
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

export function EvaluationRunsPage() {
  const { message } = App.useApp();
  const { activeTaskKey } = useTaskContext();
  const [modelRef, setModelRef] = useState<string | undefined>();
  const [datasetId, setDatasetId] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [resultsRunId, setResultsRunId] = useState<string | null>(null);
  const cancelMutation = useCancelEvaluation();
  const deleteMutation = useDeleteEvaluation();
  const deleteAllMutation = useDeleteAllEvaluations();
  const reEvaluateMutation = useReEvaluate();
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [reEvaluateLoadingId, setReEvaluateLoadingId] = useState<string | null>(
    null,
  );

  const datasetsQuery = useDatasetsQuery({
    scope: "evaluation",
    ocr_type: activeTaskKey,
    status: "ready",
    limit: 200,
  });

  const params = useMemo(
    () => ({
      ocr_type: activeTaskKey,
      model_ref: modelRef,
      dataset_id: datasetId,
      status,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      include_metrics: true,
    }),
    [activeTaskKey, modelRef, datasetId, status, page, pageSize],
  );

  const query = useEvaluationsQuery(params);

  const modelRefOptions = useMemo(() => {
    const refs = new Set<string>();
    for (const run of query.data?.evaluations ?? []) {
      if (run.model_ref) refs.add(run.model_ref);
    }
    return [...refs].sort().map((r) => ({ value: r, label: r }));
  }, [query.data?.evaluations]);

  const datasetOptions = useMemo(
    () =>
      (datasetsQuery.data?.datasets ?? []).map((d) => ({
        value: d.id,
        label: `${d.name} v${d.version}`,
      })),
    [datasetsQuery.data?.datasets],
  );

  const handleCancel = async (run: EvaluationRun) => {
    try {
      await cancelMutation.mutateAsync(run.id);
      message.success("Evaluation cancelled");
    } catch (error) {
      message.error(getApiErrorMessage(error));
    }
  };

  const handleDelete = async (run: EvaluationRun) => {
    setDeleteLoadingId(run.id);
    try {
      await deleteMutation.mutateAsync(run.id);
      message.success("Evaluation deleted");
    } catch (error) {
      message.error(getApiErrorMessage(error));
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const handleReEvaluate = async (run: EvaluationRun) => {
    setReEvaluateLoadingId(run.id);
    try {
      await reEvaluateMutation.mutateAsync(run);
      message.success("Re-evaluation queued");
    } catch (error) {
      message.error(getApiErrorMessage(error));
    } finally {
      setReEvaluateLoadingId(null);
    }
  };

  const handleDeleteAll = async () => {
    try {
      const result = await deleteAllMutation.mutateAsync(activeTaskKey);
      message.success(`Deleted ${result.deleted} evaluation(s)`);
    } catch (error) {
      message.error(getApiErrorMessage(error));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Evaluation runs"
        actions={
          <Popconfirm
            title="Delete all evaluations?"
            description="Cancels active runs and permanently removes all evaluation history for this task."
            okText="Delete all"
            okButtonProps={{ danger: true }}
            onConfirm={() => void handleDeleteAll()}
          >
            <Button danger loading={deleteAllMutation.isPending}>
              Delete all evaluations
            </Button>
          </Popconfirm>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        <DataTableToolbar
          left={
            <>
              <Select
                allowClear
                placeholder="Model ref"
                className="w-40"
                showSearch
                optionFilterProp="label"
                value={modelRef}
                options={modelRefOptions}
                onChange={(v) => {
                  setModelRef(v);
                  setPage(1);
                }}
              />
              <Select
                allowClear
                placeholder="Dataset"
                className="min-w-[200px]"
                showSearch
                optionFilterProp="label"
                value={datasetId}
                options={datasetOptions}
                loading={datasetsQuery.isLoading}
                onChange={(v) => {
                  setDatasetId(v);
                  setPage(1);
                }}
              />
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
            onDelete={(run) => void handleDelete(run)}
            onReEvaluate={(run) => void handleReEvaluate(run)}
            deleteLoadingId={deleteLoadingId}
            reEvaluateLoadingId={reEvaluateLoadingId}
          />
        </div>
      </div>
      <EvaluationResultsDrawer
        open={Boolean(resultsRunId)}
        evaluationId={resultsRunId}
        onClose={() => setResultsRunId(null)}
      />
    </div>
  );
}
