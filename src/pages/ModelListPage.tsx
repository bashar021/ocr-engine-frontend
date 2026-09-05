import { CloudUploadOutlined } from "@ant-design/icons";
import { Alert, Button, Tabs } from "antd";
import { useMemo, useState } from "react";

import { getApiErrorMessage } from "@/api/client";
import { PageHeader } from "@/components/common/PageHeader";
import {
  ModelFilters,
  type ModelFilterState,
} from "@/components/models/ModelFilters";
import { ModelsTable } from "@/components/models/ModelsTable";
import { UploadModelModal } from "@/components/models/UploadModelModal";
import { useArtifactMutations } from "@/features/models/useArtifactMutations";
import { useModelsQuery } from "@/features/models/useModelsQuery";
import { useDebounce } from "@/hooks/useDebounce";

const DEFAULT_FILTERS: ModelFilterState = { search: "" };

type ModelTab = "activated" | "deactivated";

export function ModelListPage() {
  const [filters, setFilters] = useState<ModelFilterState>(DEFAULT_FILTERS);
  const [modelTab, setModelTab] = useState<ModelTab>("activated");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [uploadOpen, setUploadOpen] = useState(false);
  const debouncedSearch = useDebounce(filters.search, 300);
  const mutations = useArtifactMutations();

  const params = useMemo(() => {
    const deactivated = modelTab === "deactivated";
    const statusFilter = filters.status;
    const conflict =
      (deactivated && Boolean(statusFilter) && statusFilter !== "retired") ||
      (!deactivated && statusFilter === "retired");

    return {
      search: debouncedSearch || undefined,
      ocr_type: filters.ocr_type,
      role: filters.role,
      runtime: filters.runtime,
      // Impossible combo yields empty list when filter conflicts with tab.
      status: conflict
        ? "retired"
        : deactivated
          ? "retired"
          : statusFilter || undefined,
      exclude_status: conflict
        ? "retired"
        : deactivated
          ? undefined
          : "retired",
      limit: pageSize,
      offset: (page - 1) * pageSize,
      include_metrics: false,
    };
  }, [debouncedSearch, filters, modelTab, page, pageSize]);

  const query = useModelsQuery(params);

  const actionLoadingId = useMemo(() => {
    if (mutations.retire.isPending && mutations.retire.variables) {
      return mutations.retire.variables;
    }
    if (mutations.activate.isPending && mutations.activate.variables) {
      return mutations.activate.variables;
    }
    if (mutations.remove.isPending && mutations.remove.variables) {
      return mutations.remove.variables;
    }
    return null;
  }, [
    mutations.activate.isPending,
    mutations.activate.variables,
    mutations.remove.isPending,
    mutations.remove.variables,
    mutations.retire.isPending,
    mutations.retire.variables,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        breadcrumbs={[
          { title: "Dashboard", path: "/" },
          { title: "Models", path: "/models/list" },
          { title: "Model list" },
        ]}
        actions={
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            onClick={() => setUploadOpen(true)}
          >
            Upload model
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        <ModelFilters
          tab="models"
          value={filters}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
          total={query.data?.total}
        />
        <Tabs
          activeKey={modelTab}
          onChange={(key) => {
            setModelTab(key as ModelTab);
            setPage(1);
          }}
          items={[
            { key: "activated", label: "Activated" },
            { key: "deactivated", label: "Deactivated" },
          ]}
        />
        {query.isError ? (
          <Alert
            type="error"
            showIcon
            message="Failed to load models"
            description={getApiErrorMessage(query.error)}
            action={
              <Button size="small" onClick={() => void query.refetch()}>
                Retry
              </Button>
            }
          />
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto">
          <ModelsTable
            data={query.data?.artifacts ?? []}
            loading={query.isLoading || query.isFetching}
            total={query.data?.total ?? 0}
            page={page}
            pageSize={pageSize}
            tab={modelTab}
            actionLoadingId={actionLoadingId}
            onPageChange={(p, s) => {
              setPage(p);
              setPageSize(s);
            }}
            onDeactivate={(art) => mutations.retire.mutate(art.id)}
            onActivate={(art) => mutations.activate.mutate(art.id)}
            onDelete={(art) => mutations.remove.mutateAsync(art.id)}
          />
        </div>
      </div>
      <UploadModelModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
      />
    </div>
  );
}
