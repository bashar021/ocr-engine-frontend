import { useState } from "react";
import {
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { Link, useParams } from "react-router-dom";

import { PageHeader } from "@/components/common/PageHeader";
import { BillStatusBadge } from "@/components/bill/BillBadges";
import {
  useBillProfile,
  useBillProfiles,
  useGeneratedBillProfiles,
  useValidateBillSchema,
} from "@/features/bill/hooks";
import { getApiErrorMessage } from "@/api/client";

export function BillProfilesPage() {
  const { message } = App.useApp();
  const profilesQuery = useBillProfiles();
  const generatedQuery = useGeneratedBillProfiles();
  const validateMut = useValidateBillSchema();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const profileQuery = useBillProfile(selectedId ?? undefined);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Bill profiles / schemas"
        description="Profile-driven extraction configuration from the Bill OCR backend. DRAFT generated profiles are never auto-active."
      />
      <div className="space-y-4 p-6">
        <Card
          size="small"
          title="Active profile store"
          extra={
            <Button
              loading={profilesQuery.isFetching}
              onClick={() => void profilesQuery.refetch()}
            >
              Refresh
            </Button>
          }
        >
          <Table
            rowKey="profile_id"
            size="small"
            loading={profilesQuery.isLoading}
            dataSource={profilesQuery.data?.profiles ?? []}
            columns={[
              {
                title: "Profile",
                dataIndex: "profile_id",
                render: (v: string, row: { name?: string }) => (
                  <Button type="link" onClick={() => setSelectedId(v)}>
                    {row.name || v}
                  </Button>
                ),
              },
              { title: "Version", dataIndex: "version" },
              {
                title: "Status",
                dataIndex: "status",
                render: (v: string) => <BillStatusBadge status={v} />,
              },
              { title: "Fields", dataIndex: "field_count" },
            ]}
          />
        </Card>

        <Card size="small" title="Generated drafts (adaptive)">
          {(generatedQuery.data?.drafts?.length ?? 0) === 0 ? (
            <Typography.Text type="secondary">
              No generated draft profiles.
            </Typography.Text>
          ) : (
            <pre className="max-h-64 overflow-auto text-xs">
              {JSON.stringify(generatedQuery.data?.drafts, null, 2)}
            </pre>
          )}
          <Typography.Paragraph type="secondary" className="!mt-2 !mb-0 text-xs">
            Drafts must not be treated as production-active until approved via
            the generated-profile status API.
          </Typography.Paragraph>
        </Card>
      </div>

      <Drawer
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        width={560}
        title={selectedId ?? "Profile"}
        extra={
          <Space>
            <Button
              loading={validateMut.isPending}
              onClick={async () => {
                if (!profileQuery.data) return;
                try {
                  const res = await validateMut.mutateAsync(
                    profileQuery.data as Record<string, unknown>,
                  );
                  if (res.valid) message.success("Schema valid");
                  else message.error(res.error || "Invalid schema");
                } catch (e) {
                  message.error(getApiErrorMessage(e));
                }
              }}
            >
              Validate
            </Button>
            {selectedId ? (
              <Link to={`/bill/profiles/${encodeURIComponent(selectedId)}`}>
                <Button type="primary">Open</Button>
              </Link>
            ) : null}
          </Space>
        }
      >
        {profileQuery.isLoading ? (
          <Typography.Text>Loading…</Typography.Text>
        ) : profileQuery.data ? (
          <>
            <Descriptions size="small" column={1} bordered className="mb-3">
              <Descriptions.Item label="ID">
                {String(profileQuery.data.profile_id ?? selectedId)}
              </Descriptions.Item>
              <Descriptions.Item label="Version">
                {String(profileQuery.data.version ?? "—")}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag>{String(profileQuery.data.status ?? "—")}</Tag>
              </Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5}>Fields</Typography.Title>
            <pre className="max-h-[60vh] overflow-auto text-xs">
              {JSON.stringify(
                profileQuery.data.fields ?? profileQuery.data,
                null,
                2,
              )}
            </pre>
          </>
        ) : (
          <Typography.Text type="danger">Profile not found</Typography.Text>
        )}
      </Drawer>
    </div>
  );
}

export function BillProfileDetailPage() {
  const { profileId: raw = "" } = useParams();
  const profileId = decodeURIComponent(raw);
  const profileQuery = useBillProfile(profileId);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        breadcrumbs={[
          { title: "Profiles", path: "/bill/profiles" },
          { title: profileId },
        ]}
        title={profileId}
        description="Full profile JSON from the Bill OCR backend."
      />
      <div className="p-6">
        <Card size="small" loading={profileQuery.isLoading}>
          <pre className="max-h-[75vh] overflow-auto text-xs">
            {JSON.stringify(profileQuery.data, null, 2)}
          </pre>
        </Card>
      </div>
    </div>
  );
}
