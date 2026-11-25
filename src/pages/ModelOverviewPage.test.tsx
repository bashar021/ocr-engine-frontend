import { screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ModelOverviewPage } from "@/pages/ModelOverviewPage";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/test-utils";
import { http, HttpResponse } from "msw";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("ModelOverviewPage (External & Multimodal LLMs)", () => {
  it("renders LLM Overview page with providers, key pool, and stats", async () => {
    server.use(
      http.get("*/v1/llm/overview", () => {
        return HttpResponse.json({
          summary: {
            total_calls: 42,
            successful_calls: 40,
            failed_calls: 2,
            success_rate: 95.2,
            quota_swaps_count: 3,
            avg_latency_ms: 850,
            last_activity: "2026-11-25T12:00:00Z",
          },
          providers: {
            gemini: {
              id: "gemini",
              name: "Google Gemini",
              status: "ready",
              configured: true,
              default_model: "gemini-3.5-flash-lite",
              key_pool: {
                total_keys: 2,
                active_key_masked: "AIzaSy...1234",
                active_index: 0,
                exhausted_keys_count: 0,
                standby_keys_count: 1,
                cooldown_seconds: 3600,
                keys: [
                  { index: 0, masked_key: "AIzaSy...1234", status: "active" },
                  { index: 1, masked_key: "AIzaSy...5678", status: "standby" },
                ],
              },
              stats: { calls: 35, successes: 34, failures: 1, quota_swaps: 3, avg_latency_ms: 820 },
            },
            ollama: {
              id: "ollama",
              name: "Local Ollama (Qwen2.5-VL)",
              status: "ready",
              configured: true,
              target_model: "qwen2.5vl:7b",
              base_url: "http://127.0.0.1:11434",
              model_size_bytes: 4800000000,
              stats: { calls: 7, successes: 6, failures: 1, avg_latency_ms: 950 },
            },
            openai: {
              id: "openai",
              name: "OpenAI",
              status: "not_configured",
              configured: false,
              keys_count: 0,
              default_model: "gpt-4o-mini",
              stats: { calls: 0, successes: 0, failures: 0 },
            },
          },
          future_providers: [
            {
              id: "anthropic",
              name: "Anthropic Claude",
              status: "planned",
              description: "Claude 3.7 Sonnet / Haiku",
              env_key: "ANTHROPIC_API_KEY",
            },
          ],
          by_feature: [
            {
              key: "databank_raw",
              label: "Raw Data Extraction & BBox",
              calls: 30,
              successes: 29,
              failures: 1,
              avg_latency_ms: 830,
            },
          ],
          by_model: [
            { model: "gemini-3.5-flash-lite", calls: 35, successes: 34, failures: 1, avg_latency_ms: 820 },
          ],
          prompts: {
            odometer_tight_bbox_prompt: "1. Does this image relate to a car dashboard?\n2. Does this image relate to an odometer?",
            odometer_system_instruction: "You are an automotive OCR expert.",
            visible_text_prompt: "Read all visible text.",
          },
          recent_logs: [
            {
              id: "log-1",
              timestamp: "2026-11-25T12:00:00Z",
              provider: "gemini",
              model: "gemini-3.5-flash-lite",
              feature: "databank_raw",
              success: true,
              latency_ms: 820,
              details: '{"ground_truth": "128450", "box_2d": [310, 420, 390, 680]}',
            },
          ],
        });
      })
    );

    renderWithProviders(<ModelOverviewPage />, { route: "/models/overview" });

    await waitFor(() => {
      expect(screen.getByText("Google Gemini")).toBeInTheDocument();
    });

    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Local Ollama (Vision)")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/AIzaSy...1234/)).toBeInTheDocument();
  });
});
