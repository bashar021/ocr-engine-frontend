import { LinkOutlined } from "@ant-design/icons";
import { Alert, Button, Tabs } from "antd";
import { useMemo, useState } from "react";

import { getApiErrorMessage } from "@/api/client";
import { PageHeader } from "@/components/common/PageHeader";
import { CreateModelRefModal } from "@/components/models/CreateModelRefModal";
import {
  ModelFilters,
  type ModelFilterState,
} from "@/components/models/ModelFilters";
import { ModelRefsTable } from "@/components/models/ModelRefsTable";
import { useModelRefsQuery } from "@/features/models/useModelRefsQuery";
import { usePipelineRefMutations } from "@/features/models/usePipelineRefMutations";
import { useDebounce } from "@/hooks/useDebounce";

const DEFAULT_FILTERS: ModelFilterState = { search: "" };

type RefTab = "activated" | "deactivated";

export function ModelRefsPage() {
  const [filters, setFilters] = useState<ModelFilterState>(DEFAULT_FILTERS);
  const [refTab, setRefTab] = useState<RefTab>("activated");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebounce(filters.search, 300);
  const mutations = usePipelineRefMutations();

  // Fetch without status filter so tabs can split activated vs deactivated.
  const params = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      ocr_type: filters.ocr_type,
      include_metrics: true,
    }),
    [debouncedSearch, filters.ocr_type],
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
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return tabRefs.slice(start, start + pageSize);
  }, [tabRefs, page, pageSize]);

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
      <PageHeader
        breadcrumbs={[
          { title: "Dashboard", path: "/" },
          { title: "Models", path: "/models/list" },
          { title: "Model refs" },
        ]}
        actions={
          <Button
            type="primary"
            icon={<LinkOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            Create model ref
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        <ModelFilters
          tab="refs"
          value={filters}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
          total={tabRefs.length}
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
            total={tabRefs.length}
            page={page}
            pageSize={pageSize}
            onPageChange={(p, s) => {
              setPage(p);
              setPageSize(s);
            }}
            actionLoadingKey={actionLoadingKey}
            onActivate={(ref, setDefault) => {
              const baseline = window.prompt(
                "Optional: baseline evaluation UUID for promotion audit (Cancel to skip)",
              );
              let candidate: string | null = null;
              if (baseline?.trim()) {
                candidate = window.prompt(
                  "Candidate evaluation UUID (post-train or compare run)",
                );
              }
              mutations.activate.mutate({
                ocrType: ref.ocr_type,
                modelRef: ref.model_ref,
                setDefault,
                ...(baseline?.trim() && candidate?.trim()
                  ? {
                      baseline_evaluation_id: baseline.trim(),
                      candidate_evaluation_id: candidate.trim(),
                    }
                  : {}),
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
    </div>
  );
}
