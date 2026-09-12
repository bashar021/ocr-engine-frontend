import { Alert, Table, Tag, Typography } from "antd";
import { Link } from "react-router-dom";
import dayjs from "dayjs";

import { getApiErrorMessage } from "@/api/client";
import { PageHeader } from "@/components/common/PageHeader";
import {
  CapabilityAlert,
  DatasetHealthBar,
} from "@/components/bill/dataset/DatasetContextBar";
import { useBillDatasetContext } from "@/features/bill/dataset/context";
import {
  useBillCanonicalDatasetsQuery,
  useBillDatasetProfilesQuery,
  useBillDatasetQuery,
  useBillDatasetsQuery,
} from "@/features/bill/dataset/hooks";

export function BillVersionsPage() {
  const { datasetId, setDatasetId, setVersion, setChunk } =
    useBillDatasetContext();
  const datasetsQuery = useBillDatasetsQuery({
    scope: "evaluation",
    limit: 200,
    offset: 0,
  });
  const datasetQuery = useBillDatasetQuery(datasetId);
  const canonicalQuery = useBillCanonicalDatasetsQuery();
  const profilesQuery = useBillDatasetProfilesQuery();

  const selected = datasetQuery.data;
  const sameName = selected
    ? (datasetsQuery.data?.datasets ?? []).filter(
        (d) => d.name === selected.name,
      )
    : [];

  const splitRows = selected?.split_counts
    ? [
        {
          key: "train",
          name: "TRAIN",
          count: selected.split_counts.train ?? 0,
        },
        {
          key: "val",
          name: "VALIDATION",
          count: selected.split_counts.val ?? 0,
        },
        {
          key: "test",
          name: "TEST",
          count: selected.split_counts.test ?? 0,
        },
      ]
    : [];

  const totalSplit = splitRows.reduce((a, r) => a + r.count, 0) || 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        breadcrumbs={[
          { title: "Datasets", path: "/bill/datasets" },
          { title: "Versions & splits" },
        ]}
        title="Versions & splits"
        description="Dataset versions are immutable rows from GET /v1/evaluation/datasets. Splits are sample metadata counts — creation must go through the backend."
      />

      <CapabilityAlert
        type="info"
        title="No client-side random split"
        detail="There is no bill-specific split assign API. Split counts shown are backend-provided. Profile versions are managed under Bill Profiles."
      />

      <DatasetHealthBar
        sampleCount={selected?.sample_count}
        splitCounts={selected?.split_counts}
      />

      <div className="space-y-6 px-4 pb-4">
        <div>
          <Typography.Title level={5}>Dataset versions</Typography.Title>
          {!datasetId ? (
            <Alert
              type="info"
              showIcon
              message="Select a dataset to see version history for that name."
            />
          ) : null}
          <Table
            size="small"
            rowKey="id"
            loading={datasetsQuery.isLoading}
            dataSource={
              datasetId ? sameName : (datasetsQuery.data?.datasets ?? [])
            }
            pagination={{ pageSize: 15 }}
            columns={[
              {
                title: "Name",
                dataIndex: "name",
                render: (n: string, row: { id: string; version: string }) => (
                  <Typography.Link
                    onClick={() => {
                      setDatasetId(row.id);
                      setVersion(row.version);
                    }}
                  >
                    {n}
                  </Typography.Link>
                ),
              },
              {
                title: "Version",
                dataIndex: "version",
                width: 90,
                render: (v: string) => `v${v}`,
              },
              {
                title: "Documents",
                dataIndex: "sample_count",
                width: 100,
              },
              {
                title: "Digest",
                dataIndex: "manifest_digest",
                ellipsis: true,
                render: (v: string | null) => v || "—",
              },
              {
                title: "Status",
                dataIndex: "status",
                width: 100,
                render: (s: string) => <Tag>{s}</Tag>,
              },
              {
                title: "Created",
                dataIndex: "created_at",
                width: 120,
                render: (v: string | null) =>
                  v ? dayjs(v).format("YYYY-MM-DD") : "—",
              },
            ]}
            locale={{ emptyText: "No versions." }}
          />
        </div>

        <div>
          <Typography.Title level={5}>
            Splits (selected dataset)
          </Typography.Title>
          {splitRows.length ? (
            <Table
              size="small"
              rowKey="key"
              dataSource={splitRows}
              pagination={false}
              columns={[
                {
                  title: "Split",
                  dataIndex: "name",
                },
                {
                  title: "Documents",
                  dataIndex: "count",
                  render: (n: number) => n.toLocaleString(),
                },
                {
                  title: "%",
                  dataIndex: "count",
                  render: (count: number) =>
                    `${((count / totalSplit) * 100).toFixed(1)}%`,
                },
                {
                  title: "",
                  dataIndex: "key",
                  render: (key: string) => (
                    <Typography.Link onClick={() => setChunk(key)}>
                      Filter workspace
                    </Typography.Link>
                  ),
                },
              ]}
            />
          ) : (
            <Typography.Text type="secondary">
              No split_counts on this dataset (or no dataset selected).
            </Typography.Text>
          )}
        </div>

        <div>
          <Typography.Title level={5}>Canonical datasets</Typography.Title>
          {canonicalQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message={getApiErrorMessage(canonicalQuery.error)}
            />
          ) : (
            <Table
              size="small"
              rowKey={(r) => String((r as { id?: string; name?: string }).id ?? (r as { name?: string }).name)}
              loading={canonicalQuery.isLoading}
              dataSource={canonicalQuery.data?.datasets ?? []}
              pagination={{ pageSize: 10 }}
              columns={[
                { title: "Name", dataIndex: "name" },
                { title: "Task", dataIndex: "task_key", width: 100 },
                {
                  title: "Versions",
                  key: "versions",
                  render: (_: unknown, row: Record<string, unknown>) =>
                    Array.isArray(row.versions) ? row.versions.length : "—",
                },
              ]}
              locale={{ emptyText: "No canonical bill datasets linked." }}
            />
          )}
        </div>

        <div>
          <Typography.Title level={5}>
            Bill profiles (schema versions)
          </Typography.Title>
          <Table
            size="small"
            rowKey="profile_id"
            loading={profilesQuery.isLoading}
            dataSource={profilesQuery.data?.profiles ?? []}
            pagination={{ pageSize: 10 }}
            columns={[
              {
                title: "Profile",
                dataIndex: "name",
                render: (n: string, row: { profile_id: string }) => (
                  <Link
                    to={`/bill/profiles/${encodeURIComponent(row.profile_id)}`}
                  >
                    {n}
                  </Link>
                ),
              },
              { title: "ID", dataIndex: "profile_id", ellipsis: true },
              {
                title: "Version",
                dataIndex: "version",
                width: 90,
                render: (v: string) => `v${v}`,
              },
              { title: "Fields", dataIndex: "field_count", width: 80 },
              {
                title: "Status",
                dataIndex: "status",
                width: 100,
                render: (s: string) => <Tag>{s}</Tag>,
              },
            ]}
            locale={{ emptyText: "No profiles." }}
          />
        </div>
      </div>
    </div>
  );
}
