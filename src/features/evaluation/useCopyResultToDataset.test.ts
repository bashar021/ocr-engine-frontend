import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createElement, type ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useCopyResultToDataset } from "@/features/evaluation/useEvaluationMutations";
import { server } from "@/test/mocks/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("useCopyResultToDataset", () => {
  it("copyResultToDataset posts to the copy-to-dataset endpoint", async () => {
    let body: unknown;
    server.use(
      http.post(
        "*/v1/evaluations/:evaluationId/results/:resultId/copy-to-dataset",
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({
            target_dataset_id: "t1",
            sample_id: "s1",
            filename: "x.png",
            sample_count: 3,
          });
        },
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(() => useCopyResultToDataset(), { wrapper });

    const res = await result.current.mutateAsync({
      evaluationId: "e1",
      resultId: "r1",
      targetDatasetId: "t1",
    });

    expect(res.sample_count).toBe(3);
    expect(body).toEqual({ target_dataset_id: "t1" });
  });
});
