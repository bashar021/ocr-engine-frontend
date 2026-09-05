import {
  Button,
  Drawer,
  Pagination,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";

import { fetchSampleImageObjectUrl } from "@/api/evaluation";
import { useDatasetSamplesQuery } from "@/features/evaluation/useEvaluationDetailQuery";
import type { DatasetSample, EvaluationDataset } from "@/types/evaluation";
import { formatBytes } from "@/utils/format";

interface DatasetSamplesDrawerProps {
  dataset: EvaluationDataset | null;
  open: boolean;
  onClose: () => void;
}

function SampleThumb({
  datasetId,
  sampleId,
}: {
  datasetId: string;
  sampleId: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    void fetchSampleImageObjectUrl(datasetId, sampleId).then((u) => {
      if (cancelled) {
        URL.revokeObjectURL(u);
        return;
      }
      revoked = u;
      setUrl(u);
    });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [datasetId, sampleId]);
  if (!url) {
    return <div className="h-12 w-20 animate-pulse rounded bg-slate-100" />;
  }
  return (
    <img
      src={url}
      alt=""
      className="h-12 w-20 rounded object-contain bg-slate-50"
    />
  );
}

export function DatasetSamplesDrawer({
  dataset,
  open,
  onClose,
}: DatasetSamplesDrawerProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [splitFilter, setSplitFilter] = useState<string>("all");
  const samplesQuery = useDatasetSamplesQuery(
    open ? (dataset?.id ?? null) : null,
    {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    },
  );

  const samples = (samplesQuery.data?.samples ?? []).filter((s) => {
    if (splitFilter === "all") return true;
    const split =
      s.split ||
      (typeof s.metadata?.split === "string" ? s.metadata.split : null);
    return split === splitFilter;
  });

  const showThumbs =
    dataset?.pack === "recognition_crops" ||
    dataset?.image_mode === "recognition_crop" ||
    Boolean(dataset?.split_counts);

  const columns: ColumnsType<DatasetSample> = [
    ...(showThumbs
      ? [
          {
            title: "Crop",
            key: "thumb",
            width: 100,
            render: (_: unknown, row: DatasetSample) =>
              dataset ? (
                <SampleThumb datasetId={dataset.id} sampleId={row.id} />
              ) : null,
          } as ColumnsType<DatasetSample>[number],
        ]
      : []),
    {
      title: "Filename",
      dataIndex: "filename",
      key: "filename",
      ellipsis: true,
    },
    { title: "Ground truth", dataIndex: "ground_truth", key: "ground_truth" },
    {
      title: "Split",
      key: "split",
      width: 80,
      render: (_, row) => {
        const split =
          row.split ||
          (typeof row.metadata?.split === "string" ? row.metadata.split : null);
        return split ? <Tag>{split}</Tag> : "—";
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v: string) => (
        <Tag color={v === "active" ? "green" : "red"}>{v}</Tag>
      ),
    },
    {
      title: "Size",
      dataIndex: "size_bytes",
      key: "size_bytes",
      render: (v: number | null) => formatBytes(v),
    },
    {
      title: "Dims",
      key: "dims",
      render: (_, row) =>
        row.width && row.height ? `${row.width}×${row.height}` : "—",
    },
  ];

  const splits = dataset?.split_counts;

  return (
    <Drawer
      title={
        dataset ? `Samples — ${dataset.name} v${dataset.version}` : "Samples"
      }
      open={open}
      onClose={() => {
        setPage(1);
        setSplitFilter("all");
        onClose();
      }}
      width={880}
      destroyOnHidden
      extra={
        <Space>
          {splits ? (
            <Select
              size="small"
              value={splitFilter}
              style={{ width: 140 }}
              onChange={setSplitFilter}
              options={[
                { value: "all", label: "All splits" },
                { value: "train", label: `Train (${splits.train ?? 0})` },
                { value: "val", label: `Val (${splits.val ?? 0})` },
                { value: "test", label: `Test (${splits.test ?? 0})` },
              ]}
            />
          ) : null}
          <Button
            onClick={() => void samplesQuery.refetch()}
            loading={samplesQuery.isFetching}
          >
            Refresh
          </Button>
        </Space>
      }
    >
      {splits ? (
        <div className="mb-3 text-sm text-slate-600">
          Splits: train {splits.train ?? 0} · val {splits.val ?? 0} · test{" "}
          {splits.test ?? 0}
        </div>
      ) : null}
      <Spin spinning={samplesQuery.isLoading || samplesQuery.isFetching}>
        <Table
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={samples}
          pagination={false}
        />
        <div className="mt-4 flex justify-end">
          <Pagination
            current={page}
            pageSize={pageSize}
            total={samplesQuery.data?.total ?? 0}
            showSizeChanger
            onChange={(p, s) => {
              setPage(p);
              setPageSize(s);
            }}
          />
        </div>
      </Spin>
    </Drawer>
  );
}
