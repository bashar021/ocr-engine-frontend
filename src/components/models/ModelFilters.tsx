import { Select } from "antd";

import { SearchInput } from "@/components/common/SearchInput";
import { DataTableToolbar } from "@/components/common/DataTableToolbar";

export type ModelsPageTab = "models" | "refs" | "overview";

export interface ModelFilterState {
  search: string;
  ocr_type?: string;
  role?: string;
  status?: string;
  runtime?: string;
}

interface ModelFiltersProps {
  tab: ModelsPageTab;
  value: ModelFilterState;
  onChange: (next: ModelFilterState) => void;
  total?: number;
}

const OCR_TYPES = [
  { value: "odometer", label: "Odometer" },
  { value: "number_plate", label: "Number plate" },
  { value: "bill", label: "Bill" },
  { value: "vin", label: "VIN" },
  { value: "document", label: "Document" },
];

const ROLES = [
  { value: "detection", label: "Detection" },
  { value: "recognition", label: "Recognition" },
];

const ARTIFACT_STATUSES = [
  { value: "uploaded", label: "Uploaded" },
  { value: "verified", label: "Verified" },
  { value: "active_eligible", label: "Active eligible" },
  { value: "retired", label: "Retired" },
  { value: "missing_file", label: "Missing file" },
  { value: "digest_mismatch", label: "Digest mismatch" },
];

const REF_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
];

const RUNTIMES = [
  { value: "pytorch", label: "PyTorch" },
  { value: "paddle", label: "Paddle" },
  { value: "onnx", label: "ONNX" },
  { value: "stub", label: "Stub" },
];

export function ModelFilters({
  tab,
  value,
  onChange,
  total,
}: ModelFiltersProps) {
  if (tab === "overview") return null;

  const countLabel =
    tab === "refs"
      ? `${total ?? 0} model ref${total === 1 ? "" : "s"}`
      : `${total ?? 0} model${total === 1 ? "" : "s"}`;

  return (
    <DataTableToolbar
      left={
        <>
          <SearchInput
            className="w-full max-w-xs"
            placeholder={
              tab === "refs"
                ? "Search model ref, notes…"
                : "Search name, version, file…"
            }
            value={value.search}
            onChange={(search) => onChange({ ...value, search })}
          />
          <Select
            allowClear
            placeholder="OCR type"
            className="w-36"
            options={OCR_TYPES}
            value={value.ocr_type}
            onChange={(ocr_type) => onChange({ ...value, ocr_type })}
          />
          {tab === "models" ? (
            <>
              <Select
                allowClear
                placeholder="Role"
                className="w-36"
                options={ROLES}
                value={value.role}
                onChange={(role) => onChange({ ...value, role })}
              />
              <Select
                allowClear
                placeholder="Status"
                className="w-40"
                options={ARTIFACT_STATUSES}
                value={value.status}
                onChange={(status) => onChange({ ...value, status })}
              />
              <Select
                allowClear
                placeholder="Runtime"
                className="w-32"
                options={RUNTIMES}
                value={value.runtime}
                onChange={(runtime) => onChange({ ...value, runtime })}
              />
            </>
          ) : (
            <Select
              allowClear
              placeholder="Status"
              className="w-36"
              options={REF_STATUSES}
              value={value.status}
              onChange={(status) => onChange({ ...value, status })}
            />
          )}
        </>
      }
      right={
        typeof total === "number" ? (
          <span className="text-sm text-slate-500">{countLabel}</span>
        ) : null
      }
    />
  );
}
