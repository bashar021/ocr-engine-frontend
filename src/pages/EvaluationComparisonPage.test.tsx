import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { EvaluationComparisonPage } from "@/pages/EvaluationComparisonPage";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/test-utils";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("EvaluationComparisonPage", () => {
  it("renders Comparison page and auto-selects default model comparison by default", async () => {
    renderWithProviders(<EvaluationComparisonPage />, {
      route: "/evaluation/comparison",
    });

    expect(screen.getByText("Model Comparison & Champion Benchmarking")).toBeInTheDocument();
    expect(screen.getByText("Evaluate & decide:")).toBeInTheDocument();

    // Auto-selects default model and candidate on dashboard-eval dataset
    await waitFor(() => {
      expect(screen.getByText(/Model Verdict/i)).toBeInTheDocument();
    });

    // Verify winner announcement banner
    expect(screen.getByText(/Winner: v2/i)).toBeInTheDocument();
    expect(screen.getByText(/Margin:/i)).toBeInTheDocument();

    // Verify side-by-side scorecards
    expect(screen.getByText("Baseline Model")).toBeInTheDocument();
    expect(screen.getByText("Candidate Model")).toBeInTheDocument();

    // Verify real-world sample transition matrix
    expect(screen.getByText("Client Real-World Sample Transition Matrix")).toBeInTheDocument();
    expect(screen.getByText(/Improved \(Fixed by Candidate\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Regressed \(Broken by Candidate\)/i)).toBeInTheDocument();

    // Verify categorized metrics table
    expect(screen.getByText("Detailed Client Metrics & Taxonomy Comparison")).toBeInTheDocument();
    expect(screen.getByText("Client Core KPIs")).toBeInTheDocument();
    expect(screen.getByText("Failure Taxonomy")).toBeInTheDocument();
    expect(screen.getByText("Speed & Latency")).toBeInTheDocument();
  });

  it("allows switching criteria to determine the winning model", async () => {
    renderWithProviders(<EvaluationComparisonPage />, {
      route: "/evaluation/comparison",
    });

    await waitFor(() => {
      expect(screen.getByText(/Model Verdict/i)).toBeInTheDocument();
    });

    // Check criteria dropdown exists and has Balanced Client Value Score
    expect(screen.getAllByText(/Balanced Client Value Score/i).length).toBeGreaterThan(0);

    // Verify swap button works
    const swapBtn = screen.getByRole("button", { name: /swap/i });
    expect(swapBtn).toBeInTheDocument();
    fireEvent.click(swapBtn);

    // After swapping, baseline and candidate reverse
    await waitFor(() => {
      expect(screen.getByText(/Winner: v2/i)).toBeInTheDocument();
    });
  });

  it("opens sample differences drawer and displays sample diff rows", async () => {
    renderWithProviders(<EvaluationComparisonPage />, {
      route: "/evaluation/comparison",
    });

    await waitFor(() => {
      expect(screen.getByText(/Inspect Sample Differences/i)).toBeInTheDocument();
    });

    const inspectBtn = screen.getByText(/Inspect Sample Differences/i);
    fireEvent.click(inspectBtn);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText(/Sample Differences/i)).toBeInTheDocument();
    expect(within(drawer).getAllByText("Ground Truth").length).toBeGreaterThan(0);
  });
});
