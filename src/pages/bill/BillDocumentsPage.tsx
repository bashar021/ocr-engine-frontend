import { useMemo, useState } from "react";
import {
  App,
  Button,
  Card,
  Select,
  Space,
  Table,
  Typography,
  Upload,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import {
  InboxOutlined,
  ReloadOutlined,
  EyeOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import dayjs from "dayjs";

import { PageHeader } from "@/components/common/PageHeader";
import { BillStatusBadge, ConfidenceBadge } from "@/components/bill/BillBadges";
import {
  useBillProfiles,
  useLocalBillDocuments,
  useProcessBillDocuments,
} from "@/features/bill/hooks";
import { removeLocalBillDocument } from "@/features/bill/localDocuments";
import type { BillLocalDocument } from "@/types/bill";
import { getApiErrorMessage } from "@/api/client";

const ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf";

export function BillDocumentsPage() {
  const { message } = App.useApp();
  const [refreshKey, setRefreshKey] = useState(0);
  const docsQuery = useLocalBillDocuments(refreshKey);
  const profilesQuery = useBillProfiles();
  const processMut = useProcessBillDocuments();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [profileId, setProfileId] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [reviewOnly, setReviewOnly] = useState(false);

  const docs = useMemo(() => {
    let rows = docsQuery.data ?? [];
    if (statusFilter) rows = rows.filter((d) => d.status === statusFilter);
    if (reviewOnly) rows = rows.filter((d) => d.reviewRequired);
    return rows;
  }, [docsQuery.data, statusFilter, reviewOnly]);

  const onUpload = async () => {
    const files = fileList
      .map((f) => f.originFileObj as File | undefined)
      .filter((f): f is File => f instanceof File);
    if (!files.length) {
      message.warning("Select one or more bill images or PDFs");
      return;
    }
    try {
      const results = await processMut.mutateAsync({
        files,
        profileId,
        forceProcess: true,
      });
      const ok = results.filter((r) => r.ok).length;
      const fail = results.length - ok;
      message.success(`Processed ${ok} document(s)${fail ? `, ${fail} failed` : ""}`);
      setFileList([]);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const columns = [
    {
      title: "File",
      dataIndex: "fileName",
      render: (v: string, row: BillLocalDocument) => (
        <div>
          <Link to={`/bill/documents/${encodeURIComponent(row.documentId)}`}>
            {v}
          </Link>
          <div className="text-xs text-slate-500">{row.documentId}</div>
        </div>
      ),
    },
    {
      title: "Type",
      dataIndex: "documentType",
      width: 120,
      render: (v: string) => v || "—",
    },
    {
      title: "Pages",
      dataIndex: "pageCount",
      width: 80,
      render: (v: number | undefined) => v ?? "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 140,
      render: (v: string) => <BillStatusBadge status={v} />,
    },
    {
      title: "Review",
      dataIndex: "reviewRequired",
      width: 110,
      render: (v: boolean) =>
        v ? <BillStatusBadge status="REVIEW_REQUIRED" /> : <span>No</span>,
    },
    {
      title: "Confidence",
      key: "conf",
      width: 130,
      render: (_: unknown, row: BillLocalDocument) => (
        <ConfidenceBadge level={row.confidenceLevel} score={row.confidenceOverall} />
      ),
    },
    {
      title: "Validation",
      dataIndex: "validationStatus",
      width: 110,
      render: (v: string) => (v ? <BillStatusBadge status={v} /> : "—"),
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      width: 160,
      render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm"),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_: unknown, row: BillLocalDocument) => (
        <Space>
          <Link to={`/bill/documents/${encodeURIComponent(row.documentId)}`}>
            <Button size="small" icon={<EyeOutlined />} />
          </Link>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={async () => {
              await removeLocalBillDocument(row.id);
              setRefreshKey((k) => k + 1);
              message.success("Removed from local inbox");
            }}
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Bill documents"
        description="Upload bills/receipts for document intelligence. Results use the live Bill OCR backend — no mock data. Document list is local because the API has no list-documents endpoint."
        actions={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            Refresh
          </Button>
        }
      />
      <div className="space-y-4 p-6">
        <Card title="Upload & process" size="small">
          <Space direction="vertical" className="w-full" size="middle">
            <Upload.Dragger
              multiple
              accept={ACCEPT}
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: fl }) => setFileList(fl)}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                Drop bill images or PDFs (JPEG, PNG, WebP, PDF)
              </p>
              <p className="ant-upload-hint">
                Processing is synchronous — large PDFs may take several minutes.
              </p>
            </Upload.Dragger>
            <Space wrap>
              <Select
                allowClear
                placeholder="Profile (optional)"
                style={{ minWidth: 220 }}
                value={profileId}
                onChange={setProfileId}
                options={(profilesQuery.data?.profiles ?? []).map((p) => ({
                  value: p.profile_id,
                  label: `${p.name || p.profile_id} v${p.version ?? "?"}`,
                }))}
              />
              <Button
                type="primary"
                loading={processMut.isPending}
                onClick={() => void onUpload()}
              >
                Process {fileList.length || ""} document(s)
              </Button>
            </Space>
          </Space>
        </Card>

        <Card
          title={`Inbox (${docs.length})`}
          size="small"
          extra={
            <Space>
              <Select
                allowClear
                placeholder="Status"
                style={{ width: 160 }}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  "COMPLETED",
                  "REVIEW_REQUIRED",
                  "PARTIAL",
                  "FAILED",
                ].map((s) => ({ value: s, label: s }))}
              />
              <Button
                type={reviewOnly ? "primary" : "default"}
                onClick={() => setReviewOnly((v) => !v)}
              >
                Review required
              </Button>
            </Space>
          }
        >
          {!docs.length ? (
            <Typography.Text type="secondary">
              No bills processed yet in this browser. Upload bills to begin.
            </Typography.Text>
          ) : (
            <Table
              rowKey="id"
              size="small"
              dataSource={docs}
              columns={columns}
              pagination={{ pageSize: 20 }}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
