import { LinkOutlined } from "@ant-design/icons";
import { Alert, Button, Select, Tabs } from "antd";
import { useMemo, useState } from "react";

import { getApiErrorMessage } from "@/api/client";
import { PageHeader } from "@/components/common/PageHeader";
import { CreateModelRefModal } from "@/components/models/CreateModelRefModal";
import {
  ModelFilters,
  type ModelFilterState,
} from "@/components/models/ModelFilters";
import { ModelRefMetricsModal } from "@/components/models/ModelRefMetricsModal";
import { ModelRefsTable } from "@/components/models/ModelRefsTable";
import { useModelRefsQuery } from "@/features/models/useModelRefsQuery";
import { usePipelineRefMutations } from "@/features/models/usePipelineRefMutations";
import { useTaskContext } from "@/features/tasks/TaskContext";
import { useDebounce } from "@/hooks/useDebounce";
import type { PipelineRef } from "@/types/models";

const DEFAULT_FILTERS: ModelFilterState = { search: "" };

type RefTab = "activated" | "deactivated";

type MetricSortKey =
  | "none"
  | "overall"
  | "total_images_evaluated"
  | "total_datasets_evaluated"
  | "evaluation_count_completed"
  | "detection_success_rate"
  | "recognition_exact_match_accuracy"
  | "end_to_end_accuracy"
  | "end_to_end_success_rate"
  | "latency_p50_ms"
  | "latency_p95_ms";

function metricNumber(ref: PipelineRef, key: MetricSortKey): number {
  const m = ref.evaluation_metrics;
  if (!m || key === "none" || key === "overall") return 0;
  const v = m[key as keyof typeof m];
  return typeof v === "number" && !Number.isNaN(v) ? v : -Infinity;
}

/** Higher is better for rates/counts; lower is better for latency. */
function overallScore(ref: PipelineRef): number {
  const m = ref.evaluation_metrics;
  if (!m) return -Infinity;
  const e2e = Number(m.end_to_end_accuracy ?? 0);
  const det = Number(m.detection_success_rate ?? 0);
  const rec = Number(m.recognition_exact_match_accuracy ?? 0);
  const success = Number(m.end_to_end_success_rate ?? 0);
  const lat = Number(m.latency_p50_ms ?? 0);
  const latScore = lat > 0 ? 1 / (1 + lat / 1000) : 0;
  return e2e * 0.4 + det * 0.2 + rec * 0.2 + success * 0.1 + latScore * 0.1;
}

export function ModelRefsPage() {
  const { activeTaskKey } = useTaskContext();
  const [filters, setFilters] = useState<ModelFilterState>(DEFAULT_FILTERS);
  const [refTab, setRefTab] = useState<RefTab>("activated");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [metricsRef, setMetricsRef] = useState<PipelineRef | null>(null);
  const [sortKey, setSortKey] = useState<MetricSortKey>("none");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const debouncedSearch = useDebounce(filters.search, 300);
  const mutations = usePipelineRefMutations();

  const params = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      ocr_type: activeTaskKey,
      include_metrics: true,
    }),
    [debouncedSearch, activeTaskKey],
  );

  const query = useModelRefsQuery(params);
  const refs = query.data?.refs ?? [];

  const activated = useMemo(
    () =>
      refs.filter((r) => {
        if (r.status !== "active") return false;
        if (filters.status && r.status !== filters.status) return false;
        return true;
      }),
    [refs, filters.status],
  );
  const deactivated = useMemo(
    () =>
      refs.filter((r) => {
        if (r.status === "active") return false;
        if (filters.status && r.status !== filters.status) return false;
        return true;
      }),
    [refs, filters.status],
  );

  const tabRefs = refTab === "activated" ? activated : deactivated;

  const sortedRefs = useMemo(() => {
    if (sortKey === "none") return tabRefs;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...tabRefs].sort((a, b) => {
      if (sortKey === "overall") {
        return (overallScore(a) - overallScore(b)) * dir;
      }
      const av = metricNumber(a, sortKey);
      const bv = metricNumber(b, sortKey);
      if (av === bv) return 0;
      return av < bv ? -1 * dir : 1 * dir;
    });
  }, [tabRefs, sortKey, sortDir]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRefs.slice(start, start + pageSize);
  }, [sortedRefs, page, pageSize]);

  const actionLoadingKey = useMemo(() => {
    const vars =
      mutations.activate.variables ??
      mutations.setDefault.variables ??
      mutations.disable.variables;
    if (!vars) return null;
    if (
      !mutations.activate.isPending &&
      !mutations.setDefault.isPending &&
      !mutations.disable.isPending
    ) {
      return null;
    }
    return `${vars.ocrType}/${vars.modelRef}`;
  }, [
    mutations.activate.isPending,
    mutations.activate.variables,
    mutations.disable.isPending,
    mutations.disable.variables,
    mutations.setDefault.isPending,
    mutations.setDefault.variables,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader title="Model refs" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        <ModelFilters
          tab="refs"
          value={filters}
          hideOcrType
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
          total={tabRefs.length}
          extraFilters={
            <>
              <Select
                value={sortKey}
                onChange={(v: MetricSortKey) => {
                  setSortKey(v);
                  setPage(1);
                }}
                className="w-52"
                options={[
                  { value: "none", label: "Sort: default" },
                  { value: "overall", label: "Sort: overall metrics" },
                  { value: "end_to_end_accuracy", label: "Sort: E2E accuracy" },
                  {
                    value: "end_to_end_success_rate",
                    label: "Sort: E2E success",
                  },
                  {
                    value: "detection_success_rate",
                    label: "Sort: Det. success",
                  },
                  {
                    value: "recognition_exact_match_accuracy",
                    label: "Sort: Rec. exact match",
                  },
                  { value: "latency_p50_ms", label: "Sort: Latency p50" },
                  { value: "latency_p95_ms", label: "Sort: Latency p95" },
                  {
                    value: "total_images_evaluated",
                    label: "Sort: Images evaluated",
                  },
                  {
                    value: "total_datasets_evaluated",
                    label: "Sort: Datasets evaluated",
                  },
                  {
                    value: "evaluation_count_completed",
                    label: "Sort: Eval runs",
                  },
                ]}
              />
              {sortKey !== "none" ? (
                <Select
                  value={sortDir}
                  onChange={(v: "asc" | "desc") => {
                    setSortDir(v);
                    setPage(1);
                  }}
                  className="w-32"
                  options={[
                    { value: "desc", label: "High → low" },
                    { value: "asc", label: "Low → high" },
                  ]}
                />
              ) : null}
            </>
          }
          rightActions={
            <Button
              type="primary"
              icon={<LinkOutlined />}
              onClick={() => setCreateOpen(true)}
            >
              Create model ref
            </Button>
          }
        />
        <Tabs
          activeKey={refTab}
          onChange={(key) => {
            setRefTab(key as RefTab);
            setPage(1);
          }}
          items={[
            {
              key: "activated",
              label: `Activated (${activated.length})`,
            },
            {
              key: "deactivated",
              label: `Deactivated (${deactivated.length})`,
            },
          ]}
        />
        {query.isError ? (
          <Alert
            type="error"
            showIcon
            message="Failed to load model refs"
            description={getApiErrorMessage(query.error)}
            action={
              <Button size="small" onClick={() => void query.refetch()}>
                Retry
              </Button>
            }
          />
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto">
          <ModelRefsTable
            data={paged}
            allRefs={refs}
            loading={query.isLoading || query.isFetching}
            total={sortedRefs.length}
            page={page}
            pageSize={pageSize}
            onPageChange={(p, s) => {
              setPage(p);
              setPageSize(s);
            }}
            actionLoadingKey={actionLoadingKey}
            onViewMetrics={(ref) => setMetricsRef(ref)}
            onActivate={(ref, setDefault) => {
              mutations.activate.mutate({
                ocrType: ref.ocr_type,
                modelRef: ref.model_ref,
                setDefault,
              });
            }}
            onSetDefault={(ref) => {
              mutations.setDefault.mutate({
                ocrType: ref.ocr_type,
                modelRef: ref.model_ref,
              });
            }}
            onDeactivate={(ref) => {
              mutations.disable.mutate({
                ocrType: ref.ocr_type,
                modelRef: ref.model_ref,
              });
            }}
          />
        </div>
      </div>
      <CreateModelRefModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <ModelRefMetricsModal
        open={Boolean(metricsRef)}
        refItem={metricsRef}
        onClose={() => setMetricsRef(null)}
      />
    </div>
  );
}
