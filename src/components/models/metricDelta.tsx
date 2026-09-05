import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  MinusOutlined,
} from "@ant-design/icons";
import { Tooltip } from "antd";
import dayjs from "dayjs";

import type { PipelineRef, PipelineRefMetrics } from "@/types/models";

export type MetricKey = keyof PipelineRefMetrics;

const HIGHER_IS_BETTER: MetricKey[] = [
  "detection_success_rate",
  "recognition_exact_match_accuracy",
  "end_to_end_accuracy",
  "end_to_end_success_rate",
];
const LOWER_IS_BETTER: MetricKey[] = ["latency_p50_ms", "latency_p95_ms"];

function refTime(ref: PipelineRef): number {
  const raw = ref.created_at || ref.updated_at;
  return raw ? dayjs(raw).valueOf() : 0;
}

/** Previous active (non-disabled) ref for the same OCR type, by creation time. */
export function buildPreviousActiveMap(
  refs: PipelineRef[],
): Map<string, PipelineRef> {
  const byType = new Map<string, PipelineRef[]>();
  for (const r of refs) {
    if (r.status !== "active") continue;
    const list = byType.get(r.ocr_type) ?? [];
    list.push(r);
    byType.set(r.ocr_type, list);
  }
  const prev = new Map<string, PipelineRef>();
  for (const [, list] of byType) {
    list.sort((a, b) => refTime(a) - refTime(b));
    for (let i = 1; i < list.length; i++) {
      prev.set(list[i]!.id, list[i - 1]!);
    }
  }
  return prev;
}

export function MetricWithDelta({
  value,
  previous,
  metricKey,
  format,
}: {
  value: number | null | undefined;
  previous: number | null | undefined;
  metricKey: MetricKey;
  format: (v: number | null | undefined) => string;
}) {
  const text = format(value);
  if (
    value == null ||
    previous == null ||
    Number.isNaN(value) ||
    Number.isNaN(previous)
  ) {
    return <span>{text}</span>;
  }
  const delta = value - previous;
  if (Math.abs(delta) < 1e-9) {
    return (
      <span className="inline-flex items-center gap-1">
        {text}
        <MinusOutlined className="text-xs text-slate-400" />
      </span>
    );
  }
  const higherBetter = HIGHER_IS_BETTER.includes(metricKey);
  const lowerBetter = LOWER_IS_BETTER.includes(metricKey);
  const improved = (higherBetter && delta > 0) || (lowerBetter && delta < 0);
  const color = improved ? "text-emerald-600" : "text-red-600";
  const Icon = delta > 0 ? ArrowUpOutlined : ArrowDownOutlined;
  const tip = `vs previous active: ${format(previous)} (${delta > 0 ? "+" : ""}${format(delta)})`;
  return (
    <Tooltip title={tip}>
      <span className={`inline-flex items-center gap-1 ${color}`}>
        {text}
        <Icon className="text-xs" />
      </span>
    </Tooltip>
  );
}
