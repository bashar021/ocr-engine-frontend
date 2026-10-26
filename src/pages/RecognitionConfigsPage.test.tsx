import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { RecognitionConfigsPage } from "@/pages/RecognitionConfigsPage";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/test-utils";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("RecognitionConfigsPage & Studio", () => {
  it("renders recognition configs table with candidate tags and actions", async () => {
    renderWithProviders(<RecognitionConfigsPage />, {
      route: "/models/recognition-configs",
    });

    expect(
      screen.getByRole("button", { name: /new config version/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("odometer-recognition")).toBeInTheDocument();
    });

    // Check candidate tags in row
    expect(screen.getByText("adaptive_threshold")).toBeInTheDocument();
    expect(screen.getByText("otsu_threshold")).toBeInTheDocument();

    // Check action buttons
    expect(
      screen.getByRole("button", { name: /edit/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /clone & tune/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create model ref/i }),
    ).toBeInTheDocument();
  });

  it(
    "opens studio modal, shows Otsu and Adaptive controls, and applies presets",
    async () => {
      renderWithProviders(<RecognitionConfigsPage />, {
        route: "/models/recognition-configs",
      });

      await waitFor(() => {
        expect(screen.getByText("odometer-recognition")).toBeInTheDocument();
      });

      const newBtn = screen.getByRole("button", { name: /new config version/i });
      fireEvent.click(newBtn);

      const dialog = await screen.findByRole("dialog");
      expect(
        within(dialog).getByText(/Recognition Config Studio/i),
      ).toBeInTheDocument();

      // Presets bar
      expect(within(dialog).getByText(/⚡ Otsu & Adaptive/i)).toBeInTheDocument();
      expect(within(dialog).getByText(/🌙 Night & Glare/i)).toBeInTheDocument();
      expect(within(dialog).getByText(/✨ Denoise \+ Sharp/i)).toBeInTheDocument();
      expect(within(dialog).getByText(/🚀 Full Pipeline/i)).toBeInTheDocument();

      // Candidate chips
      expect(
        within(dialog).getByRole("button", { name: /Otsu's thresholding/i }),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole("button", { name: /Adaptive thresholding/i }),
      ).toBeInTheDocument();

      // Adaptive thresholding parameter inputs
      expect(
        within(dialog).getByText(/Adaptive Thresholding \(Local Window\)/i),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText(/Block Size \(odd window 3–99\)/i),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText(/Adaptive Offset C \(-50 to 50\)/i),
      ).toBeInTheDocument();

      // Click a preset
      fireEvent.click(within(dialog).getByText(/🌙 Night & Glare/i));
    },
    15000,
  );

  it(
    "runs live test bench and displays match rate, fixed improvements, and winning candidates",
    async () => {
      renderWithProviders(<RecognitionConfigsPage />, {
        route: "/models/recognition-configs",
      });

      await waitFor(() => {
        expect(screen.getByText("odometer-recognition")).toBeInTheDocument();
      });

      // Open studio via Clone & Tune
      const cloneBtn = screen.getByRole("button", { name: /clone & tune/i });
      fireEvent.click(cloneBtn);

      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText(/Clone & Test/i)).toBeInTheDocument();

      // Open Evaluation Bench side panel from Studio
      const openBenchBtn = within(dialog).getByRole("button", {
        name: /test in evaluation bench/i,
      });
      fireEvent.click(openBenchBtn);

      // Target evaluation cases should load in the side panel drawer
      await waitFor(() => {
        expect(screen.getByText("sample1.png")).toBeInTheDocument();
      });

      // Run Live Test
      const runTestBtn = await screen.findByRole("button", {
        name: /run live test \(2\)/i,
      });
      expect(runTestBtn).toBeEnabled();
      fireEvent.click(runTestBtn);

      // Should display KPI summary header after preview
      await waitFor(() => {
        expect(screen.getByText("Draft Match Rate")).toBeInTheDocument();
      });
      expect(screen.getByText("100%")).toBeInTheDocument();
      expect(screen.getByText("+1")).toBeInTheDocument(); // +1 Fixed prior miss

      // Filter tabs
      expect(screen.getByText(/All Tested \(2\)/i)).toBeInTheDocument();
      expect(screen.getByText(/✨ Fixed \(1\)/i)).toBeInTheDocument();

      // Candidate winner tag in table
      const winnerTags = screen.getAllByText("otsu_threshold");
      expect(winnerTags.length).toBeGreaterThan(0);

      // Visual impact section rendered
      expect(
        screen.getAllByText(/Preprocessed candidate variants/i).length,
      ).toBeGreaterThan(0);
    },
    15000,
  );

  it(
    "saves immutable version after tuning",
    async () => {
      renderWithProviders(<RecognitionConfigsPage />, {
        route: "/models/recognition-configs",
      });

      await waitFor(() => {
        expect(screen.getByText("odometer-recognition")).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole("button", { name: /new config version/i }),
      );

      const dialog = await screen.findByRole("dialog");
      const saveBtn = within(dialog).getByRole("button", {
        name: /save immutable version/i,
      });

      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/Ready: odometer-recognizer-paddle v1.0.1/i),
        ).toBeInTheDocument();
      });
    },
    15000,
  );

  it(
    "supports target selector with automatic sample selection ready for live test",
    async () => {
      renderWithProviders(<RecognitionConfigsPage />, {
        route: "/models/recognition-configs",
      });

      await waitFor(() => {
        expect(screen.getByText("odometer-recognition")).toBeInTheDocument();
      });

      // Open evaluation bench side panel directly from table action
      const benchBtn = screen.getByRole("button", { name: /evaluation bench/i });
      fireEvent.click(benchBtn);

      expect(
        await screen.findByText(/Target Evaluation or Dataset/i),
      ).toBeInTheDocument();

      // Cases auto-select top samples and the button is immediately enabled
      await waitFor(
        () => {
          expect(screen.getByText("sample1.png")).toBeInTheDocument();
        },
        { timeout: 10000 },
      );

      await waitFor(
        () => {
          expect(
            screen.getByRole("button", { name: /run live test \(2\)/i }),
          ).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );

  it(
    "displays evaluation predicted vs current config predicted columns and supports failure type filtering",
    async () => {
      renderWithProviders(<RecognitionConfigsPage />, {
        route: "/models/recognition-configs",
      });

      await waitFor(() => {
        expect(screen.getByText("odometer-recognition")).toBeInTheDocument();
      });

      const benchBtn = screen.getByRole("button", { name: /evaluation bench/i });
      fireEvent.click(benchBtn);

      expect(
        await screen.findByText(/Sample Data \/ Failure Filter/i),
      ).toBeInTheDocument();

      // Shows original evaluation run banner and status
      expect(
        await screen.findByText(/Original Evaluation Run:/i),
      ).toBeInTheDocument();

      // Shows prior predicted value once cases load
      expect(await screen.findByText("887510")).toBeInTheDocument();

      // Verify columns
      expect(screen.getAllByText("Ground Truth (GT)")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Evaluation Predicted")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Original Evaluation Status")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Current Config Predicted")[0]).toBeInTheDocument();

      // Shows original evaluation failure status tag
      expect(screen.getAllByText(/MISMATCH/i)[0]).toBeInTheDocument();

      // Run live test
      const runTestBtn = await screen.findByRole("button", {
        name: /run live test \(2\)/i,
      });
      fireEvent.click(runTestBtn);

      // Verify columns after test
      await waitFor(() => {
        expect(screen.getAllByText("Impact / Delta")[0]).toBeInTheDocument();
      });
      expect(screen.getAllByText("Winning Preprocess")[0]).toBeInTheDocument();
      expect(await screen.findByText("✨ Fixed Prior Miss")).toBeInTheDocument();
    },
    15000,
  );

  it(
    "supports editing unlinked recognition config in-place and controls auto-direction",
    async () => {
      renderWithProviders(<RecognitionConfigsPage />, {
        route: "/models/recognition-configs",
      });

      await waitFor(() => {
        expect(screen.getByText("odometer-recognition")).toBeInTheDocument();
      });

      // Verify unlinked badge
      expect(screen.getByText(/unlinked \(editable\)/i)).toBeInTheDocument();

      // Click Edit
      const editBtn = screen.getByRole("button", { name: /edit/i });
      expect(editBtn).toBeEnabled();
      fireEvent.click(editBtn);

      const dialog = await screen.findByRole("dialog");
      expect(
        within(dialog).getByText(/edit recognition config/i),
      ).toBeInTheDocument();

      // Check sub-tab for orientation & wrong direction auto-correction
      const geomTab = within(dialog).getByText(/crop orientation & geometry/i);
      fireEvent.click(geomTab);

      expect(
        within(dialog).getByText(/auto-correct wrong image direction/i),
      ).toBeInTheDocument();

      // Save Changes button
      const saveChangesBtn = within(dialog).getByRole("button", {
        name: /save changes/i,
      });
      expect(saveChangesBtn).toBeInTheDocument();
      fireEvent.click(saveChangesBtn);
    },
    15000,
  );

  it(
    "supports picking more than 20 samples in evaluation bench",
    async () => {
      renderWithProviders(<RecognitionConfigsPage />, {
        route: "/models/recognition-configs",
      });

      await waitFor(() => {
        expect(screen.getByText("odometer-recognition")).toBeInTheDocument();
      });

      const benchBtn = screen.getByRole("button", { name: /evaluation bench/i });
      fireEvent.click(benchBtn);

      await waitFor(() => {
        expect(screen.getByText("sample1.png")).toBeInTheDocument();
      });

      // Quick pick buttons > 20
      expect(screen.getByRole("button", { name: /pick 50/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /pick 100/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /select all/i })).toBeInTheDocument();
    },
    15000,
  );
});
