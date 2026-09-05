import { Card, Col, Row, Statistic, Typography } from "antd";

import type { TrainingDataCounts } from "@/types/training";

interface Props {
  counts: TrainingDataCounts;
  title?: string;
  parentVersion?: string | null;
  newVersion?: string | null;
}

export function TrainingDataCountsPanel({
  counts,
  title = "Training data composition",
  parentVersion,
  newVersion,
}: Props) {
  return (
    <Card title={title} size="small">
      <Typography.Paragraph type="secondary" className="!mb-3 text-xs">
        {counts.formula ?? "total = parent_sample_count + new_sample_count"}
        {parentVersion ? ` · parent ${parentVersion}` : ""}
        {newVersion ? ` · new ${newVersion}` : ""}
      </Typography.Paragraph>
      <Row gutter={16}>
        <Col span={8}>
          <Statistic
            title="Parent model data"
            value={counts.parent_sample_count}
            suffix="samples"
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="New training data"
            value={counts.new_sample_count}
            suffix="samples"
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Total for new version"
            value={counts.total_sample_count}
            suffix="samples"
          />
        </Col>
      </Row>
      {counts.by_role && Object.keys(counts.by_role).length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          {Object.entries(counts.by_role).map(([role, n]) => (
            <span key={role} className="rounded bg-slate-100 px-2 py-1">
              {role}: {n}
            </span>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
