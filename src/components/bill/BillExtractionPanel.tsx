import { Collapse, Empty, List, Space, Typography } from "antd";

import { BillStatusBadge, ConfidenceBadge } from "@/components/bill/BillBadges";
import {
  formatBillFieldValue,
  type BillDocumentResult,
  type BillFieldResult,
} from "@/types/bill";

type Props = {
  result: BillDocumentResult | null | undefined;
  selectedField?: string | null;
  onSelectField?: (field: string) => void;
};

function FieldCard({
  name,
  field,
  selected,
  onSelect,
}: {
  name: string;
  field: BillFieldResult;
  selected: boolean;
  onSelect?: () => void;
}) {
  const detail = field.confidence_detail;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded border p-3 text-left transition ${
        selected
          ? "border-teal-600 bg-teal-50"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Typography.Text strong>{name}</Typography.Text>
        <Space size={4} wrap>
          <BillStatusBadge status={field.status} />
          <ConfidenceBadge
            level={detail?.level}
            score={field.confidence ?? detail?.score}
          />
        </Space>
      </div>
      <Typography.Paragraph className="!mb-1 !mt-2 font-mono text-sm">
        {formatBillFieldValue(field.value)}
      </Typography.Paragraph>
      {field.raw_value != null &&
      formatBillFieldValue(field.raw_value) !==
        formatBillFieldValue(field.value) ? (
        <Typography.Text type="secondary" className="text-xs">
          Raw: {formatBillFieldValue(field.raw_value)}
        </Typography.Text>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
        {field.strategy ? <span>Strategy: {field.strategy}</span> : null}
        {Array.isArray(field.candidates) && field.candidates.length > 1 ? (
          <span>{field.candidates.length} candidates</span>
        ) : null}
      </div>
      {detail?.components ? (
        <Collapse
          size="small"
          ghost
          className="!mt-1"
          items={[
            {
              key: "c",
              label: "Confidence components",
              children: (
                <ul className="m-0 list-disc pl-4 text-xs text-slate-600">
                  {Object.entries(detail.components).map(([k, v]) => (
                    <li key={k}>
                      {k}: {Math.round(Number(v) * 100)}%
                    </li>
                  ))}
                </ul>
              ),
            },
          ]}
        />
      ) : null}
    </button>
  );
}

export function BillExtractionPanel({
  result,
  selectedField,
  onSelectField,
}: Props) {
  const fields = result?.fields ?? {};
  const names = Object.keys(fields);
  if (!result) {
    return <Empty description="Extraction result not loaded" />;
  }
  if (!names.length) {
    return (
      <Empty description="No extraction fields in this result (partial or empty)" />
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Typography.Text type="secondary">
          Document type: {result.document_type ?? "UNKNOWN"}
        </Typography.Text>
        <BillStatusBadge status={result.status} />
        <ConfidenceBadge
          level={
            (result.confidence?.confidence_band as string | undefined) ||
            result.confidence?.level
          }
          score={
            (result.confidence?.calibrated_confidence as number | undefined) ??
            result.confidence?.overall
          }
          calibrated={result.confidence?.calibrated as boolean | undefined}
        />
      </div>
      {names.map((name) => (
        <FieldCard
          key={name}
          name={name}
          field={fields[name]!}
          selected={selectedField === name}
          onSelect={() => onSelectField?.(name)}
        />
      ))}
      {result.line_items && result.line_items.length > 0 ? (
        <div className="mt-4">
          <Typography.Title level={5}>Line items</Typography.Title>
          <List
            size="small"
            bordered
            dataSource={result.line_items}
            renderItem={(item, idx) => (
              <List.Item>
                <pre className="m-0 max-w-full overflow-auto text-xs">
                  {JSON.stringify(item, null, 2)}
                </pre>
                <Typography.Text type="secondary" className="ml-2">
                  #{idx + 1}
                </Typography.Text>
              </List.Item>
            )}
          />
        </div>
      ) : null}
    </div>
  );
}
