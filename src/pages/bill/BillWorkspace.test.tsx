import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";

import { renderWithProviders } from "@/test/test-utils";
import { server } from "@/test/mocks/server";
import { BillDocumentsPage } from "@/pages/bill/BillDocumentsPage";
import { BillSystemPage } from "@/pages/bill/BillSystemPage";
import { BillProfilesPage } from "@/pages/bill/BillProfilesPage";
import { formatBillFieldValue, normalizeBBox } from "@/types/bill";
import { AppRoutes } from "@/routes";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Bill OCR utils", () => {
  it("normalizes bbox arrays", () => {
    expect(normalizeBBox([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
    expect(normalizeBBox({ x1: 1, y1: 2, x2: 3, y2: 4 })).toEqual([1, 2, 3, 4]);
    expect(normalizeBBox(null)).toBeNull();
  });

  it("formats currency objects without inventing conversion", () => {
    expect(formatBillFieldValue({ amount: 1180, currency: "INR" })).toContain(
      "1180",
    );
    expect(formatBillFieldValue(null)).toBe("—");
  });
});

describe("Bill OCR routes", () => {
  it("renders bill documents page", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/bill/documents" element={<BillDocumentsPage />} />
      </Routes>,
      { route: "/bill/documents" },
    );
    expect(await screen.findByText(/Bill documents/i)).toBeInTheDocument();
    expect(screen.getByText(/no list-documents endpoint/i)).toBeInTheDocument();
  });

  it("renders bill system page with backend providers", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/bill/system" element={<BillSystemPage />} />
      </Routes>,
      { route: "/bill/system" },
    );
    expect(
      await screen.findByText(/Bill system \/ models/i),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Configured models/i)).toBeInTheDocument();
      expect(screen.getByText(/ocr_provider/i)).toBeInTheDocument();
    });
  });

  it("renders bill profiles from API", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/bill/profiles" element={<BillProfilesPage />} />
      </Routes>,
      { route: "/bill/profiles" },
    );
    expect(await screen.findByText(/Bill profiles/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Generic Invoice/i)).toBeInTheDocument();
    });
  });

  it("keeps odometer live OCR route available", async () => {
    renderWithProviders(<AppRoutes />, { route: "/ocr" });
    expect(await screen.findByText(/OCR Playground/i)).toBeInTheDocument();
  });
});
