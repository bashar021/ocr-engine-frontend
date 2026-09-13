import { useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { EyeOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import { processBillEvaluationSample } from "@/api/bill";
import { listDatasets, listDatasetSamples } from "@/api/evaluation";
import { fetchBillSampleImageObjectUrl } from "@/api/billDataset";
import {
  BillSamplePreviewModal,
  type BillSamplePreviewTarget,
} from "@/components/bill/BillSamplePreviewModal";
import { PageHeader } from "@/components/common/PageHeader";
import type { DatasetSample, EvaluationDataset } from "@/types/evaluation";

const SYNC_ORIGINS = new Set([
  "databank_reviewed",
  "databank_reviewed_chunk",
  "databank_blurry",
  "databank_dead",
  "databank_category",
]);

function isSyncedMirror(ds: EvaluationDataset): boolean {
  const origin = String(
    (ds.metadata as { origin?: string } | null)?.origin ?? "",
  );
  if (SYNC_ORIGINS.has(origin)) return true;
  const name = (ds.name || "").toLowerCase();
  return name.startsWith("data-bank-");
}

export function BillEvaluationDatasetsPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [preview, setPreview] = useState<BillSamplePreviewTarget | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const datasetsQuery = useQuery({
    queryKey: ["bill-eval-datasets-synced"],
    queryFn: () =>
      listDatasets({
        ocr_type: "bill",
        include_archived: false,
        limit: 200,
        offset: 0,
      }),
  });

  const synced = useMemo(
    () => (datasetsQuery.data?.datasets ?? []).filter(isSyncedMirror),
    [datasetsQuery.data],
  );

  useEffect(() => {
    if (!selectedId && synced[0]?.id) setSelectedId(synced[0].id);
  }, [synced, selectedId]);

  const samplesQuery = useQuery({
    queryKey: ["bill-eval-synced-samples", selectedId, page, pageSize],
    queryFn: () =>
      listDatasetSamples(selectedId!, {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
    enabled: Boolean(selectedId),
  });

  const runMut = useMutation({
    mutationFn: (sampleId: string) =>
      processBillEvaluationSample(selectedId!, sampleId, {}),
    onSuccess: () => {
      message.success("OCR completed");
      void samplesQuery.refetch();
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  useEffect(() => {
    let revoke: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      if (!preview || !selectedId) {
        setPreviewUrl(null);
        return;
      }
      try {
        const url = await fetchBillSampleImageObjectUrl(
          selectedId,
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
  }, [preview, selectedId]);

  const openPreview = (row: DatasetSample & { last_prediction?: unknown }) => {
    if (!selectedId) return;
    setPreview({
      source: "evaluation",
      datasetId: selectedId,
      sampleId: row.id,
      filename: row.filename,
      groundTruth: row.ground_truth,
      predictedValue:
        typeof row.last_prediction === "object" &&
        row.last_prediction &&
        "value" in (row.last_prediction as object)
          ? String((row.last_prediction as { value?: unknown }).value ?? "")
          : undefined,
      lastPrediction: row.last_prediction,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Evaluation datasets"
        description="Bill datasets synced from Data list categories. Run OCR on any entry and compare ground truth vs predicted fields."
      />
      <div className="space-y-4 p-6">
        <Table
          rowKey="id"
          size="small"
          loading={datasetsQuery.isLoading}
          dataSource={synced}
          pagination={false}
          rowSelection={{
            type: "radio",
            selectedRowKeys: selectedId ? [selectedId] : [],
            onChange: (keys) => {
              setSelectedId(String(keys[0] ?? ""));
              setPage(1);
            },
          }}
          onRow={(row) => ({
            onClick: () => {
              setSelectedId(row.id);
              setPage(1);
            },
          })}
          columns={[
            { title: "Name", dataIndex: "name" },
            { title: "Version", dataIndex: "version", width: 100 },
            {
              title: "Samples",
              dataIndex: "sample_count",
              width: 100,
            },
            {
              title: "Origin",
              width: 160,
              render: (_: unknown, row: EvaluationDataset) => (
                <Tag>
                  {String(
                    (row.metadata as { origin?: string } | null)?.origin ??
                      "sync",
                  )}
                </Tag>
              ),
            },
          ]}
        />

        {!selectedId ? (
          <Typography.Text type="secondary">
            Sync a category from Data list to populate this tab.
          </Typography.Text>
        ) : (
          <Table
            rowKey="id"
            size="small"
            loading={samplesQuery.isLoading}
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
                dataIndex: "ground_truth",
                ellipsis: true,
                width: 200,
              },
              {
                title: "Predicted",
                width: 160,
                ellipsis: true,
                render: (
                  _: unknown,
                  row: DatasetSample & { last_prediction?: { value?: unknown } },
                ) =>
                  row.last_prediction?.value != null
                    ? String(row.last_prediction.value)
                    : "—",
              },
              {
                title: "Actions",
                width: 160,
                render: (_: unknown, row: DatasetSample) => (
                  <Space>
                    <Button
                      size="small"
                      icon={<PlayCircleOutlined />}
                      loading={runMut.isPending}
                      onClick={() => runMut.mutate(row.id)}
                    >
                      Run OCR
                    </Button>
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => openPreview(row)}
                    />
                  </Space>
                ),
              },
            ]}
          />
        )}
      </div>

      <BillSamplePreviewModal
        open={Boolean(preview)}
        target={preview ? { ...preview, imageUrl: previewUrl } : null}
        onClose={() => setPreview(null)}
        onProcessed={() => {
          void samplesQuery.refetch();
          void qc.invalidateQueries({ queryKey: ["bill-eval-synced-samples"] });
        }}
      />
    </div>
  );
}
