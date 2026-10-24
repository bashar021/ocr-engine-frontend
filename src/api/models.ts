import { apiClient } from "@/api/client";
import type {
  CreatePipelineRefPayload,
  ListArtifactsParams,
  ListArtifactsResponse,
  ListPipelineRefsParams,
  ListPipelineRefsResponse,
  ModelArtifact,
  PipelineRef,
  UploadArtifactPayload,
} from "@/types/models";

export async function listArtifacts(
  params: ListArtifactsParams = {},
): Promise<ListArtifactsResponse> {
  const { data } = await apiClient.get<ListArtifactsResponse>(
    "/v1/models/artifacts",
    {
      params: {
        ...params,
        include_metrics: params.include_metrics ?? true,
      },
    },
  );
  return data;
}

export async function listPipelineRefs(
  params: ListPipelineRefsParams = {},
): Promise<ListPipelineRefsResponse> {
  const { data } = await apiClient.get<ListPipelineRefsResponse>(
    "/v1/models/refs",
    {
      params: {
        ...params,
        include_metrics: params.include_metrics ?? true,
      },
    },
  );
  return data;
}

export async function createPipelineRef(
  payload: Omit<CreatePipelineRefPayload, "activate" | "set_default">,
): Promise<PipelineRef> {
  const { data } = await apiClient.post<PipelineRef>("/v1/models/refs", {
    ocr_type: payload.ocr_type,
    ...(payload.model_ref ? { model_ref: payload.model_ref } : {}),
    detection_artifact_id: payload.detection_artifact_id,
    recognition_artifact_id: payload.recognition_artifact_id,
    notes: payload.notes,
  });
  return data;
}

export async function suggestModelRef(
  ocrType: string,
): Promise<{ suggested_model_ref: string; next_index?: number }> {
  const { data } = await apiClient.get("/v1/models/refs/suggest", {
    params: { ocr_type: ocrType },
  });
  return data;
}

export async function suggestArtifactVersion(payload: {
  ocr_type: string;
  role: string;
  name: string;
  bump?: "major" | "minor" | "patch";
}): Promise<{ suggested_version: string; bump_level?: string }> {
  const { data } = await apiClient.post("/v1/models/artifacts/suggest-version", {
    ocr_type: payload.ocr_type,
    role: payload.role,
    name: payload.name,
    bump: payload.bump ?? "patch",
  });
  return data;
}

export async function markArtifactMainList(
  artifactId: string,
  applicable = true,
): Promise<ModelArtifact> {
  const { data } = await apiClient.post<ModelArtifact>(
    `/v1/models/artifacts/${artifactId}/main-list`,
    { applicable },
  );
  return data;
}

export async function activatePipelineRef(
  ocrType: string,
  modelRef: string,
  setDefault = false,
  audit?: {
    promotion_override?: boolean;
    promotion_reason?: string;
    baseline_evaluation_id?: string;
    candidate_evaluation_id?: string;
  },
): Promise<PipelineRef> {
  const { data } = await apiClient.post<PipelineRef>(
    `/v1/models/refs/${encodeURIComponent(ocrType)}/${encodeURIComponent(modelRef)}/activate`,
    {
      set_default: setDefault,
      ...audit,
    },
  );
  return data;
}

export async function disablePipelineRef(
  ocrType: string,
  modelRef: string,
): Promise<PipelineRef> {
  const { data } = await apiClient.post<PipelineRef>(
    `/v1/models/refs/${encodeURIComponent(ocrType)}/${encodeURIComponent(modelRef)}/disable`,
  );
  return data;
}

export async function setDefaultPipelineRef(
  ocrType: string,
  modelRef: string,
): Promise<PipelineRef> {
  const { data } = await apiClient.post<PipelineRef>(
    `/v1/models/refs/${encodeURIComponent(ocrType)}/${encodeURIComponent(modelRef)}/set-default`,
  );
  return data;
}

export async function checkPromotion(payload: {
  left_evaluation_id: string;
  right_evaluation_id: string;
  max_allowed_regressions?: number;
  min_accuracy_delta?: number;
}) {
  const { data } = await apiClient.post("/v1/models/promotion/check", payload);
  return data;
}

export async function getArtifact(id: string): Promise<ModelArtifact> {
  const { data } = await apiClient.get<ModelArtifact>(
    `/v1/models/artifacts/${id}`,
  );
  return data;
}

export async function uploadArtifact(
  payload: UploadArtifactPayload,
): Promise<ModelArtifact> {
  const form = new FormData();
  form.append("file", payload.file);
  form.append("ocr_type", payload.ocr_type);
  form.append("role", payload.role);
  form.append("name", payload.name);
  if (payload.version) form.append("version", payload.version);
  form.append("runtime", payload.runtime);
  if (payload.framework) form.append("framework", payload.framework);
  if (payload.metadata) form.append("metadata", payload.metadata);
  if (payload.training_accuracy != null) {
    form.append("training_accuracy", String(payload.training_accuracy));
  }

  const { data } = await apiClient.post<ModelArtifact>(
    "/v1/models/artifacts",
    form,
  );
  return data;
}

export async function verifyArtifact(id: string): Promise<ModelArtifact> {
  const { data } = await apiClient.post<ModelArtifact>(
    `/v1/models/artifacts/${id}/verify`,
  );
  return data;
}

export async function retireArtifact(id: string): Promise<ModelArtifact> {
  const { data } = await apiClient.post<ModelArtifact>(
    `/v1/models/artifacts/${id}/retire`,
  );
  return data;
}

export async function activateArtifact(id: string): Promise<ModelArtifact> {
  const { data } = await apiClient.post<ModelArtifact>(
    `/v1/models/artifacts/${id}/activate`,
  );
  return data;
}

export async function deleteArtifact(id: string): Promise<ModelArtifact> {
  const { data } = await apiClient.delete<ModelArtifact>(
    `/v1/models/artifacts/${id}`,
  );
  return data;
}

export async function downloadArtifact(
  id: string,
  filename: string,
): Promise<void> {
  const { data, headers } = await apiClient.get<Blob>(
    `/v1/models/artifacts/${id}/download`,
    { responseType: "blob" },
  );
  const disposition = headers["content-disposition"] ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const dl = match ? match[1] : filename;
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = dl;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type RecognitionConfigBody = Record<string, unknown>;

export interface RecognitionConfigArtifact extends ModelArtifact {
  config?: RecognitionConfigBody;
  evaluation_linkage?: {
    last_evaluation_id?: string | null;
    last_evaluated_at?: string | null;
    recommended_dataset_ids?: string[];
    created_for_comparison_with_artifact_id?: string | null;
  };
  pipeline_impl_version?: string;
  selection_strategy?: string;
  config_digest?: string;
}

export async function listRecognitionConfigs(params: {
  ocr_type?: string;
  name?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  configs: RecognitionConfigArtifact[];
  total: number;
  defaults: RecognitionConfigBody;
}> {
  const { data } = await apiClient.get("/v1/models/recognition-configs", {
    params,
  });
  return data;
}

export async function getRecognitionConfigDefaults(): Promise<{
  config: RecognitionConfigBody;
}> {
  const { data } = await apiClient.get(
    "/v1/models/recognition-configs/defaults",
  );
  return data;
}

export async function getRecognitionConfig(
  artifactId: string,
): Promise<RecognitionConfigArtifact> {
  const { data } = await apiClient.get(
    `/v1/models/recognition-configs/${artifactId}`,
  );
  return data;
}

export async function createRecognitionConfig(payload: {
  ocr_type?: string;
  name?: string;
  version?: string;
  bump?: "major" | "minor" | "patch";
  config?: RecognitionConfigBody;
  clone_from_artifact_id?: string;
}): Promise<RecognitionConfigArtifact> {
  const { data } = await apiClient.post(
    "/v1/models/recognition-configs",
    payload,
  );
  return data;
}

export async function deleteRecognitionConfig(
  artifactId: string,
): Promise<
  RecognitionConfigArtifact & {
    deleted?: boolean;
    retired?: boolean;
    message?: string;
  }
> {
  const { data } = await apiClient.delete(
    `/v1/models/recognition-configs/${artifactId}`,
  );
  return data;
}

export async function createRefFromRecognitionConfig(payload: {
  ocr_type: string;
  model_ref?: string;
  detection_artifact_id: string;
  recognition_artifact_id: string;
  activate?: boolean;
  set_default?: boolean;
}): Promise<PipelineRef & { provenance?: Record<string, unknown> }> {
  const { data } = await apiClient.post(
    "/v1/models/recognition-configs/refs",
    {
      ocr_type: payload.ocr_type,
      ...(payload.model_ref ? { model_ref: payload.model_ref } : {}),
      detection_artifact_id: payload.detection_artifact_id,
      recognition_artifact_id: payload.recognition_artifact_id,
      activate: payload.activate,
      set_default: payload.set_default,
    },
  );
  return data;
}

export interface RecognitionPreviewCase {
  result_id: string;
  dataset_id: string;
  dataset_sample_id: string;
  filename: string | null;
  ground_truth: string | null;
  predicted: string | null;
  raw_predicted?: string | null;
  is_correct: boolean | null;
  failure_type?: string | null;
  confidence?: number | null;
  error_type?: string | null;
  ocr_status?: string | null;
  fail_stage?: string | null;
  bbox: { x1: number; y1: number; x2: number; y2: number };
  bbox_source: string;
  image_path: string;
}

export interface RecognitionPreviewVisuals {
  context_image?: string;
  crop_image?: string;
  crop_size?: { width: number; height: number };
  padding_ratio?: number;
  candidate_images?: Array<{
    name: string;
    image?: string;
    error?: string;
    selected?: boolean;
    size?: { width: number; height: number };
  }>;
}

export interface RecognitionPreviewResult {
  result_id: string;
  filename?: string | null;
  ground_truth?: string | null;
  prior_predicted?: string | null;
  prior_correct?: boolean | null;
  prior_confidence?: number | null;
  failure_type?: string | null;
  error_type?: string | null;
  ocr_status?: string | null;
  fail_stage?: string | null;
  ok?: boolean;
  error?: string;
  predicted?: string;
  raw_text?: string;
  confidence?: number;
  valid?: boolean;
  matches_gt?: boolean;
  selected_candidate?: string;
  selection_strategy?: string;
  candidates?: Array<Record<string, unknown>>;
  bbox?: { x1: number; y1: number; x2: number; y2: number };
  latency_ms?: number;
  visuals?: RecognitionPreviewVisuals | null;
}

export interface RecognitionPreviewResponse {
  draft: boolean;
  finalized: boolean;
  note: string;
  summary: {
    requested: number;
    attempted: number;
    matches_gt: number;
    match_rate: number | null;
  };
  previews: RecognitionPreviewResult[];
  config_echo?: Record<string, unknown>;
}

export async function listRecognitionPreviewCases(params: {
  evaluation_id?: string;
  dataset_id?: string;
  limit?: number;
  offset?: number;
  failures_only?: boolean;
  failure_type?: string;
}): Promise<{
  evaluation_id: string;
  dataset_id: string;
  cases: RecognitionPreviewCase[];
  total: number;
  failure_type_counts?: Record<string, number>;
}> {
  const { data } = await apiClient.get(
    "/v1/models/recognition-configs/preview-cases",
    { params },
  );
  return data;
}

export async function previewRecognitionConfig(payload: {
  config: RecognitionConfigBody;
  evaluation_id?: string;
  dataset_id?: string;
  result_ids: string[];
  include_images?: boolean;
}): Promise<RecognitionPreviewResponse> {
  const { data } = await apiClient.post(
    "/v1/models/recognition-configs/preview",
    { include_images: true, ...payload },
    { timeout: 300_000 },
  );
  return data;
}
