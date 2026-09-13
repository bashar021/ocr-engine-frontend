import { useEffect, useState } from "react";
import {
  App,
  Button,
  Card,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";

import { getApiErrorMessage } from "@/api/client";
import { PageHeader } from "@/components/common/PageHeader";
import {
  useBillProfile,
  useBillProfiles,
  useUpdateBillProfile,
} from "@/features/bill/hooks";

type FieldRow = {
  key: string;
  field_name: string;
  display_name?: string;
  type?: string;
  required?: boolean;
  enabled?: boolean;
  confidence_threshold?: number;
  preferred_region?: string;
  anchors?: string[];
  search_strategy?: string;
  raw: Record<string, unknown>;
};

function toRows(fields: unknown): FieldRow[] {
  if (!Array.isArray(fields)) return [];
  return fields.map((f, i) => {
    const row = (f ?? {}) as Record<string, unknown>;
    const name = String(row.field_name ?? row.name ?? `field_${i}`);
    return {
      key: `${name}-${i}`,
      field_name: name,
      display_name: row.display_name ? String(row.display_name) : undefined,
      type: row.type ? String(row.type) : "STRING",
      required: Boolean(row.required),
      enabled: row.enabled !== false,
      confidence_threshold:
        typeof row.confidence_threshold === "number"
          ? row.confidence_threshold
          : undefined,
      preferred_region: row.preferred_region
        ? String(row.preferred_region)
        : undefined,
      anchors: Array.isArray(row.anchors) ? row.anchors.map(String) : undefined,
      search_strategy: row.search_strategy
        ? String(row.search_strategy)
        : undefined,
      raw: row,
    };
  });
}

export function BillModelsFieldsPage() {
  const { message } = App.useApp();
  const profilesQuery = useBillProfiles();
  const [profileId, setProfileId] = useState<string | undefined>();
  const profileQuery = useBillProfile(profileId);
  const updateMut = useUpdateBillProfile();
  const [rows, setRows] = useState<FieldRow[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!profileQuery.data) return;
    setRows(toRows(profileQuery.data.fields));
    setDirty(false);
  }, [profileQuery.data]);

  const profiles = profilesQuery.data?.profiles ?? [];
  const profileVersion = String(profileQuery.data?.version ?? "");

  const patchRow = (key: string, patch: Partial<FieldRow>) => {
    setDirty(true);
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  };

  const onSave = async () => {
    if (!profileId) return;
    try {
      const fields = rows
        .filter((r) => r.enabled !== false)
        .map((r) => ({
          ...r.raw,
          field_name: r.field_name,
          display_name: r.display_name,
          type: r.type,
          required: r.required,
          confidence_threshold: r.confidence_threshold,
          preferred_region: r.preferred_region,
          anchors: r.anchors,
          search_strategy: r.search_strategy,
        }));
      await updateMut.mutateAsync({ profileId, body: { fields } });
      setDirty(false);
      message.success("Saved new profile version with updated fields");
    } catch (err) {
      message.error(getApiErrorMessage(err));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Field extraction controls"
        description="Customize which fields a Bill profile extracts. Saving creates a new additive profile version."
      />
      <div className="space-y-4 p-6">
        <Card size="small">
          <Space wrap>
            <Select
              className="min-w-64"
              placeholder="Select profile"
              loading={profilesQuery.isLoading}
              value={profileId}
              options={profiles.map((p) => ({
                value: p.profile_id,
                label: `${p.name || p.profile_id} (v${p.version})`,
              }))}
              onChange={(v) => setProfileId(v)}
            />
            {profileVersion ? <Tag>Version {profileVersion}</Tag> : null}
            <Button
              type="primary"
              disabled={!profileId || !dirty}
              loading={updateMut.isPending}
              onClick={() => void onSave()}
            >
              Save as new version
            </Button>
          </Space>
        </Card>

        {!profileId ? (
          <Typography.Text type="secondary">
            Select a profile to edit field extraction controls.
          </Typography.Text>
        ) : (
          <Table
            rowKey="key"
            size="small"
            loading={profileQuery.isLoading}
            dataSource={rows}
            pagination={false}
            scroll={{ x: 960 }}
            columns={[
              {
                title: "Field",
                dataIndex: "field_name",
                fixed: "left",
                width: 160,
              },
              {
                title: "Type",
                dataIndex: "type",
                width: 130,
                render: (v: string, row) => (
                  <Select
                    size="small"
                    className="w-full"
                    value={v}
                    options={[
                      "STRING",
                      "IDENTIFIER",
                      "CURRENCY",
                      "AMOUNT",
                      "DATE",
                      "DECIMAL",
                      "INTEGER",
                    ].map((t) => ({ value: t, label: t }))}
                    onChange={(nv) => patchRow(row.key, { type: nv })}
                  />
                ),
              },
              {
                title: "Enabled",
                dataIndex: "enabled",
                width: 90,
                render: (v: boolean, row) => (
                  <Switch
                    checked={v !== false}
                    onChange={(nv) => patchRow(row.key, { enabled: nv })}
                  />
                ),
              },
              {
                title: "Required",
                dataIndex: "required",
                width: 90,
                render: (v: boolean, row) => (
                  <Switch
                    checked={Boolean(v)}
                    onChange={(nv) => patchRow(row.key, { required: nv })}
                  />
                ),
              },
              {
                title: "Confidence",
                dataIndex: "confidence_threshold",
                width: 120,
                render: (v: number | undefined, row) => (
                  <InputNumber
                    size="small"
                    min={0}
                    max={1}
                    step={0.05}
                    className="w-full"
                    value={v}
                    onChange={(nv) =>
                      patchRow(row.key, {
                        confidence_threshold: nv ?? undefined,
                      })
                    }
                  />
                ),
              },
              {
                title: "Region",
                dataIndex: "preferred_region",
                width: 140,
                render: (v: string | undefined, row) => (
                  <Input
                    size="small"
                    value={v}
                    onChange={(e) =>
                      patchRow(row.key, { preferred_region: e.target.value })
                    }
                  />
                ),
              },
              {
                title: "Anchors",
                dataIndex: "anchors",
                render: (v: string[] | undefined, row) => (
                  <Select
                    mode="tags"
                    size="small"
                    className="w-full"
                    value={v}
                    tokenSeparators={[","]}
                    onChange={(nv) => patchRow(row.key, { anchors: nv })}
                  />
                ),
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}
