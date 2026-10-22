import { Alert, App, Button, Form, Modal, Popconfirm, Select, Space } from "antd";
import { PlayCircleOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { getApiErrorMessage } from "@/api/client";
import { getDatabank, listDatabankDatasets } from "@/api/databank";
import { DataTableToolbar } from "@/components/common/DataTableToolbar";
import { PageHeader } from "@/components/common/PageHeader";
import { EvaluationMetricsModal } from "@/components/evaluation/EvaluationMetricsModal";
import { EvaluationResultsDrawer } from "@/components/evaluation/EvaluationResultsDrawer";
import { EvaluationsTable } from "@/components/evaluation/EvaluationsTable";
import { EVALUATION_POLL_INTERVAL_MS } from "@/constants/polling";
import {
  useCancelEvaluation,
  useDeleteAllEvaluations,
  useDeleteEvaluation,
  useReEvaluate,
  useStartEvaluation,
} from "@/features/evaluation/useEvaluationMutations";
import { useEvaluationsQuery } from "@/features/evaluation/useEvaluationsQuery";
import { useModelRefsQuery } from "@/features/models/useModelRefsQuery";
import { useTaskContext } from "@/features/tasks/TaskContext";
import type { EvaluationRun } from "@/types/evaluation";
import {
  EVALUATION_SORT_OPTIONS,
  canReEvaluateRun,
  sortEvaluations,
  type EvaluationSortKey,
} from "@/utils/evaluationSort";
import { isRealLabelDataset } from "@/utils/datasetFilters";

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
  const [metricsRun, setMetricsRun] = useState<EvaluationRun | null>(null);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runForm] = Form.useForm<{
    dataset_id: string;
    model_ref: string;
    evaluation_type: string;
    batch_size: number;
    worker_threads: number;
  }>();

  const cancelMutation = useCancelEvaluation();
  const deleteMutation = useDeleteEvaluation();
  const deleteAllMutation = useDeleteAllEvaluations();
  const reEvaluateMutation = useReEvaluate();
  const startEvaluationMutation = useStartEvaluation();

  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [reEvaluateLoadingId, setReEvaluateLoadingId] = useState<string | null>(
    null,
  );
  const [sortKey, setSortKey] = useState<EvaluationSortKey>("created_desc");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [bulkReEvaluateLoading, setBulkReEvaluateLoading] = useState(false);

  // 1. Query only real Label Data datasets (excluding any raw datasets)
  const labelDatasetsQuery = useQuery({
    queryKey: ["databank", "datasets-list", activeTaskKey, "label"],
    queryFn: () => listDatabankDatasets(activeTaskKey, { dataset_type: "label" }),
  });

  const defaultBankQuery = useQuery({
    queryKey: ["databank", "default-label-bank", activeTaskKey],
    queryFn: () => getDatabank(activeTaskKey, "label"),
  });

  const labelDatasets = useMemo(() => {
    const list = labelDatasetsQuery.data?.datasets || [];
    const filtered = list.filter((d) => isRealLabelDataset(d));
    if (filtered.length === 0 && defaultBankQuery.data && isRealLabelDataset(defaultBankQuery.data)) {
      return [defaultBankQuery.data];
    }
    return filtered;
  }, [labelDatasetsQuery.data?.datasets, defaultBankQuery.data]);

  const datasetOptions = useMemo(
    () =>
      labelDatasets.map((d) => ({
        value: d.id,
        label: `${d.name} (${d.sample_count ?? 0} samples)`,
      })),
    [labelDatasets],
  );

  // 2. Query available model pipelines for running evaluation
  const modelRefsQuery = useModelRefsQuery(
    { ocr_type: activeTaskKey, include_metrics: false },
    runModalOpen || true,
  );

  const availableModelRefOptions = useMemo(() => {
    const refs = (modelRefsQuery.data?.refs ?? []).filter(
      (r) => r.status === "active" || r.status === "draft",
    );
    return refs.map((r) => ({
      value: r.model_ref,
      label: r.is_llm
        ? `${r.model_ref} (LLM direct evaluation, ${r.status})`
        : `${r.model_ref} (${r.status}${r.is_default ? ", default" : ""})`,
      isDefault: r.is_default,
      isLlm: r.is_llm,
    }));
  }, [modelRefsQuery.data?.refs]);

  // Pre-fill modal fields when opened
  useEffect(() => {
    if (runModalOpen) {
      const defaultDs = datasetId || labelDatasets[0]?.id || "";
      const defaultModel =
        availableModelRefOptions.find((m) => m.isDefault)?.value ||
        availableModelRefOptions[0]?.value ||
        "";
      runForm.setFieldsValue({
        dataset_id: defaultDs,
        model_ref: defaultModel,
        evaluation_type: "test",
        batch_size: 16,
        worker_threads: 4,
      });
    }
  }, [runModalOpen, datasetId, labelDatasets, availableModelRefOptions, runForm]);

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

  const sortedEvaluations = useMemo(
    () => sortEvaluations(query.data?.evaluations ?? [], sortKey),
    [query.data?.evaluations, sortKey],
  );

  const selectedRuns = useMemo(
    () => sortedEvaluations.filter((r) => selectedRowKeys.includes(r.id)),
    [sortedEvaluations, selectedRowKeys],
  );

  const canBulkReEvaluate =
    selectedRuns.length > 0 &&
    selectedRuns.every((r) => canReEvaluateRun(r));

  const modelRefOptions = useMemo(() => {
    const refs = new Set<string>();
    for (const run of query.data?.evaluations ?? []) {
      if (run.model_ref) refs.add(run.model_ref);
    }
    for (const m of availableModelRefOptions) {
      refs.add(m.value);
    }
    return [...refs].sort().map((r) => ({ value: r, label: r }));
  }, [query.data?.evaluations, availableModelRefOptions]);

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

  const executeEvaluation = async (
    values: {
      dataset_id: string;
      model_ref: string;
      evaluation_type: string;
      batch_size?: number;
      worker_threads?: number;
    },
    force = false,
  ) => {
    await startEvaluationMutation.mutateAsync({
      dataset_id: values.dataset_id,
      ocr_type: activeTaskKey,
      model_ref: values.model_ref,
      evaluation_type: values.evaluation_type,
      evaluation_config: {
        batch_size: values.batch_size || 16,
        worker_threads: values.worker_threads || 4,
      },
      force,
    });
    message.success(
      force ? "Re-evaluation queued" : "Evaluation run queued successfully",
    );
    setRunModalOpen(false);
    runForm.resetFields();
    setPage(1);
  };

  const handleStartEvaluationSubmit = async () => {
    try {
      const values = await runForm.validateFields();
      await executeEvaluation(values, false);
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      const errorCode =
        axios.isAxiosError(error) &&
        (error.response?.data as { error_code?: string } | undefined)?.error_code;
      if (errorCode === "EVALUATION_ALREADY_EXISTS") {
        Modal.confirm({
          title: "Evaluation already exists",
          content:
            "An evaluation already exists for this dataset and pipeline. Re-evaluate by deleting the prior run and queueing a new one?",
          okText: "Re-evaluate",
          onOk: async () => {
            const vals = runForm.getFieldsValue();
            await executeEvaluation(vals, true);
          },
        });
        return;
      }
      message.error(getApiErrorMessage(error));
    }
  };

  const handleReEvaluateSelected = () => {
    if (!canBulkReEvaluate) return;
    Modal.confirm({
      title: `Re-evaluate ${selectedRuns.length} run(s)?`,
      content:
        "Deletes each existing run for its dataset/pipeline and queues a new evaluation.",
      okText: "Re-evaluate",
      onOk: async () => {
        setBulkReEvaluateLoading(true);
        try {
          const results = await Promise.allSettled(
            selectedRuns.map((run) => reEvaluateMutation.mutateAsync(run)),
          );
          const ok = results.filter((r) => r.status === "fulfilled").length;
          const failed = results.length - ok;
          if (failed === 0) {
            message.success(`Queued ${ok} re-evaluation(s)`);
          } else {
            message.warning(`Queued ${ok}; ${failed} failed`);
          }
          setSelectedRowKeys([]);
        } catch (error) {
          message.error(getApiErrorMessage(error));
        } finally {
          setBulkReEvaluateLoading(false);
        }
      },
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Evaluation runs"
        actions={
          <Space wrap>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => setRunModalOpen(true)}
              className="bg-teal-700 hover:bg-teal-800 font-medium shadow-xs text-white"
            >
              Run Evaluation
            </Button>
            <Button
              disabled={!canBulkReEvaluate}
              loading={bulkReEvaluateLoading}
              onClick={handleReEvaluateSelected}
            >
              Re-evaluate selected
            </Button>
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
          </Space>
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
                className="min-w-[220px]"
                showSearch
                optionFilterProp="label"
                value={datasetId}
                options={datasetOptions}
                loading={labelDatasetsQuery.isLoading}
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
              <Select
                className="min-w-[200px]"
                value={sortKey}
                options={EVALUATION_SORT_OPTIONS}
                onChange={(v: EvaluationSortKey) => setSortKey(v)}
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
            data={sortedEvaluations}
            loading={query.isLoading || query.isFetching}
            total={query.data?.total ?? 0}
            page={page}
            pageSize={pageSize}
            onPageChange={(p, s) => {
              setPage(p);
              setPageSize(s);
            }}
            onViewResults={(run) => setResultsRunId(run.id)}
            onViewMetrics={(run) => setMetricsRun(run)}
            onCancel={(run) => void handleCancel(run)}
            onDelete={(run) => void handleDelete(run)}
            onReEvaluate={(run) => void handleReEvaluate(run)}
            deleteLoadingId={deleteLoadingId}
            reEvaluateLoadingId={reEvaluateLoadingId}
            selectedRowKeys={selectedRowKeys}
            onSelectedRowKeysChange={setSelectedRowKeys}
          />
        </div>
      </div>
      <EvaluationResultsDrawer
        open={Boolean(resultsRunId)}
        evaluationId={resultsRunId}
        onClose={() => setResultsRunId(null)}
      />
      <EvaluationMetricsModal
        open={Boolean(metricsRun)}
        run={metricsRun}
        onClose={() => setMetricsRun(null)}
        onViewResults={(run) => {
          setMetricsRun(null);
          setResultsRunId(run.id);
        }}
      />

      {/* Modal to Run Evaluation on Label Dataset */}
      <Modal
        title="Run Evaluation on Label Dataset"
        open={runModalOpen}
        onCancel={() => setRunModalOpen(false)}
        onOk={handleStartEvaluationSubmit}
        confirmLoading={startEvaluationMutation.isPending}
        okText="Start Evaluation"
        okButtonProps={{ className: "bg-teal-700 hover:bg-teal-800 font-medium text-white" }}
        destroyOnHidden
      >
        <Form form={runForm} layout="vertical" className="pt-2">
          <Form.Item
            name="dataset_id"
            label="Label Dataset"
            rules={[{ required: true, message: "Please select a label dataset" }]}
            extra="Only verified real label datasets are available for evaluation."
          >
            <Select
              placeholder="Select label dataset"
              options={datasetOptions}
              showSearch
              optionFilterProp="label"
              loading={labelDatasetsQuery.isLoading}
            />
          </Form.Item>

          <Form.Item
            name="model_ref"
            label="Model / Pipeline"
            rules={[{ required: true, message: "Please select a model pipeline" }]}
            extra="Choose qwen2.5vl:7b for a direct LLM evaluation. Its accuracy and run metrics are saved alongside the OCR pipeline metrics."
          >
            <Select
              placeholder="Select model pipeline"
              options={availableModelRefOptions}
              showSearch
              optionFilterProp="label"
              loading={modelRefsQuery.isLoading}
            />
          </Form.Item>

          <Form.Item
            name="evaluation_type"
            label="Evaluation Type"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "test", label: "Test (Standard Evaluation)" },
                { value: "benchmark", label: "Benchmark" },
                { value: "validation", label: "Validation" },
              ]}
            />
          </Form.Item>

          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/40">
            <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              ⚡ Laptop Acceleration & Execution Tuning
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Form.Item
                name="batch_size"
                label="Batch Size"
                initialValue={16}
                rules={[{ required: true }]}
                extra="Standard: 16 images per batch"
                className="!mb-0"
              >
                <Select
                  options={[
                    { value: 8, label: "8 (Low RAM / Dual-core)" },
                    { value: 16, label: "16 (Recommended for Laptops)" },
                    { value: 32, label: "32 (High Performance)" },
                    { value: 64, label: "64 (Workstation / Server)" },
                  ]}
                />
              </Form.Item>

              <Form.Item
                name="worker_threads"
                label="Parallel Workers"
                initialValue={4}
                rules={[{ required: true }]}
                extra="Standard: 4 threads"
                className="!mb-0"
              >
                <Select
                  options={[
                    { value: 1, label: "1 (Single-threaded)" },
                    { value: 2, label: "2 (Light / Background)" },
                    { value: 4, label: "4 (Recommended for Laptops)" },
                    { value: 8, label: "8 (High Performance)" },
                  ]}
                />
              </Form.Item>
            </div>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
