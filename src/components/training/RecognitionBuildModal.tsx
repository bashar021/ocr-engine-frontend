import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Switch,
  message,
} from "antd";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import {
  buildRecognitionDataset,
  getRecognitionBuildJob,
  type RecognitionBuildJob,
} from "@/api/training";
import { useTaskContext } from "@/features/tasks/TaskContext";
import { defaultRecognitionCropName } from "@/features/tasks/taskOptions";

interface RecognitionBuildModalProps {
  open: boolean;
  onClose: () => void;
  ocrType?: string;
  databankDatasetId?: string | null;
  datasetIds?: string[];
}

export function RecognitionBuildModal({
  open,
  onClose,
  ocrType: ocrTypeProp,
  databankDatasetId,
  datasetIds,
}: RecognitionBuildModalProps) {
  const { activeTaskKey } = useTaskContext();
  const ocrType = ocrTypeProp ?? activeTaskKey;
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [jobId, setJobId] = useState<string | null>(null);
  const [preview, setPreview] = useState<RecognitionBuildJob["preview"] | null>(
    null,
  );
  const completionNotified = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      setJobId(null);
      setPreview(null);
      completionNotified.current = null;
      return;
    }
    form.resetFields();
    form.setFieldsValue({ name: defaultRecognitionCropName(ocrType) });
  }, [open, form, ocrType]);

  const jobQuery = useQuery({
    queryKey: ["training", "recognition-build", jobId],
    queryFn: () => getRecognitionBuildJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s && ["queued", "running"].includes(s) ? 1500 : false;
    },
  });

  useEffect(() => {
    const job = jobQuery.data;
    if (!job || job.status !== "completed" || !job.result) return;
    const notifyKey = job.id ?? jobId ?? "completed";
    if (completionNotified.current === notifyKey) return;
    completionNotified.current = notifyKey;
    message.success(
      `Pack ready: ${job.result.name}@${job.result.version} (${job.result.sample_count} crops)`,
    );
    void queryClient.invalidateQueries({
      queryKey: ["evaluation", "datasets"],
    });
  }, [jobQuery.data, jobId, queryClient]);

  const dryRunMutation = useMutation({
    mutationFn: async () => {
      const values = await form.validateFields();
      return buildRecognitionDataset({
        ocr_type: ocrType,
        databank_dataset_id: databankDatasetId || undefined,
        dataset_ids: datasetIds,
        include_blurry: Boolean(values.include_blurry),
        exclude_dead: values.exclude_dead !== false,
        train_ratio: values.train_ratio,
        val_ratio: values.val_ratio,
        test_ratio: values.test_ratio,
        seed: values.seed ?? 42,
        name: values.name,
        dry_run: true,
      });
    },
    onSuccess: (res) => {
      setPreview(res.preview ?? null);
      if (!res.preview?.ready_for_train) {
        message.warning("Not enough samples for train/val/test yet");
      } else {
        message.success("Preview ready");
      }
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  const buildMutation = useMutation({
    mutationFn: async () => {
      const values = await form.validateFields();
      return buildRecognitionDataset({
        ocr_type: ocrType,
        databank_dataset_id: databankDatasetId || undefined,
        dataset_ids: datasetIds,
        include_blurry: Boolean(values.include_blurry),
        exclude_dead: values.exclude_dead !== false,
        train_ratio: values.train_ratio,
        val_ratio: values.val_ratio,
        test_ratio: values.test_ratio,
        seed: values.seed ?? 42,
        name: values.name,
        dry_run: false,
      });
    },
    onSuccess: (res) => {
      if (res.id) setJobId(res.id);
      else if (res.status === "completed") {
        message.success("Build completed");
      }
    },
    onError: (e) => message.error(getApiErrorMessage(e)),
  });

  const job = jobQuery.data;
  const busy =
    buildMutation.isPending ||
    Boolean(job && ["queued", "running"].includes(job.status));

  return (
    <Modal
      title="Build recognition training pack"
      open={open}
      onCancel={onClose}
      width={640}
      footer={null}
      destroyOnHidden
    >
      <Alert
        className="mb-4"
        type="info"
        showIcon
        message="Creates cropped images with frozen train / val / test splits (default 80/10/10). Test is never used for training."
      />
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          exclude_dead: true,
          include_blurry: false,
          train_ratio: 0.8,
          val_ratio: 0.1,
          test_ratio: 0.1,
          seed: 42,
          name: defaultRecognitionCropName(ocrType),
        }}
      >
        <Form.Item name="name" label="Dataset name">
          <Input />
        </Form.Item>
        <div className="grid grid-cols-3 gap-3">
          <Form.Item name="train_ratio" label="Train ratio">
            <InputNumber min={0.5} max={0.95} step={0.05} className="w-full" />
          </Form.Item>
          <Form.Item name="val_ratio" label="Val ratio">
            <InputNumber min={0.05} max={0.3} step={0.05} className="w-full" />
          </Form.Item>
          <Form.Item name="test_ratio" label="Test ratio">
            <InputNumber min={0.05} max={0.3} step={0.05} className="w-full" />
          </Form.Item>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Form.Item name="seed" label="Split seed">
            <InputNumber className="w-full" />
          </Form.Item>
          <Form.Item
            name="exclude_dead"
            label="Exclude dead"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="include_blurry"
            label="Include blurry"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </div>
      </Form>

      {preview ? (
        <div className="mb-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          Accepted {preview.accepted_count ?? 0} · Quarantine{" "}
          {preview.quarantine_count ?? 0}
          <div className="mt-1">
            Splits: train {preview.splits?.train ?? 0} · val{" "}
            {preview.splits?.val ?? 0} · test {preview.splits?.test ?? 0}
          </div>
        </div>
      ) : null}

      {jobId && job ? (
        <div className="mb-3 space-y-2">
          <Progress
            percent={Math.round(job.progress_pct ?? 0)}
            status={job.status === "failed" ? "exception" : undefined}
          />
          <div className="text-sm text-slate-600">
            {job.message || job.status}
          </div>
          {job.result?.id ? (
            <Link
              className="text-sm"
              to="/evaluation/training-datasets"
              onClick={onClose}
            >
              Open training datasets → {job.result.name}@{job.result.version}
            </Link>
          ) : null}
          {job.error ? <Alert type="error" message={job.error} /> : null}
          {job.logs_tail ? (
            <pre className="max-h-32 overflow-auto rounded bg-white p-2 text-xs">
              {job.logs_tail}
            </pre>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Close</Button>
        <Button
          loading={dryRunMutation.isPending}
          disabled={busy}
          onClick={() => dryRunMutation.mutate()}
        >
          Dry-run preview
        </Button>
        <Button
          type="primary"
          loading={busy}
          onClick={() => buildMutation.mutate()}
        >
          Build in background
        </Button>
      </div>
    </Modal>
  );
}
