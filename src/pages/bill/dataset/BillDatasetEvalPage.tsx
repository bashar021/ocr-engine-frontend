import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  App,
} from "antd";
import { Link, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";

import { getApiErrorMessage } from "@/api/client";
import {
  cancelBillEvaluation,
  getBillEvaluationMetrics,
} from "@/api/billDataset";
import { PageHeader } from "@/components/common/PageHeader";
import { CapabilityAlert } from "@/components/bill/dataset/DatasetContextBar";
import { StartEvaluationModal } from "@/components/evaluation/StartEvaluationModal";
import { useBillDatasetContext } from "@/features/bill/dataset/context";
import {
  useBillDatasetQuery,
  useBillDatasetsQuery,
  useBillEvaluationsQuery,
} from "@/features/bill/dataset/hooks";
import type { EvaluationDataset, EvaluationRun } from "@/types/evaluation";

export function BillDatasetEvalPage() {
  const { message } = App.useApp();
  const { datasetId, setDatasetId, setVersion } = useBillDatasetContext();
  const [searchParams] = useSearchParams();
  const evaluationIdParam = searchParams.get("evaluationId");
  const [evalDataset, setEvalDataset] = useState<EvaluationDataset | null>(
    null,
  );
  const [metrics, setMetrics] = useState<unknown>(null);
  const [metricsFor, setMetricsFor] = useState<string | null>(null);

  const datasetsQuery = useBillDatasetsQuery({
    scope: "evaluation",
    limit: 100,
    offset: 0,
  });
  const datasetQuery = useBillDatasetQuery(datasetId);
  const evalQuery = useBillEvaluationsQuery({
    dataset_id: datasetId ?? undefined,
    limit: 50,
    offset: 0,
  });

  const runs = evalQuery.data?.evaluations ?? [];
  const selectedRun = useMemo(
    () => runs.find((r) => r.id === evaluationIdParam) ?? runs[0] ?? null,
    [runs, evaluationIdParam],
  );

  const loadMetrics = async (run: EvaluationRun) => {
    try {
      const m = await getBillEvaluationMetrics(run.id);
      setMetrics(m);
      setMetricsFor(run.id);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const cancelRun = async (run: EvaluationRun) => {
    try {
      await cancelBillEvaluation(run.id);
      message.success("Cancel requested");
      void evalQuery.refetch();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        breadcrumbs={[
          { title: "Datasets", path: "/bill/datasets" },
          { title: "Evaluation" },
        ]}
        title="Evaluation"
        description="Evaluation runs for ocr_type=bill. Metrics come from the shared evaluation runner (string GT / det-rec lineage)."
        actions={
          <Space>
            <Select
              size="small"
              className="min-w-[220px]"
              placeholder="Dataset"
              value={datasetId ?? undefined}
              options={(datasetsQuery.data?.datasets ?? []).map((d) => ({
                value: d.id,
                label: `${d.name} v${d.version}`,
              }))}
              onChange={(id) => {
                const d = datasetsQuery.data?.datasets?.find(
                  (x) => x.id === id,
                );
                setDatasetId(id);
                if (d) setVersion(d.version);
              }}
            />
            <Button
              type="primary"
              disabled={!datasetQuery.data}
              onClick={() => setEvalDataset(datasetQuery.data ?? null)}
            >
              Run evaluation
            </Button>
            <Link to="/evaluation/comparison">
              <Button>Compare runs</Button>
            </Link>
          </Space>
        }
      />

      <CapabilityAlert
        type="warning"
        title="Bill field-level evaluation is not available"
        detail="POST /v1/evaluations expects detection+recognition artifacts and single-string ground truth. Profile fixture test (POST /v1/bill/profiles/{id}/test) evaluates one stored document only. Charts below show real backend metrics only when a run exists."
      />

      <div className="px-4 pb-4">
        <Table
          size="small"
          rowKey="id"
          loading={evalQuery.isLoading}
          dataSource={runs}
          pagination={{ pageSize: 15 }}
          columns={[
            {
              title: "Run",
              dataIndex: "id",
              render: (id: string) => (
                <Typography.Text code copyable={{ text: id }}>
                  {id.slice(0, 10)}…
                </Typography.Text>
              ),
            },
            { title: "Dataset", dataIndex: "dataset_id", ellipsis: true },
            {
              title: "Status",
              dataIndex: "status",
              width: 110,
              render: (s: string) => <Tag>{s}</Tag>,
            },
            {
              title: "Type",
              dataIndex: "evaluation_type",
              width: 100,
            },
            {
              title: "Model",
              dataIndex: "model_ref",
              ellipsis: true,
              render: (v: string | null) => v || "—",
            },
            {
              title: "Created",
              dataIndex: "created_at",
              width: 140,
              render: (v: string | null) =>
                v ? dayjs(v).format("YYYY-MM-DD HH:mm") : "—",
            },
            {
              title: "",
              key: "a",
              width: 180,
              render: (_: unknown, row: EvaluationRun) => (
                <Space size={4}>
                  <Button size="small" onClick={() => void loadMetrics(row)}>
                    Metrics
                  </Button>
                  {["queued", "running"].includes(String(row.status)) ? (
                    <Button
                      size="small"
                      danger
                      onClick={() => void cancelRun(row)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </Space>
              ),
            },
          ]}
          locale={{ emptyText: "No evaluations yet for this dataset filter." }}
        />

        {metrics && metricsFor ? (
          <Card size="small" className="mt-4" title={`Metrics · ${metricsFor}`}>
            <pre className="max-h-80 overflow-auto text-xs">
              {JSON.stringify(metrics, null, 2)}
            </pre>
          </Card>
        ) : selectedRun ? (
          <Alert
            className="mt-4"
            type="info"
            showIcon
            message={`Selected run ${selectedRun.id} — click Metrics to load GET /v1/evaluations/{id}/metrics`}
          />
        ) : null}

        <Row gutter={12} className="mt-4">
          <Col span={24}>
            <Typography.Paragraph type="secondary" className="text-xs">
              Deep link: /bill/evaluation?evaluationId=…&datasetId=…
            </Typography.Paragraph>
          </Col>
        </Row>
      </div>

      <StartEvaluationModal
        open={Boolean(evalDataset)}
        dataset={evalDataset}
        onClose={() => setEvalDataset(null)}
      />
    </div>
  );
}
