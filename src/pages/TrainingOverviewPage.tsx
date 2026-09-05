import { Card, Col, Row, Statistic, Table, Tag } from "antd";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getTrainingDashboard, listTrainingRuns } from "@/api/training";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusTag } from "@/components/common/StatusTag";
import { TrainingDataCountsPanel } from "@/components/training/TrainingDataCountsPanel";

export function TrainingOverviewPage() {
  const statsQuery = useQuery({
    queryKey: ["training", "dashboard"],
    queryFn: getTrainingDashboard,
  });
  const runsQuery = useQuery({
    queryKey: ["training", "runs", "overview"],
    queryFn: () => listTrainingRuns({ limit: 8 }),
  });

  const stats = statsQuery.data;
  const recent = runsQuery.data?.runs ?? [];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[{ title: "Dashboard", path: "/" }, { title: "Training" }]}
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-6">
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="Training runs" value={stats?.runs_total ?? 0} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="Active / queued"
                value={
                  (stats?.runs_by_status?.queued ?? 0) +
                  (stats?.runs_by_status?.starting ?? 0) +
                  (stats?.runs_by_status?.running ?? 0)
                }
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="Candidate models"
                value={stats?.candidate_artifacts ?? 0}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="Ready dataset samples"
                value={stats?.ready_dataset_samples ?? 0}
              />
            </Card>
          </Col>
        </Row>

        <Card
          title="Workflow"
          extra={<Link to="/training/runs">Start training →</Link>}
        >
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>
              From a completed evaluation, open{" "}
              <Link to="/training/curate">Curate failures</Link>
            </li>
            <li>
              Draw the correct boundary, fix ground truth, exclude false/bad
              images
            </li>
            <li>
              Create a <strong>copied</strong> hard-case dataset (source stays
              unmodified)
            </li>
            <li>
              Start a run with original dataset (base) + hard-case dataset under{" "}
              <Link to="/training/runs">Runs</Link>. Curated packs live under{" "}
              <Link to="/evaluation/training-datasets">Training datasets</Link>;
              uploads under <Link to="/evaluation/datasets">Datasets</Link>.
            </li>
          </ol>
        </Card>

        <Card title="Recent runs">
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            loading={runsQuery.isLoading}
            dataSource={recent}
            columns={[
              {
                title: "Model",
                render: (_, r) => (
                  <Link to={`/training/runs/${r.id}`}>
                    {r.name}:{r.version}
                  </Link>
                ),
              },
              {
                title: "Status",
                dataIndex: "status",
                render: (s: string) => <StatusTag status={s} />,
              },
              {
                title: "Data",
                key: "data",
                render: (_, r) =>
                  r.data_counts ? (
                    <span className="text-xs">
                      P {r.data_counts.parent_sample_count} + N{" "}
                      {r.data_counts.new_sample_count} ={" "}
                      <strong>{r.data_counts.total_sample_count}</strong>
                    </span>
                  ) : (
                    "—"
                  ),
              },
              {
                title: "Artifact",
                dataIndex: "output_artifact_id",
                render: (v: string | null) =>
                  v ? <Tag color="blue">{v.slice(0, 8)}…</Tag> : "—",
              },
            ]}
          />
        </Card>

        {recent[0]?.data_counts ? (
          <TrainingDataCountsPanel
            counts={recent[0].data_counts}
            title="Latest run data mix"
            newVersion={`${recent[0].name}:${recent[0].version}`}
          />
        ) : null}
      </div>
    </div>
  );
}
