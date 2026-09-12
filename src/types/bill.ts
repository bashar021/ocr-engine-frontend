/** Bill OCR types — mirrored from ocr-engine Bill API contracts (no mocks). */

export type BillProcessStatus =
  | "COMPLETED"
  | "REVIEW_REQUIRED"
  | "PARTIAL"
  | "FAILED"
  | string;

export type BillFieldStatus =
  | "EXTRACTED"
  | "MISSING"
  | "AMBIGUOUS"
  | "LOW_CONFIDENCE"
  | string;

export interface BillBBox {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  /** Backend often returns [x1,y1,x2,y2] */
  0?: number;
  1?: number;
  2?: number;
  3?: number;
}

export type BillBBoxLike = number[] | BillBBox | null | undefined;

export interface BillOcrBlock {
  id: string;
  text: string;
  bbox?: BillBBoxLike;
  confidence?: number;
  page_id?: string;
  reading_order?: number;
  source?: string;
  language?: string;
}

export interface BillFieldResult {
  value?: unknown;
  raw_value?: unknown;
  confidence?: number;
  status?: BillFieldStatus;
  strategy?: string;
  evidence?: unknown[];
  confidence_detail?: {
    score?: number;
    level?: string;
    components?: Record<string, number>;
    reasons?: string[];
  };
  calibration?: Record<string, unknown>;
  candidates?: unknown[];
}

export interface BillFailure {
  code: string;
  stage?: string;
  message?: string;
  severity?: string;
  retryable?: boolean;
  human_review_required?: boolean;
  field?: string | null;
  evidence?: unknown;
  metadata?: Record<string, unknown>;
}

export interface BillValidationResult {
  status?: string;
  results?: Array<{
    rule?: string;
    passed?: boolean;
    message?: string;
    field?: string;
    expected?: unknown;
    actual?: unknown;
  }>;
  failed_count?: number;
}

export interface BillProcessingMeta {
  pipeline_version?: string;
  profile_id?: string;
  profile_version?: string;
  schema_version?: string;
  stage_metrics?: Record<string, unknown>;
}

export interface BillDocumentResult {
  document_id?: string;
  document_type?: string;
  status?: BillProcessStatus;
  value?: unknown;
  fields?: Record<string, BillFieldResult>;
  line_items?: Array<Record<string, unknown>>;
  tables?: Array<Record<string, unknown>>;
  validation?: BillValidationResult;
  confidence?: {
    overall?: number;
    level?: string;
    components?: Record<string, number>;
    calibrated_confidence?: number;
    confidence_band?: string;
    calibrated?: boolean;
    [key: string]: unknown;
  };
  review?: { required?: boolean; fields?: string[] };
  processing?: BillProcessingMeta;
  failures?: BillFailure[];
  quality?: Record<string, unknown>;
  document_model?: {
    page_count?: number;
    text_block_count?: number;
    table_count?: number;
    relationship_count?: number;
  };
  conflicts?: Array<Record<string, unknown>>;
  vlm?: Record<string, unknown> | null;
  duplicate?: Record<string, unknown>;
  review_payload?: Record<string, unknown>;
  evidence_refs?: {
    ocr_blocks?: BillOcrBlock[];
    rule_candidates?: Record<string, unknown[]>;
    graph_candidates?: Record<string, unknown[]>;
    fused?: Record<string, unknown[]>;
    vlm_hints?: unknown[];
  };
  explanations?: Record<string, unknown>;
  multipage?: boolean;
  page_previews?: Array<{
    page_number: number;
    page_id?: string;
    width?: number;
    height?: number;
    url?: string;
  }>;
}

export interface BillProcessResponse {
  job_id: string;
  document_id?: string;
  status?: BillProcessStatus;
  result?: BillDocumentResult;
  validation?: BillValidationResult;
  confidence?: BillDocumentResult["confidence"];
  failures?: BillFailure[];
  processing?: BillProcessingMeta;
  review?: { required?: boolean; fields?: string[] };
  model_ref?: string;
  task?: string;
  pipeline_version?: string;
  multipage?: boolean;
  page_count?: number;
  page_previews?: BillDocumentResult["page_previews"];
}

export interface BillJobRecord {
  job_id: string;
  document_id?: string;
  status?: string;
  saved_at?: string;
  result?: BillDocumentResult;
}

export interface BillProfileSummary {
  profile_id: string;
  name?: string;
  version?: string;
  status?: string;
  field_count?: number;
  path?: string;
}

export interface BillProvidersResponse {
  providers: Array<{
    type: string;
    name: string;
    version?: string | null;
    replaceable?: boolean;
    production?: boolean;
    health?: Record<string, unknown>;
    self_hosted?: boolean;
  }>;
  readiness?: Record<string, unknown>;
  forbidden_in_production?: string[];
}

export interface BillModelsResponse {
  vlm_enabled?: boolean;
  vlm_provider?: string;
  vlm_model_name?: string;
  vlm_model_path?: string | null;
  vlm_device?: string;
  vlm_policy?: string;
  ocr_provider?: string;
  layout_provider?: string;
  table_provider?: string;
  detector_provider?: string;
  visual_provider?: string;
  heuristic_fallback?: boolean;
  pipeline_version?: string;
}

export interface BillFeedbackItem {
  feedback_id?: string;
  document_id?: string;
  field?: string;
  corrected_value?: unknown;
  original_prediction?: unknown;
  reviewer?: string;
  notes?: string;
  failure_type?: string;
  created_at?: string;
  [key: string]: unknown;
}

/** Client-side inbox record (backend has no list-documents API). */
export interface BillLocalDocument {
  id: string;
  jobId: string;
  documentId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  pageCount?: number;
  multipage?: boolean;
  status: BillProcessStatus;
  documentType?: string;
  profileId?: string;
  profileVersion?: string;
  confidenceOverall?: number;
  confidenceLevel?: string;
  reviewRequired?: boolean;
  validationStatus?: string;
  failureCodes?: string[];
  createdAt: string;
  processingMs?: number;
  /** IndexedDB blob key — original upload retained for viewer overlays */
  blobKey: string;
  /** Last known result snapshot from process response or refetch */
  resultSnapshot?: BillDocumentResult | null;
}

export function normalizeBBox(bbox: BillBBoxLike): [number, number, number, number] | null {
  if (!bbox) return null;
  if (Array.isArray(bbox) && bbox.length >= 4) {
    return [Number(bbox[0]), Number(bbox[1]), Number(bbox[2]), Number(bbox[3])];
  }
  if (typeof bbox === "object") {
    const o = bbox as BillBBox;
    if (
      o.x1 != null &&
      o.y1 != null &&
      o.x2 != null &&
      o.y2 != null
    ) {
      return [Number(o.x1), Number(o.y1), Number(o.x2), Number(o.y2)];
    }
  }
  return null;
}

export function formatBillFieldValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object" && value !== null && "amount" in value) {
    const v = value as { amount?: unknown; currency?: unknown };
    const amount = v.amount != null ? String(v.amount) : "";
    const currency = v.currency != null ? String(v.currency) : "";
    return [currency, amount].filter(Boolean).join(" ").trim() || JSON.stringify(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
