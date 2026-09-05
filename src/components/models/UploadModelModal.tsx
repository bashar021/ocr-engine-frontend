import { InboxOutlined } from "@ant-design/icons";
import {
  Alert,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Upload,
  message,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useMemo, useState } from "react";

import { getApiErrorMessage } from "@/api/client";
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
  version: string;
  runtime: string;
  framework?: string;
  training_accuracy?: number;
}

export function UploadModelModal({ open, onClose }: UploadModelModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const upload = useUploadModel();
  const runtime = Form.useWatch("runtime", form);

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
        const name = file.name?.toLowerCase() || "";
        if (!name.endsWith(".zip")) {
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
        version: values.version,
        runtime: values.runtime,
        framework:
          values.framework ||
          (values.runtime === "paddle_inference" ? "paddleocr" : undefined),
        training_accuracy: values.training_accuracy,
      });
      message.success("Model uploaded successfully");
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
          <Form.Item
            name="version"
            label="Version"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input placeholder="1.0.0" />
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
          <Form.Item name="training_accuracy" label="Training accuracy">
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
