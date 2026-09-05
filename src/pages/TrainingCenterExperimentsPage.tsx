import { Card, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { listTrainingCycles, type TrainingExperiment } from "@/api/training";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusTag } from "@/components/common/StatusTag";

type ExpRow = TrainingExperiment & { cycle_name?: string };

export function TrainingCenterExperimentsPage() {
  const cyclesQuery = useQuery({
    queryKey: ["training", "cycles", "with-experiments"],
    queryFn: () => listTrainingCycles({ limit: 50 }),
  });

  const rows: ExpRow[] = (cyclesQuery.data?.cycles ?? []).flatMap((c) =>
    (c.experiments ?? []).map((e) => ({ ...e, cycle_name: c.name })),
  );

  const columns: ColumnsType<ExpRow> = [
    {
      title: "Experiment",
      render: (_, r) => (
        <div>
          <div className="font-medium">{r.name}</div>
          <div className="text-xs text-slate-500">{r.id.slice(0, 8)}…</div>
        </div>
      ),
    },
    {
      title: "Cycle",
      render: (_, r) => (
        <Link to={`/training-center/cycles/${r.cycle_id}`}>
          {r.cycle_name || r.cycle_id.slice(0, 8)}
        </Link>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (s: string) => <StatusTag status={s} />,
    },
    {
      title: "Rank",
      dataIndex: "rank",
      render: (v) => v ?? "—",
    },
    {
      title: "Val exact",
      render: (_, r) => {
        const m = r.metrics || {};
        const v =
          m.validation_exact_match_accuracy ??
          m.exact_match_accuracy ??
          m.exact_match;
        return typeof v === "number" ? v.toFixed(4) : "—";
      },
    },
    {
      title: "E2E exact",
      render: (_, r) => {
        const e2e = (r.metrics?.protected_test_e2e || {}) as Record<
          string,
          unknown
        >;
        const v = e2e.exact_match_accuracy ?? e2e.end_to_end_accuracy;
        return typeof v === "number" ? Number(v).toFixed(4) : "—";
      },
    },
    {
      title: "Hard-case rate",
      render: (_, r) => {
        const v = r.config?.hard_case_oversample_rate;
        return v != null ? <Tag>{String(v)}</Tag> : "—";
      },
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { title: "Training Center", path: "/training-center" },
          { title: "Experiments" },
        ]}
      />
      <Card className="m-6">
        <Table
          rowKey="id"
          loading={cyclesQuery.isLoading}
          columns={columns}
          dataSource={rows}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  );
}
