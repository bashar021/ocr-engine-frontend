import {
  App,
  Button,
  Drawer,
  Input,
  Modal,
  Pagination,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";

import { getApiErrorMessage } from "@/api/client";
import { fetchSampleImageObjectUrl } from "@/api/evaluation";
import { SearchInput } from "@/components/common/SearchInput";
import { useMoveSampleToDatabankCategory } from "@/features/evaluation/useEvaluationMutations";
import { useDatasetSamplesQuery } from "@/features/evaluation/useEvaluationDetailQuery";
import { useDebounce } from "@/hooks/useDebounce";
import type { DatasetSample, EvaluationDataset } from "@/types/evaluation";
import { formatBytes, formatPercent } from "@/utils/format";

const SAMPLE_STATUSES = [
  { value: "active", label: "Active" },
  { value: "invalid", label: "Invalid" },
  { value: "archived", label: "Archived" },
];

const HAS_GT_OPTIONS = [
  { value: "all", label: "Any GT" },
  { value: "yes", label: "Has GT" },
  { value: "no", label: "Missing GT" },
];

const DATABANK_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "blurry", label: "Blurry" },
  { value: "dead", label: "Dead" },
];

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

function SampleImageModal({
  open,
  datasetId,
  sample,
  onClose,
}: {
  open: boolean;
  datasetId: string;
  sample: DatasetSample | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !sample) {
      setUrl(null);
      return;
    }
    let revoked: string | null = null;
    let cancelled = false;
    setLoading(true);
    void fetchSampleImageObjectUrl(datasetId, sample.id)
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        revoked = u;
        setUrl(u);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [open, datasetId, sample]);

  return (
    <Modal
      title={sample?.filename ?? "Sample image"}
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      destroyOnHidden
    >
      <Spin spinning={loading}>
        <div className="flex min-h-[320px] items-center justify-center bg-slate-50">
          {url ? (
            <img
              src={url}
              alt={sample?.filename ?? "Sample"}
              className="max-h-[70vh] max-w-full object-contain"
            />
          ) : null}
        </div>
      </Spin>
    </Modal>
  );
}

function resetFilters() {
  return {
    search: "",
    status: undefined as string | undefined,
    split: "all",
    hasGt: "all" as "all" | "yes" | "no",
    page: 1,
  };
}

export function DatasetSamplesDrawer({
  dataset,
  open,
  onClose,
}: DatasetSamplesDrawerProps) {
  const { message } = App.useApp();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [splitFilter, setSplitFilter] = useState("all");
  const [hasGt, setHasGt] = useState<"all" | "yes" | "no">("all");
  const [imageSample, setImageSample] = useState<DatasetSample | null>(null);
  const [customCategory, setCustomCategory] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const moveMutation = useMoveSampleToDatabankCategory();

  const queryParams = useMemo(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      search: debouncedSearch || undefined,
      status,
      split: splitFilter === "all" ? undefined : splitFilter,
      has_gt:
        hasGt === "yes" ? true : hasGt === "no" ? false : undefined,
      include_eval_metrics: true,
    }),
    [page, pageSize, debouncedSearch, status, splitFilter, hasGt],
  );

  const samplesQuery = useDatasetSamplesQuery(
    open ? (dataset?.id ?? null) : null,
    queryParams,
  );

  const samples = samplesQuery.data?.samples ?? [];
  const modelRefs = samplesQuery.data?.model_refs ?? [];

  const categoryOptions = useMemo(() => {
    const custom = customCategory.trim();
    const opts = [...DATABANK_CATEGORIES];
    if (custom && !opts.some((o) => o.value === custom)) {
      opts.push({ value: custom, label: custom });
    }
    return opts;
  }, [customCategory]);

  const showThumbs =
    dataset?.pack === "recognition_crops" ||
    dataset?.image_mode === "recognition_crop" ||
    Boolean(dataset?.split_counts);

  const handleMoveCategory = async (
    sample: DatasetSample,
    category: string,
  ) => {
    if (!dataset) return;
    try {
      await moveMutation.mutateAsync({
        datasetId: dataset.id,
        sampleId: sample.id,
        category,
      });
      message.success(`Moved to ${category || "general"}`);
    } catch (error) {
      message.error(getApiErrorMessage(error));
    }
  };

  const columns = useMemo<ColumnsType<DatasetSample>>(() => {
    const base: ColumnsType<DatasetSample> = [
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
        width: 160,
      },
      {
        title: "Ground truth",
        dataIndex: "ground_truth",
        key: "ground_truth",
        ellipsis: true,
        width: 120,
      },
      {
        title: "Split",
        key: "split",
        width: 80,
        render: (_, row) => {
          const split =
            row.split ||
            (typeof row.metadata?.split === "string"
              ? row.metadata.split
              : null);
          return split ? <Tag>{split}</Tag> : "—";
        },
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 90,
        render: (v: string) => (
          <Tag color={v === "active" ? "green" : "red"}>{v}</Tag>
        ),
      },
      {
        title: "Size",
        dataIndex: "size_bytes",
        key: "size_bytes",
        width: 90,
        render: (v: number | null) => formatBytes(v),
      },
      {
        title: "Dims",
        key: "dims",
        width: 90,
        render: (_, row) =>
          row.width && row.height ? `${row.width}×${row.height}` : "—",
      },
    ];

    for (const ref of modelRefs) {
      base.push({
        title: `Pred (${ref})`,
        key: `pred_${ref}`,
        width: 110,
        ellipsis: true,
        render: (_, row) => {
          const metric = row.latest_eval_metrics?.find(
            (m) => m.model_ref === ref,
          );
          return metric?.predicted ?? "—";
        },
      });
      base.push({
        title: `OK (${ref})`,
        key: `correct_${ref}`,
        width: 70,
        render: (_, row) => {
          const metric = row.latest_eval_metrics?.find(
            (m) => m.model_ref === ref,
          );
          if (metric?.is_correct == null) return "—";
          return metric.is_correct ? (
            <Tag color="green">yes</Tag>
          ) : (
            <Tag color="red">no</Tag>
          );
        },
      });
      base.push({
        title: `Conf (${ref})`,
        key: `conf_${ref}`,
        width: 80,
        render: (_, row) => {
          const metric = row.latest_eval_metrics?.find(
            (m) => m.model_ref === ref,
          );
          return formatPercent(metric?.confidence ?? null);
        },
      });
    }

    base.push({
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 220,
      render: (_, row) => (
        <Space size="small" wrap>
          <Button size="small" onClick={() => setImageSample(row)}>
            View
          </Button>
          <Select
            size="small"
            placeholder="Databank category"
            style={{ width: 140 }}
            loading={moveMutation.isPending}
            options={categoryOptions}
            value={
              row.databank_category ??
              (typeof row.metadata?.databank_category === "string"
                ? row.metadata.databank_category
                : typeof row.metadata?.category === "string"
                  ? row.metadata.category
                  : undefined)
            }
            onChange={(cat) => void handleMoveCategory(row, cat)}
          />
        </Space>
      ),
    });

    return base;
  }, [categoryOptions, dataset, modelRefs, moveMutation.isPending, showThumbs]);

  const splits = dataset?.split_counts;

  const handleClose = () => {
    const reset = resetFilters();
    setSearch(reset.search);
    setStatus(reset.status);
    setSplitFilter(reset.split);
    setHasGt(reset.hasGt);
    setPage(reset.page);
    setImageSample(null);
    setCustomCategory("");
    onClose();
  };

  return (
    <>
      <Drawer
        title={
          dataset ? `Samples — ${dataset.name} v${dataset.version}` : "Samples"
        }
        open={open}
        onClose={handleClose}
        width={Math.min(1200, 880 + modelRefs.length * 120)}
        destroyOnHidden
        extra={
          <Button
            onClick={() => void samplesQuery.refetch()}
            loading={samplesQuery.isFetching}
          >
            Refresh
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SearchInput
            className="w-48"
            placeholder="Search filename / GT…"
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
          />
          <Select
            allowClear
            placeholder="Status"
            className="w-32"
            options={SAMPLE_STATUSES}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          />
          <Select
            className="w-32"
            value={hasGt}
            options={HAS_GT_OPTIONS}
            onChange={(v) => {
              setHasGt(v);
              setPage(1);
            }}
          />
          {splits ? (
            <Select
              value={splitFilter}
              className="w-36"
              onChange={(v) => {
                setSplitFilter(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All splits" },
                { value: "train", label: `Train (${splits.train ?? 0})` },
                { value: "val", label: `Val (${splits.val ?? 0})` },
                { value: "test", label: `Test (${splits.test ?? 0})` },
              ]}
            />
          ) : null}
          <Input
            placeholder="Custom category"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            className="w-40"
            allowClear
          />
        </div>

        {splits ? (
          <div className="mb-3 text-sm text-slate-600">
            Splits: train {splits.train ?? 0} · val {splits.val ?? 0} · test{" "}
            {splits.test ?? 0}
            {modelRefs.length ? (
              <span className="ml-3 text-slate-500">
                Eval refs: {modelRefs.join(", ")}
              </span>
            ) : null}
          </div>
        ) : null}

        <Spin spinning={samplesQuery.isLoading || samplesQuery.isFetching}>
          <Table
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={samples}
            pagination={false}
            scroll={{ x: 900 + modelRefs.length * 280 }}
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

      {dataset && imageSample ? (
        <SampleImageModal
          open={Boolean(imageSample)}
          datasetId={dataset.id}
          sample={imageSample}
          onClose={() => setImageSample(null)}
        />
      ) : null}
    </>
  );
}
