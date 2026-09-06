import { InboxOutlined } from "@ant-design/icons";
import {
  Alert,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Typography,
  Upload,
  message,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import { suggestArtifactVersion } from "@/api/models";
import { useUploadModel } from "@/features/models/useUploadModel";

const OCR_TYPES = [
  { value: "odometer", label: "Odometer" },
  { value: "number_plate", label: "Number plate" },
  { value: "bill", label: "Bill" },
  { value: "vin", label: "VIN" },
  { value: "document", label: "Document" },
];

const ROLES = [
  { value: "detection", label: "Detection" },
  { value: "recognition", label: "Recognition" },
];

const RUNTIMES = [
  { value: "pytorch", label: "PyTorch" },
  { value: "paddle", label: "Paddle (config / default weights)" },
  {
    value: "paddle_inference",
    label: "PaddleOCR inference package (.zip)",
  },
  { value: "onnx", label: "ONNX" },
  { value: "stub", label: "Stub" },
];

interface UploadModelModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  ocr_type: string;
  role: string;
  name: string;
  runtime: string;
  framework?: string;
  training_accuracy?: number;
}

export function UploadModelModal({ open, onClose }: UploadModelModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const upload = useUploadModel();
  const runtime = Form.useWatch("runtime", form);
  const ocrType = Form.useWatch("ocr_type", form);
  const role = Form.useWatch("role", form);
  const name = Form.useWatch("name", form);

  const suggestQuery = useQuery({
    queryKey: ["models", "artifacts", "suggest-version", ocrType, role, name],
    queryFn: () =>
      suggestArtifactVersion({
        ocr_type: ocrType || "odometer",
        role: role || "detection",
        name: name || "model",
        bump: "patch",
      }),
    enabled: open && Boolean(name?.trim()),
  });

  const isPaddlePackage = runtime === "paddle_inference";
  const accept = useMemo(() => {
    if (isPaddlePackage) return ".zip";
    return ".pt,.onnx,.engine,.bin,.json,.zip";
  }, [isPaddlePackage]);

  const reset = () => {
    form.resetFields();
    setFileList([]);
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const file = fileList[0]?.originFileObj;
      if (!file) {
        message.error("Please choose a model file to upload");
        return;
      }
      if (values.runtime === "paddle_inference") {
        if (values.role !== "recognition") {
          message.error(
            "PaddleOCR inference package requires role=recognition",
          );
          return;
        }
        const fileName = file.name?.toLowerCase() || "";
        if (!fileName.endsWith(".zip")) {
          message.error(
            "Upload a .zip containing inference.pdiparams, inference.yml, inference.json",
          );
          return;
        }
      }

      await upload.mutateAsync({
        file,
        ocr_type: values.ocr_type,
        role: values.role,
        name: values.name,
        runtime: values.runtime,
        framework:
          values.framework ||
          (values.runtime === "paddle_inference" ? "paddleocr" : undefined),
        training_accuracy: values.training_accuracy,
      });
      message.success(
        `Model uploaded${suggestQuery.data?.suggested_version ? ` as v${suggestQuery.data.suggested_version}` : ""}`,
      );
      reset();
      onClose();
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(getApiErrorMessage(error));
    }
  };

  return (
    <Modal
      title="Upload model"
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      okText="Upload"
      confirmLoading={upload.isPending}
      destroyOnHidden
      width={560}
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-4"
        initialValues={{
          ocr_type: "odometer",
          role: "detection",
          runtime: "pytorch",
        }}
        onValuesChange={(changed) => {
          if (changed.runtime === "paddle_inference") {
            form.setFieldsValue({
              role: "recognition",
              framework: "paddleocr",
            });
            setFileList([]);
          }
        }}
      >
        {isPaddlePackage ? (
          <Alert
            className="mb-3"
            type="info"
            showIcon
            message="PaddleOCR inference ZIP"
            description={
              <>
                Package must include <code>inference.pdiparams</code>,{" "}
                <code>inference.yml</code>, and <code>inference.json</code>{" "}
                (flat or in one subdirectory). Do not upload training
                checkpoints (<code>best_accuracy.pdparams</code>).
              </>
            }
          />
        ) : null}

        <Form.Item label="Model file" required>
          <Upload.Dragger
            maxCount={1}
            beforeUpload={() => false}
            fileList={fileList}
            onChange={({ fileList: next }) => setFileList(next)}
            accept={accept}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click or drag model file</p>
            <p className="ant-upload-hint">
              {isPaddlePackage
                ? ".zip (inference package)"
                : ".pt, .onnx, .engine, .bin, .json, .zip"}
            </p>
          </Upload.Dragger>
        </Form.Item>

        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <Form.Item
            name="ocr_type"
            label="OCR type"
            rules={[{ required: true, message: "Required" }]}
          >
            <Select options={OCR_TYPES} />
          </Form.Item>
          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: "Required" }]}
          >
            <Select options={ROLES} disabled={isPaddlePackage} />
          </Form.Item>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input
              placeholder={
                isPaddlePackage
                  ? "odometer-recognition-v5"
                  : "odometer-detector"
              }
            />
          </Form.Item>
          <Form.Item label="Version">
            {suggestQuery.data?.suggested_version ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <Typography.Text type="secondary" className="text-xs">
                  Will be assigned
                </Typography.Text>
                <div className="font-mono font-medium">
                  v{suggestQuery.data.suggested_version}
                </div>
              </div>
            ) : (
              <Typography.Text type="secondary" className="text-sm">
                Auto-assigned on upload
              </Typography.Text>
            )}
          </Form.Item>
          <Form.Item
            name="runtime"
            label="Runtime"
            rules={[{ required: true, message: "Required" }]}
          >
            <Select options={RUNTIMES} />
          </Form.Item>
          <Form.Item name="framework" label="Framework">
            <Input
              placeholder={isPaddlePackage ? "paddleocr" : "ultralytics"}
            />
          </Form.Item>
          <Form.Item name="training_accuracy" label="Ground / training accuracy">
            <InputNumber
              className="w-full"
              min={0}
              max={1}
              step={0.01}
              placeholder="0.95"
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
