import { InboxOutlined } from "@ant-design/icons";
import { Alert, Form, Input, Modal, Upload, message } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useEffect, useState } from "react";

import { getApiErrorMessage } from "@/api/client";
import { useUploadDataset } from "@/features/evaluation/useEvaluationMutations";
import { useTaskContext } from "@/features/tasks/TaskContext";

interface UploadDatasetModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  ocr_type: string;
  description?: string;
}

export function UploadDatasetModal({ open, onClose }: UploadDatasetModalProps) {
  const { activeTaskKey } = useTaskContext();
  const [form] = Form.useForm<FormValues>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const upload = useUploadDataset();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({ ocr_type: activeTaskKey });
    }
  }, [open, form, activeTaskKey]);

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
        message.error("Please choose a ZIP dataset file");
        return;
      }
      const created = await upload.mutateAsync({
        ocr_type: values.ocr_type,
        description: values.description,
        origin: "upload",
        file,
      });
      message.success(
        `Uploaded as ${created.name} v${created.version} (auto-named)`,
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
      title="Upload dataset"
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      okText="Upload"
      confirmLoading={upload.isPending}
      destroyOnHidden
      width={560}
    >
      <Alert
        className="mb-3"
        type="info"
        showIcon
        message="Name is automatic"
        description="Uploads are named {ocr_type}-{YYYY-MM-DD} with an auto-bumped version (1.0.0, 1.0.1, …)."
      />
      <Form
        form={form}
        layout="vertical"
        className="mt-2"
        initialValues={{ ocr_type: activeTaskKey }}
      >
        <Form.Item label="Dataset ZIP" required>
          <Upload.Dragger
            maxCount={1}
            beforeUpload={() => false}
            fileList={fileList}
            onChange={({ fileList: next }) => setFileList(next)}
            accept=".zip,application/zip"
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click or drag ZIP file</p>
            <p className="ant-upload-hint">
              Images named like <code>1-887512.png</code> (GT after first dash)
            </p>
          </Upload.Dragger>
        </Form.Item>
        <Form.Item name="ocr_type" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="description" label="Notes (optional)">
          <Input.TextArea rows={2} placeholder="Optional notes" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
