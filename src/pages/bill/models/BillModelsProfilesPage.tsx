import { Button, Card, Descriptions, Space, Table, Tag } from "antd";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/common/PageHeader";
import { BillStatusBadge } from "@/components/bill/BillBadges";
import { useBillModels, useBillProfiles } from "@/features/bill/hooks";

/**
 * Bill Models → Profiles & versions.
 * Bill extraction is profile-driven (not det/rec artifacts).
 */
export function BillModelsProfilesPage() {
  const profilesQuery = useBillProfiles();
  const modelsQuery = useBillModels();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Profiles & versions"
        description="Maintain Bill OCR extraction profile versions. Field controls live under Field extraction; providers under Pipeline."
      />
      <div className="space-y-4 p-6">
        <Card
          size="small"
          title="Active profiles"
          extra={
            <Space>
              <Button
                loading={profilesQuery.isFetching}
                onClick={() => void profilesQuery.refetch()}
              >
                Refresh
              </Button>
              <Link to="/bill/models/fields">Edit fields</Link>
            </Space>
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
                  <Link to={`/bill/profiles/${v}`}>{row.name || v}</Link>
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

        <Card size="small" title="Pipeline snapshot" loading={modelsQuery.isLoading}>
          <Descriptions size="small" bordered column={1}>
            <Descriptions.Item label="pipeline_version">
              {String(modelsQuery.data?.pipeline_version ?? "—")}
            </Descriptions.Item>
            <Descriptions.Item label="ocr_provider">
              {String(modelsQuery.data?.ocr_provider ?? "—")}
            </Descriptions.Item>
            <Descriptions.Item label="vlm_enabled">
              {modelsQuery.data?.vlm_enabled ? (
                <Tag color="green">yes</Tag>
              ) : (
                <Tag>no</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="vlm_model">
              {String(
                modelsQuery.data?.vlm_model_name ??
                  modelsQuery.data?.vlm_provider ??
                  "—",
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </div>
    </div>
  );
}
