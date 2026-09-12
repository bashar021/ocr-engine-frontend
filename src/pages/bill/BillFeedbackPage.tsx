import { App, Button, Card, Select, Space, Table, Typography } from "antd";
import { useState } from "react";
import dayjs from "dayjs";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/common/PageHeader";
import {
  useBillFeedback,
  useExportBillFeedback,
  useLocalBillDocuments,
} from "@/features/bill/hooks";
import { getApiErrorMessage } from "@/api/client";
import { formatBillFieldValue } from "@/types/bill";

export function BillFeedbackPage() {
  const { message } = App.useApp();
  const docsQuery = useLocalBillDocuments();
  const [documentId, setDocumentId] = useState<string | undefined>();
  const feedbackQuery = useBillFeedback(documentId);
  const exportMut = useExportBillFeedback();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Bill feedback"
        description="Human corrections and review feedback from the Bill OCR backend. Export writes a server-local JSONL path (not a browser download)."
        actions={
          <Button
            loading={exportMut.isPending}
            onClick={async () => {
              try {
                const res = await exportMut.mutateAsync();
                message.info(
                  `Export recorded on server: ${res.path ?? "unknown path"} (${res.count ?? 0} rows)`,
                );
              } catch (e) {
                message.error(getApiErrorMessage(e));
              }
            }}
          >
            Export (server path)
          </Button>
        }
      />
      <div className="space-y-4 p-6">
        <Space wrap>
          <Select
            allowClear
            placeholder="Filter by document"
            style={{ minWidth: 280 }}
            value={documentId}
            onChange={setDocumentId}
            options={(docsQuery.data ?? []).map((d) => ({
              value: d.documentId,
              label: `${d.fileName} (${d.documentId})`,
            }))}
          />
          <Button onClick={() => void feedbackQuery.refetch()}>Refresh</Button>
        </Space>
        <Card size="small">
          <Table
            rowKey={(r) => String(r.feedback_id ?? `${r.document_id}-${r.created_at}`)}
            size="small"
            loading={feedbackQuery.isLoading}
            dataSource={feedbackQuery.data?.feedback ?? []}
            locale={{
              emptyText: "No feedback records returned by the backend.",
            }}
            columns={[
              {
                title: "Document",
                dataIndex: "document_id",
                render: (v: string) =>
                  v ? (
                    <Link to={`/bill/documents/${encodeURIComponent(v)}`}>{v}</Link>
                  ) : (
                    "—"
                  ),
              },
              { title: "Field", dataIndex: "field" },
              {
                title: "Corrected",
                dataIndex: "corrected_value",
                render: (v: unknown) => formatBillFieldValue(v),
              },
              {
                title: "Original",
                dataIndex: "original_prediction",
                render: (v: unknown) => formatBillFieldValue(v),
              },
              { title: "Reviewer", dataIndex: "reviewer" },
              {
                title: "Created",
                dataIndex: "created_at",
                render: (v: string) =>
                  v ? dayjs(v).format("YYYY-MM-DD HH:mm") : "—",
              },
            ]}
          />
          <Typography.Paragraph type="secondary" className="!mt-3 !mb-0 text-xs">
            Corrections do not retrain models and do not mutate stored extraction
            results (`auto_retrain: false`).
          </Typography.Paragraph>
        </Card>
      </div>
    </div>
  );
}
