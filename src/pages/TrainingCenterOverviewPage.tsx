import { ExperimentOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { Button, Card, Statistic, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";

import { listTrainingCycles, type TrainingCycle } from "@/api/training";
import { CreateTrainingCycleModal } from "@/components/training/CreateTrainingCycleModal";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusTag } from "@/components/common/StatusTag";

function userFacingStage(stage: string): string {
  const map: Record<string, string> = {
    queued: "Queued",
    dataset_validation: "Validating data",
    dataset_build: "Preparing dataset",
    detection_training: "Detection training",
    recognition_training: "Training recognition models",
    recognition_evaluation: "Training recognition models",
    experiment_ranking: "Building experiments",
    e2e_evaluation: "Running protected-test E2E",
    baseline_comparison: "Comparing with production",
    candidate_creation: "Creating candidate",
    promotion_decision: "Finalizing result",
    complete: "Completed",
    failed: "Failed",
    stopped: "Stopped",
  };
  return map[stage] || stage;
}

export function TrainingCenterOverviewPage() {
  const queryClient = useQueryClient();
  const [startOpen, setStartOpen] = useState(false);

  const cyclesQuery = useQuery({
    queryKey: ["training", "cycles"],
    queryFn: () => listTrainingCycles({ limit: 50 }),
    refetchInterval: 4000,
  });

  const columns: ColumnsType<TrainingCycle> = [
    {
      title: "Cycle",
      render: (_, r) => (
        <div>
          <Link className="font-medium" to={`/training-center/cycles/${r.id}`}>
            {r.name}
          </Link>
          <div className="text-xs text-slate-500">
            {(r.config as { description?: string } | null)?.description ||
              r.trigger}
          </div>
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (s: string) => <StatusTag status={s} />,
    },
    {
      title: "Progress",
      render: (_, r) => (
        <div>
          <div>{userFacingStage(r.stage)}</div>
          <div className="text-xs text-slate-500">
            {Math.round(r.progress_pct ?? 0)}%
          </div>
        </div>
      ),
    },
    {
      title: "Result",
      render: (_, r) => r.gate_result?.status ?? "—",
    },
    {
      title: "Production",
      render: (_, r) =>
        r.status === "promoted" ? (
          <Tag color="red">Changed</Tag>
        ) : (
          <Tag color="green">Unchanged</Tag>
        ),
    },
  ];

  const cycles = cyclesQuery.data?.cycles ?? [];
  const active = cycles.filter((c) =>
    ["queued", "running", "evaluating", "candidate"].includes(c.status),
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: "Dashboard", path: "/" },
          { title: "Training Center" },
        ]}
        actions={
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => setStartOpen(true)}
          >
            Create Training Cycle
          </Button>
        }
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <Card>
            <Statistic title="Active cycles" value={active.length} />
          </Card>
          <Card>
            <Statistic
              title="Total cycles"
              value={cyclesQuery.data?.total ?? 0}
            />
          </Card>
          <Card>
            <Statistic
              title="Candidates"
              value={cycles.filter((c) => c.status === "candidate").length}
            />
          </Card>
          <Card>
            <Statistic
              title="Promoted"
              value={cycles.filter((c) => c.status === "promoted").length}
            />
          </Card>
        </div>
        <Card
          title="Training cycles"
          extra={
            <Link to="/training/runs">
              <ExperimentOutlined /> Legacy runs
            </Link>
          }
        >
          <Table
            rowKey="id"
            loading={cyclesQuery.isLoading}
            columns={columns}
            dataSource={cycles}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </div>

      <CreateTrainingCycleModal
        open={startOpen}
        onClose={() => setStartOpen(false)}
        onCreated={async () => {
          message.success("Training cycle created");
          await queryClient.invalidateQueries({
            queryKey: ["training", "cycles"],
          });
        }}
      />
    </div>
  );
}
