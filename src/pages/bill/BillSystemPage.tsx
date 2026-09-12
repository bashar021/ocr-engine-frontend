import { Alert, Card, Col, Descriptions, Row, Table, Tag, Typography } from "antd";

import { PageHeader } from "@/components/common/PageHeader";
import {
  useBillFailureTaxonomy,
  useBillModels,
  useBillProviders,
  useLocalBillDocuments,
} from "@/features/bill/hooks";

export function BillSystemPage() {
  const providersQuery = useBillProviders();
  const modelsQuery = useBillModels();
  const taxonomyQuery = useBillFailureTaxonomy();
  const docsQuery = useLocalBillDocuments();

  const docs = docsQuery.data ?? [];
  const counts = {
    total: docs.length,
    completed: docs.filter((d) => d.status === "COMPLETED").length,
    review: docs.filter((d) => d.reviewRequired || d.status === "REVIEW_REQUIRED")
      .length,
    failed: docs.filter((d) => d.status === "FAILED").length,
    partial: docs.filter((d) => d.status === "PARTIAL").length,
  };

  const readiness = providersQuery.data?.readiness as
    | { ready?: boolean; components?: Record<string, { ready?: boolean; error?: string; provider?: string }> }
    | undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Bill system / models"
        description="Live provider/model configuration and readiness from the Bill OCR backend. Dashboard counts below are derived only from this browser’s processed inbox (no server-wide metrics API)."
      />
      <div className="space-y-4 p-6">
        <Row gutter={[16, 16]}>
          {(
            [
              ["Inbox documents", counts.total],
              ["Completed", counts.completed],
              ["Review required", counts.review],
              ["Failed", counts.failed],
              ["Partial", counts.partial],
            ] as const
          ).map(([label, value]) => (
            <Col xs={12} md={8} lg={4} key={label}>
              <Card size="small">
                <Typography.Text type="secondary">{label}</Typography.Text>
                <div className="text-2xl font-semibold">{value}</div>
              </Card>
            </Col>
          ))}
        </Row>

        {readiness && readiness.ready === false ? (
          <Alert
            type="warning"
            showIcon
            message="Bill component readiness reports not ready"
            description="Required providers/models may be unavailable. Processing will fail clearly rather than returning fake results."
          />
        ) : null}

        <Card size="small" title="Configured models" loading={modelsQuery.isLoading}>
          <Descriptions size="small" bordered column={1}>
            {Object.entries(modelsQuery.data ?? {}).map(([k, v]) => (
              <Descriptions.Item key={k} label={k}>
                {v == null ? "—" : String(v)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </Card>

        <Card size="small" title="Providers" loading={providersQuery.isLoading}>
          <Table
            rowKey={(r) => `${r.type}-${r.name}`}
            size="small"
            dataSource={providersQuery.data?.providers ?? []}
            columns={[
              { title: "Type", dataIndex: "type", width: 120 },
              { title: "Name", dataIndex: "name" },
              { title: "Version", dataIndex: "version", render: (v) => v ?? "—" },
              {
                title: "Production",
                dataIndex: "production",
                render: (v: boolean) =>
                  v ? <Tag color="green">yes</Tag> : <Tag>n/a</Tag>,
              },
            ]}
            pagination={false}
          />
          {providersQuery.data?.forbidden_in_production?.length ? (
            <Typography.Paragraph type="secondary" className="!mt-3 !mb-0 text-xs">
              Forbidden in production:{" "}
              {providersQuery.data.forbidden_in_production.join(", ")}
            </Typography.Paragraph>
          ) : null}
          {readiness?.components ? (
            <pre className="mt-3 max-h-64 overflow-auto text-xs">
              {JSON.stringify(readiness.components, null, 2)}
            </pre>
          ) : null}
        </Card>

        <Card size="small" title="Failure taxonomy" loading={taxonomyQuery.isLoading}>
          <Typography.Paragraph>
            Codes: {(taxonomyQuery.data?.codes ?? []).join(", ") || "—"}
          </Typography.Paragraph>
          <Typography.Paragraph>
            Retryable: {(taxonomyQuery.data?.retryable ?? []).join(", ") || "—"}
          </Typography.Paragraph>
          <Typography.Paragraph>
            Review required:{" "}
            {(taxonomyQuery.data?.review_required ?? []).join(", ") || "—"}
          </Typography.Paragraph>
        </Card>
      </div>
    </div>
  );
}
