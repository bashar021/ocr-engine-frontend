import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  Progress,
  Space,
  Table,
  Tag,
  Typography,
  App,
} from "antd";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import { updateBillDatasetSample } from "@/api/billDataset";
import { PageHeader } from "@/components/common/PageHeader";
import {
  CapabilityAlert,
  DatasetHealthBar,
} from "@/components/bill/dataset/DatasetContextBar";
import { useBillDatasetContext } from "@/features/bill/dataset/context";
import {
  billDatasetKeys,
  useBillDatasetProfilesQuery,
  useBillDatasetQuery,
  useBillDatasetSamplesQuery,
} from "@/features/bill/dataset/hooks";
import { useBillFeedback } from "@/features/bill/hooks";
import {
  annotationStatusFromSample,
  coveragePct,
} from "@/features/bill/dataset/annotationStatus";
import type { DatasetSample } from "@/types/evaluation";

export function BillAnnotationsPage() {
  const { message } = App.useApp();
  const { datasetId, chunk } = useBillDatasetContext();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<DatasetSample | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const qc = useQueryClient();

  const datasetQuery = useBillDatasetQuery(datasetId);
  const samplesQuery = useBillDatasetSamplesQuery(datasetId, {
    limit: pageSize,
    offset: (page - 1) * pageSize,
    split: chunk && chunk !== "all" ? chunk : undefined,
  });
  const profilesQuery = useBillDatasetProfilesQuery();
  const feedbackQuery = useBillFeedback();

  const samples = samplesQuery.data?.samples ?? [];
  const enriched = useMemo(() => {
    return samples.map((s) => ({
      ...s,
      _ann: annotationStatusFromSample(s),
    }));
  }, [samples]);

  const filtered = useMemo(() => {
    if (!statusFilter) return enriched;
    return enriched.filter((s) => s._ann === statusFilter);
  }, [enriched, statusFilter]);

  const pageCov = coveragePct(samples);

  const fieldHints = useMemo(() => {
    const profiles = profilesQuery.data?.profiles ?? [];
    return profiles.slice(0, 5).map((p) => ({
      id: p.profile_id,
      name: p.name,
      fields: p.field_count,
    }));
  }, [profilesQuery.data]);

  const onSaveGt = async (values: { ground_truth: string }) => {
    if (!datasetId || !selected) return;
    try {
      await updateBillDatasetSample(datasetId, selected.id, {
        ground_truth: values.ground_truth,
      });
      message.success("Ground truth updated");
      void qc.invalidateQueries({
        queryKey: billDatasetKeys.samples(datasetId, {
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }),
      });
      setSelected(null);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        breadcrumbs={[
          { title: "Datasets", path: "/bill/datasets" },
          { title: "Annotations" },
        ]}
        title="Annotations"
        description="Ground-truth health for the selected dataset. Sample GT is a single string on the shared evaluation API — not multi-field bill schemas."
      />

      <CapabilityAlert
        type="warning"
        title="Field-level bill annotations are not available on dataset samples"
        detail="PATCH sample supports ground_truth string + bbox only. Multi-field corrections use POST /v1/documents/{id}/review (feedback store). Schema coverage below lists active Bill profiles for reference — not sample field completion."
      />

      {!datasetId ? (
        <Alert
          className="mx-4"
          type="info"
          showIcon
          message="Select a dataset to inspect annotation coverage."
        />
      ) : null}

      <DatasetHealthBar
        sampleCount={datasetQuery.data?.sample_count}
        labeled={pageCov?.labeled}
        unlabeled={pageCov?.unlabeled}
        splitCounts={datasetQuery.data?.split_counts}
      />

      <div className="px-4 pb-2">
        <Typography.Text type="secondary" className="text-xs">
          Active profiles (schema-driven field counts):{" "}
          {fieldHints.length
            ? fieldHints.map((p) => `${p.name} (${p.fields})`).join(" · ")
            : "loading…"}
        </Typography.Text>
        {pageCov ? (
          <div className="mt-2 max-w-md">
            <Typography.Text className="text-xs">
              Page GT coverage {pageCov.pct.toFixed(1)}%
            </Typography.Text>
            <Progress
              percent={Number(pageCov.pct.toFixed(1))}
              size="small"
              status="active"
            />
          </div>
        ) : null}
      </div>

      <div className="px-4 pb-4">
        <Space className="mb-2">
          {["LABELED", "UNLABELED", "PARTIAL", "INVALID"].map((s) => (
            <Button
              key={s}
              size="small"
              type={statusFilter === s ? "primary" : "default"}
              onClick={() =>
                setStatusFilter((prev) => (prev === s ? undefined : s))
              }
            >
              {s}
            </Button>
          ))}
        </Space>

        <Table
          size="small"
          rowKey="id"
          loading={samplesQuery.isLoading}
          dataSource={filtered}
          pagination={{
            current: page,
            pageSize,
            total: samplesQuery.data?.total ?? 0,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          columns={[
            { title: "Document", dataIndex: "filename" },
            {
              title: "Status",
              dataIndex: "_ann",
              width: 110,
              render: (s: string) => <Tag>{s}</Tag>,
            },
            {
              title: "Ground truth",
              dataIndex: "ground_truth",
              ellipsis: true,
              render: (v: string) => v || "—",
            },
            {
              title: "Split",
              dataIndex: "split",
              width: 90,
              render: (v: string | null | undefined) => v || "—",
            },
            {
              title: "",
              key: "a",
              width: 80,
              render: (_: unknown, row: DatasetSample & { _ann: string }) => (
                <Button size="small" onClick={() => setSelected(row)}>
                  Open
                </Button>
              ),
            },
          ]}
          locale={{ emptyText: "No annotation records for this filter." }}
          sticky
        />

        <Typography.Title level={5} className="!mt-6">
          Bill feedback corrections ({feedbackQuery.data?.feedback?.length ?? 0}
          )
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="!mt-0 text-xs">
          From GET /v1/bill/feedback — field-level human corrections on
          processed documents.
        </Typography.Paragraph>
        <Table
          size="small"
          rowKey={(r) => String(r.feedback_id ?? `${r.document_id}-${r.field}`)}
          loading={feedbackQuery.isLoading}
          dataSource={feedbackQuery.data?.feedback ?? []}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: "Document",
              dataIndex: "document_id",
              render: (id: string) => (
                <Link to={`/bill/documents/${encodeURIComponent(id)}`}>
                  {id}
                </Link>
              ),
            },
            { title: "Field", dataIndex: "field", width: 140 },
            {
              title: "Corrected",
              dataIndex: "corrected_value",
              ellipsis: true,
              render: (v: unknown) =>
                typeof v === "string" ? v : JSON.stringify(v),
            },
          ]}
          locale={{ emptyText: "No feedback corrections yet." }}
        />
      </div>

      <Drawer
        title={selected?.filename}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        width={420}
      >
        <CapabilityAlert
          type="info"
          title="Editable: string GT only"
          detail="This form calls PATCH …/samples/{id}. It does not edit bill extraction fields."
        />
        <Form
          layout="vertical"
          key={selected?.id}
          initialValues={{ ground_truth: selected?.ground_truth ?? "" }}
          onFinish={(v) => void onSaveGt(v)}
        >
          <Form.Item name="ground_truth" label="Ground truth">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            Save GT
          </Button>
        </Form>
      </Drawer>
    </div>
  );
}
