import { useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Input,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
} from "antd";
import {
  EyeOutlined,
  PlusOutlined,
  SyncOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import {
  addDatabankCategory,
  fetchDatabankSampleImageUrl,
  getDatabank,
  listDatabankSamples,
  setDatabankSampleCategory,
  syncDatabankReviewedEval,
  uploadToDatabank,
} from "@/api/databank";
import {
  BillSamplePreviewModal,
  type BillSamplePreviewTarget,
} from "@/components/bill/BillSamplePreviewModal";
import { PageHeader } from "@/components/common/PageHeader";
import type { DatabankSample } from "@/types/databank";

const BILL = "bill";

function tabCategoryScope(tabKey: string): string {
  return tabKey === "general" ? "" : tabKey;
}

export function BillDataListPage() {
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const [tab, setTab] = useState("general");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [preview, setPreview] = useState<BillSamplePreviewTarget | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");

  const bankQuery = useQuery({
    queryKey: ["bill-databank", BILL],
    queryFn: () => getDatabank(BILL),
    refetchInterval: (q) => {
      const st = q.state.data?.status;
      return st === "predicting" || st === "processing" || st === "rerunning"
        ? 2000
        : false;
    },
  });
  const dataset = bankQuery.data;
  const datasetId = dataset?.id;

  const customCategories = useMemo(
    () => dataset?.custom_categories ?? [],
    [dataset?.custom_categories],
  );

  const samplesQuery = useQuery({
    queryKey: ["bill-databank-samples", datasetId, tab, page, pageSize],
    queryFn: () => {
      if (tab === "general") {
        return listDatabankSamples(datasetId!, {
          review_status: "general",
          limit: pageSize,
          offset: (page - 1) * pageSize,
        });
      }
      if (tab === "unreviewed" || tab === "reviewed") {
        return listDatabankSamples(datasetId!, {
          review_status: tab,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        });
      }
      return listDatabankSamples(datasetId!, {
        review_status: "all",
        category: tabCategoryScope(tab),
        within_review_status: "all",
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
    },
    enabled: Boolean(datasetId),
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => uploadToDatabank(BILL, file),
    onSuccess: () => {
      message.success("Upload queued — bill predictions run in background");
      void qc.invalidateQueries({ queryKey: ["bill-databank"] });
      void qc.invalidateQueries({ queryKey: ["bill-databank-samples"] });
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  const categoryMut = useMutation({
    mutationFn: ({
      sampleId,
      category,
    }: {
      sampleId: string;
      category: string;
    }) => setDatabankSampleCategory(datasetId!, sampleId, category),
    onSuccess: () => {
      message.success("Category updated");
      void samplesQuery.refetch();
      void bankQuery.refetch();
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  const addCatMut = useMutation({
    mutationFn: (name: string) => addDatabankCategory(datasetId!, name),
    onSuccess: () => {
      message.success("Category created");
      setNewCategory("");
      void bankQuery.refetch();
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  const syncMut = useMutation({
    mutationFn: () => {
      if (tab === "general" || tab === "unreviewed" || tab === "reviewed") {
        return syncDatabankReviewedEval(datasetId!, {
          reviewed_chunk_count: 1,
        });
      }
      return syncDatabankReviewedEval(datasetId!, { category: tab });
    },
    onSuccess: () => message.success("Synced to Evaluation datasets"),
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  useEffect(() => {
    let revoke: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      if (!preview || !datasetId) {
        setPreviewUrl(null);
        return;
      }
      try {
        const url = await fetchDatabankSampleImageUrl(
          datasetId,
          preview.sampleId,
        );
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        revoke = () => URL.revokeObjectURL(url);
        setPreviewUrl(url);
      } catch {
        if (!cancelled) setPreviewUrl(null);
      }
    })();
    return () => {
      cancelled = true;
      revoke?.();
    };
  }, [preview, datasetId]);

  const tabItems = [
    {
      key: "general",
      label: `General (${dataset?.sample_count ?? 0})`,
    },
    {
      key: "unreviewed",
      label: `Unreviewed (${dataset?.unreviewed_count ?? 0})`,
    },
    {
      key: "reviewed",
      label: `Reviewed (${dataset?.reviewed_count ?? 0})`,
    },
    {
      key: "blurry",
      label: `Blurry (${dataset?.category_counts?.blurry?.total ?? 0})`,
    },
    {
      key: "dead",
      label: `Dead (${dataset?.category_counts?.dead?.total ?? 0})`,
    },
    ...customCategories.map((c) => ({
      key: c,
      label: `${c} (${dataset?.category_counts?.[c]?.total ?? 0})`,
    })),
  ];

  const openPreview = (row: DatabankSample & { last_prediction?: unknown }) => {
    setPreview({
      source: "databank",
      datasetId: datasetId!,
      sampleId: row.id,
      filename: row.filename,
      groundTruth: row.final_gt || row.ground_truth,
      predictedValue: row.rerun_predicted || row.upload_predicted,
      lastPrediction: row.last_prediction,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Bill data list"
        description="Bill-only databank (separate from odometer). Categorize samples and sync into Evaluation datasets."
      />
      <div className="space-y-3 p-6">
        <Space wrap>
          <Upload
            accept=".zip,application/zip"
            showUploadList={false}
            beforeUpload={(file) => {
              uploadMut.mutate(file);
              return false;
            }}
          >
            <Button icon={<UploadOutlined />} loading={uploadMut.isPending}>
              Upload ZIP
            </Button>
          </Upload>
          <Button
            icon={<SyncOutlined />}
            loading={syncMut.isPending}
            disabled={!datasetId}
            onClick={() => {
              modal.confirm({
                title: "Sync to Evaluation datasets?",
                content:
                  "Creates/updates bill evaluation mirrors only. Odometer data is never modified.",
                onOk: () => syncMut.mutateAsync(),
              });
            }}
          >
            Sync to Evaluation datasets
          </Button>
          <Typography.Text type="secondary">
            Status: {dataset?.status ?? "—"}
          </Typography.Text>
        </Space>

        <Space>
          <Input
            placeholder="New sub-dataset category"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="w-56"
          />
          <Button
            icon={<PlusOutlined />}
            disabled={!newCategory.trim() || !datasetId}
            loading={addCatMut.isPending}
            onClick={() => addCatMut.mutate(newCategory.trim())}
          >
            Add category
          </Button>
        </Space>

        <Tabs
          activeKey={tab}
          onChange={(k) => {
            setTab(k);
            setPage(1);
          }}
          items={tabItems}
        />

        <Table
          rowKey="id"
          size="small"
          loading={samplesQuery.isLoading || bankQuery.isLoading}
          dataSource={samplesQuery.data?.samples ?? []}
          pagination={{
            current: page,
            pageSize,
            total: samplesQuery.data?.total ?? 0,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          columns={[
            { title: "Filename", dataIndex: "filename", ellipsis: true },
            {
              title: "GT",
              width: 160,
              ellipsis: true,
              render: (_: unknown, r: DatabankSample) =>
                r.final_gt || r.ground_truth || "—",
            },
            {
              title: "Predicted",
              width: 160,
              ellipsis: true,
              render: (_: unknown, r: DatabankSample) =>
                r.rerun_predicted || r.upload_predicted || "—",
            },
            {
              title: "Match",
              width: 80,
              render: (_: unknown, r: DatabankSample) => {
                const m = r.rerun_match ?? r.upload_match;
                if (m == null) return "—";
                return m ? (
                  <Tag color="green">OK</Tag>
                ) : (
                  <Tag color="red">miss</Tag>
                );
              },
            },
            {
              title: "Status",
              dataIndex: "review_status",
              width: 110,
              render: (v: string) => <Tag>{v}</Tag>,
            },
            {
              title: "Move to",
              width: 150,
              render: (_: unknown, row: DatabankSample) => (
                <Space size={4} wrap>
                  {["general", "blurry", "dead", ...customCategories].map(
                    (c) => (
                      <Button
                        key={c}
                        size="small"
                        type={
                          (row.category || "general") === c
                            ? "primary"
                            : "default"
                        }
                        onClick={() =>
                          categoryMut.mutate({
                            sampleId: row.id,
                            category: c === "general" ? "" : c,
                          })
                        }
                      >
                        {c}
                      </Button>
                    ),
                  )}
                </Space>
              ),
            },
            {
              title: "",
              width: 72,
              render: (_: unknown, row: DatabankSample) => (
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => openPreview(row)}
                />
              ),
            },
          ]}
        />
      </div>

      <BillSamplePreviewModal
        open={Boolean(preview)}
        target={preview ? { ...preview, imageUrl: previewUrl } : null}
        onClose={() => setPreview(null)}
        onProcessed={() => void samplesQuery.refetch()}
      />
    </div>
  );
}
