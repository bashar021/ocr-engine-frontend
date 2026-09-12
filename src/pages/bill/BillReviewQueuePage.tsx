import { useMemo, useState } from "react";
import { Button, Card, Table, Typography } from "antd";
import { Link } from "react-router-dom";
import dayjs from "dayjs";

import { PageHeader } from "@/components/common/PageHeader";
import { BillStatusBadge, ConfidenceBadge } from "@/components/bill/BillBadges";
import { useLocalBillDocuments } from "@/features/bill/hooks";
import type { BillLocalDocument } from "@/types/bill";

function reviewPriority(doc: BillLocalDocument): number {
  // Honest heuristic from backend-derived flags only — not an ML score
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

export function BillReviewQueuePage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const docsQuery = useLocalBillDocuments(refreshKey);

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
        title="Bill review queue"
        description="Documents needing human attention based on review flags, validation failures, low confidence, or process failures from the Bill OCR backend."
        actions={
          <Button onClick={() => setRefreshKey((k) => k + 1)}>Refresh</Button>
        }
      />
      <div className="p-6">
        <Card size="small">
          {!rows.length ? (
            <Typography.Text type="secondary">
              Review queue is clear for documents in this browser inbox.
            </Typography.Text>
          ) : (
            <Table
              rowKey="id"
              size="small"
              dataSource={rows}
              pagination={{ pageSize: 25 }}
              columns={[
                {
                  title: "Priority",
                  dataIndex: "priority",
                  width: 90,
                  render: (v: number) =>
                    v >= 70 ? "Critical" : v >= 45 ? "High" : v >= 25 ? "Medium" : "Low",
                },
                {
                  title: "Document",
                  dataIndex: "fileName",
                  render: (v: string, row: BillLocalDocument) => (
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
                  render: (v: string) => <BillStatusBadge status={v} />,
                },
                {
                  title: "Confidence",
                  key: "c",
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
                  render: (v: string) =>
                    v ? <BillStatusBadge status={v} /> : "—",
                },
                {
                  title: "Failures",
                  dataIndex: "failureCodes",
                  render: (v: string[] | undefined) =>
                    v?.length ? v.join(", ") : "—",
                },
                {
                  title: "Created",
                  dataIndex: "createdAt",
                  render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm"),
                },
              ]}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
