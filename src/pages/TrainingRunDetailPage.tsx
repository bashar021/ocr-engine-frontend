import {
  Alert,
  Button,
  Card,
  Descriptions,
  Progress,
  Tag,
  message,
} from "antd";
import { Link, useParams } from "react-router-dom";
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

  if (runQuery.isError) {
    return (
      <div className="p-6">
        <Alert type="error" message={getApiErrorMessage(runQuery.error)} />
      </div>
    );
  }

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
          run && ["queued", "starting", "running"].includes(run.status) ? (
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
          ) : null
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
                  {run.training_base_artifact_id ?? "—"}
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
              <Descriptions.Item label="Digest">
                <span className="font-mono text-xs">
                  {artifactQuery.data.artifact_digest?.slice(0, 16)}…
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Parent samples">
                {String(
                  (
                    artifactQuery.data.metadata as Record<
                      string,
                      unknown
                    > | null
                  )?.parent_sample_count ?? "—",
                )}
              </Descriptions.Item>
              <Descriptions.Item label="New samples">
                {String(
                  (
                    artifactQuery.data.metadata as Record<
                      string,
                      unknown
                    > | null
                  )?.new_sample_count ?? "—",
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Total samples">
                {String(
                  (
                    artifactQuery.data.metadata as Record<
                      string,
                      unknown
                    > | null
                  )?.total_sample_count ?? "—",
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Candidate">
                <Tag color="gold">yes — promote manually</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        ) : null}

        <Card title="Datasets in this run">
          <ul className="space-y-1 text-sm">
            {(run?.datasets ?? []).map((d) => (
              <li key={`${d.dataset_id}-${d.role}`}>
                <Tag>{d.role}</Tag> {d.dataset_id.slice(0, 8)}… ·{" "}
                {d.sample_count ?? 0} samples
                {d.manifest_digest ? (
                  <span className="ml-2 text-xs text-slate-400">
                    {d.manifest_digest.slice(0, 18)}…
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Metrics">
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

        <Card title="Logs">
          <pre className="max-h-64 overflow-auto rounded bg-slate-50 p-2 text-xs">
            {run?.logs_tail || "—"}
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
                  <Link to="/evaluation/runs">{id}</Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
