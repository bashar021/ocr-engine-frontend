import { Alert, Checkbox, Form, Input, Modal, Select, message } from "antd";
import { useEffect, useMemo } from "react";

import { getApiErrorMessage } from "@/api/client";
import { useCreateModelRef } from "@/features/models/useCreateModelRef";
import { useModelsQuery } from "@/features/models/useModelsQuery";

const OCR_TYPES = [
  { value: "odometer", label: "Odometer" },
  { value: "number_plate", label: "Number plate" },
  { value: "bill", label: "Bill" },
  { value: "vin", label: "VIN" },
  { value: "document", label: "Document" },
];

interface CreateModelRefModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  ocr_type: string;
  model_ref: string;
  detection_artifact_id: string;
  recognition_artifact_id: string;
  notes?: string;
  activate?: boolean;
  set_default?: boolean;
}

function artifactLabel(
  name: string,
  version: string,
  status: string,
  runtime: string,
) {
  return `${name} v${version} · ${runtime} · ${status}`;
}

export function CreateModelRefModal({
  open,
  onClose,
}: CreateModelRefModalProps) {
  const [form] = Form.useForm<FormValues>();
  const create = useCreateModelRef();
  const ocrType = Form.useWatch("ocr_type", form);
  const activate = Form.useWatch("activate", form);

  const artifactsQuery = useModelsQuery(
    {
      ocr_type: ocrType || "odometer",
      include_metrics: false,
      limit: 500,
      offset: 0,
    },
    open,
  );

  // Re-fetch when modal opens / ocr type changes via query key already
  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        ocr_type: "odometer",
        activate: true,
        set_default: false,
      });
    }
  }, [open, form]);

  useEffect(() => {
    form.setFieldValue("detection_artifact_id", undefined);
    form.setFieldValue("recognition_artifact_id", undefined);
  }, [ocrType, form]);

  const detectionOptions = useMemo(() => {
    return (artifactsQuery.data?.artifacts ?? [])
      .filter((a) => a.role === "detection" && a.status !== "retired")
      .map((a) => ({
        value: a.id,
        label: artifactLabel(a.name, a.version, a.status, a.runtime),
      }));
  }, [artifactsQuery.data?.artifacts]);

  const recognitionOptions = useMemo(() => {
    return (artifactsQuery.data?.artifacts ?? [])
      .filter((a) => a.role === "recognition" && a.status !== "retired")
      .map((a) => ({
        value: a.id,
        label: artifactLabel(a.name, a.version, a.status, a.runtime),
      }));
  }, [artifactsQuery.data?.artifacts]);

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await create.mutateAsync({
        ocr_type: values.ocr_type,
        model_ref: values.model_ref.trim(),
        detection_artifact_id: values.detection_artifact_id,
        recognition_artifact_id: values.recognition_artifact_id,
        notes: values.notes?.trim() || undefined,
        activate: Boolean(values.activate),
        set_default: Boolean(values.set_default),
      });
      message.success(
        values.activate
          ? "Model ref created and activated"
          : "Model ref created as draft",
      );
      form.resetFields();
      onClose();
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(getApiErrorMessage(error));
    }
  };

  return (
    <Modal
      title="Create model ref"
      open={open}
      onCancel={handleCancel}
      onOk={() => void handleOk()}
      okText="Create"
      confirmLoading={create.isPending}
      destroyOnHidden
      width={560}
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-4"
        initialValues={{ ocr_type: "odometer" }}
      >
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <Form.Item
            name="ocr_type"
            label="OCR type"
            rules={[{ required: true, message: "Required" }]}
          >
            <Select options={OCR_TYPES} />
          </Form.Item>
          <Form.Item
            name="model_ref"
            label="Model ref"
            rules={[
              { required: true, message: "Required" },
              {
                pattern: /^[^/\\]+$/,
                message: "Cannot contain / or \\",
              },
            ]}
          >
            <Input placeholder="v1" />
          </Form.Item>
        </div>

        <Form.Item
          name="detection_artifact_id"
          label="Detection model"
          rules={[{ required: true, message: "Select a detection artifact" }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Select detection artifact"
            options={detectionOptions}
            loading={artifactsQuery.isLoading || artifactsQuery.isFetching}
            notFoundContent={
              detectionOptions.length === 0
                ? "No detection artifacts for this OCR type"
                : undefined
            }
          />
        </Form.Item>

        <Form.Item
          name="recognition_artifact_id"
          label="Recognition model"
          rules={[{ required: true, message: "Select a recognition artifact" }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Select recognition artifact"
            options={recognitionOptions}
            loading={artifactsQuery.isLoading || artifactsQuery.isFetching}
            notFoundContent={
              recognitionOptions.length === 0
                ? "No recognition artifacts for this OCR type"
                : undefined
            }
          />
        </Form.Item>

        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} placeholder="Optional notes" />
        </Form.Item>

        <Form.Item name="activate" valuePropName="checked" className="mb-2">
          <Checkbox>Activate after create (required for OCR serving)</Checkbox>
        </Form.Item>
        <Form.Item name="set_default" valuePropName="checked" className="mb-0">
          <Checkbox disabled={!activate}>
            Set as default for this OCR type
          </Checkbox>
        </Form.Item>
        <Alert
          type="warning"
          showIcon
          className="mt-3"
          message="Human promotion only"
          description="Trained candidates stay inactive until you explicitly activate a model ref. Prefer comparing evaluations (same dataset version) before promoting."
        />
      </Form>
    </Modal>
  );
}
