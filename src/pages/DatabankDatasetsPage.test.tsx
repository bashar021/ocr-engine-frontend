import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { DatabankDatasetsPage } from "@/pages/DatabankDatasetsPage";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/test-utils";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("DatabankDatasetsPage", () => {
  it("renders Datasets page with header, KPIs, and actions", async () => {
    renderWithProviders(<DatabankDatasetsPage />, { route: "/databank/datasets" });

    // Page title and subtitle
    expect(screen.getByRole("heading", { name: "Datasets" })).toBeInTheDocument();
    expect(
      screen.getByText(/complete visibility and management for all raw data and label data datasets/i),
    ).toBeInTheDocument();

    // Top action buttons
    expect(screen.getByRole("button", { name: /create dataset/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload data/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();

    // KPI Statistic Cards
    expect(screen.getByText("Total Datasets")).toBeInTheDocument();
    expect(screen.getByText("Raw Data Datasets")).toBeInTheDocument();
    expect(screen.getByText("Label Data Datasets")).toBeInTheDocument();
    expect(screen.getAllByText("Total Samples").length).toBeGreaterThanOrEqual(1);
  });

  it("provides visibility of both raw data and label data datasets and does NOT list datasets by categories", async () => {
    renderWithProviders(<DatabankDatasetsPage />, { route: "/databank/datasets" });

    // Wait for datasets to load
    await waitFor(() => {
      // Label Data datasets
      expect(screen.getByText("data-bank")).toBeInTheDocument();
      expect(screen.getByText("curated-meters-v1")).toBeInTheDocument();

      // Raw Data dataset
      expect(screen.getByText("raw-batch-2026")).toBeInTheDocument();
    });

    // Does NOT list datasets based on categories as separate dataset rows
    expect(screen.queryByText("data-bank-reviewed")).not.toBeInTheDocument();
    expect(screen.queryByText("data-bank-blurry")).not.toBeInTheDocument();
    expect(screen.queryByText("data-bank-dead")).not.toBeInTheDocument();

    // Scope badges are rendered
    expect(screen.getAllByText("Raw Data").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Label Data").length).toBeGreaterThanOrEqual(1);

    // Categories are rendered as tags inside the row, not separate dataset entries
    expect(screen.getByText(/high_glare \(5\)/i)).toBeInTheDocument();
  });

  it("filters datasets by search query", async () => {
    renderWithProviders(<DatabankDatasetsPage />, { route: "/databank/datasets" });

    await waitFor(() => {
      expect(screen.getByText("raw-batch-2026")).toBeInTheDocument();
      expect(screen.getByText("curated-meters-v1")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search dataset name or description/i);
    fireEvent.change(searchInput, { target: { value: "raw-batch" } });

    await waitFor(() => {
      expect(screen.getByText("raw-batch-2026")).toBeInTheDocument();
      expect(screen.queryByText("curated-meters-v1")).not.toBeInTheDocument();
    });
  });

  it("opens Create Dataset modal with Name, Description, and Type options", async () => {
    renderWithProviders(<DatabankDatasetsPage />, { route: "/databank/datasets" });

    const createBtn = screen.getByRole("button", { name: /create dataset/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText("Create New Dataset")).toBeInTheDocument();
      expect(screen.getByLabelText(/dataset name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByText(/dataset purpose \/ type/i)).toBeInTheDocument();
    });
  });

  it("provides quick navigation actions to Label Data and Raw Data", async () => {
    renderWithProviders(<DatabankDatasetsPage />, { route: "/databank/datasets" });

    await waitFor(() => {
      expect(screen.getByText("curated-meters-v1")).toBeInTheDocument();
    });

    // Action buttons inside table rows
    const labelBtns = screen.getAllByRole("button", { name: /label data/i });
    expect(labelBtns.length).toBeGreaterThanOrEqual(1);

    const rawBtns = screen.getAllByRole("button", { name: /raw data/i });
    expect(rawBtns.length).toBeGreaterThanOrEqual(1);

    const sampleBtns = screen.getAllByRole("button", { name: /samples/i });
    expect(sampleBtns.length).toBeGreaterThanOrEqual(1);
  });
});
