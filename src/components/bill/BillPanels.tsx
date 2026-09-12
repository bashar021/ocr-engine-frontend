import { Alert, Empty, Table, Tag, Typography } from "antd";

import type { BillFailure, BillValidationResult } from "@/types/bill";

export function BillValidationPanel({
  validation,
}: {
  validation?: BillValidationResult | null;
}) {
  if (!validation) {
    return <Empty description="Validation not available for this result" />;
  }
  const rows = validation.results ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Typography.Text strong>Status:</Typography.Text>
        <Tag
          color={
            validation.status === "PASSED"
              ? "green"
              : validation.status === "FAILED"
                ? "red"
                : "default"
          }
        >
          {validation.status ?? "UNKNOWN"}
        </Tag>
        {validation.failed_count != null ? (
          <Typography.Text type="secondary">
            Failed rules: {validation.failed_count}
          </Typography.Text>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <Empty description="No validation rule results" />
      ) : (
        <Table
          size="small"
          rowKey={(_, i) => String(i)}
          pagination={false}
          dataSource={rows}
          columns={[
            {
              title: "Rule",
              dataIndex: "rule",
              render: (v: string) => v || "—",
            },
            {
              title: "Result",
              dataIndex: "passed",
              width: 90,
              render: (passed: boolean) =>
                passed ? (
                  <Tag color="green">PASS</Tag>
                ) : (
                  <Tag color="red">FAIL</Tag>
                ),
            },
            {
              title: "Field",
              dataIndex: "field",
              render: (v: string) => v || "—",
            },
            {
              title: "Message",
              dataIndex: "message",
              ellipsis: true,
            },
          ]}
        />
      )}
    </div>
  );
}

export function BillFailurePanel({
  failures,
}: {
  failures?: BillFailure[] | null;
}) {
  if (!failures?.length) {
    return <Empty description="No processing failures" />;
  }
  return (
    <div className="space-y-2">
      {failures.map((f, i) => (
        <Alert
          key={`${f.code}-${i}`}
          type={
            f.severity === "ERROR"
              ? "error"
              : f.severity === "WARNING"
                ? "warning"
                : "info"
          }
          showIcon
          message={`${f.code}${f.stage ? ` · ${f.stage}` : ""}`}
          description={
            <div className="space-y-1 text-sm">
              <div>{f.message}</div>
              <div className="text-slate-500">
                {[
                  f.retryable != null
                    ? `retryable=${String(f.retryable)}`
                    : null,
                  f.human_review_required
                    ? "human_review_required"
                    : null,
                  f.field ? `field=${f.field}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
          }
        />
      ))}
    </div>
  );
}

export function BillProcessingTimeline({
  stageMetrics,
}: {
  stageMetrics?: Record<string, unknown> | null;
}) {
  if (!stageMetrics || Object.keys(stageMetrics).length === 0) {
    return <Empty description="No stage metrics from backend" />;
  }
  const stages = [
    "quality",
    "detection",
    "ocr",
    "layout",
    "table",
    "visual",
    "vlm",
    "vlm_policy",
  ];
  return (
    <div className="space-y-2">
      {stages.map((key) => {
        const msKey = `${key}_ms`;
        const has =
          key in stageMetrics ||
          msKey in stageMetrics ||
          (key === "vlm" && "vlm_health" in stageMetrics);
        if (!has) return null;
        const ms = stageMetrics[msKey];
        const payload = stageMetrics[key];
        return (
          <div
            key={key}
            className="rounded border border-slate-200 bg-white px-3 py-2"
          >
            <Typography.Text strong className="capitalize">
              {key.replace("_", " ")}
            </Typography.Text>
            {ms != null ? (
              <Typography.Text type="secondary" className="ml-2">
                {typeof ms === "number" ? `${ms.toFixed(1)} ms` : String(ms)}
              </Typography.Text>
            ) : null}
            {payload != null ? (
              <pre className="mt-1 max-h-40 overflow-auto text-xs text-slate-600">
                {JSON.stringify(payload, null, 2)}
              </pre>
            ) : null}
          </div>
        );
      })}
      {"pipeline_version" in stageMetrics ? (
        <Typography.Text type="secondary">
          Pipeline: {String(stageMetrics.pipeline_version)}
        </Typography.Text>
      ) : null}
    </div>
  );
}
