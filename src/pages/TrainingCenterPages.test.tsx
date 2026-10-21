import { screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { AugmentationDatasetPage } from "@/pages/AugmentationDatasetPage";
import { FineTuneModelPage } from "@/pages/FineTuneModelPage";
import { TrainDetectorPage } from "@/pages/TrainDetectorPage";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/test-utils";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Training Center Pages", () => {
  it("renders TrainDetectorPage with non-destructive guarantee, architectures, and launch button", async () => {
    renderWithProviders(<TrainDetectorPage />, {
      route: "/training/new-detector",
    });

    expect(screen.getByText("New Detection Model")).toBeInTheDocument();
    expect(screen.getByText("Strict Non-Destructive Guarantee")).toBeInTheDocument();
    expect(
      screen.getByText(/Original datasets are never altered/i),
    ).toBeInTheDocument();

    expect(screen.getByText("1. Source Training Datasets")).toBeInTheDocument();
    expect(screen.getByText("2. Model Architecture & Identity")).toBeInTheDocument();
    expect(screen.getByText("3. Training Hyperparameters")).toBeInTheDocument();

    const launchBtn = screen.getByRole("button", {
      name: /Launch Detection Training Run/i,
    });
    expect(launchBtn).toBeInTheDocument();
  });

  it("renders FineTuneModelPage with base artifact selector, layer freezing strategies, and transfer learning controls", async () => {
    renderWithProviders(<FineTuneModelPage />, {
      route: "/training/fine-tune",
    });

    expect(screen.getByText("Fine-tune Detection Model")).toBeInTheDocument();
    expect(screen.getByText("Strict Non-Destructive Guarantee")).toBeInTheDocument();
    expect(
      screen.getByText(/The base model artifact in the Model Registry is never modified/i),
    ).toBeInTheDocument();

    expect(screen.getByText("1. Select Base Model Checkpoint")).toBeInTheDocument();
    expect(screen.getByText("2. New Training / Hard-Case Datasets")).toBeInTheDocument();
    expect(screen.getByText("3. Transfer Learning & Layer Freezing")).toBeInTheDocument();

    // Verifies layer freezing strategies
    expect(screen.getByText(/Backbone Frozen \(freeze=10\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Partial Freeze \(freeze=5\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Full Fine-tune \(freeze=0\)/i)).toBeInTheDocument();

    const launchBtn = screen.getByRole("button", {
      name: /Launch Fine-tuning Run/i,
    });
    expect(launchBtn).toBeInTheDocument();
  });

  it("renders AugmentationDatasetPage with non-destructive badge, categories, presets, and interactive preview", async () => {
    renderWithProviders(<AugmentationDatasetPage />, {
      route: "/training/augmentation",
    });

    expect(screen.getByText("Data Augmentation")).toBeInTheDocument();
    expect(screen.getByText("Strict Non-Destructive Copy Guarantee")).toBeInTheDocument();
    expect(screen.getByText(/Original datasets are NEVER modified/i)).toBeInTheDocument();

    expect(screen.getByText("1. Select Source Dataset")).toBeInTheDocument();
    expect(screen.getByText("2. Quick Pipeline Presets")).toBeInTheDocument();

    // Verify presets
    expect(screen.getByText("Balanced Detection Mix")).toBeInTheDocument();
    expect(screen.getByText("Windshield Glare & Tilt")).toBeInTheDocument();

    // Verify preview and creation sections
    expect(screen.getByText("Interactive Live Preview")).toBeInTheDocument();
    expect(screen.getByText("4. Output Dataset Generation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Augmented Dataset/i })).toBeInTheDocument();
  });
});
