import { App, Button, Card, Select, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import {
  createAugmentedDataset,
  listAugmentationStrategies,
} from "@/api/training";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusTag } from "@/components/common/StatusTag";
import { useDatasetsQuery } from "@/features/evaluation/useDatasetsQuery";
import { useTaskContext } from "@/features/tasks/TaskContext";
import type { EvaluationDataset } from "@/types/evaluation";

function isAugmentedDataset(d: EvaluationDataset): boolean {
  if (d.origin === "augmented") return true;
  const meta = d.metadata ?? {};
  return Boolean(meta.augmentation_strategy || meta.origin === "augmented");
}

export function AugmentationDatasetPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { activeTaskKey } = useTaskContext();
  const [sourceDatasetId, setSourceDatasetId] = useState<string | undefined>();
  const [strategy, setStrategy] = useState<string | undefined>();

  const trainingQuery = useDatasetsQuery({
    scope: "training",
    ocr_type: activeTaskKey,
    status: "ready",
    limit: 200,
  });

  const strategiesQuery = useQuery({
    queryKey: ["training", "augmentation", "strategies"],
    queryFn: listAugmentationStrategies,
  });

  const augmentedRows = useMemo(
    () => (trainingQuery.data?.datasets ?? []).filter(isAugmentedDataset),
    [trainingQuery.data?.datasets],
  );

  const sourceOptions = useMemo(
    () =>
      (trainingQuery.data?.datasets ?? [])
        .filter((d) => !isAugmentedDataset(d))
        .map((d) => ({
          value: d.id,
          label: `${d.name} v${d.version} (${d.sample_count} samples)`,
        })),
    [trainingQuery.data?.datasets],
  );

  const strategyOptions = useMemo(
    () =>
      (strategiesQuery.data ?? []).map((s) => ({
        value: s.key,
        label: s.label,
        title: s.description,
      })),
    [strategiesQuery.data],
  );

  const createMutation = useMutation({
    mutationFn: () =>
      createAugmentedDataset({
        source_dataset_id: sourceDatasetId!,
        strategy: strategy!,
      }),
    onSuccess: (created) => {
      message.success(
        `Created ${created.name} v${created.version} (${created.sample_count ?? 0} samples)`,
      );
      setStrategy(undefined);
      void queryClient.invalidateQueries({ queryKey: ["evaluation", "datasets"] });
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  const columns: ColumnsType<EvaluationDataset> = [
    {
      title: "Name",
      key: "name",
      render: (_, d) => (
        <span>
          {d.name}{" "}
          <Typography.Text type="secondary">v{d.version}</Typography.Text>
        </span>
      ),
    },
    {
      title: "Strategy",
      key: "strategy",
      width: 140,
      render: (_, d) => {
        const key =
          (d.metadata?.augmentation_strategy as string | undefined) ??
          d.metadata?.augmentation_strategy_label;
        return key ? <Tag color="blue">{String(key)}</Tag> : "—";
      },
    },
    {
      title: "Source",
      key: "source",
      ellipsis: true,
      render: (_, d) => {
        const name = d.metadata?.source_dataset_name as string | undefined;
        const ver = d.metadata?.source_dataset_version as string | undefined;
        if (name) return `${name}${ver ? ` v${ver}` : ""}`;
        return (d.metadata?.source_dataset_id as string | undefined)?.slice(0, 8) ?? "—";
      },
    },
    {
      title: "Samples",
      dataIndex: "sample_count",
      width: 90,
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 100,
      render: (v) => <StatusTag status={v} />,
    },
    {
      title: "Created",
      dataIndex: "created_at",
      width: 160,
      render: (v) => (v ? dayjs(v).format("YYYY-MM-DD HH:mm") : "—"),
    },
  ];

  const selectedStrategy = (strategiesQuery.data ?? []).find(
    (s) => s.key === strategy,
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: "Dashboard", path: "/" },
          { title: "Training Dataset" },
          { title: "Augmentation" },
        ]}
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-6">
        <Card title="Create augmented dataset" size="small">
          <Space wrap className="w-full" align="start">
            <div className="min-w-[280px]">
              <div className="mb-1 text-xs text-slate-500">Source training dataset</div>
              <Select
                className="w-full"
                showSearch
                optionFilterProp="label"
                placeholder="Select training dataset"
                loading={trainingQuery.isLoading}
                options={sourceOptions}
                value={sourceDatasetId}
                onChange={setSourceDatasetId}
              />
            </div>
            <div className="min-w-[240px]">
              <div className="mb-1 text-xs text-slate-500">Augmentation strategy</div>
              <Select
                className="w-full"
                showSearch
                optionFilterProp="label"
                placeholder="Select strategy"
                loading={strategiesQuery.isLoading}
                options={strategyOptions}
                value={strategy}
                onChange={setStrategy}
              />
            </div>
            <Button
              type="primary"
              className="mt-5"
              disabled={!sourceDatasetId || !strategy}
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Create augmented dataset
            </Button>
          </Space>
          {selectedStrategy?.description ? (
            <Typography.Paragraph type="secondary" className="!mb-0 mt-3 text-sm">
              {selectedStrategy.description}
            </Typography.Paragraph>
          ) : null}
        </Card>

        <Card title="Augmented datasets" size="small">
          <Table
            rowKey="id"
            size="small"
            loading={trainingQuery.isLoading}
            columns={columns}
            dataSource={augmentedRows}
            pagination={{ pageSize: 15 }}
          />
        </Card>
      </div>
    </div>
  );
}
