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
import { useDebounce } from "@/hooks/useDebounce";
import type { EvaluationDataset } from "@/types/evaluation";
import { getDatasetDeleteAvailability } from "@/utils/datasetDeleteAvailability";

const OCR_TYPES = [
  { value: "odometer", label: "Odometer" },
  { value: "number_plate", label: "Number plate" },
  { value: "bill", label: "Bill" },
  { value: "vin", label: "VIN" },
  { value: "document", label: "Document" },
];

const DATASET_STATUSES = [
  { value: "uploading", label: "Uploading" },
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "failed", label: "Failed" },
  { value: "consumed", label: "Consumed" },
  { value: "archived", label: "Archived" },
];

export function EvaluationDatasetsPage() {
  const { modal, message } = App.useApp();
  const [search, setSearch] = useState("");
  const [ocrType, setOcrType] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebounce(search, 300);

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
      ocr_type: ocrType,
      status,
      include_archived: status === "archived",
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    [debouncedSearch, ocrType, status, page, pageSize],
  );

  const query = useDatasetsQuery(params);

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
          <>
            <Select
              allowClear
              placeholder="OCR type"
              className="w-36"
              options={OCR_TYPES}
              value={ocrType}
              onChange={(v) => {
                setOcrType(v);
                setPage(1);
              }}
            />
            <Button
              type="primary"
              icon={<ExperimentOutlined />}
              onClick={() => setUploadOpen(true)}
            >
              Upload dataset
            </Button>
          </>
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
            data={query.data?.datasets ?? []}
            loading={query.isLoading || query.isFetching}
            deletePending={deletePending}
            total={query.data?.total ?? 0}
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
