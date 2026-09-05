import {
  Alert,
  Button,
  Card,
  Descriptions,
  Progress,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { getApiErrorMessage } from "@/api/client";
import {
  advanceTrainingCycle,
  cancelTrainingCycle,
  getTrainingCycle,
  promoteTrainingCycle,
  type TrainingExperiment,
} from "@/api/training";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusTag } from "@/components/common/StatusTag";

const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  dataset_validation: "Validating data",
  dataset_build: "Preparing dataset",
  detection_training: "Detection training",
  recognition_training: "Training recognition models",
  recognition_evaluation: "Training recognition models",
  experiment_ranking: "Ranking experiments",
  e2e_evaluation: "Running protected-test E2E",
  baseline_comparison: "Comparing with production",
  candidate_creation: "Creating candidate",
  promotion_decision: "Finalizing result",
  complete: "Completed",
  failed: "Failed",
  stopped: "Stopped",
};

const USER_STAGES = [
  "Preparing dataset",
  "Validating data",
  "Building experiments",
  "Training recognition models",
  "Evaluating candidates",
  "Running protected-test E2E",
  "Comparing with production",
  "Candidate accepted/rejected",
  "Completed",
];

function mapStageToUserProgress(stage: string): string {
  if (stage === "dataset_build" || stage === "queued") return "Preparing dataset";
  if (stage === "dataset_validation") return "Validating data";
  if (stage === "experiment_ranking") return "Building experiments";
  if (
    stage === "recognition_training" ||
    stage === "recognition_evaluation" ||
    stage === "detection_training"
  )
    return "Training recognition models";
  if (stage === "candidate_creation") return "Evaluating candidates";
  if (stage === "e2e_evaluation") return "Running protected-test E2E";
  if (stage === "baseline_comparison") return "Comparing with production";
  if (stage === "promotion_decision") return "Candidate accepted/rejected";
  if (stage === "complete") return "Completed";
  return STAGE_LABELS[stage] || stage;
}

export function TrainingCycleDetailPage() {
  const { cycleId = "" } = useParams();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["training", "cycles", cycleId],
    queryFn: () => getTrainingCycle(cycleId),
    enabled: Boolean(cycleId),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s && ["queued", "running", "evaluating"].includes(s)
        ? 2500
        : false;
    },
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["training", "cycles", cycleId],
    });
    await queryClient.invalidateQueries({ queryKey: ["training", "cycles"] });
  };

  const advanceMutation = useMutation({
    mutationFn: () => advanceTrainingCycle(cycleId),
    onSuccess: async () => {
      message.success("Cycle advanced");
      await invalidate();
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelTrainingCycle(cycleId),
    onSuccess: async () => {
      message.success("Cycle cancelled");
      await invalidate();
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  const promoteMutation = useMutation({
    mutationFn: () => promoteTrainingCycle(cycleId),
    onSuccess: async () => {
      message.success("Candidate promoted");
      await invalidate();
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  const cycle = query.data;
  const experiments = cycle?.experiments ?? [];

  const expColumns: ColumnsType<TrainingExperiment> = [
    { title: "#", dataIndex: "experiment_index", width: 60 },
    { title: "Name", dataIndex: "name" },
    {
      title: "Status",
      dataIndex: "status",
      render: (s: string) => <StatusTag status={s} />,
    },
    {
      title: "Rank",
      dataIndex: "rank",
      render: (v: number | null) => v ?? "—",
    },
    {
      title: "Score",
      dataIndex: "ranking_score",
      render: (v: number | null) => (v == null ? "—" : v.toFixed(2)),
    },
    {
      title: "Config",
      render: (_, r) => (
        <Typography.Text className="font-mono text-xs" ellipsis>
          {r.config_hash?.slice(0, 10) ?? "—"}
        </Typography.Text>
      ),
    },
    {
      title: "Run",
      render: (_, r) =>
        r.training_run_id ? (
          <Link to={`/training/runs/${r.training_run_id}`}>Open</Link>
        ) : (
          "—"
        ),
    },
  ];

  const gate = cycle?.gate_result;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: "Dashboard", path: "/" },
          { title: "Training Center", path: "/training-center" },
          { title: cycle?.name || "Cycle" },
        ]}
        actions={
          <Space wrap>
            <Button
              loading={advanceMutation.isPending}
              onClick={() => advanceMutation.mutate()}
            >
              Advance stage
            </Button>
            <Button
              danger
              loading={cancelMutation.isPending}
              disabled={
                !cycle ||
                [
                  "completed",
                  "failed",
                  "cancelled",
                  "promoted",
                  "rejected",
                ].includes(cycle.status)
              }
              onClick={() => cancelMutation.mutate()}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              loading={promoteMutation.isPending}
              disabled={
                !cycle ||
                cycle.status !== "candidate" ||
                gate?.status === "FAIL"
              }
              onClick={() => promoteMutation.mutate()}
            >
              Promote candidate
            </Button>
          </Space>
        }
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-6">
        {query.isError ? (
          <Alert
            type="error"
            showIcon
            message={getApiErrorMessage(query.error)}
          />
        ) : null}
        {cycle ? (
          <>
            <Card>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <StatusTag status={cycle.status} />
                <Tag color="blue">{mapStageToUserProgress(cycle.stage)}</Tag>
                <Typography.Text type="secondary">
                  {cycle.message}
                </Typography.Text>
              </div>
              <Progress percent={Math.round(cycle.progress_pct ?? 0)} />
              <div className="mt-3 flex flex-wrap gap-2">
                {USER_STAGES.map((label) => {
                  const current = mapStageToUserProgress(cycle.stage);
                  const idx = USER_STAGES.indexOf(label);
                  const curIdx = USER_STAGES.indexOf(current);
                  const done =
                    cycle.stage === "complete" ||
                    (curIdx >= 0 && idx < curIdx);
                  const active = label === current;
                  return (
                    <Tag
                      key={label}
                      color={active ? "blue" : done ? "green" : "default"}
                    >
                      {label}
                    </Tag>
                  );
                })}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <Typography.Text type="secondary">Goal</Typography.Text>
                  <div className="font-medium">
                    {(cycle.config as { training_type?: string } | null)
                      ?.training_type === "recognition" || !cycle.config
                      ? "Recognition"
                      : String(
                          (cycle.config as { training_type?: string })
                            ?.training_type,
                        )}
                  </div>
                </div>
                <div>
                  <Typography.Text type="secondary">
                    Experiment progress
                  </Typography.Text>
                  <div className="font-medium">
                    {experiments.filter((e) => e.status === "completed").length}{" "}
                    of {experiments.length || cycle.max_experiments} completed
                  </div>
                </div>
                <div>
                  <Typography.Text type="secondary">
                    Production impact
                  </Typography.Text>
                  <div
                    className={
                      cycle.status === "promoted"
                        ? "font-medium text-red-600"
                        : "font-medium text-emerald-700"
                    }
                  >
                    {cycle.status === "promoted"
                      ? "Production model updated"
                      : "Production model unchanged"}
                  </div>
                </div>
              </div>
              {cycle.gate_result ? (
                <Alert
                  className="mt-3"
                  type={
                    cycle.gate_result.status === "PASS"
                      ? "success"
                      : cycle.gate_result.status === "FAIL"
                        ? "error"
                        : "warning"
                  }
                  showIcon
                  message={
                    cycle.gate_result.status === "PASS"
                      ? "Candidate better than / competitive with production (E2E)"
                      : cycle.gate_result.status === "FAIL"
                        ? "Candidate did not improve over production"
                        : `Gate: ${cycle.gate_result.status}`
                  }
                />
              ) : null}
              {cycle.error ? (
                <Alert className="mt-3" type="error" message={cycle.error} />
              ) : null}
              {cycle.stopping_reason ? (
                <Alert
                  className="mt-3"
                  type="warning"
                  message={`Stopped: ${cycle.stopping_reason}`}
                />
              ) : null}
            </Card>

            <Card title="Lineage">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Cycle ID">
                  {cycle.id}
                </Descriptions.Item>
                <Descriptions.Item label="Trigger">
                  {cycle.trigger}
                </Descriptions.Item>
                <Descriptions.Item label="Baseline ref">
                  {cycle.baseline_model_ref ?? "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Baseline detector">
                  {cycle.baseline_detection_artifact_id ?? "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Baseline recognizer">
                  {cycle.baseline_recognition_artifact_id ?? "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Candidate detector">
                  {cycle.candidate_detection_artifact_id ?? "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Candidate recognizer">
                  {cycle.candidate_recognition_artifact_id ?? "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Recognition dataset">
                  {cycle.recognition_dataset_id ?? "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Protected test">
                  {cycle.protected_test_dataset_id ?? "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Promotion">
                  {cycle.promotion_decision ?? "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Gate source">
                  {(cycle.comparison as { metrics_source?: string } | null)
                    ?.metrics_source ?? "—"}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="Stage progress">
              <div className="flex flex-wrap gap-2">
                {[
                  "dataset_validation",
                  "dataset_build",
                  "detection_training",
                  "recognition_training",
                  "experiment_ranking",
                  "e2e_evaluation",
                  "baseline_comparison",
                  "candidate_creation",
                  "promotion_decision",
                  "complete",
                ].map((s) => (
                  <Tag
                    key={s}
                    color={
                      cycle.stage === s
                        ? "blue"
                        : ["complete", "failed", "stopped"].includes(
                              cycle.stage,
                            ) && s === "complete"
                          ? "green"
                          : "default"
                    }
                  >
                    {s}
                  </Tag>
                ))}
              </div>
            </Card>

            {gate ? (
              <Card title="Quality gate">
                <Tag
                  color={
                    gate.status === "PASS"
                      ? "green"
                      : gate.status === "FAIL"
                        ? "red"
                        : "gold"
                  }
                >
                  {gate.status}
                </Tag>
                <div className="mt-2 text-sm text-slate-600">
                  Baseline exact {gate.baseline_exact?.toFixed?.(4) ?? "—"} →
                  Candidate {gate.candidate_exact?.toFixed?.(4) ?? "—"} (
                  {gate.delta_exact != null
                    ? `${gate.delta_exact >= 0 ? "+" : ""}${(gate.delta_exact * 100).toFixed(2)} pp`
                    : "—"}
                  )
                </div>
                {(gate.reasons ?? []).map((r) => (
                  <div key={r} className="text-xs text-slate-500">
                    • {r}
                  </div>
                ))}
              </Card>
            ) : null}

            <Card title="Experiments">
              <Table
                rowKey="id"
                size="small"
                columns={expColumns}
                dataSource={experiments}
                pagination={false}
              />
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
