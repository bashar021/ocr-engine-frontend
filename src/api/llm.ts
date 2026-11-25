import { apiClient } from "@/api/client";

export interface LlmKeyItem {
  index: number;
  masked_key: string;
  status: "active" | "standby" | "exhausted";
  exhausted_remaining_seconds?: number;
  exhausted_reason?: string;
}

export interface GeminiKeyPool {
  total_keys: number;
  active_key_masked: string | null;
  active_index: number;
  exhausted_keys_count: number;
  standby_keys_count: number;
  cooldown_seconds: number;
  keys: LlmKeyItem[];
}

export interface LlmProviderStats {
  calls: number;
  successes: number;
  failures: number;
  quota_swaps?: number;
  avg_latency_ms?: number;
}

export interface LlmProviderInfo {
  id: string;
  name: string;
  status: "ready" | "no_key" | "offline" | "model_missing" | "not_configured" | string;
  configured: boolean;
  default_model?: string;
  available_models?: string[];
  key_pool?: GeminiKeyPool;
  base_url?: string;
  target_model?: string;
  installed_models?: string[];
  model_size_bytes?: number | null;
  model_details?: Record<string, any>;
  ping_latency_ms?: number | null;
  keys_count?: number;
  stats: LlmProviderStats;
}

export interface FutureProviderInfo {
  id: string;
  name: string;
  status: string;
  description: string;
  env_key: string;
}

export interface LlmFeatureBreakdown {
  key: string;
  label: string;
  calls: number;
  successes: number;
  failures: number;
  avg_latency_ms: number;
}

export interface LlmModelBreakdown {
  model: string;
  calls: number;
  successes: number;
  failures: number;
  avg_latency_ms: number;
}

export interface LlmPromptLibrary {
  odometer_tight_bbox_prompt: string;
  odometer_system_instruction: string;
  visible_text_prompt: string;
}

export interface LlmLogItem {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  feature: string;
  success: boolean;
  latency_ms: number;
  details?: string | null;
  error?: string | null;
  swapped_key?: boolean;
}

export interface LlmOverviewResponse {
  summary: {
    total_calls: number;
    successful_calls: number;
    failed_calls: number;
    success_rate: number;
    quota_swaps_count: number;
    avg_latency_ms: number;
    last_activity: string | null;
  };
  providers: {
    gemini: LlmProviderInfo;
    ollama: LlmProviderInfo;
    openai: LlmProviderInfo;
  };
  future_providers?: FutureProviderInfo[];
  by_feature: LlmFeatureBreakdown[];
  by_model: LlmModelBreakdown[];
  prompts: LlmPromptLibrary;
  recent_logs: LlmLogItem[];
}

export interface TestConnectionResponse {
  success: boolean;
  latency_ms: number;
  message: string;
}

export async function getLlmOverview(): Promise<LlmOverviewResponse> {
  const { data } = await apiClient.get<LlmOverviewResponse>("/v1/llm/overview");
  return data;
}

export async function testLlmConnection(
  provider: string
): Promise<TestConnectionResponse> {
  const { data } = await apiClient.post<TestConnectionResponse>(
    "/v1/llm/test-connection",
    { provider }
  );
  return data;
}

export async function resetGeminiKeyPool(): Promise<{
  success: boolean;
  message: string;
}> {
  const { data } = await apiClient.post<{ success: boolean; message: string }>(
    "/v1/llm/reset-pool"
  );
  return data;
}
