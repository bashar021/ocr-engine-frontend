import { InboxOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import {
  importBillDatasetZip,
  validateBillDatasetZip,
  type BillImportValidationSummary,
} from "@/api/billDataset";
import { billDatasetKeys } from "@/features/bill/dataset/hooks";

type Props = {
  open: boolean;
  onClose: () => void;
  onImported?: (dataset: { id: string; name: string; version: string }) => void;
};

type Phase = "pick" | "validating" | "summary" | "importing" | "done";

/**
 * Bill OCR package upload: ZIP → validate → summary → import.
 * Uses POST /v1/bill/datasets/import/* — not the odometer filename-GT path.
 */
export function BillZipUploadModal({ open, onClose, onImported }: Props) {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [phase, setPhase] = useState<Phase>("pick");
  const [summary, setSummary] = useState<BillImportValidationSummary | null>(
    null,
  );
  const [result, setResult] = useState<{
    id: string;
    name: string;
    version: string;
    sample_count: number;
    import_status?: string;
  } | null>(null);

  const reset = () => {
    form.resetFields();
    setFileList([]);
    setPhase("pick");
    setSummary(null);
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const file = fileList[0]?.originFileObj as File | undefined;

  const runValidate = async () => {
    if (!file) {
      message.error("Choose a bill_ocr ZIP package");
      return;
    }
    setPhase("validating");
    try {
      const res = await validateBillDatasetZip(file);
      setSummary(res);
      setPhase("summary");
      if (!res.valid && res.valid_documents === 0) {
        message.error("Package validation failed — no importable documents");
      }
    } catch (e) {
      setPhase("pick");
      message.error(getApiErrorMessage(e));
    }
  };

  const runImport = async () => {
    if (!file) return;
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setPhase("importing");
    try {
      const created = await importBillDatasetZip(file, {
        name: values.name || undefined,
        version: values.version || undefined,
        description: values.description || undefined,
        chunkSize: values.chunk_size || undefined,
        proceedWithValidOnly: true,
      });
      setResult({
        id: created.id,
        name: created.name,
        version: created.version,
        sample_count: created.sample_count,
        import_status: created.import_status as string | undefined,
      });
      setPhase("done");
      void qc.invalidateQueries({ queryKey: billDatasetKeys.all });
      message.success(
        `Imported ${created.sample_count} document(s) as ${created.name} v${created.version}`,
      );
      onImported?.({
        id: created.id,
        name: created.name,
        version: created.version,
      });
    } catch (e) {
      setPhase("summary");
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <Modal
      title="Import Bill OCR dataset ZIP"
      open={open}
      onCancel={handleClose}
      width={720}
      destroyOnHidden
      footer={
        phase === "done" ? (
          <Button type="primary" onClick={handleClose}>
            Close
          </Button>
        ) : phase === "summary" || phase === "importing" ? (
          <Space>
            <Button
              onClick={() => setPhase("pick")}
              disabled={phase === "importing"}
            >
              Back
            </Button>
            <Button onClick={handleClose} disabled={phase === "importing"}>
              Cancel
            </Button>
            <Button
              type="primary"
              disabled={
                !summary?.valid && (summary?.valid_documents ?? 0) === 0
              }
              loading={phase === "importing"}
              onClick={() => void runImport()}
            >
              Import valid documents
            </Button>
          </Space>
        ) : (
          <Space>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              type="primary"
              loading={phase === "validating"}
              onClick={() => void runValidate()}
            >
              Validate package
            </Button>
          </Space>
        )
      }
    >
      <Alert
        className="mb-3"
        type="info"
        showIcon
        message="Expected package layout"
        description={
          <Typography.Paragraph className="!mb-0 text-xs">
            <code>manifest.jsonl</code> + <code>documents/</code> + optional{" "}
            <code>annotations/</code>. Unlabeled rows (
            <code>annotation: null</code>) are valid. This is not the odometer
            filename-GT ZIP format.
          </Typography.Paragraph>
        }
      />

      {(phase === "pick" || phase === "validating") && (
        <>
          <Upload.Dragger
            accept=".zip,application/zip"
            maxCount={1}
            fileList={fileList}
            beforeUpload={() => false}
            onChange={({ fileList: fl }) => setFileList(fl)}
            disabled={phase === "validating"}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Drop bill_ocr_upload.zip here</p>
          </Upload.Dragger>
          <Form
            form={form}
            layout="vertical"
            className="mt-3"
            initialValues={{ chunk_size: 500 }}
          >
            <Form.Item name="name" label="Dataset name (optional)">
              <Input placeholder="Auto-named if empty" />
            </Form.Item>
            <Form.Item name="version" label="Version (optional)">
              <Input placeholder="e.g. v1" />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item name="chunk_size" label="Chunk size">
              <InputNumber min={50} max={100000} className="w-full" />
            </Form.Item>
          </Form>
        </>
      )}

      {(phase === "summary" || phase === "importing") && summary ? (
        <div className="space-y-3">
          <Alert
            type={summary.valid ? "success" : "warning"}
            showIcon
            message={
              summary.valid
                ? "Package can be imported"
                : "Package has blocking issues — import valid documents only if any"
            }
          />
          <div className="flex flex-wrap gap-2 text-xs">
            {(
              [
                ["Documents", summary.documents_found],
                ["Labeled", summary.labeled],
                ["Partial", summary.partial],
                ["Unlabeled", summary.unlabeled],
                ["Valid", summary.valid_documents],
                ["Invalid", summary.invalid_documents],
                ["Missing docs", summary.missing_documents],
                ["Orphan ann", summary.orphan_annotations],
                ["Dup IDs", summary.duplicate_ids],
                ["Bad ann", summary.invalid_annotations],
                ["Unsupported", summary.unsupported_files],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-1"
              >
                <span className="text-slate-500">{label}</span>{" "}
                <strong className="tabular-nums">{value}</strong>
              </div>
            ))}
          </div>
          {summary.manifest_hash ? (
            <Typography.Text type="secondary" className="text-xs font-mono">
              {summary.manifest_hash}
            </Typography.Text>
          ) : null}
          <Table
            size="small"
            rowKey={(_, i) => String(i)}
            pagination={{ pageSize: 8 }}
            dataSource={summary.issues ?? []}
            columns={[
              {
                title: "Severity",
                dataIndex: "severity",
                width: 90,
                render: (s: string) => (
                  <Tag color={s === "critical" ? "red" : "gold"}>{s}</Tag>
                ),
              },
              { title: "Code", dataIndex: "code", width: 160 },
              { title: "Message", dataIndex: "message", ellipsis: true },
              {
                title: "Document",
                dataIndex: "document_id",
                width: 120,
                render: (v: string | null | undefined) => v || "—",
              },
            ]}
            locale={{ emptyText: "No validation issues." }}
          />
        </div>
      ) : null}

      {phase === "done" && result ? (
        <Alert
          type="success"
          showIcon
          message={`Dataset ${result.name} v${result.version}`}
          description={`${result.sample_count} documents registered${
            result.import_status ? ` · ${result.import_status}` : ""
          }. Open Data list to browse.`}
        />
      ) : null}
    </Modal>
  );
}
