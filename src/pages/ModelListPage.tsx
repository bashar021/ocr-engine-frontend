import { CloudUploadOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Alert, Button, Select, Tabs } from "antd";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { getApiErrorMessage } from "@/api/client";
import { PageHeader } from "@/components/common/PageHeader";
import {
  ModelFilters,
  type ModelFilterState,
} from "@/components/models/ModelFilters";
import { ModelsTable } from "@/components/models/ModelsTable";
import { QwenModelPanel } from "@/components/models/QwenModelPanel";
import { LlmOverviewPanel } from "@/components/models/LlmOverviewPanel";
import { UploadModelModal } from "@/components/models/UploadModelModal";
import { useArtifactMutations } from "@/features/models/useArtifactMutations";
import { useModelsQuery } from "@/features/models/useModelsQuery";
import { useTaskContext } from "@/features/tasks/TaskContext";
import { useDebounce } from "@/hooks/useDebounce";

const DEFAULT_FILTERS: ModelFilterState = { search: "" };

type RoleTab = "overview" | "detection" | "recognition" | "llm";
type ActivationFilter = "activated" | "deactivated";

export function ModelListPage() {
  const { activeTaskKey } = useTaskContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [filters, setFilters] = useState<ModelFilterState>(DEFAULT_FILTERS);
  const [roleTab, setRoleTab] = useState<RoleTab>(
    tabParam === "overview" ? "overview" : tabParam === "llm" ? "llm" : "detection"
  );

  useEffect(() => {
    if (tabParam === "overview" && roleTab !== "overview") {
      setRoleTab("overview");
    } else if (tabParam === "llm" && roleTab !== "llm") {
      setRoleTab("llm");
    }
  }, [tabParam]);

  const [activationFilter, setActivationFilter] =
    useState<ActivationFilter>("activated");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [uploadOpen, setUploadOpen] = useState(false);
  const debouncedSearch = useDebounce(filters.search, 300);
  const mutations = useArtifactMutations();
  const isOverviewTab = roleTab === "overview";
  const isLlmTab = roleTab === "llm";
  const isArtifactsTab = !isOverviewTab && !isLlmTab;

  const params = useMemo(() => {
    const deactivated = activationFilter === "deactivated";
    const statusFilter = filters.status;
    const conflict =
      (deactivated && Boolean(statusFilter) && statusFilter !== "retired") ||
      (!deactivated && statusFilter === "retired");

    return {
      search: debouncedSearch || undefined,
      ocr_type: activeTaskKey,
      role: isArtifactsTab ? roleTab : undefined,
      runtime: filters.runtime,
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
  }, [
    debouncedSearch,
    filters.runtime,
    filters.status,
    activationFilter,
    activeTaskKey,
    roleTab,
    isArtifactsTab,
    page,
    pageSize,
  ]);

  const query = useModelsQuery(params, isArtifactsTab);

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
      <PageHeader title="Model list" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
        <Tabs
          activeKey={roleTab}
          onChange={(key) => {
            const nextTab = key as RoleTab;
            setRoleTab(nextTab);
            setPage(1);
            if (nextTab === "overview") {
              setSearchParams({ tab: "overview" });
            } else if (nextTab === "llm") {
              setSearchParams({ tab: "llm" });
            } else {
              setSearchParams({});
            }
          }}
          items={[
            {
              key: "overview",
              label: (
                <span className="flex items-center gap-1.5 font-medium">
                  <ThunderboltOutlined className="text-amber-500" />
                  LLM Overview
                </span>
              ),
            },
            { key: "detection", label: "Detection" },
            { key: "recognition", label: "Recognition" },
            { key: "llm", label: "Qwen Vision (Local)" },
          ]}
        />
        {isOverviewTab ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <LlmOverviewPanel />
          </div>
        ) : isLlmTab ? (
          <QwenModelPanel />
        ) : (
          <>
        <ModelFilters
          tab="models"
          value={filters}
          hideOcrType
          hideRole
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
          total={query.data?.total}
          extraFilters={
            <Select
              value={activationFilter}
              onChange={(v: ActivationFilter) => {
                setActivationFilter(v);
                setPage(1);
              }}
              className="w-40"
              options={[
                { value: "activated", label: "Activated" },
                { value: "deactivated", label: "Deactivated" },
              ]}
            />
          }
          rightActions={
            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              onClick={() => setUploadOpen(true)}
            >
              Upload model
            </Button>
          }
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
            tab={activationFilter}
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
          </>
        )}
      </div>
      <UploadModelModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
      />
    </div>
  );
}
