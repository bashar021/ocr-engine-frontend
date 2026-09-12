import { Alert, Button, Select, Space, Tag, Typography } from "antd";
import { ClearOutlined, ReloadOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";

import { useBillDatasetContext } from "@/features/bill/dataset/context";
import { useBillDatasetsQuery } from "@/features/bill/dataset/hooks";

const CHUNK_OPTIONS = [
  { value: "all", label: "All splits" },
  { value: "train", label: "TRAIN" },
  { value: "val", label: "VALIDATION" },
  { value: "test", label: "TEST" },
  { value: "unlabeled", label: "UNLABELED" },
];

type Props = {
  onRefresh?: () => void;
  refreshing?: boolean;
};

/** Compact sticky context bar shared across Dataset workspace tabs. */
export function DatasetContextBar({ onRefresh, refreshing }: Props) {
  const {
    datasetId,
    version,
    chunk,
    setDatasetId,
    setVersion,
    setChunk,
    clearContext,
  } = useBillDatasetContext();

  const datasetsQuery = useBillDatasetsQuery({
    scope: "evaluation",
    limit: 200,
    offset: 0,
    include_archived: false,
  });

  const datasets = datasetsQuery.data?.datasets ?? [];
  const selected = datasets.find((d) => d.id === datasetId) ?? null;

  const versionOptions = selected
    ? [{ value: selected.version, label: `v${selected.version}` }]
    : version
      ? [{ value: version, label: `v${version}` }]
      : [];

  // Same-name versions from list (backend versions are separate dataset rows)
  const sameName = selected
    ? datasets.filter((d) => d.name === selected.name)
    : [];
  const versionChoices =
    sameName.length > 1
      ? sameName.map((d) => ({
          value: d.id,
          label: `v${d.version} (${d.sample_count} docs)`,
        }))
      : versionOptions.map((v) => ({
          value: selected?.id ?? datasetId ?? "",
          label: v.label,
        }));

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
      <Typography.Text
        type="secondary"
        className="text-xs uppercase tracking-wide"
      >
        Context
      </Typography.Text>
      <Select
        size="small"
        showSearch
        allowClear
        placeholder="Dataset"
        className="min-w-[200px]"
        value={datasetId ?? undefined}
        loading={datasetsQuery.isLoading}
        optionFilterProp="label"
        options={datasets.map((d) => ({
          value: d.id,
          label: `${d.name} · v${d.version} (${d.sample_count})`,
        }))}
        onChange={(v) => {
          const row = datasets.find((d) => d.id === v);
          setDatasetId(v ?? null);
          if (row) setVersion(row.version);
        }}
      />
      <Select
        size="small"
        placeholder="Version"
        className="min-w-[140px]"
        disabled={!datasetId}
        value={datasetId ?? undefined}
        options={versionChoices}
        onChange={(id) => {
          const row = datasets.find((d) => d.id === id);
          if (row) {
            setDatasetId(row.id);
            setVersion(row.version);
          }
        }}
      />
      <Select
        size="small"
        className="min-w-[120px]"
        value={chunk && chunk !== "all" ? chunk : "all"}
        options={CHUNK_OPTIONS}
        onChange={(v) => setChunk(v === "all" ? null : v)}
      />
      {selected ? (
        <Tag color={selected.status === "ready" ? "green" : "default"}>
          {selected.status}
        </Tag>
      ) : (
        <Tag>No dataset</Tag>
      )}
      <Space size={4} className="ml-auto">
        <Button
          size="small"
          icon={<ClearOutlined />}
          onClick={clearContext}
          disabled={!datasetId && !chunk}
        >
          Clear
        </Button>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          loading={refreshing || datasetsQuery.isFetching}
          onClick={() => {
            void datasetsQuery.refetch();
            onRefresh?.();
          }}
        >
          Refresh
        </Button>
        <Link to="/bill/datasets">
          <Button size="small" type="link">
            All datasets
          </Button>
        </Link>
      </Space>
    </div>
  );
}

export function DatasetHealthBar({
  sampleCount,
  labeled,
  unlabeled,
  splitCounts,
}: {
  sampleCount?: number;
  labeled?: number;
  unlabeled?: number;
  splitCounts?: { train?: number; val?: number; test?: number } | null;
}) {
  const chips: Array<{ label: string; value: string | number }> = [];
  if (sampleCount != null)
    chips.push({ label: "Documents", value: sampleCount });
  if (labeled != null) chips.push({ label: "Labeled", value: labeled });
  if (unlabeled != null) chips.push({ label: "Unlabeled", value: unlabeled });
  if (splitCounts?.train != null)
    chips.push({ label: "Train", value: splitCounts.train });
  if (splitCounts?.val != null)
    chips.push({ label: "Val", value: splitCounts.val });
  if (splitCounts?.test != null)
    chips.push({ label: "Test", value: splitCounts.test });

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {chips.map((c) => (
        <div
          key={c.label}
          className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs"
        >
          <span className="text-slate-500">{c.label}</span>{" "}
          <span className="font-semibold tabular-nums">{c.value}</span>
        </div>
      ))}
    </div>
  );
}

export function CapabilityAlert({
  title,
  detail,
  type = "info",
}: {
  title: string;
  detail: string;
  type?: "info" | "warning";
}) {
  return (
    <Alert
      className="mx-4 mb-2"
      type={type}
      showIcon
      message={title}
      description={detail}
    />
  );
}
