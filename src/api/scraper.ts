import { apiClient } from "@/api/client";
import type {
  ScraperCategory,
  ScraperImage,
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
  limit?: number;
  offset?: number;
}): Promise<{ images: ScraperImage[]; total: number }> {
  const { data } = await apiClient.get<{
    images: ScraperImage[];
    total: number;
  }>("/v1/scraper/images", { params });
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
