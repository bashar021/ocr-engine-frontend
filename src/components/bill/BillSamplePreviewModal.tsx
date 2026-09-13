import { useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Col,
  Descriptions,
  Empty,
  Image,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { PlayCircleOutlined } from "@ant-design/icons";

import { getApiErrorMessage } from "@/api/client";
import {
  processBillDatabankSample,
  processBillEvaluationSample,
} from "@/api/bill";
import { useBillProfiles } from "@/features/bill/hooks";

function parseMaybeJson(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw === "object") return raw;
  const text = String(raw).trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function fieldsFromPrediction(pred: unknown): Record<string, unknown> {
  if (!pred || typeof pred !== "object") return {};
  const p = pred as Record<string, unknown>;
  const fields = p.fields;
  if (fields && typeof fields === "object" && !Array.isArray(fields)) {
    return fields as Record<string, unknown>;
  }
  const result = p.result;
  if (result && typeof result === "object") {
    const rf = (result as Record<string, unknown>).fields;
    if (rf && typeof rf === "object" && !Array.isArray(rf)) {
      return rf as Record<string, unknown>;
    }
  }
  return {};
}

function fieldsFromGt(gt: unknown): Record<string, unknown> {
  const parsed = parseMaybeJson(gt);
  if (!parsed) return {};
  if (typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    if (obj.fields && typeof obj.fields === "object") {
      return obj.fields as Record<string, unknown>;
    }
    return obj;
  }
  return { value: parsed };
}

function formatCell(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("value" in o) return formatCell(o.value);
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

export type BillSamplePreviewTarget = {
  source: "databank" | "evaluation";
  datasetId: string;
  sampleId: string;
  filename?: string;
  groundTruth?: string | null;
  predictedValue?: string | null;
  lastPrediction?: unknown;
  imageUrl?: string | null;
};

type Props = {
  open: boolean;
  target: BillSamplePreviewTarget | null;
  onClose: () => void;
  onProcessed?: () => void;
};

export function BillSamplePreviewModal({
  open,
  target,
  onClose,
  onProcessed,
}: Props) {
  const { message } = App.useApp();
  const profilesQuery = useBillProfiles();
  const [profileId, setProfileId] = useState<string | undefined>();
  const [running, setRunning] = useState(false);
  const [prediction, setPrediction] = useState<unknown>(null);

  useEffect(() => {
    setPrediction(target?.lastPrediction ?? null);
  }, [target?.sampleId, target?.lastPrediction]);

  const gtFields = useMemo(
    () => fieldsFromGt(target?.groundTruth),
    [target?.groundTruth],
  );
  const predFields = useMemo(
    () => fieldsFromPrediction(prediction),
    [prediction],
  );

  const fieldNames = useMemo(() => {
    const names = new Set([
      ...Object.keys(gtFields),
      ...Object.keys(predFields),
    ]);
    return Array.from(names).sort();
  }, [gtFields, predFields]);

  const compareRows = fieldNames.map((name) => ({
    key: name,
    field: name,
    gt: formatCell(gtFields[name]),
    pred: formatCell(predFields[name]),
    match:
      formatCell(gtFields[name]) !== "—" &&
      formatCell(gtFields[name]) === formatCell(predFields[name]),
  }));

  const runOcr = async () => {
    if (!target) return;
    setRunning(true);
    try {
      const body = profileId ? { profile_id: profileId } : {};
      if (target.source === "databank") {
        const res = await processBillDatabankSample(
          target.datasetId,
          target.sampleId,
          body,
        );
        setPrediction(res.prediction ?? res.sample?.last_prediction ?? null);
      } else {
        const res = await processBillEvaluationSample(
          target.datasetId,
          target.sampleId,
          body,
        );
        setPrediction(res.prediction ?? null);
      }
      message.success("OCR completed");
      onProcessed?.();
    } catch (err) {
      message.error(getApiErrorMessage(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="92vw"
      style={{ top: 24 }}
      styles={{ body: { maxHeight: "85vh", overflow: "auto" } }}
      title={target?.filename ?? "Sample preview"}
      destroyOnHidden
    >
      {!target ? (
        <Empty />
      ) : (
        <div className="space-y-4">
          <Space wrap>
            <Select
              allowClear
              placeholder="Profile (optional)"
              className="min-w-56"
              loading={profilesQuery.isLoading}
              value={profileId}
              options={(profilesQuery.data?.profiles ?? []).map((p) => ({
                value: p.profile_id,
                label: `${p.name || p.profile_id} (v${p.version})`,
              }))}
              onChange={setProfileId}
            />
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={running}
              onClick={() => void runOcr()}
            >
              Run OCR
            </Button>
            {target.predictedValue ? (
              <Tag>Predicted: {target.predictedValue}</Tag>
            ) : null}
          </Space>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Typography.Title level={5}>Media</Typography.Title>
              {target.imageUrl ? (
                <Image
                  src={target.imageUrl}
                  alt={target.filename}
                  className="max-h-[70vh] w-full object-contain"
                />
              ) : (
                <Empty description="No preview image" />
              )}
            </Col>
            <Col xs={24} lg={12}>
              <Typography.Title level={5}>GT vs predicted</Typography.Title>
              {compareRows.length === 0 ? (
                <Descriptions size="small" bordered column={1}>
                  <Descriptions.Item label="Ground truth">
                    <pre className="m-0 max-h-48 overflow-auto text-xs whitespace-pre-wrap">
                      {target.groundTruth || "—"}
                    </pre>
                  </Descriptions.Item>
                  <Descriptions.Item label="Predicted">
                    <pre className="m-0 max-h-48 overflow-auto text-xs whitespace-pre-wrap">
                      {prediction
                        ? JSON.stringify(prediction, null, 2)
                        : "—"}
                    </pre>
                  </Descriptions.Item>
                </Descriptions>
              ) : (
                <Table
                  size="small"
                  rowKey="key"
                  pagination={false}
                  dataSource={compareRows}
                  columns={[
                    { title: "Field", dataIndex: "field", width: 140 },
                    {
                      title: "Ground truth",
                      dataIndex: "gt",
                      render: (v: string) => (
                        <span className="font-mono text-xs">{v}</span>
                      ),
                    },
                    {
                      title: "Predicted",
                      dataIndex: "pred",
                      render: (v: string) => (
                        <span className="font-mono text-xs">{v}</span>
                      ),
                    },
                    {
                      title: "OK",
                      dataIndex: "match",
                      width: 70,
                      render: (ok: boolean) =>
                        ok ? <Tag color="green">yes</Tag> : <Tag>—</Tag>,
                    },
                  ]}
                />
              )}
            </Col>
          </Row>
        </div>
      )}
    </Modal>
  );
}
