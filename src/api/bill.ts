import { apiClient } from "@/api/client";
import type {
  BillDocumentResult,
  BillFeedbackItem,
  BillJobRecord,
  BillModelsResponse,
  BillProcessResponse,
  BillProfileSummary,
  BillProvidersResponse,
} from "@/types/bill";

export type ProcessBillOptions = {
  profileId?: string;
  profileVersion?: string;
  extractionSchemaJson?: string;
  forceProcess?: boolean;
  modelRef?: string;
  requestId?: string;
  signal?: AbortSignal;
};

/** Primary Bill OCR entry — sync process (blocks until complete). */
export async function processBillDocument(
  file: File,
  opts: ProcessBillOptions = {},
): Promise<BillProcessResponse> {
  const form = new FormData();
  form.append("image", file);
  if (opts.extractionSchemaJson) {
    form.append("extraction_schema_json", opts.extractionSchemaJson);
  }
  if (opts.profileId) form.append("profile_id", opts.profileId);
  if (opts.profileVersion) form.append("profile_version", opts.profileVersion);
  form.append("force_process", opts.forceProcess ? "true" : "false");
  if (opts.modelRef) form.append("model_ref", opts.modelRef);

  const { data } = await apiClient.post<BillProcessResponse>(
    "/v1/documents/process",
    form,
    {
      headers: {
        "Content-Type": "multipart/form-data",
        ...(opts.requestId ? { "X-Request-ID": opts.requestId } : {}),
      },
      timeout: 300_000,
      signal: opts.signal,
    },
  );
  return data;
}

export async function getBillJob(jobId: string): Promise<BillJobRecord> {
  const { data } = await apiClient.get<BillJobRecord>(`/v1/bill/jobs/${jobId}`);
  return data;
}

export async function getBillDocumentSummary(documentId: string) {
  const { data } = await apiClient.get<{
    document_id: string;
    job_id?: string;
    status?: string;
    document_type?: string;
    processing?: Record<string, unknown>;
  }>(`/v1/documents/${documentId}`);
  return data;
}

export async function getBillDocumentResult(
  documentId: string,
): Promise<BillDocumentResult> {
  const { data } = await apiClient.get<BillDocumentResult>(
    `/v1/documents/${documentId}/result`,
  );
  return data;
}

export type BillPagePreview = {
  page_number: number;
  page_id?: string;
  width?: number;
  height?: number;
  url?: string;
  available?: boolean;
  content_type?: string;
};

export async function listBillDocumentPages(documentId: string): Promise<{
  document_id: string;
  pages: BillPagePreview[];
  page_count: number;
}> {
  const { data } = await apiClient.get<{
    document_id: string;
    pages: BillPagePreview[];
    page_count: number;
  }>(`/v1/documents/${documentId}/pages`);
  return data;
}

/** Fetch a rendered page JPEG via the API client (supports API key). */
export async function getBillPageImageObjectUrl(
  documentId: string,
  pageNumber: number,
): Promise<string> {
  const { data } = await apiClient.get<Blob>(
    `/v1/documents/${documentId}/pages/${pageNumber}/image`,
    { responseType: "blob" },
  );
  return URL.createObjectURL(data);
}

export async function getBillDocumentEvidence(documentId: string) {
  const { data } = await apiClient.get<{
    document_id: string;
    evidence_refs?: BillDocumentResult["evidence_refs"];
    explanations?: Record<string, unknown>;
    conflicts?: unknown[];
    vlm?: unknown;
  }>(`/v1/documents/${documentId}/evidence`);
  return data;
}

export async function getBillDocumentReview(documentId: string) {
  const { data } = await apiClient.get<Record<string, unknown>>(
    `/v1/documents/${documentId}/review`,
  );
  return data;
}

export async function submitBillReviewCorrection(
  documentId: string,
  body: {
    field: string;
    corrected_value: unknown;
    original_prediction?: unknown;
    reviewer?: string;
    notes?: string;
    failure_type?: string;
    evidence?: unknown;
  },
) {
  const { data } = await apiClient.post<{
    status: string;
    feedback_id?: string;
    auto_retrain?: boolean;
    message?: string;
  }>(`/v1/documents/${documentId}/review`, body);
  return data;
}

export async function listBillProfiles(): Promise<{ profiles: BillProfileSummary[] }> {
  const { data } = await apiClient.get<{ profiles: BillProfileSummary[] }>(
    "/v1/bill/profiles",
  );
  return data;
}

export async function getBillProfile(profileId: string, version?: string) {
  const { data } = await apiClient.get<Record<string, unknown>>(
    `/v1/bill/profiles/${profileId}`,
    { params: version ? { version } : undefined },
  );
  return data;
}

export async function createBillProfile(body: Record<string, unknown>) {
  const { data } = await apiClient.post<Record<string, unknown>>(
    "/v1/bill/profiles",
    body,
  );
  return data;
}

export type ProfileVersionBody = {
  fields?: Record<string, unknown>[];
  line_items?: Record<string, unknown>;
  validation?: Record<string, unknown>;
  thresholds?: Record<string, unknown>;
  description?: string;
  version?: string;
};

export async function updateBillProfile(
  profileId: string,
  body: ProfileVersionBody,
) {
  const { data } = await apiClient.put<Record<string, unknown>>(
    `/v1/bill/profiles/${profileId}`,
    body,
  );
  return data;
}

export async function createBillProfileVersion(
  profileId: string,
  body: ProfileVersionBody,
) {
  const { data } = await apiClient.post<Record<string, unknown>>(
    `/v1/bill/profiles/${profileId}/versions`,
    body,
  );
  return data;
}

export async function processBillEvaluationSample(
  datasetId: string,
  sampleId: string,
  body: {
    profile_id?: string;
    profile_version?: string;
    model_ref?: string;
  } = {},
) {
  const { data } = await apiClient.post<{
    dataset_id: string;
    sample_id: string;
    filename?: string;
    ground_truth?: string;
    prediction?: Record<string, unknown>;
    predicted_value?: string;
    confidence?: number;
    status?: string;
  }>(`/v1/bill/datasets/${datasetId}/samples/${sampleId}/process`, body, {
    timeout: 300_000,
  });
  return data;
}

export async function processBillDatabankSample(
  datasetId: string,
  sampleId: string,
  body: {
    profile_id?: string;
    profile_version?: string;
    model_ref?: string;
  } = {},
) {
  const { data } = await apiClient.post<{
    dataset_id: string;
    sample_id: string;
    filename?: string;
    ground_truth?: string;
    prediction?: Record<string, unknown>;
    sample?: Record<string, unknown>;
  }>(
    `/v1/bill/databank/datasets/${datasetId}/samples/${sampleId}/process`,
    body,
    { timeout: 300_000 },
  );
  return data;
}

export async function validateBillSchema(schema: Record<string, unknown>) {
  const { data } = await apiClient.post<{
    valid: boolean;
    schema?: unknown;
    error?: string;
  }>("/v1/bill/schemas/validate", schema);
  return data;
}

export async function getDefaultBillSchema() {
  const { data } = await apiClient.get<Record<string, unknown>>(
    "/v1/bill/schemas/default",
  );
  return data;
}

export async function listGeneratedBillProfiles() {
  const { data } = await apiClient.get<{ drafts: unknown[] }>(
    "/v1/bill/profiles/generated",
  );
  return data;
}

export async function updateGeneratedProfileStatus(
  profileId: string,
  body: { status?: string; reviewer?: string },
) {
  const { data } = await apiClient.post(
    `/v1/bill/profiles/generated/${profileId}/status`,
    body,
  );
  return data;
}

export async function listBillFeedback(documentId?: string) {
  const { data } = await apiClient.get<{ feedback: BillFeedbackItem[] }>(
    "/v1/bill/feedback",
    { params: documentId ? { document_id: documentId } : undefined },
  );
  return data;
}

export async function exportBillFeedback() {
  const { data } = await apiClient.post<{ path?: string; count?: number }>(
    "/v1/bill/feedback/export",
  );
  return data;
}

export async function listBillProviders(): Promise<BillProvidersResponse> {
  const { data } = await apiClient.get<BillProvidersResponse>("/v1/bill/providers");
  return data;
}

export async function listBillModels(): Promise<BillModelsResponse> {
  const { data } = await apiClient.get<BillModelsResponse>("/v1/bill/models");
  return data;
}

export async function getBillFailureTaxonomy() {
  const { data } = await apiClient.get<{
    codes: string[];
    retryable: string[];
    review_required: string[];
  }>("/v1/bill/failures/taxonomy");
  return data;
}

export async function testBillProfile(
  profileId: string,
  body: { document_id: string; expected?: Record<string, unknown> },
) {
  const { data } = await apiClient.post(
    `/v1/bill/profiles/${profileId}/test`,
    body,
  );
  return data;
}
