import {
  Alert,
  Button,
  Card,
  Collapse,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Steps,
  Tag,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "@/api/client";
import { listArtifacts, listPipelineRefs } from "@/api/models";
import {
  createTrainingCycle,
  getCycleCreationOptions,
  preflightTrainingCycle,
  type CycleCreationOptions,
  type CyclePreflightResult,
} from "@/api/training";
import { useTaskContext } from "@/features/tasks/TaskContext";

const { TextArea } = Input;

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (cycleId: string) => void;
};

export function CreateTrainingCycleModal({ open, onClose, onCreated }: Props) {
  const { activeTaskKey } = useTaskContext();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [datasetId, setDatasetId] = useState<string | undefined>();
  const [trainingType, setTrainingType] = useState("recognition");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [baselineRecognitionId, setBaselineRecognitionId] = useState<
    string | undefined
  >();
  const [baselineDetectionId, setBaselineDetectionId] = useState<
    string | undefined
  >();
  const [baselineModelRef, setBaselineModelRef] = useState<string | undefined>();
  const [preflight, setPreflight] = useState<CyclePreflightResult | null>(null);

  const optionsQuery = useQuery({
    queryKey: ["training", "cycle-options", activeTaskKey],
    queryFn: () => getCycleCreationOptions(activeTaskKey),
    enabled: open,
  });

  const options: CycleCreationOptions | undefined = optionsQuery.data;

  const baselineArtifactsQuery = useQuery({
    queryKey: ["models", "artifacts", "cycle-baseline", activeTaskKey],
    queryFn: () =>
      listArtifacts({
        ocr_type: activeTaskKey,
        include_metrics: false,
        limit: 200,
      }),
    enabled: open,
  });

  const refsQuery = useQuery({
    queryKey: ["models", "refs", "cycle-baseline", activeTaskKey],
    queryFn: () =>
      listPipelineRefs({ ocr_type: activeTaskKey, include_metrics: false }),
    enabled: open,
  });

  useEffect(() => {
    if (!open || !options?.production) return;
    setBaselineRecognitionId(
      options.production.recognition_artifact_id ?? undefined,
    );
    setBaselineDetectionId(options.production.detection_artifact_id ?? undefined);
    setBaselineModelRef(options.production.model_ref ?? undefined);
  }, [open, options?.production]);
  const selected = useMemo(
    () => options?.datasets.find((d) => d.id === datasetId),
    [options, datasetId],
  );

  useEffect(() => {
    if (!open) {
      setStep(0);
      setDatasetId(undefined);
      setTrainingType("recognition");
      setName("");
      setDescription("");
      setPreflight(null);
      setAdvancedOpen(false);
      setBaselineRecognitionId(undefined);
      setBaselineDetectionId(undefined);
      setBaselineModelRef(undefined);
    }
  }, [open]);

  const preflightMutation = useMutation({
    mutationFn: () =>
      preflightTrainingCycle({
        recognition_dataset_id: datasetId!,
        training_type: trainingType,
        name: name || undefined,
        description: description || undefined,
      }),
    onSuccess: (data) => {
      setPreflight(data);
      setStep(2);
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createTrainingCycle({
        ocr_type: activeTaskKey,
        recognition_dataset_id: datasetId!,
        training_type: trainingType,
        name: name || undefined,
        description: description || undefined,
        baseline_recognition_artifact_id: baselineRecognitionId,
        baseline_detection_artifact_id: baselineDetectionId,
        baseline_model_ref: baselineModelRef,
        skip_detection: true,
        auto_promote: false,
      }),
    onSuccess: (cycle) => {
      onClose();
      onCreated?.(cycle.id);
      navigate(`/training-center/cycles/${cycle.id}`);
    },
  });

  const canNextFromSelect =
    Boolean(datasetId) &&
    trainingType === "recognition" &&
    (selected?.ready ?? false);

  return (
    <Modal
      title="Create Training Cycle"
      open={open}
      onCancel={onClose}
      width={720}
      footer={null}
      destroyOnClose
    >
      <Steps
        size="small"
        className="mb-4"
        current={step}
        items={[
          { title: "Dataset" },
          { title: "Details" },
          { title: "Review" },
        ]}
      />

      {optionsQuery.isError ? (
        <Alert
          type="error"
          showIcon
          className="mb-3"
          message={getApiErrorMessage(optionsQuery.error)}
        />
      ) : null}

      {step === 0 ? (
        <div className="space-y-4">
          <Typography.Paragraph type="secondary" className="!mb-2">
            Choose a verified recognition dataset. The system handles splits,
            experiments, hard cases, and evaluation automatically.
          </Typography.Paragraph>

          <div>
            <Typography.Text strong>Dataset</Typography.Text>
            <Select
              className="mt-1 w-full"
              loading={optionsQuery.isLoading}
              placeholder="Select a verified recognition pack"
              value={datasetId}
              onChange={(v) => setDatasetId(v)}
              options={(options?.datasets ?? []).map((d) => ({
                value: d.id,
                disabled: !d.ready,
                label: (
                  <div className="flex flex-wrap items-center gap-2 py-0.5">
                    <span>
                      {d.name}@{d.version}
                    </span>
                    <Tag color={d.ready ? "green" : "default"}>
                      {d.ready ? "Ready" : d.readiness_code}
                    </Tag>
                    <span className="text-xs text-slate-500">
                      {d.verified_sample_count} samples
                    </span>
                  </div>
                ),
              }))}
            />
          </div>

          {selected ? (
            <Card size="small">
              <Space direction="vertical" size={4} className="w-full">
                <div>
                  <Tag color={selected.ready ? "green" : "orange"}>
                    {selected.ready ? "Ready" : selected.readiness_code}
                  </Tag>
                  <Typography.Text>
                    {selected.readiness_message}
                  </Typography.Text>
                </div>
                <Typography.Text type="secondary" className="text-sm">
                  Type: {selected.dataset_type} · Verified samples:{" "}
                  {selected.verified_sample_count}
                  {selected.train_count
                    ? ` · Train ${selected.train_count} / Val ${selected.validation_count}`
                    : ""}
                  {selected.protected_test_excluded
                    ? " · Protected-test excluded"
                    : ""}
                </Typography.Text>
                {(selected.issues ?? []).map((issue) => (
                  <Alert
                    key={issue.code}
                    type="warning"
                    showIcon
                    message={issue.message}
                    description={issue.next_step}
                  />
                ))}
              </Space>
            </Card>
          ) : null}

          <div>
            <Typography.Text strong>What do you want to train?</Typography.Text>
            <Radio.Group
              className="mt-2 flex flex-col gap-2"
              value={trainingType}
              onChange={(e) => setTrainingType(e.target.value)}
            >
              {(options?.training_types ?? []).map((t) => (
                <Radio key={t.id} value={t.id} disabled={!t.available}>
                  <div>
                    <div className="font-medium">{t.label}</div>
                    <div className="text-xs text-slate-500">
                      {t.description}
                    </div>
                  </div>
                </Radio>
              ))}
            </Radio.Group>
          </div>

          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="primary"
              disabled={!canNextFromSelect}
              onClick={() => setStep(1)}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <Form layout="vertical">
            <Form.Item label="Training cycle name (optional)">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Auto-generated if left blank"
              />
            </Form.Item>
            <Form.Item label="Short description (optional)">
              <TextArea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder='e.g. "Improve repeated-digit recognition"'
              />
            </Form.Item>
          </Form>

          <Collapse
            activeKey={advancedOpen ? ["adv"] : []}
            onChange={(keys) =>
              setAdvancedOpen(
                Array.isArray(keys) ? keys.includes("adv") : false,
              )
            }
            items={[
              {
                key: "adv",
                label: "Advanced settings (engineers)",
                children: (
                  <div className="space-y-3">
                    <Alert
                      type="info"
                      showIcon
                      message="System-controlled training hyperparameters"
                      description="Epochs, learning rate, batch size, and experiment matrix use safe server defaults."
                    />
                    <div>
                      <Typography.Text strong>Baseline model ref</Typography.Text>
                      <Select
                        className="mt-1 w-full"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        value={baselineModelRef}
                        onChange={setBaselineModelRef}
                        placeholder="Production default"
                        options={(refsQuery.data?.refs ?? []).map((r) => ({
                          value: r.model_ref,
                          label: `${r.model_ref}${r.is_default ? " (default)" : ""}`,
                        }))}
                      />
                    </div>
                    <div>
                      <Typography.Text strong>
                        Baseline detection artifact
                      </Typography.Text>
                      <Select
                        className="mt-1 w-full"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        value={baselineDetectionId}
                        onChange={setBaselineDetectionId}
                        options={(baselineArtifactsQuery.data?.artifacts ?? [])
                          .filter((a) => a.role === "detection")
                          .map((a) => ({
                            value: a.id,
                            label: `${a.name} v${a.version}`,
                          }))}
                      />
                    </div>
                    <div>
                      <Typography.Text strong>
                        Baseline recognition artifact
                      </Typography.Text>
                      <Select
                        className="mt-1 w-full"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        value={baselineRecognitionId}
                        onChange={setBaselineRecognitionId}
                        options={(baselineArtifactsQuery.data?.artifacts ?? [])
                          .filter((a) => a.role === "recognition")
                          .map((a) => ({
                            value: a.id,
                            label: `${a.name} v${a.version}`,
                          }))}
                      />
                    </div>
                  </div>
                ),
              },
            ]}
          />

          {(preflightMutation.isError || createMutation.isError) && (
            <Alert
              type="error"
              showIcon
              message={getApiErrorMessage(
                preflightMutation.error || createMutation.error,
              )}
            />
          )}

          <div className="flex justify-between gap-2">
            <Button onClick={() => setStep(0)}>Back</Button>
            <Space>
              <Button onClick={onClose}>Cancel</Button>
              <Button
                type="primary"
                loading={preflightMutation.isPending}
                onClick={() => preflightMutation.mutate()}
              >
                Review
              </Button>
            </Space>
          </div>
        </div>
      ) : null}

      {step === 2 && preflight ? (
        <div className="space-y-4">
          {!preflight.can_start ? (
            <Alert
              type="error"
              showIcon
              message="Training cannot start"
              description={
                <ul className="mb-0 list-disc pl-4">
                  {preflight.blockers.map((b) => (
                    <li key={b.code}>
                      {b.message}
                      {b.next_step ? (
                        <div className="text-xs text-slate-500">
                          {b.next_step}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              }
            />
          ) : (
            <Alert
              type="success"
              showIcon
              message="Ready to start"
              description="Production model will not change automatically."
            />
          )}

          <Card size="small" title="Summary">
            <Space direction="vertical" size={6} className="w-full">
              <div>
                <Typography.Text type="secondary">Dataset</Typography.Text>
                <div className="font-medium">
                  {preflight.summary.dataset.name}@
                  {preflight.summary.dataset.version}
                </div>
                <div className="text-sm text-slate-500">
                  {preflight.summary.dataset.verified_sample_count} verified
                  samples
                </div>
              </div>
              <div>
                <Typography.Text type="secondary">Training</Typography.Text>
                <div className="font-medium">
                  {preflight.summary.training.label}
                </div>
              </div>
              <div>
                <Typography.Text type="secondary">Cycle name</Typography.Text>
                <div className="font-medium">{preflight.summary.name}</div>
              </div>
              {preflight.summary.description ? (
                <div>
                  <Typography.Text type="secondary">
                    Description
                  </Typography.Text>
                  <div>{preflight.summary.description}</div>
                </div>
              ) : null}
              <div>
                <Typography.Text type="secondary">
                  Initialization
                </Typography.Text>
                <div>{preflight.summary.initialization}</div>
              </div>
              <div>
                <Typography.Text type="secondary">Evaluation</Typography.Text>
                <div>{preflight.summary.evaluation}</div>
              </div>
              <div>
                <Typography.Text type="secondary">Experiments</Typography.Text>
                <div>{preflight.summary.experiments}</div>
              </div>
              <div>
                <Typography.Text type="secondary">Hard cases</Typography.Text>
                <div>{preflight.summary.hard_cases}</div>
              </div>
              <div>
                <Typography.Text type="secondary">
                  Production model
                </Typography.Text>
                <div className="font-medium text-emerald-700">
                  {preflight.summary.production_model}
                </div>
              </div>
            </Space>
          </Card>

          <Collapse
            items={[
              {
                key: "tech",
                label: "Technical details",
                children: (
                  <pre className="max-h-48 overflow-auto text-xs">
                    {JSON.stringify(
                      {
                        dataset_id: preflight.dataset.id,
                        readiness: preflight.dataset.readiness_code,
                        protected_test: preflight.summary.protected_test,
                        production: options?.production,
                      },
                      null,
                      2,
                    )}
                  </pre>
                ),
              },
            ]}
          />

          <div className="flex justify-between gap-2">
            <Button onClick={() => setStep(1)}>Back</Button>
            <Space>
              <Button onClick={onClose}>Cancel</Button>
              <Button
                type="primary"
                disabled={!preflight.can_start}
                loading={createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                Start Training Cycle
              </Button>
            </Space>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
