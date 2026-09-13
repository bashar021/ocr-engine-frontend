import { useMemo, useState } from "react";
import { Alert, Button, Table, Tag, Typography } from "antd";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import { getBillDatasetIssues } from "@/api/billDataset";
import { PageHeader } from "@/components/common/PageHeader";
import { CapabilityAlert } from "@/components/bill/dataset/DatasetContextBar";
import { useBillDatasetContext } from "@/features/bill/dataset/context";
import {
  useBillHardFailuresQuery,
  useBillTaxonomyQuery,
} from "@/features/bill/dataset/hooks";
import { listLocalBillDocuments } from "@/features/bill/localDocuments";
import { BILL_DATASET_GAPS } from "@/features/bill/dataset/capabilities";
import type { BillLocalDocument } from "@/types/bill";

export function BillIssuesPage() {
  const { datasetId } = useBillDatasetContext();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const taxonomyQuery = useBillTaxonomyQuery();
  const hardQuery = useBillHardFailuresQuery(
    datasetId
      ? {
          dataset_id: datasetId,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }
      : null,
  );
  const importIssuesQuery = useQuery({
    queryKey: ["bill", "dataset", "import-issues", datasetId],
    queryFn: () => getBillDatasetIssues(datasetId!),
    enabled: Boolean(datasetId),
  });

  const importIssues = useMemo(() => {
    const raw = importIssuesQuery.data?.issues;
    return Array.isArray(raw) ? raw : [];
  }, [importIssuesQuery.data]);

  const localIssues = useMemo(() => {
    return listLocalBillDocuments()
      .filter(
        (d) =>
          d.status === "FAILED" ||
          d.status === "PARTIAL" ||
          d.validationStatus === "FAILED" ||
          (d.failureCodes && d.failureCodes.length > 0),
      )
      .flatMap((d) => {
        const codes = d.failureCodes?.length
          ? d.failureCodes
          : [d.status || "ISSUE"];
        return codes.map((code) => ({
          key: `${d.documentId}-${code}`,
          code,
          document: d,
        }));
      });
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        breadcrumbs={[
          { title: "Datasets", path: "/bill/datasets" },
          { title: "Issues" },
        ]}
        title="Issues"
        description="Import validation issues, evaluation hard-failures, failure taxonomy, and local process failures."
      />

      <CapabilityAlert
        type="info"
        title="Import issues are persisted on the dataset"
        detail="GET /v1/bill/datasets/{id}/issues returns issues recorded during Bill ZIP import. Resolve/ignore workflow is not yet a separate CRUD API."
      />

      <div className="space-y-6 px-4 pb-4">
        <div>
          <Typography.Title level={5}>Import issues</Typography.Title>
          {!datasetId ? (
            <Alert
              type="info"
              showIcon
              message="Select a dataset to load import issues"
            />
          ) : importIssuesQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message={getApiErrorMessage(importIssuesQuery.error)}
            />
          ) : (
            <Table
              size="small"
              rowKey={(_, i) => String(i)}
              loading={importIssuesQuery.isLoading}
              dataSource={importIssues as Array<Record<string, unknown>>}
              pagination={{ pageSize: 15 }}
              columns={[
                {
                  title: "Severity",
                  dataIndex: "severity",
                  width: 90,
                  render: (s: string) => (
                    <Tag color={s === "critical" ? "red" : "gold"}>{s}</Tag>
                  ),
                },
                { title: "Code", dataIndex: "code", width: 160 },
                { title: "Message", dataIndex: "message", ellipsis: true },
                {
                  title: "Document",
                  dataIndex: "document_id",
                  width: 140,
                  render: (v: string | undefined) => v || "—",
                },
              ]}
              locale={{ emptyText: "No import issues for this dataset." }}
            />
          )}
        </div>

        <div>
          <Typography.Title level={5}>Failure taxonomy</Typography.Title>
          {taxonomyQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message={getApiErrorMessage(taxonomyQuery.error)}
            />
          ) : (
            <div className="flex flex-wrap gap-1">
              {(taxonomyQuery.data?.codes ?? []).map((c) => (
                <Tag
                  key={c}
                  color={
                    taxonomyQuery.data?.review_required?.includes(c)
                      ? "orange"
                      : taxonomyQuery.data?.retryable?.includes(c)
                        ? "blue"
                        : "default"
                  }
                >
                  {c}
                </Tag>
              ))}
            </div>
          )}
        </div>

        <div>
          <Typography.Title level={5}>
            Evaluation hard failures
          </Typography.Title>
          {!datasetId ? (
            <Alert
              type="info"
              showIcon
              message="Select a dataset to load hard-failures"
            />
          ) : hardQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message={getApiErrorMessage(hardQuery.error)}
              action={
                <Button size="small" onClick={() => void hardQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : (
            <Table
              size="small"
              rowKey="id"
              loading={hardQuery.isLoading}
              dataSource={hardQuery.data?.results ?? []}
              pagination={{
                current: page,
                pageSize,
                total: hardQuery.data?.total ?? 0,
                onChange: (p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                },
              }}
              columns={[
                {
                  title: "Filename",
                  dataIndex: "filename",
                  render: (v: string | undefined) => v || "—",
                },
                {
                  title: "Failure",
                  dataIndex: "failure_type",
                  width: 140,
                  render: (v: string | null | undefined) =>
                    v ? <Tag color="red">{v}</Tag> : "—",
                },
                {
                  title: "Predicted",
                  dataIndex: "predicted_normalized",
                  ellipsis: true,
                },
                {
                  title: "GT",
                  dataIndex: "ground_truth_normalized",
                  ellipsis: true,
                },
              ]}
              locale={{ emptyText: "No hard failures for this dataset." }}
            />
          )}
        </div>

        <div>
          <Typography.Title level={5}>
            Local process issues ({localIssues.length})
          </Typography.Title>
          <Table
            size="small"
            rowKey="key"
            dataSource={localIssues}
            pagination={{ pageSize: 15 }}
            columns={[
              {
                title: "Issue",
                dataIndex: "code",
                width: 160,
                render: (c: string) => <Tag color="red">{c}</Tag>,
              },
              {
                title: "Document",
                key: "doc",
                render: (_: unknown, row: { document: BillLocalDocument }) => (
                  <Link
                    to={`/bill/documents/${encodeURIComponent(row.document.documentId)}`}
                  >
                    {row.document.fileName}
                  </Link>
                ),
              },
              {
                title: "Status",
                width: 120,
                render: (_: unknown, row: { document: BillLocalDocument }) =>
                  row.document.status,
              },
              {
                title: "Created",
                width: 120,
                render: (_: unknown, row: { document: BillLocalDocument }) =>
                  row.document.createdAt
                    ? dayjs(row.document.createdAt).format("YYYY-MM-DD")
                    : "—",
              },
            ]}
            locale={{ emptyText: "No local process issues." }}
          />
        </div>

        <div>
          <Typography.Title level={5}>Remaining backend gaps</Typography.Title>
          <ul className="list-disc pl-5 text-sm text-slate-600">
            {BILL_DATASET_GAPS.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
