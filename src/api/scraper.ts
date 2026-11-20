import { apiClient } from "@/api/client";
import type {
  GeminiConfig,
  GeminiPrompt,
  PromoteToDatabankResult,
  ScraperBBox,
  ScraperCategory,
  ScraperImage,
  ScraperLabelJob,
  ScraperSession,
  ScraperSessionConfig,
  ScraperStats,
} from "@/types/scraper";

export async function getCategories(): Promise<ScraperCategory[]> {
  const { data } = await apiClient.get<{ categories: ScraperCategory[] }>(
    "/v1/scraper/categories",
  );
  return data.categories;
}

export async function createCategory(
  name: string,
  description?: string,
  ocr_type?: string,
): Promise<ScraperCategory> {
  const { data } = await apiClient.post<ScraperCategory>(
    "/v1/scraper/categories",
    { name, description, ocr_type },
  );
  return data;
}

export async function updateCategory(
  id: string,
  updates: { name?: string; description?: string },
): Promise<ScraperCategory> {
  const { data } = await apiClient.put<ScraperCategory>(
    `/v1/scraper/categories/${id}`,
    updates,
  );
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/v1/scraper/categories/${id}`);
}

export async function startScrape(
  config: ScraperSessionConfig,
): Promise<ScraperSession> {
  const { data } = await apiClient.post<ScraperSession>(
    "/v1/scraper/sessions",
    config,
  );
  return data;
}

export async function getSessions(params?: {
  category_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ sessions: ScraperSession[]; total: number }> {
  const { data } = await apiClient.get<{
    sessions: ScraperSession[];
    total: number;
  }>("/v1/scraper/sessions", { params });
  return data;
}

export async function getSession(
  id: string,
): Promise<ScraperSession & { images: ScraperImage[] }> {
  const { data } = await apiClient.get<{
    session: ScraperSession & { images: ScraperImage[] };
  }>(`/v1/scraper/sessions/${id}`);
  return data.session;
}

export async function stopSession(id: string): Promise<void> {
  await apiClient.post(`/v1/scraper/sessions/${id}/stop`);
}

export async function getImages(params?: {
  category_id?: string;
  session_id?: string;
  search?: string;
  has_ground_truth?: boolean;
  provider?: string;
  has_license?: boolean;
  min_width?: number;
  max_width?: number;
  min_height?: number;
  max_height?: number;
  sort_by?: string;
  limit?: number;
  offset?: number;
}): Promise<{ images: ScraperImage[]; total: number }> {
  const { data } = await apiClient.get<{
    images: ScraperImage[];
    total: number;
  }>("/v1/scraper/images", { params });
  return data;
}

export async function batchDeleteImages(
  imageIds: string[],
): Promise<{ deleted_count: number }> {
  const { data } = await apiClient.post<{ deleted_count: number }>(
    "/v1/scraper/images/batch-delete",
    { image_ids: imageIds },
  );
  return data;
}

export async function batchUpdateImageCategory(
  imageIds: string[],
  categoryId: string | null,
): Promise<{ updated_count: number }> {
  const { data } = await apiClient.post<{ updated_count: number }>(
    "/v1/scraper/images/batch-category",
    { image_ids: imageIds, category_id: categoryId },
  );
  return data;
}

export function getImageUrl(id: string): string {
  return apiClient.getUri({ url: `/v1/scraper/images/${id}/file` });
}

/**
 * Fetch through the configured API client so preview thumbnails also work when
 * the API is hosted on another origin or requires an X-API-Key header.
 */
export async function getImageBlob(id: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/v1/scraper/images/${id}/file`, {
    responseType: "blob",
  });
  return data;
}

export async function deleteImage(id: string): Promise<void> {
  await apiClient.delete(`/v1/scraper/images/${id}`);
}

export async function updateImageCategory(
  id: string,
  categoryId: string | null,
): Promise<ScraperImage> {
  const { data } = await apiClient.post<ScraperImage>(
    `/v1/scraper/images/${id}/category`,
    { category_id: categoryId },
  );
  return data;
}

export async function getStats(): Promise<ScraperStats> {
  const { data } = await apiClient.get<ScraperStats>("/v1/scraper/stats");
  return data;
}

export async function updateImageGroundTruth(
  id: string,
  groundTruth: string | null,
  bbox?: ScraperBBox | null,
): Promise<ScraperImage> {
  const { data } = await apiClient.put<ScraperImage>(
    `/v1/scraper/images/${id}/ground-truth`,
    { ground_truth: groundTruth, bbox: bbox ?? null },
  );
  return data;
}

export async function promoteToDatabank(
  imageIds: string[],
  opts?: { ocr_type?: string; dataset_id?: string },
): Promise<PromoteToDatabankResult> {
  const { data } = await apiClient.post<PromoteToDatabankResult>(
    "/v1/scraper/promote-to-databank",
    { image_ids: imageIds, ocr_type: opts?.ocr_type, dataset_id: opts?.dataset_id },
  );
  return data;
}

export async function startLabelJob(body: {
  category_id?: string;
  session_id?: string;
  prompt?: string;
  model?: string;
  api_key?: string;
  limit?: number;
}): Promise<ScraperLabelJob> {
  const { data } = await apiClient.post<{ job: ScraperLabelJob }>(
    "/v1/scraper/label-jobs",
    body,
  );
  return data.job;
}

export async function getLabelJob(id: string): Promise<ScraperLabelJob> {
  const { data } = await apiClient.get<{ job: ScraperLabelJob }>(
    `/v1/scraper/label-jobs/${id}`,
  );
  return data.job;
}

export async function stopLabelJob(id: string): Promise<ScraperLabelJob> {
  const { data } = await apiClient.post<{ job: ScraperLabelJob }>(
    `/v1/scraper/label-jobs/${id}/stop`,
  );
  return data.job;
}

export async function listLabelJobs(params?: {
  category_id?: string;
  limit?: number;
}): Promise<ScraperLabelJob[]> {
  const { data } = await apiClient.get<{ jobs: ScraperLabelJob[] }>(
    "/v1/scraper/label-jobs",
    { params },
  );
  return data.jobs;
}

export async function getGeminiPrompts(): Promise<GeminiPrompt[]> {
  const { data } = await apiClient.get<{ prompts: GeminiPrompt[] }>(
    "/v1/scraper/prompts",
  );
  return data.prompts;
}

export async function getGeminiConfig(): Promise<GeminiConfig> {
  const { data } = await apiClient.get<GeminiConfig>(
    "/v1/scraper/gemini-config",
  );
  return data;
}

export async function extractWithGemini(
  id: string,
  params: { prompt: string; api_key?: string; model?: string },
): Promise<{
  extracted_value: string;
  model: string;
  prompt: string;
  bbox?: ScraperBBox | null;
}> {
  const { data } = await apiClient.post<{
    extracted_value: string;
    model: string;
    prompt: string;
    bbox?: ScraperBBox | null;
  }>(`/v1/scraper/images/${id}/extract-gemini`, params);
  return data;
}
