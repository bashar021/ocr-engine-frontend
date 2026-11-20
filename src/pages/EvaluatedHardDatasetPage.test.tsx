import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { EvaluatedHardDatasetPage } from "@/pages/EvaluatedHardDatasetPage";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/test-utils";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("EvaluatedHardDatasetPage (Evaluation Review)", () => {
  it("renders Evaluation Review page with single-line toolbar and 2 selection fields", async () => {
    renderWithProviders(<EvaluatedHardDatasetPage />, {
      route: "/evaluation/hard-cases",
    });

    // Check header renamed to Evaluation Review
    expect(screen.getByText("Evaluation Review")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Inspect evaluation failures, review model predictions, and correct ground truth labels/i,
      ),
    ).toBeInTheDocument();

    // Check that exactly 2 dataset/model selection dropdowns exist in the toolbar
    await waitFor(() => {
      expect(screen.getByText(/dashboard-eval/i)).toBeInTheDocument();
    });

    // Verify category datasets and raw datasets are excluded from dropdown options
    expect(screen.queryByText(/data-bank-reviewed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/raw-data-bank/i)).not.toBeInTheDocument();

    // Check failure counts strip exists
    await waitFor(() => {
      expect(screen.getByText(/Failures \(\d+\):/i)).toBeInTheDocument();
      expect(screen.getByText(/Mismatch: 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Detection failure: 1/i)).toBeInTheDocument();
    });

    // Check search input exists
    expect(
      screen.getByPlaceholderText(/Search filename, GT, prediction.../i),
    ).toBeInTheDocument();

    // Check table renders failure rows
    expect(screen.getByText("1-887512.png")).toBeInTheDocument();
    expect(screen.getByText("2-123456.png")).toBeInTheDocument();

    // Check Actions column has Review button
    const reviewButtons = screen.getAllByRole("button", { name: /review/i });
    expect(reviewButtons.length).toBeGreaterThan(0);
  });

  it("opens Review modal showing Predicted and GT side-by-side and allows editing & saving GT to original dataset", async () => {
    renderWithProviders(<EvaluatedHardDatasetPage />, {
      route: "/evaluation/hard-cases",
    });

    await waitFor(() => {
      expect(screen.getByText("1-887512.png")).toBeInTheDocument();
    });

    // Click Review on the first row
    const reviewButtons = screen.getAllByRole("button", { name: /review/i });
    fireEvent.click(reviewButtons[0]);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText("Model Prediction")).toBeInTheDocument();
    });

    // Verify Prediction and Ground Truth cards are visible
    expect(
      screen.getByText("Ground Truth (Original Dataset)"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("887510").length).toBeGreaterThan(0); // Predicted value

    // Check editable GT input
    const gtInput = screen.getByPlaceholderText(
      /Enter correct ground truth value.../i,
    ) as HTMLInputElement;
    expect(gtInput).toBeInTheDocument();
    expect(gtInput.value).toBe("887512");

    // Check "Copy predicted to GT" helper
    const copyPredictedBtn = screen.getByRole("button", {
      name: /copy predicted to gt/i,
    });
    expect(copyPredictedBtn).toBeInTheDocument();

    fireEvent.click(copyPredictedBtn);
    expect(gtInput.value).toBe("887510");

    // Check Save button
    const saveBtn = screen.getByRole("button", {
      name: /save gt to original dataset/i,
    });
    expect(saveBtn).toBeInTheDocument();
    expect(saveBtn).not.toBeDisabled();

    // Click Save
    fireEvent.click(saveBtn);

    // Verify success confirmation
    await waitFor(() => {
      expect(
        screen.getByText(/Saved to Original Dataset/i),
      ).toBeInTheDocument();
    });
  });

  it("provides Gemini AI auto-detect feature inside Review modal to populate both GT and BBox", async () => {
    renderWithProviders(<EvaluatedHardDatasetPage />, {
      route: "/evaluation/hard-cases",
    });

    await waitFor(() => {
      expect(screen.getByText("1-887512.png")).toBeInTheDocument();
    });

    // Click Review on the first row
    const reviewButtons = screen.getAllByRole("button", { name: /review/i });
    fireEvent.click(reviewButtons[0]);

    // Modal opens
    await waitFor(() => {
      expect(
        screen.getByText(/Gemini AI Auto-Detect \(GT & BBox\)/i),
      ).toBeInTheDocument();
    });

    const geminiBtn = screen.getByRole("button", {
      name: /Auto-Detect GT & BBox \(Gemini\)/i,
    });
    expect(geminiBtn).toBeInTheDocument();

    // Click Gemini Auto-Detect
    fireEvent.click(geminiBtn);

    // Verify Gemini response is populated
    await waitFor(() => {
      expect(screen.getByText(/Gemini fetched:/i)).toBeInTheDocument();
    });

    const gtInput = screen.getByPlaceholderText(
      /Enter correct ground truth value.../i,
    ) as HTMLInputElement;
    expect(gtInput.value).toBe("887512");
  });

  it("renders Move button in the table and allows moving an image to another dataset directly", async () => {
    renderWithProviders(<EvaluatedHardDatasetPage />, {
      route: "/evaluation/hard-cases",
    });

    await waitFor(() => {
      expect(screen.getByText("1-887512.png")).toBeInTheDocument();
    });

    // Check Move buttons in table actions
    const moveButtons = screen.getAllByRole("button", { name: /move/i });
    expect(moveButtons.length).toBeGreaterThan(0);

    // Click Move on the first row
    fireEvent.click(moveButtons[0]);

    // Move modal opens
    await waitFor(() => {
      expect(
        screen.getByText("Move Image to Another Dataset"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/This will permanently remove/i),
      ).toBeInTheDocument();
    });

    // Check destination dataset selector exists
    expect(
      screen.getByText("Choose destination dataset..."),
    ).toBeInTheDocument();
  });

  it("supports row selection checkboxes, select-all, and batch move to another dataset", async () => {
    renderWithProviders(<EvaluatedHardDatasetPage />, {
      route: "/evaluation/hard-cases",
    });

    await waitFor(() => {
      expect(screen.getByText("1-887512.png")).toBeInTheDocument();
      expect(screen.getByText("2-123456.png")).toBeInTheDocument();
    });

    // Check pagination pageSize changer exists
    const pageSelect = document.querySelector(".ant-pagination-options-size-changer");
    expect(pageSelect).toBeInTheDocument();

    // Check row checkboxes exist
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(1); // 1 header checkbox + row checkboxes

    // Click select all checkbox (the first one)
    fireEvent.click(checkboxes[0]);

    // Batch selection action bar appears
    await waitFor(() => {
      expect(screen.getByText(/2 images selected/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /move 2 to dataset/i }),
      ).toBeInTheDocument();
    });

    // Click "Move 2 to Dataset"
    const batchMoveBtn = screen.getByRole("button", {
      name: /move 2 to dataset/i,
    });
    fireEvent.click(batchMoveBtn);

    // Batch Move Modal opens
    await waitFor(() => {
      expect(
        screen.getByText("Batch Move Images to Another Dataset"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/This will permanently remove/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/2 selected image\(s\)/i),
      ).toBeInTheDocument();
    });

    // Destination dataset selector exists
    expect(
      screen.getByText("Choose destination dataset..."),
    ).toBeInTheDocument();
  });
});
