import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileImageOutlined,
  InboxOutlined,
  PictureOutlined,
  SearchOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import {
  Button,
  Drawer,
  Empty,
  Image,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  fetchDatabankSampleImageUrl,
  listDatabankSamples,
} from "@/api/databank";
import { useDebounce } from "@/hooks/useDebounce";
import type { DatabankDataset, DatabankSample } from "@/types/databank";

interface DatabankSamplesDrawerProps {
  dataset: DatabankDataset | null;
  open: boolean;
  onClose: () => void;
}

function SampleThumb({
  datasetId,
  sampleId,
  filename,
}: {
  datasetId: string;
  sampleId: string;
  filename: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchDatabankSampleImageUrl(datasetId, sampleId)
      .then((u) => {
        if (active) setUrl(u);
      })
      .catch(() => {
        if (active) setUrl(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [datasetId, sampleId]);

  if (loading) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-100">
        <Spin size="small" />
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-100 text-slate-400">
        <PictureOutlined />
      </div>
    );
  }

  return (
    <Image
      src={url}
      alt={filename}
      width={48}
      height={48}
      className="rounded object-cover"
      fallback=""
    />
  );
}

export function DatabankSamplesDrawer({
  dataset,
  open,
  onClose,
}: DatabankSamplesDrawerProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [reviewFilter, setReviewFilter] = useState<"all" | "reviewed" | "unreviewed">("all");
  const debouncedSearch = useDebounce(searchInput, 300);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryFilter, reviewFilter, dataset?.id]);

  const enabled = Boolean(open && dataset?.id);

  const samplesQuery = useQuery({
    queryKey: [
      "databank",
      "drawer-samples",
      dataset?.id,
      debouncedSearch,
      categoryFilter,
      reviewFilter,
      page,
      pageSize,
    ],
    enabled,
    queryFn: () =>
      listDatabankSamples(dataset!.id, {
        search: debouncedSearch.trim() || undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        within_review_status: reviewFilter !== "all" ? reviewFilter : undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
  });

  const columns: ColumnsType<DatabankSample> = [
    {
      title: "Preview",
      key: "thumb",
      width: 70,
      render: (_, row) =>
        dataset?.id ? (
          <SampleThumb datasetId={dataset.id} sampleId={row.id} filename={row.filename} />
        ) : null,
    },
    {
      title: "Filename",
      dataIndex: "filename",
      key: "filename",
      ellipsis: true,
      render: (filename: string) => (
        <span className="font-mono text-xs text-slate-700" title={filename}>
          {filename}
        </span>
      ),
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      width: 110,
      render: (cat: string) => {
        const c = cat || "general";
        if (c === "raw") return <Tag color="orange">Raw</Tag>;
        if (c === "blurry") return <Tag color="gold">Blurry</Tag>;
        if (c === "dead") return <Tag color="red">Dead</Tag>;
        if (c === "general") return <Tag color="blue">General</Tag>;
        return <Tag color="purple">{c}</Tag>;
      },
    },
    {
      title: "Review Status",
      dataIndex: "review_status",
      key: "review_status",
      width: 120,
      render: (status: string) =>
        status === "reviewed" ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>
            Reviewed
          </Tag>
        ) : (
          <Tag color="default" icon={<ClockCircleOutlined />}>
            Unreviewed
          </Tag>
        ),
    },
    {
      title: "Ground Truth (GT)",
      key: "gt",
      width: 140,
      render: (_, row) => {
        const gt = row.final_gt || row.corrected_gt || row.ground_truth_normalized || row.ground_truth;
        return gt ? (
          <span className="font-mono font-semibold text-emerald-700">{gt}</span>
        ) : (
          <span className="text-xs text-slate-400">None</span>
        );
      },
    },
    {
      title: "Predicted",
      key: "predicted",
      width: 130,
      render: (_, row) => {
        const pred = row.upload_predicted || row.rerun_predicted;
        return pred ? (
          <span className="font-mono text-xs text-slate-800">{pred}</span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        );
      },
    },
  ];

  const categoryOptions = [
    { label: "All Categories", value: "all" },
    { label: "General", value: "general" },
    { label: "Blurry", value: "blurry" },
    { label: "Dead", value: "dead" },
    { label: "Raw", value: "raw" },
    ...(dataset?.custom_categories || []).map((c) => ({
      label: c,
      value: c,
    })),
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={860}
      title={
        <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
          <div className="flex items-center gap-2">
            <FileImageOutlined className="text-blue-600" />
            <span className="font-bold text-slate-900">{dataset?.name}</span>
            <span className="text-xs text-slate-400">v{dataset?.version}</span>
          </div>

          <Space size="small">
            <Button
              size="small"
              icon={<TagsOutlined />}
              onClick={() => {
                onClose();
                navigate(`/databank/label-data?dataset_id=${dataset?.id}`);
              }}
            >
              Open in Label Data
            </Button>
            <Button
              size="small"
              icon={<InboxOutlined />}
              onClick={() => {
                onClose();
                navigate(`/databank/raw?dataset_id=${dataset?.id}`);
              }}
            >
              Open in Raw Data
            </Button>
          </Space>
        </div>
      }
    >
      <div className="flex h-full flex-col space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <Input
            placeholder="Search filename or GT…"
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            allowClear
            className="w-56"
            size="small"
          />

          <Select
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categoryOptions}
            size="small"
            style={{ minWidth: 140 }}
          />

          <Select
            value={reviewFilter}
            onChange={setReviewFilter}
            options={[
              { label: "All Statuses", value: "all" },
              { label: "Reviewed", value: "reviewed" },
              { label: "Unreviewed", value: "unreviewed" },
            ]}
            size="small"
            style={{ width: 120 }}
          />

          <div className="ml-auto text-xs text-slate-500">
            Total: <strong>{(samplesQuery.data?.total ?? 0).toLocaleString()}</strong> samples
          </div>
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white">
          <Table<DatabankSample>
            rowKey="id"
            columns={columns}
            dataSource={samplesQuery.data?.samples || []}
            loading={samplesQuery.isLoading}
            pagination={{
              current: page,
              pageSize,
              total: samplesQuery.data?.total || 0,
              showSizeChanger: true,
              pageSizeOptions: ["15", "25", "50", "100"],
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
            size="small"
            locale={{
              emptyText: <Empty description="No samples match the criteria." image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        </div>
      </div>
    </Drawer>
  );
}
