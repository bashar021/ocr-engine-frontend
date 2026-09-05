import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  Progress,
  Space,
  Statistic,
  Tag,
  message,
} from "antd";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import { getArtifact } from "@/api/models";
import { cancelTrainingRun, getTrainingRun } from "@/api/training";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusTag } from "@/components/common/StatusTag";
import { TrainingDataCountsPanel } from "@/components/training/TrainingDataCountsPanel";

const POLL_MS = 2500;

export function TrainingRunDetailPage() {
  const { runId = "" } = useParams();
  const navigate = useNavigate();
  const [logFilter, setLogFilter] = useState("");
  const logRef = useRef<HTMLPreElement>(null);
  const runQuery = useQuery({
    queryKey: ["training", "run", runId],
    queryFn: () => getTrainingRun(runId),
    enabled: Boolean(runId),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s && ["queued", "starting", "running"].includes(s)
        ? POLL_MS
        : false;
    },
  });
  const run = runQuery.data;
  const artifactQuery = useQuery({
    queryKey: ["models", "artifact", run?.output_artifact_id],
    queryFn: () => getArtifact(run!.output_artifact_id!),
    enabled: Boolean(run?.output_artifact_id),
  });

  useEffect(() => {
    if (
      logRef.current &&
      ["queued", "starting", "running"].includes(run?.status ?? "")
    ) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [run?.logs_tail, run?.status]);

  if (runQuery.isError) {
    return (
      <div className="p-6">
        <Alert type="error" message={getApiErrorMessage(runQuery.error)} />
      </div>
    );
  }

  const val = run?.validation_metrics as
    | { exact_match?: number; test?: { exact_match_accuracy?: number } }
    | null
    | undefined;
  const testAcc = val?.test?.exact_match_accuracy ?? val?.exact_match ?? null;
  const filteredLogs = (run?.logs_tail || "")
    .split("\n")
    .filter((line) =>
      logFilter ? line.toLowerCase().includes(logFilter.toLowerCase()) : true,
    )
    .join("\n");

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: "Dashboard", path: "/" },
          { title: "Training", path: "/training" },
          { title: "Runs", path: "/training/runs" },
          { title: run ? `${run.name}:${run.version}` : "Run" },
        ]}
        actions={
          <Space>
            {run?.status === "completed" && run.role === "recognition" ? (
              <Button
                onClick={() =>
                  navigate("/training/runs", {
                    state: {
                      preferBaseArtifactId: run.output_artifact_id,
                      role: "recognition",
                    },
                  })
                }
              >
                Use as next base
              </Button>
            ) : null}
            {run?.output_artifact_id ? (
              <Link to="/models/refs">
                <Button type="primary">Create / activate model ref</Button>
              </Link>
            ) : null}
            {run && ["queued", "starting", "running"].includes(run.status) ? (
              <Button
                danger
                onClick={() =>
                  void cancelTrainingRun(run.id)
                    .then(() => {
                      message.success("Cancel requested");
                      void runQuery.refetch();
                    })
                    .catch((e) => message.error(getApiErrorMessage(e)))
                }
              >
                Cancel
              </Button>
            ) : null}
          </Space>
        }
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-6">
        <Card loading={runQuery.isLoading}>
          {run ? (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <StatusTag status={run.status} />
                <Progress
                  percent={Math.round(run.progress_pct || 0)}
                  className="max-w-xs flex-1"
                  status={run.status === "failed" ? "exception" : undefined}
                />
              </div>
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="Model">
                  {run.name}:{run.version}
                </Descriptions.Item>
                <Descriptions.Item label="Role">{run.role}</Descriptions.Item>
                <Descriptions.Item label="Adapter">
                  {run.adapter_id}
                </Descriptions.Item>
                <Descriptions.Item label="Framework">
                  {run.framework ?? "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Base artifact">
                  {run.training_base_artifact_id ?? "Default / none"}
                </Descriptions.Item>
                <Descriptions.Item label="Output artifact">
                  {run.output_artifact_id ? (
                    <Link to="/models/list">{run.output_artifact_id}</Link>
                  ) : (
                    "—"
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Epoch">
                  {run.current_epoch ?? "—"} / {run.total_epochs ?? "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Created">
                  {run.created_at ?? "—"}
                </Descriptions.Item>
              </Descriptions>
            </>
          ) : null}
        </Card>

        {testAcc != null || run?.validation_metrics ? (
          <Card title="Holdout / validation metrics">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Statistic
                title="Test exact-match"
                value={
                  testAcc != null
                    ? Number((testAcc * 100).toFixed(1))
                    : undefined
                }
                suffix={testAcc != null ? "%" : undefined}
                valueRender={() =>
                  testAcc != null ? `${(testAcc * 100).toFixed(1)}%` : "—"
                }
              />
              <Statistic
                title="Epoch"
                value={`${run?.current_epoch ?? "—"} / ${run?.total_epochs ?? "—"}`}
              />
            </div>
          </Card>
        ) : null}

        {run?.data_counts ? (
          <TrainingDataCountsPanel
            counts={run.data_counts}
            newVersion={`${run.name}:${run.version}`}
          />
        ) : null}

        {artifactQuery.data ? (
          <Card title="Registered candidate model">
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Name">
                {artifactQuery.data.name}:{artifactQuery.data.version}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <StatusTag status={artifactQuery.data.status} />
              </Descriptions.Item>
              <Descriptions.Item label="Training accuracy">
                {artifactQuery.data.training_accuracy != null
                  ? `${(artifactQuery.data.training_accuracy * 100).toFixed(1)}%`
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Runtime">
                {artifactQuery.data.runtime}
              </Descriptions.Item>
              <Descriptions.Item label="Candidate">
                <Tag color="gold">yes — promote manually</Tag>
              </Descriptions.Item>
            </Descriptions>
            <div className="mt-3">
              <Alert
                type="info"
                showIcon
                message="Human promotion only"
                description="Compare test exact-match to your baseline, then create a model ref binding this recognition artifact with your detection model and activate when ready."
              />
            </div>
          </Card>
        ) : null}

        <Card title="Datasets in this run">
          <ul className="space-y-1 text-sm">
            {(run?.datasets ?? []).map((d) => (
              <li key={`${d.dataset_id}-${d.role}`}>
                <Tag>{d.role}</Tag> {d.dataset_id.slice(0, 8)}… ·{" "}
                {d.sample_count ?? 0} samples
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Metrics (raw)">
          <pre className="max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs">
            {JSON.stringify(
              {
                training: run?.training_metrics,
                validation: run?.validation_metrics,
              },
              null,
              2,
            )}
          </pre>
        </Card>

        <Card
          title="Logs"
          extra={
            <Input.Search
              allowClear
              placeholder="Filter logs"
              size="small"
              className="w-48"
              onChange={(e) => setLogFilter(e.target.value)}
            />
          }
        >
          <pre
            ref={logRef}
            className="max-h-80 overflow-auto rounded bg-slate-50 p-2 text-xs"
          >
            {filteredLogs || "—"}
          </pre>
          {run?.error_message ? (
            <Alert className="mt-2" type="error" message={run.error_message} />
          ) : null}
        </Card>

        {(run?.post_train_eval_ids?.length ?? 0) > 0 ? (
          <Card title="Post-train evaluations">
            <ul className="text-sm">
              {run!.post_train_eval_ids.map((id) => (
                <li key={id}>
                  <Link to={`/evaluation/runs`}>{id}</Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
