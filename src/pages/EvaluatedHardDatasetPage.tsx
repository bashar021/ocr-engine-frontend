import {
  Alert,
  Button,
  Modal,
  Select,
  Spin,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import {
  fetchSampleImageObjectUrl,
  listEvaluationHardFailures,
} from "@/api/evaluation";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchInput } from "@/components/common/SearchInput";
import { useDatasetsQuery } from "@/features/evaluation/useDatasetsQuery";
import { useEvaluationsQuery } from "@/features/evaluation/useEvaluationsQuery";
import { useTaskContext } from "@/features/tasks/TaskContext";
import type { EvaluationResult } from "@/types/evaluation";
import { formatPercent } from "@/utils/format";
import {
  FAILURE_TYPE_DESCRIPTIONS,
  HARD_FAILURE_TYPES,
  formatFailureType,
} from "@/utils/failureTaxonomy";

const FAILURE_TYPES = [...HARD_FAILURE_TYPES, "UNKNOWN"];

function FailureMetricsStrip({
  counts,
}: {
  counts: Record<string, number>;
}) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return (
      <div className="rounded border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        No failure categories recorded.
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2 rounded border border-slate-200 bg-white px-4 py-3">
      {entries.map(([type, count]) => (
        <Tag key={type} color="volcano">
          {type}: {count}
        </Tag>
      ))}
    </div>
  );
}

function ImagePreviewModal({
  open,
  datasetId,
  sampleId,
  filename,
  onClose,
}: {
  open: boolean;
  datasetId: string;
  sampleId: string;
  filename: string | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setUrl(null);
      return;
    }
    let revoked: string | null = null;
    let cancelled = false;
    setLoading(true);
    void fetchSampleImageObjectUrl(datasetId, sampleId)
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        revoked = u;
        setUrl(u);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [open, datasetId, sampleId]);

  return (
    <Modal
      title={filename ?? "Sample image"}
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      destroyOnHidden
    >
      <Spin spinning={loading}>
        <div className="flex min-h-[320px] items-center justify-center bg-slate-50">
          {url ? (
            <img
              src={url}
              alt={filename ?? "Sample"}
              className="max-h-[70vh] max-w-full object-contain"
            />
          ) : null}
        </div>
      </Spin>
    </Modal>
  );
}

export function EvaluatedHardDatasetPage() {
  const { activeTaskKey } = useTaskContext();
  const [datasetId, setDatasetId] = useState<string | undefined>();
  const [evaluationId, setEvaluationId] = useState<string | undefined>();
  const [modelRef, setModelRef] = useState<string | undefined>();
  const [failureType, setFailureType] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [preview, setPreview] = useState<EvaluationResult | null>(null);
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  const datasetsQuery = useDatasetsQuery({
    scope: "evaluation",
    ocr_type: activeTaskKey,
    status: "ready",
    limit: 200,
  });

  const evalsQuery = useEvaluationsQuery(
    {
      ocr_type: activeTaskKey,
      dataset_id: datasetId,
      status: "completed",
      limit: 200,
      include_metrics: false,
    },
    Boolean(datasetId),
  );

  const datasetOptions = useMemo(
    () =>
      (datasetsQuery.data?.datasets ?? []).map((d) => ({
        value: d.id,
        label: `${d.name} v${d.version}`,
      })),
    [datasetsQuery.data?.datasets],
  );

  const evaluationOptions = useMemo(
    () =>
      (evalsQuery.data?.evaluations ?? []).map((e) => ({
        value: e.id,
        label: `${e.model_ref ?? "—"} · ${e.completed_at?.slice(0, 10) ?? e.id.slice(0, 8)}`,
      })),
    [evalsQuery.data?.evaluations],
  );

  const modelRefOptions = useMemo(() => {
    const refs = new Set<string>();
    for (const e of evalsQuery.data?.evaluations ?? []) {
      if (e.model_ref) refs.add(e.model_ref);
    }
    return [...refs].sort().map((r) => ({ value: r, label: r }));
  }, [evalsQuery.data?.evaluations]);

  useEffect(() => {
    if (defaultsApplied || datasetsQuery.isLoading) return;
    const first = datasetsQuery.data?.datasets?.[0];
    if (first) {
      setDatasetId(first.id);
      setDefaultsApplied(true);
    }
  }, [datasetsQuery.data?.datasets, datasetsQuery.isLoading, defaultsApplied]);

  useEffect(() => {
    if (!datasetId || evalsQuery.isLoading) return;
    const evals = evalsQuery.data?.evaluations ?? [];
    if (evals.length === 0) {
      setEvaluationId(undefined);
      setModelRef(undefined);
      return;
    }
    const latest = evals[0];
    setEvaluationId(latest.id);
    if (latest.model_ref) setModelRef(latest.model_ref);
  }, [datasetId, evalsQuery.data?.evaluations, evalsQuery.isLoading]);

  useEffect(() => {
    if (!evaluationId) return;
    const match = (evalsQuery.data?.evaluations ?? []).find(
      (e) => e.id === evaluationId,
    );
    if (match?.model_ref && match.model_ref !== modelRef) {
      setModelRef(match.model_ref);
    }
  }, [evaluationId, evalsQuery.data?.evaluations, modelRef]);

  const failuresQuery = useQuery({
    queryKey: [
      "evaluation",
      "hard-failures",
      datasetId,
      evaluationId,
      modelRef,
      failureType,
      search,
      page,
      pageSize,
    ],
    queryFn: () =>
      listEvaluationHardFailures({
        dataset_id: datasetId!,
        evaluation_id: evaluationId,
        model_ref: modelRef,
        failure_type: failureType,
        search: search || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
    enabled: Boolean(datasetId && (evaluationId || modelRef)),
  });

  const columns: ColumnsType<EvaluationResult> = [
    {
      title: "Failure type",
      dataIndex: "failure_type",
      width: 160,
      filters: FAILURE_TYPES.map((t) => ({
        text: t === "UNKNOWN" ? "Unknown" : formatFailureType(t),
        value: t,
      })),
      filteredValue: failureType ? [failureType] : null,
      onFilter: (value, row) =>
        (row.failure_type ?? "UNKNOWN").toUpperCase() === String(value),
      render: (v: string | null | undefined) =>
        v ? (
          <Tag title={FAILURE_TYPE_DESCRIPTIONS[v]}>{formatFailureType(v)}</Tag>
        ) : (
          "—"
        ),
    },
    {
      title: "Detection",
      dataIndex: "detection_outcome",
      width: 140,
      render: (v: string | null | undefined) => (v ? <Tag>{v}</Tag> : "—"),
    },
    {
      title: "Filename",
      dataIndex: "filename",
      ellipsis: true,
      width: 180,
    },
    {
      title: "Ground truth",
      dataIndex: "ground_truth_normalized",
      ellipsis: true,
      width: 120,
    },
    {
      title: "Predicted",
      dataIndex: "predicted_normalized",
      ellipsis: true,
      width: 120,
    },
    {
      title: "Confidence",
      dataIndex: "confidence",
      width: 100,
      render: (v: number | null) => formatPercent(v),
    },
    {
      title: "Det. OK",
      dataIndex: "detection_success",
      width: 80,
      render: (v: boolean | null) =>
        v == null ? "—" : v ? <Tag color="green">yes</Tag> : <Tag color="red">no</Tag>,
    },
    {
      title: "Rec. OK",
      dataIndex: "recognition_success",
      width: 80,
      render: (v: boolean | null) =>
        v == null ? "—" : v ? <Tag color="green">yes</Tag> : <Tag color="red">no</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 100,
      render: (_, row) =>
        row.image_available && row.dataset_id ? (
          <Button size="small" onClick={() => setPreview(row)}>
            View
          </Button>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader title="Evaluated hard dataset" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            placeholder="Dataset"
            className="min-w-[220px]"
            showSearch
            optionFilterProp="label"
            value={datasetId}
            options={datasetOptions}
            loading={datasetsQuery.isLoading}
            onChange={(v) => {
              setDatasetId(v);
              setEvaluationId(undefined);
              setModelRef(undefined);
              setPage(1);
            }}
          />
          <Select
            placeholder="Evaluation"
            className="min-w-[240px]"
            showSearch
            optionFilterProp="label"
            value={evaluationId}
            options={evaluationOptions}
            loading={evalsQuery.isLoading}
            disabled={!datasetId}
            onChange={(v) => {
              setEvaluationId(v);
              setPage(1);
            }}
          />
          <Select
            allowClear
            placeholder="Model ref"
            className="w-40"
            showSearch
            optionFilterProp="label"
            value={modelRef}
            options={modelRefOptions}
            disabled={!datasetId}
            onChange={(v) => {
              setModelRef(v);
              setPage(1);
            }}
          />
          <SearchInput
            className="w-52"
            placeholder="Search filename / GT…"
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
          />
          <Select
            allowClear
            placeholder="Failure type"
            className="w-44"
            options={FAILURE_TYPES.map((t) => ({ value: t, label: t }))}
            value={failureType}
            onChange={(v) => {
              setFailureType(v);
              setPage(1);
            }}
          />
        </div>

        {failuresQuery.data ? (
          <FailureMetricsStrip counts={failuresQuery.data.failure_type_counts} />
        ) : null}

        {failuresQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Failed to load hard failures"
            description={getApiErrorMessage(failuresQuery.error)}
          />
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto">
          <Table
            rowKey="id"
            size="middle"
            className="rounded-lg border border-slate-200 bg-white"
            columns={columns}
            dataSource={failuresQuery.data?.results ?? []}
            loading={failuresQuery.isLoading || failuresQuery.isFetching}
            scroll={{ x: 1100 }}
            pagination={{
              current: page,
              pageSize,
              total: failuresQuery.data?.total ?? 0,
              showSizeChanger: true,
              onChange: (p, s) => {
                setPage(p);
                setPageSize(s);
              },
            }}
          />
        </div>
      </div>

      {preview && preview.dataset_id ? (
        <ImagePreviewModal
          open={Boolean(preview)}
          datasetId={preview.dataset_id}
          sampleId={preview.dataset_sample_id}
          filename={preview.filename}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}
