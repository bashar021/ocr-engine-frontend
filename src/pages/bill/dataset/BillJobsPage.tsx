import { useState } from "react";
import { App, Alert, Button, Input, Space, Table, Tag, Typography } from "antd";
import { Link } from "react-router-dom";
import dayjs from "dayjs";

import { getApiErrorMessage } from "@/api/client";
import { getBillJob } from "@/api/billDataset";
import { PageHeader } from "@/components/common/PageHeader";
import { CapabilityAlert } from "@/components/bill/dataset/DatasetContextBar";
import {
  useBillDatasetMutations,
  useBillEvaluationsQuery,
  useBillPlatformJobsQuery,
} from "@/features/bill/dataset/hooks";
import { listLocalBillDocuments } from "@/features/bill/localDocuments";

export function BillJobsPage() {
  const { message, modal } = App.useApp();
  const jobsQuery = useBillPlatformJobsQuery();
  const evalQuery = useBillEvaluationsQuery({ limit: 50, offset: 0 });
  const mutations = useBillDatasetMutations();
  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState<unknown>(null);

  const localJobs = listLocalBillDocuments()
    .filter((d) => d.jobId)
    .map((d) => ({
      id: d.jobId!,
      documentId: d.documentId,
      fileName: d.fileName,
      status: d.status,
      createdAt: d.createdAt,
    }));

  const cancelJob = (id: string) => {
    modal.confirm({
      title: `Cancel job ${id}?`,
      okType: "danger",
      onOk: async () => {
        try {
          await mutations.cancelJob.mutateAsync(id);
          message.success("Cancel requested");
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  const lookupBillJob = async () => {
    if (!lookupId.trim()) return;
    try {
      const res = await getBillJob(lookupId.trim());
      setLookupResult(res);
      message.success("Job loaded");
    } catch (e) {
      setLookupResult(null);
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        breadcrumbs={[
          { title: "Datasets", path: "/bill/datasets" },
          { title: "Processing jobs" },
        ]}
        title="Processing jobs"
        description="Platform async jobs (task_key=bill), evaluation runs, and local sync process job IDs."
        actions={
          <Button onClick={() => void jobsQuery.refetch()}>Refresh</Button>
        }
      />

      <CapabilityAlert
        type="warning"
        title="Bill document process is synchronous"
        detail="POST /v1/documents/process blocks until complete — there is no async multipage bill pipeline job API. Platform /v1/jobs covers generic OCR/batch only. Active jobs poll until completed/failed/cancelled."
      />

      <div className="px-4 pb-4 space-y-6">
        <div>
          <Typography.Title level={5}>Platform jobs</Typography.Title>
          {jobsQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message={getApiErrorMessage(jobsQuery.error)}
            />
          ) : (
            <Table
              size="small"
              rowKey="id"
              loading={jobsQuery.isLoading}
              dataSource={jobsQuery.data ?? []}
              pagination={{ pageSize: 15 }}
              columns={[
                {
                  title: "Job ID",
                  dataIndex: "id",
                  render: (id: string) => (
                    <Typography.Text code copyable>
                      {id}
                    </Typography.Text>
                  ),
                },
                { title: "Type", dataIndex: "job_type", width: 120 },
                {
                  title: "Status",
                  dataIndex: "status",
                  width: 110,
                  render: (s: string) => <Tag>{s}</Tag>,
                },
                {
                  title: "Progress",
                  dataIndex: "progress_pct",
                  width: 90,
                  render: (v: number | null | undefined) =>
                    v != null ? `${v}%` : "—",
                },
                {
                  title: "Created",
                  dataIndex: "created_at",
                  width: 140,
                  render: (v: string | undefined) =>
                    v ? dayjs(v).format("YYYY-MM-DD HH:mm") : "—",
                },
                {
                  title: "",
                  key: "a",
                  width: 90,
                  render: (_: unknown, row: { id: string; status: string }) =>
                    ["queued", "pending", "running", "processing"].includes(
                      String(row.status).toLowerCase(),
                    ) ? (
                      <Button
                        size="small"
                        danger
                        onClick={() => cancelJob(row.id)}
                      >
                        Cancel
                      </Button>
                    ) : null,
                },
              ]}
              locale={{ emptyText: "No async platform jobs for bill." }}
            />
          )}
        </div>

        <div>
          <Typography.Title level={5}>Evaluation runs</Typography.Title>
          <Table
            size="small"
            rowKey="id"
            loading={evalQuery.isLoading}
            dataSource={evalQuery.data?.evaluations ?? []}
            pagination={{ pageSize: 10 }}
            columns={[
              {
                title: "Run",
                dataIndex: "id",
                render: (id: string) => (
                  <Link
                    to={`/bill/evaluation?evaluationId=${encodeURIComponent(id)}`}
                  >
                    {id.slice(0, 8)}…
                  </Link>
                ),
              },
              { title: "Dataset", dataIndex: "dataset_id", ellipsis: true },
              {
                title: "Status",
                dataIndex: "status",
                width: 110,
                render: (s: string) => <Tag>{s}</Tag>,
              },
              { title: "Model", dataIndex: "model_ref", ellipsis: true },
            ]}
            locale={{ emptyText: "No evaluation runs for ocr_type=bill." }}
          />
        </div>

        <div>
          <Typography.Title level={5}>Lookup bill process job</Typography.Title>
          <Space.Compact className="mb-2 max-w-lg">
            <Input
              placeholder="job_id from POST /v1/documents/process"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
            />
            <Button type="primary" onClick={() => void lookupBillJob()}>
              GET /v1/bill/jobs/{`{id}`}
            </Button>
          </Space.Compact>
          {lookupResult ? (
            <pre className="max-h-48 overflow-auto rounded bg-slate-50 p-2 text-xs">
              {JSON.stringify(lookupResult, null, 2)}
            </pre>
          ) : null}
        </div>

        <div>
          <Typography.Title level={5}>
            Local sync process IDs ({localJobs.length})
          </Typography.Title>
          <Table
            size="small"
            rowKey="id"
            dataSource={localJobs}
            pagination={{ pageSize: 10 }}
            columns={[
              {
                title: "Job ID",
                dataIndex: "id",
                render: (id: string) => (
                  <Typography.Text code copyable>
                    {id}
                  </Typography.Text>
                ),
              },
              {
                title: "Document",
                dataIndex: "fileName",
                render: (v: string, row: { documentId: string }) => (
                  <Link
                    to={`/bill/documents/${encodeURIComponent(row.documentId)}`}
                  >
                    {v}
                  </Link>
                ),
              },
              {
                title: "Status",
                dataIndex: "status",
                width: 120,
                render: (s: string) => <Tag>{s}</Tag>,
              },
            ]}
            locale={{ emptyText: "No local process jobs in this browser." }}
          />
        </div>
      </div>
    </div>
  );
}
