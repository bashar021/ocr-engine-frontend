import { useMemo, useState } from "react";
import { Alert, Button, Table, Tag, Typography } from "antd";
import { Link } from "react-router-dom";
import dayjs from "dayjs";

import { PageHeader } from "@/components/common/PageHeader";
import { CapabilityAlert } from "@/components/bill/dataset/DatasetContextBar";
import { BillStatusBadge, ConfidenceBadge } from "@/components/bill/BillBadges";
import { useLocalBillDocuments } from "@/features/bill/hooks";
import { useBillDatasetContext } from "@/features/bill/dataset/context";
import type { BillLocalDocument } from "@/types/bill";

function reviewPriority(doc: BillLocalDocument): number {
  let score = 0;
  if (doc.reviewRequired) score += 40;
  if (doc.status === "FAILED") score += 30;
  if (doc.status === "PARTIAL") score += 20;
  if (doc.validationStatus === "FAILED") score += 25;
  if ((doc.confidenceOverall ?? 1) < 0.5) score += 15;
  if (doc.documentType === "UNKNOWN") score += 10;
  if (doc.failureCodes?.includes("FIELD_AMBIGUOUS")) score += 20;
  return score;
}

function priorityLabel(score: number) {
  if (score >= 70) return { label: "Critical", color: "red" as const };
  if (score >= 45) return { label: "High", color: "orange" as const };
  if (score >= 25) return { label: "Medium", color: "gold" as const };
  return { label: "Low", color: "default" as const };
}

/**
 * Dataset workspace review queue.
 * Backend has no server-side bill review queue — uses local process inbox +
 * opens the real Bill document review workspace.
 */
export function BillDatasetReviewPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const docsQuery = useLocalBillDocuments(refreshKey);
  const { datasetId } = useBillDatasetContext();

  const rows = useMemo(() => {
    return (docsQuery.data ?? [])
      .filter(
        (d) =>
          d.reviewRequired ||
          d.status === "REVIEW_REQUIRED" ||
          d.status === "PARTIAL" ||
          d.status === "FAILED" ||
          d.validationStatus === "FAILED" ||
          (d.confidenceOverall != null && d.confidenceOverall < 0.65),
      )
      .map((d) => ({ ...d, priority: reviewPriority(d) }))
      .sort((a, b) => b.priority - a.priority);
  }, [docsQuery.data]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        breadcrumbs={[
          { title: "Datasets", path: "/bill/datasets" },
          { title: "Review queue" },
        ]}
        title="Review queue"
        description="Human attention queue derived from processed bill documents retained in this browser. Opens the real Bill document review workspace."
        actions={
          <Button onClick={() => setRefreshKey((k) => k + 1)}>Refresh</Button>
        }
      />

      <CapabilityAlert
        type="warning"
        title="No server-side bill review queue API"
        detail="Priority is computed locally from status/confidence/validation flags returned by process/result APIs. Corrections persist via POST /v1/documents/{id}/review. Dataset membership filtering is unavailable (no link between DOC-* and evaluation datasets)."
      />

      {datasetId ? (
        <Alert
          className="mx-4 mb-2"
          type="info"
          showIcon
          message={`Dataset context: ${datasetId}`}
          description="Review queue is not filtered by dataset — backend cannot join processed documents to dataset samples."
        />
      ) : null}

      <div className="px-4 pb-4">
        <Table
          size="small"
          rowKey="id"
          loading={docsQuery.isLoading}
          dataSource={rows}
          pagination={{ pageSize: 25 }}
          columns={[
            {
              title: "Priority",
              dataIndex: "priority",
              width: 100,
              render: (v: number) => {
                const p = priorityLabel(v);
                return <Tag color={p.color}>{p.label}</Tag>;
              },
            },
            {
              title: "Document",
              dataIndex: "fileName",
              render: (v: string, row: BillLocalDocument) => {
                const field =
                  row.failureCodes?.[0] ||
                  (row.validationStatus === "FAILED"
                    ? "validation"
                    : undefined);
                const qs = field ? `?field=${encodeURIComponent(field)}` : "";
                return (
                  <Link
                    to={`/bill/documents/${encodeURIComponent(row.documentId)}${qs}`}
                  >
                    {v}
                  </Link>
                );
              },
            },
            {
              title: "Status",
              dataIndex: "status",
              width: 130,
              render: (v: string) => <BillStatusBadge status={v} />,
            },
            {
              title: "Confidence",
              key: "c",
              width: 120,
              render: (_: unknown, row: BillLocalDocument) => (
                <ConfidenceBadge
                  level={row.confidenceLevel}
                  score={row.confidenceOverall}
                />
              ),
            },
            {
              title: "Validation",
              dataIndex: "validationStatus",
              width: 110,
              render: (v: string | undefined) => v || "—",
            },
            {
              title: "Age",
              dataIndex: "createdAt",
              width: 120,
              render: (v: string | undefined) =>
                v ? dayjs(v).format("YYYY-MM-DD") : "—",
            },
          ]}
          locale={{
            emptyText: (
              <Typography.Text type="secondary">
                Review queue is clear for documents in this browser inbox.
              </Typography.Text>
            ),
          }}
        />
      </div>
    </div>
  );
}
