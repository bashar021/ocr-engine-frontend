import { MergeCellsOutlined } from "@ant-design/icons";
import { App, Alert, Button, Modal, Space, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useMemo, useState, type Key } from "react";
import { Link } from "react-router-dom";

import { getApiErrorMessage } from "@/api/client";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusTag } from "@/components/common/StatusTag";
import { DatasetSamplesDrawer } from "@/components/evaluation/DatasetSamplesDrawer";
import { RecognitionBuildModal } from "@/components/training/RecognitionBuildModal";
import {
  useArchiveDataset,
  useHardDeleteDataset,
  useMergeTrainingDatasets,
  useSetDatasetEvaluationEligibility,
} from "@/features/evaluation/useEvaluationMutations";
import { useDatasetsQuery } from "@/features/evaluation/useDatasetsQuery";
import type { EvaluationDataset } from "@/types/evaluation";
import { getDatasetDeleteAvailability } from "@/utils/datasetDeleteAvailability";

function lineageLabel(d: EvaluationDataset): string | null {
  const fromMeta =
    typeof d.metadata?.merged_parent_labels === "string"
      ? d.metadata.merged_parent_labels
      : null;
  if (fromMeta) return fromMeta;
  const parents = d.merged_from;
  if (!parents?.length) return null;
  return parents.map((p) => `${p.name}@${p.version}`).join(" + ");
}

export function TrainingDatasetsPage() {
  const { modal, message } = App.useApp();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [samplesDataset, setSamplesDataset] =
    useState<EvaluationDataset | null>(null);

  const query = useDatasetsQuery({
    scope: "training",
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const mergeMutation = useMergeTrainingDatasets();
  const eligibilityMutation = useSetDatasetEvaluationEligibility();
  const archiveMutation = useArchiveDataset();
  const hardDeleteMutation = useHardDeleteDataset();

  const rows = query.data?.datasets ?? [];
  const selectedRows = useMemo(
    () => rows.filter((d) => selectedRowKeys.includes(d.id)),
    [rows, selectedRowKeys],
  );

  const canMerge =
    selectedRows.length >= 2 &&
    selectedRows.every((d) => d.status === "ready") &&
    new Set(selectedRows.map((d) => d.ocr_type)).size === 1;

  const handleMerge = async () => {
    try {
      const created = await mergeMutation.mutateAsync({
        dataset_ids: selectedRows.map((d) => d.id),
      });
      message.success(
        `Merged into ${created.name} v${created.version} (${created.sample_count} samples)`,
      );
      setMergeOpen(false);
      setSelectedRowKeys([]);
    } catch (error) {
      message.error(getApiErrorMessage(error));
    }
  };

  const handleAllowEvaluation = (
    dataset: EvaluationDataset,
    eligible: boolean,
  ) => {
    modal.confirm({
      title: eligible
        ? "Allow for evaluation?"
        : "Remove from evaluation datasets?",
      content: eligible ? (
        <div className="text-sm text-slate-600">
          <strong>
            {dataset.name} v{dataset.version}
          </strong>{" "}
          will appear on the main Datasets tab and can be used for evaluation
          runs. It remains listed here as a training dataset.
        </div>
      ) : (
        <div className="text-sm text-slate-600">
          This dataset will leave the main Datasets tab and can no longer be
          used for evaluation until allowed again.
        </div>
      ),
      okText: eligible ? "Allow for evaluation" : "Revoke",
      centered: true,
      zIndex: 1100,
      onOk: async () => {
        try {
          await eligibilityMutation.mutateAsync({
            datasetId: dataset.id,
            eligible,
          });
          message.success(
            eligible
              ? "Dataset allowed for evaluation"
              : "Evaluation eligibility revoked",
          );
        } catch (error) {
          message.error(getApiErrorMessage(error));
          throw error;
        }
      },
    });
  };

  const columns: ColumnsType<EvaluationDataset> = useMemo(
    () => [
      {
        title: "Dataset",
        key: "name",
        render: (_, d) => (
          <div>
            <div className="font-medium">
              {d.name} <span className="text-slate-500">v{d.version}</span>
            </div>
            <div className="text-xs text-slate-400">{d.ocr_type}</div>
          </div>
        ),
      },
      {
        title: "Origin",
        key: "origin",
        width: 140,
        render: (_, d) => {
          if (d.origin === "merged_training") {
            return <Tag color="geekblue">Merged training</Tag>;
          }
          return <Tag color="purple">System curated</Tag>;
        },
      },
      {
        title: "Lineage",
        key: "lineage",
        width: 260,
        render: (_, d) => {
          const label = lineageLabel(d);
          if (!label) {
            const srcEval = d.metadata?.source_evaluation_id;
            return srcEval ? (
              <span className="text-xs text-slate-500">
                from eval {String(srcEval).slice(0, 8)}…
              </span>
            ) : (
              "—"
            );
          }
          return (
            <Tooltip title={label}>
              <div className="text-xs text-slate-700">
                <Tag color="blue">Merge of</Tag>
                <span className="font-medium">{label}</span>
              </div>
            </Tooltip>
          );
        },
      },
      {
        title: "Status",
        dataIndex: "status",
        width: 110,
        render: (s: string) => <StatusTag status={s} />,
      },
      {
        title: "Samples",
        key: "samples",
        width: 160,
        render: (_, d) => {
          const sc = d.split_counts;
          if (sc && (sc.train != null || sc.val != null || sc.test != null)) {
            return (
              <div className="text-xs">
                <div>{d.sample_count} total</div>
                <div className="text-slate-500">
                  {sc.train ?? 0}/{sc.val ?? 0}/{sc.test ?? 0}
                </div>
                <Tag className="mt-1">train/val/test</Tag>
              </div>
            );
          }
          return d.sample_count;
        },
      },
      {
        title: "Pack",
        key: "pack",
        width: 110,
        render: (_, d) =>
          d.pack ||
          (typeof d.metadata?.pack === "string" ? d.metadata.pack : null) ? (
            <Tag color="magenta">{String(d.pack || d.metadata?.pack)}</Tag>
          ) : (
            "—"
          ),
      },
      {
        title: "Eval",
        key: "eval",
        width: 120,
        render: (_, d) =>
          d.evaluation_eligible ? (
            <Tag color="green">Allowed</Tag>
          ) : (
            <Tag>Training only</Tag>
          ),
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
        width: 360,
        render: (_, d) => {
          const deletePending =
            archiveMutation.isPending || hardDeleteMutation.isPending;
          const del = getDatasetDeleteAvailability(d, {
            mutating: deletePending,
          });
          const softBtn = (
            <Button
              size="small"
              disabled={!del.canSoftDelete}
              onClick={() => {
                if (!del.canSoftDelete) return;
                modal.confirm({
                  title: "Soft delete training dataset?",
                  content: `Archives ${d.name} v${d.version}. Filter Status=Archived to see it again.`,
                  okText: "Archive",
                  okButtonProps: { danger: true },
                  centered: true,
                  zIndex: 1100,
                  onOk: async () => {
                    try {
                      await archiveMutation.mutateAsync(d.id);
                      message.success("Dataset archived");
                    } catch (error) {
                      message.error(getApiErrorMessage(error));
                      throw error;
                    }
                  },
                });
              }}
            >
              Soft delete
            </Button>
          );
          const hardBtn = (
            <Button
              size="small"
              danger
              disabled={!del.canHardDelete}
              onClick={() => {
                if (!del.canHardDelete) return;
                modal.confirm({
                  title: "Delete training dataset?",
                  content: `Permanently delete ${d.name} v${d.version}? Training-run links to this dataset are removed; run history is kept.`,
                  okText: "Delete",
                  okButtonProps: { danger: true },
                  centered: true,
                  zIndex: 1100,
                  onOk: async () => {
                    try {
                      await hardDeleteMutation.mutateAsync(d.id);
                      message.success("Deleted");
                    } catch (error) {
                      message.error(getApiErrorMessage(error));
                      throw error;
                    }
                  },
                });
              }}
            >
              Hard delete
            </Button>
          );
          return (
            <Space size="small" wrap>
              <Button size="small" onClick={() => setSamplesDataset(d)}>
                Samples
              </Button>
              {d.evaluation_eligible ? (
                <Button
                  size="small"
                  disabled={deletePending || Boolean(d.locked_at)}
                  onClick={() => handleAllowEvaluation(d, false)}
                >
                  Revoke eval
                </Button>
              ) : (
                <Button
                  size="small"
                  type="primary"
                  disabled={
                    d.status !== "ready" ||
                    deletePending ||
                    Boolean(d.locked_at)
                  }
                  onClick={() => handleAllowEvaluation(d, true)}
                >
                  Allow for eval
                </Button>
              )}
              {del.canSoftDelete ? (
                softBtn
              ) : (
                <Tooltip title={del.softReason ?? "Soft delete unavailable"}>
                  <span>{softBtn}</span>
                </Tooltip>
              )}
              {del.canHardDelete ? (
                hardBtn
              ) : (
                <Tooltip title={del.hardReason ?? "Hard delete unavailable"}>
                  <span>{hardBtn}</span>
                </Tooltip>
              )}
            </Space>
          );
        },
      },
    ],
    [
      hardDeleteMutation,
      eligibilityMutation,
      archiveMutation,
      modal,
      message,
      handleAllowEvaluation,
    ],
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: "Dashboard", path: "/" },
          { title: "Dataset", path: "/evaluation/datasets" },
          { title: "Training datasets" },
        ]}
        actions={
          <Space>
            <Button onClick={() => setBuildOpen(true)}>
              Build recognition pack
            </Button>
            <Button
              icon={<MergeCellsOutlined />}
              disabled={!canMerge}
              onClick={() => setMergeOpen(true)}
            >
              Merge selected ({selectedRowKeys.length})
            </Button>
            <Link to="/training/curate">
              <Button type="primary">Curate failures</Button>
            </Link>
          </Space>
        }
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-6">
        {query.isError ? (
          <Alert
            type="error"
            showIcon
            message="Failed to load training datasets"
            description={getApiErrorMessage(query.error)}
          />
        ) : null}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={query.isLoading || query.isFetching}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            getCheckboxProps: (d) => ({
              disabled: d.status !== "ready",
            }),
          }}
          pagination={{
            current: page,
            pageSize,
            total: query.data?.total ?? 0,
            onChange: (p, s) => {
              setPage(p);
              setPageSize(s);
            },
          }}
        />
      </div>

      <Modal
        title="Merge training datasets"
        open={mergeOpen}
        onCancel={() => setMergeOpen(false)}
        onOk={() => void handleMerge()}
        confirmLoading={mergeMutation.isPending}
        okText="Create merge"
        okButtonProps={{ disabled: !canMerge }}
      >
        <p className="mb-3 text-sm text-slate-600">
          Creates a new training dataset that is the merge of the selected
          packs. Parents stay unchanged.
        </p>
        <ul className="mb-3 list-disc space-y-1 pl-5 text-sm">
          {selectedRows.map((d) => (
            <li key={d.id}>
              {d.name} v{d.version}{" "}
              <span className="text-slate-400">({d.sample_count} samples)</span>
            </li>
          ))}
        </ul>
        {!canMerge ? (
          <Alert
            type="warning"
            showIcon
            message="Select at least two ready datasets with the same OCR type."
          />
        ) : (
          <Alert
            type="success"
            showIcon
            message={`Result lineage: ${selectedRows
              .map((d) => `${d.name}@${d.version}`)
              .join(" + ")}`}
          />
        )}
      </Modal>

      <DatasetSamplesDrawer
        open={Boolean(samplesDataset)}
        dataset={samplesDataset}
        onClose={() => setSamplesDataset(null)}
      />
      <RecognitionBuildModal
        open={buildOpen}
        onClose={() => setBuildOpen(false)}
        datasetIds={
          selectedRows.length ? selectedRows.map((d) => d.id) : undefined
        }
      />
    </div>
  );
}
