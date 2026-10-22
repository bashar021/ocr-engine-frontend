import { apiClient } from "@/api/client";

export interface QwenVisionResponse {
  model: string;
  response: string;
  done_reason: string | null;
  total_duration: number | null;
  prompt_eval_count: number | null;
  eval_count: number | null;
}

export interface QwenModelStatus {
  model: string;
  ollama_base_url: string;
  available: boolean;
  size_bytes: number | null;
  modified_at: string | null;
  details: Record<string, unknown> | null;
  error: string | null;
}

export async function getQwenModelStatus(): Promise<QwenModelStatus> {
  const { data } = await apiClient.get<QwenModelStatus>("/v1/vision/qwen/status");
  return data;
}

export async function chatWithQwen(
  image: File,
  prompt: string,
): Promise<QwenVisionResponse> {
  const form = new FormData();
  form.append("image", image);
  form.append("prompt", prompt);
  const { data } = await apiClient.post<QwenVisionResponse>("/v1/vision/qwen", form);
  return data;
}
