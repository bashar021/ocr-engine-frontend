import {
  App,
  Button,
  Drawer,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import {
  deleteDatasetSample,
  fetchSampleImageObjectUrl,
  getDatasetSample,
  updateDatasetSample,
} from "@/api/evaluation";
import { SearchInput } from "@/components/common/SearchInput";
import {
  BboxAnnotator,
  type DrawnBox,
} from "@/components/training/BboxAnnotator";
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

function parseBbox(raw: unknown): DrawnBox | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const x1 = Number(b.x1);
  const y1 = Number(b.y1);
  const x2 = Number(b.x2);
  const y2 = Number(b.y2);
  if (![x1, y1, x2, y2].every((n) => Number.isFinite(n))) return null;
  if (x2 <= x1 || y2 <= y1) return null;
  return { x1, y1, x2, y2 };
}

function sampleBbox(sample: DatasetSample | null | undefined): DrawnBox | null {
  if (!sample) return null;
  return parseBbox(sample.bbox) ?? parseBbox(sample.metadata?.bbox);
}

function useObjectUrl(
  datasetId: string | null | undefined,
  sampleId: string | null | undefined,
  enabled: boolean,
) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !datasetId || !sampleId) {
      setUrl(null);
      setError(null);
      setLoading(false);
      return;
    }
    let revoked: string | null = null;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchSampleImageObjectUrl(datasetId, sampleId)
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        revoked = u;
        setUrl(u);
      })
      .catch((e) => {
        if (!cancelled) {
          setUrl(null);
          setError(getApiErrorMessage(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [enabled, datasetId, sampleId]);

  return { url, loading, error };
}

function SampleThumb({
  datasetId,
  sampleId,
}: {
  datasetId: string;
  sampleId: string;
}) {
  const { url } = useObjectUrl(datasetId, sampleId, true);
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
  dataset,
  sample,
  onClose,
  onRemoved,
  onUpdated,
}: {
  open: boolean;
  dataset: EvaluationDataset;
  sample: DatasetSample | null;
  onClose: () => void;
  onRemoved: (sampleId: string) => void;
  onUpdated: (sample: DatasetSample) => void;
}) {
  const { message, modal } = App.useApp();
  const [detail, setDetail] = useState<DatasetSample | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [box, setBox] = useState<DrawnBox | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [editing, setEditing] = useState(false);

  const isAugmented =
    dataset.origin === "augmented" ||
    dataset.metadata?.origin === "augmented" ||
    detail?.origin === "augmented";

  const source = detail?.source_sample ?? null;
  const sourceDatasetId =
    source?.dataset_id ||
    detail?.source_dataset_id ||
    (typeof dataset.metadata?.source_dataset_id === "string"
      ? dataset.metadata.source_dataset_id
      : null);

  const current = useObjectUrl(dataset.id, sample?.id, open && Boolean(sample));
  const sourceImg = useObjectUrl(
    sourceDatasetId,
    source?.id ??
      (typeof sample?.metadata?.source_sample_id === "string"
        ? sample.metadata.source_sample_id
        : null),
    open && Boolean(isAugmented && sourceDatasetId),
  );

  useEffect(() => {
    if (!open || !sample) {
      setDetail(null);
      setBox(null);
      setEditing(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void getDatasetSample(dataset.id, sample.id)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setBox(sampleBbox(d));
      })
      .catch((e) => {
        if (!cancelled) {
          message.error(getApiErrorMessage(e));
          setDetail(sample);
          setBox(sampleBbox(sample));
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, dataset.id, sample, message]);

  const display = detail ?? sample;
  const sourceBox = sampleBbox(source);

  const saveBbox = async () => {
    if (!sample) return;
    if (!box) {
      message.warning("Draw a bounding box before saving");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateDatasetSample(dataset.id, sample.id, {
        bbox: box,
      });
      setDetail(updated);
      setBox(sampleBbox(updated));
      setEditing(false);
      onUpdated(updated);
      message.success("Bounding box updated");
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const clearBbox = async () => {
    if (!sample) return;
    setSaving(true);
    try {
      const updated = await updateDatasetSample(dataset.id, sample.id, {
        clear_bbox: true,
      });
      setDetail(updated);
      setBox(null);
      onUpdated(updated);
      message.success("Bounding box cleared");
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const removeSample = () => {
    if (!sample) return;
    modal.confirm({
      title: "Remove image from dataset?",
      content:
        "This deletes the sample from this dataset copy only. Source datasets are not modified.",
      okText: "Remove",
      okButtonProps: { danger: true },
      onOk: async () => {
        setRemoving(true);
        try {
          await deleteDatasetSample(dataset.id, sample.id);
          message.success("Sample removed from dataset");
          onRemoved(sample.id);
          onClose();
        } catch (e) {
          message.error(getApiErrorMessage(e));
          throw e;
        } finally {
          setRemoving(false);
        }
      },
    });
  };

  return (
    <Modal
      title={display?.filename ?? "Sample image"}
      open={open}
      onCancel={onClose}
      width={isAugmented ? 1100 : 920}
      destroyOnHidden
      footer={
        <Space wrap>
          {!editing ? (
            <Button onClick={() => setEditing(true)}>Edit bounding box</Button>
          ) : (
            <>
              <Button
                type="primary"
                loading={saving}
                onClick={() => void saveBbox()}
              >
                Save bounding box
              </Button>
              <Button
                onClick={() => {
                  setBox(sampleBbox(display));
                  setEditing(false);
                }}
              >
                Cancel edit
              </Button>
            </>
          )}
          <Popconfirm
            title="Clear bounding box?"
            onConfirm={() => void clearBbox()}
          >
            <Button disabled={!box} loading={saving}>
              Clear box
            </Button>
          </Popconfirm>
          <Button danger loading={removing} onClick={removeSample}>
            Remove from dataset
          </Button>
          <Button onClick={onClose}>Close</Button>
        </Space>
      }
    >
      <Spin spinning={detailLoading || current.loading}>
        <div className="mb-3 flex flex-wrap gap-2 text-sm text-slate-600">
          <span>
            GT:{" "}
            <span className="font-mono font-medium text-slate-900">
              {display?.ground_truth_normalized || display?.ground_truth || "—"}
            </span>
          </span>
          {box ? (
            <Tag color="green">
              Box {Math.round(box.x1)},{Math.round(box.y1)} →{" "}
              {Math.round(box.x2)},{Math.round(box.y2)}
            </Tag>
          ) : (
            <Tag>No bbox</Tag>
          )}
          {isAugmented ? <Tag color="blue">Augmented</Tag> : null}
        </div>

        <div
          className={isAugmented ? "grid gap-4 md:grid-cols-2" : "grid gap-4"}
        >
          {isAugmented ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Original
                {source?.dataset_name
                  ? ` — ${source.dataset_name}${source.dataset_version ? ` v${source.dataset_version}` : ""}`
                  : ""}
              </div>
              {sourceImg.loading ? (
                <div className="flex h-64 items-center justify-center text-slate-400">
                  Loading…
                </div>
              ) : sourceImg.error ? (
                <div className="flex h-64 items-center justify-center text-sm text-red-600">
                  {sourceImg.error}
                </div>
              ) : sourceImg.url ? (
                <BboxAnnotator
                  src={sourceImg.url}
                  value={sourceBox}
                  onChange={() => undefined}
                  imageWidth={source?.width}
                  imageHeight={source?.height}
                  readOnly
                />
              ) : (
                <div className="flex h-64 items-center justify-center text-slate-400">
                  Source image unavailable
                </div>
              )}
              <div className="mt-2 text-xs text-slate-500">
                Read-only source view (bbox from original sample)
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {isAugmented ? "Augmented" : "Image"}
            </div>
            {current.error ? (
              <div className="flex h-64 items-center justify-center text-sm text-red-600">
                {current.error}
              </div>
            ) : current.url ? (
              <BboxAnnotator
                src={current.url}
                value={box}
                onChange={editing ? setBox : () => undefined}
                imageWidth={display?.width}
                imageHeight={display?.height}
                readOnly={!editing}
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-slate-400">
                Loading image…
              </div>
            )}
            <div className="mt-2 text-xs text-slate-500">
              {editing
                ? "Drag on the image to redraw the bounding box, then save."
                : "Bounding box overlay. Click Edit to update."}
            </div>
          </div>
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
  const queryClient = useQueryClient();
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
      has_gt: hasGt === "yes" ? true : hasGt === "no" ? false : undefined,
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

  const invalidateSamples = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["evaluation", "samples", dataset?.id],
    });
    await queryClient.invalidateQueries({
      queryKey: ["evaluation", "datasets"],
    });
    await samplesQuery.refetch();
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
        title: "BBox",
        key: "bbox",
        width: 70,
        render: (_, row) =>
          sampleBbox(row) ? <Tag color="green">yes</Tag> : <Tag>no</Tag>,
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
          dataset={dataset}
          sample={imageSample}
          onClose={() => setImageSample(null)}
          onRemoved={() => {
            void invalidateSamples();
          }}
          onUpdated={(updated) => {
            setImageSample(updated);
            void invalidateSamples();
          }}
        />
      ) : null}
    </>
  );
}
