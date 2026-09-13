import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";

import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/mocks/server";
import { BillDatasetLayout } from "@/components/bill/dataset/BillDatasetLayout";
import { BillDatasetsPage } from "@/pages/bill/dataset/BillDatasetsPage";
import { BillDataListPage } from "@/pages/bill/dataset/BillDataListPage";
import { BillIssuesPage } from "@/pages/bill/dataset/BillIssuesPage";
import { annotationStatusFromSample } from "@/features/bill/dataset/annotationStatus";
import { BILL_DATASET_GAPS } from "@/features/bill/dataset/capabilities";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Bill dataset annotation status", () => {
  it("classifies empty GT as UNLABELED", () => {
    expect(annotationStatusFromSample({ ground_truth: "" })).toBe("UNLABELED");
    expect(annotationStatusFromSample({ ground_truth: "INV-1" })).toBe(
      "LABELED",
    );
    expect(
      annotationStatusFromSample({
        ground_truth: "x",
        metadata: { annotation_coverage: 0.4 },
      }),
    ).toBe("PARTIAL");
  });

  it("documents real backend gaps", () => {
    expect(BILL_DATASET_GAPS.length).toBeGreaterThan(3);
    expect(BILL_DATASET_GAPS.some((g) => g.includes("list"))).toBe(true);
  });
});

describe("Bill dataset workspace routes", () => {
  it("renders datasets hub", async () => {
    renderWithProviders(
      <Routes>
        <Route element={<BillDatasetLayout />}>
          <Route path="/bill/datasets" element={<BillDatasetsPage />} />
        </Route>
      </Routes>,
      { route: "/bill/datasets" },
    );
    expect(
      await screen.findByRole("heading", { name: /^Datasets$/i }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Bill OCR package import/i)).toBeInTheDocument();
    });
  });

  it("renders bill databank data list", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/bill/data" element={<BillDataListPage />} />
      </Routes>,
      { route: "/bill/data" },
    );
    expect(
      await screen.findByRole("heading", { name: /Bill data list/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Bill-only databank/i)).toBeInTheDocument();
  });

  it("renders issues with taxonomy", async () => {
    renderWithProviders(
      <Routes>
        <Route element={<BillDatasetLayout />}>
          <Route path="/bill/issues" element={<BillIssuesPage />} />
        </Route>
      </Routes>,
      { route: "/bill/issues" },
    );
    expect(
      await screen.findByRole("heading", { name: /^Issues$/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Import issues are persisted on the dataset/i),
    ).toBeInTheDocument();
  });
});
