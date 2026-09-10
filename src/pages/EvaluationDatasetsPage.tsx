import { ExperimentOutlined } from "@ant-design/icons";
import { App, Alert, Button, Select } from "antd";
import { useMemo, useState } from "react";

import { getApiErrorMessage } from "@/api/client";
import { DataTableToolbar } from "@/components/common/DataTableToolbar";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchInput } from "@/components/common/SearchInput";
import { DatasetSamplesDrawer } from "@/components/evaluation/DatasetSamplesDrawer";
import { DatasetsTable } from "@/components/evaluation/DatasetsTable";
import { StartEvaluationModal } from "@/components/evaluation/StartEvaluationModal";
import { UploadDatasetModal } from "@/components/evaluation/UploadDatasetModal";
import { EVALUATION_POLL_INTERVAL_MS } from "@/constants/polling";
import {
  useArchiveDataset,
  useHardDeleteDataset,
} from "@/features/evaluation/useEvaluationMutations";
import { useDatasetsQuery } from "@/features/evaluation/useDatasetsQuery";
import { useTaskContext } from "@/features/tasks/TaskContext";
import { useDebounce } from "@/hooks/useDebounce";
import type { EvaluationDataset } from "@/types/evaluation";
import { getDatasetDeleteAvailability } from "@/utils/datasetDeleteAvailability";

const DATASET_STATUSES = [
  { value: "uploading", label: "Uploading" },
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "failed", label: "Failed" },
  { value: "consumed", label: "Consumed" },
  { value: "archived", label: "Archived" },
];

const DATASET_ORIGINS = [
  { value: "upload", label: "Uploaded" },
  { value: "curated_hard_case", label: "System curated" },
  { value: "merged_training", label: "Merged training" },
  { value: "system", label: "System" },
  { value: "databank_reviewed", label: "Databank reviewed" },
  { value: "databank_blurry", label: "Databank blurry" },
  { value: "databank_dead", label: "Databank dead" },
];

const SOURCE_TYPES = [
  { value: "zip_upload", label: "ZIP upload" },
  { value: "system", label: "System" },
];

function datasetOrigin(dataset: EvaluationDataset): string {
  return (
    dataset.origin ||
    (typeof dataset.metadata?.origin === "string"
      ? dataset.metadata.origin
      : "upload")
  );
}

export function EvaluationDatasetsPage() {
  const { activeTaskKey } = useTaskContext();
  const { modal, message } = App.useApp();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [origin, setOrigin] = useState<string | undefined>();
  const [sourceType, setSourceType] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebounce(search, 300);
  const hasClientFilters = Boolean(origin || sourceType);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [samplesDataset, setSamplesDataset] =
    useState<EvaluationDataset | null>(null);
  const [evalDataset, setEvalDataset] = useState<EvaluationDataset | null>(
    null,
  );
  const archiveMutation = useArchiveDataset();
  const hardDeleteMutation = useHardDeleteDataset();

  const params = useMemo(
    () => ({
      scope: "evaluation" as const,
      search: debouncedSearch || undefined,
      ocr_type: activeTaskKey,
      status,
      include_archived: status === "archived",
      limit: hasClientFilters ? 500 : pageSize,
      offset: hasClientFilters ? 0 : (page - 1) * pageSize,
    }),
    [debouncedSearch, activeTaskKey, status, page, pageSize, hasClientFilters],
  );

  const query = useDatasetsQuery(params);

  const filteredDatasets = useMemo(() => {
    let rows = query.data?.datasets ?? [];
    if (origin) {
      rows = rows.filter((d) => datasetOrigin(d) === origin);
    }
    if (sourceType) {
      rows = rows.filter((d) => d.source_type === sourceType);
    }
    return rows;
  }, [query.data?.datasets, origin, sourceType]);

  const pagedDatasets = useMemo(() => {
    if (!hasClientFilters) return filteredDatasets;
    const start = (page - 1) * pageSize;
    return filteredDatasets.slice(start, start + pageSize);
  }, [filteredDatasets, hasClientFilters, page, pageSize]);

  const displayTotal = hasClientFilters
    ? filteredDatasets.length
    : (query.data?.total ?? 0);

  const deletePending =
    archiveMutation.isPending || hardDeleteMutation.isPending;

  const handleSoftDelete = (dataset: EvaluationDataset) => {
    const del = getDatasetDeleteAvailability(dataset, {
      mutating: deletePending,
    });
    if (!del.canSoftDelete) {
      message.warning(del.softReason ?? "Soft delete unavailable");
      return;
    }
    modal.confirm({
      title: "Soft delete dataset?",
      content: (
        <div className="text-sm text-slate-600">
          Archives <strong>{dataset.name}</strong> v{dataset.version}. It leaves
          the default list (filter Status → Archived to see it). Images stay on
          disk until you hard-delete. Evaluation history is kept.
        </div>
      ),
      okText: "Archive",
      okButtonProps: { danger: true },
      centered: true,
      zIndex: 1100,
      onOk: async () => {
        try {
          await archiveMutation.mutateAsync(dataset.id);
          message.success(
            "Dataset archived — filter Status = Archived to view it",
          );
        } catch (error) {
          message.error(getApiErrorMessage(error));
          throw error;
        }
      },
    });
  };

  const handleHardDelete = (dataset: EvaluationDataset) => {
    const del = getDatasetDeleteAvailability(dataset, {
      mutating: deletePending,
    });
    if (!del.canHardDelete) {
      message.warning(del.hardReason ?? "Hard delete unavailable");
      return;
    }
    modal.confirm({
      title: "Hard delete dataset?",
      content: (
        <div className="text-sm text-slate-600">
          Permanently removes <strong>{dataset.name}</strong> v{dataset.version}
          , its images, samples, and all evaluation runs for this dataset. This
          cannot be undone.
        </div>
      ),
      okText: "Delete forever",
      okButtonProps: { danger: true },
      centered: true,
      zIndex: 1100,
      onOk: async () => {
        try {
          await hardDeleteMutation.mutateAsync(dataset.id);
          message.success("Dataset permanently deleted");
        } catch (error) {
          message.error(getApiErrorMessage(error));
          throw error;
        }
      },
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: "Dashboard", path: "/" },
          { title: "Dataset", path: "/evaluation/datasets" },
          { title: "Datasets" },
        ]}
        actions={
          <Button
            type="primary"
            icon={<ExperimentOutlined />}
            onClick={() => setUploadOpen(true)}
          >
            Upload dataset
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        <DataTableToolbar
          left={
            <>
              <SearchInput
                className="w-full max-w-xs"
                placeholder="Search datasets…"
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
              />
              <Select
                allowClear
                placeholder="Status"
                className="w-40"
                options={DATASET_STATUSES}
                value={status}
                onChange={(v) => {
                  setStatus(v);
                  setPage(1);
                }}
              />
              <Select
                allowClear
                placeholder="Origin"
                className="w-44"
                options={DATASET_ORIGINS}
                value={origin}
                onChange={(v) => {
                  setOrigin(v);
                  setPage(1);
                }}
              />
              <Select
                allowClear
                placeholder="Source type"
                className="w-36"
                options={SOURCE_TYPES}
                value={sourceType}
                onChange={(v) => {
                  setSourceType(v);
                  setPage(1);
                }}
              />
              <span className="text-xs text-slate-400">
                Polling every {EVALUATION_POLL_INTERVAL_MS / 1000}s while active
              </span>
            </>
          }
        />
        {query.isError ? (
          <Alert
            type="error"
            showIcon
            message="Failed to load datasets"
            description={getApiErrorMessage(query.error)}
            action={
              <Button size="small" onClick={() => void query.refetch()}>
                Retry
              </Button>
            }
          />
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto">
          <DatasetsTable
            data={pagedDatasets}
            loading={query.isLoading || query.isFetching}
            deletePending={deletePending}
            total={displayTotal}
            page={page}
            pageSize={pageSize}
            onPageChange={(p, s) => {
              setPage(p);
              setPageSize(s);
            }}
            onViewSamples={setSamplesDataset}
            onStartEvaluation={setEvalDataset}
            onSoftDelete={handleSoftDelete}
            onHardDelete={handleHardDelete}
          />
        </div>
      </div>
      <UploadDatasetModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
      />
      <StartEvaluationModal
        open={Boolean(evalDataset)}
        dataset={evalDataset}
        onClose={() => setEvalDataset(null)}
      />
      <DatasetSamplesDrawer
        open={Boolean(samplesDataset)}
        dataset={samplesDataset}
        onClose={() => setSamplesDataset(null)}
      />
    </div>
  );
}
