import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { LabelDataPage } from "@/pages/LabelDataPage";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/test-utils";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("LabelDataPage", () => {
  it("renders Label Data page with dataset selector, actions, short tabs, and filters", async () => {
    renderWithProviders(<LabelDataPage />, { route: "/databank/label-data" });

    // Header title and dataset selector
    expect(screen.getByRole("heading", { name: "Label Data" })).toBeInTheDocument();
    expect(screen.getByText("Dataset:")).toBeInTheDocument();

    // Top action buttons
    expect(screen.getByRole("button", { name: /new dataset/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /upload data/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /add category/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument();

    // Category short tabs
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /general/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /blurry/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /dead/i })).toBeInTheDocument();
    });

    // Counts near Unreviewed
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /unreviewed:/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /has gt:/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /no gt:/i })).toBeInTheDocument();
    });

    // No duplicate add category button on the tab bar
    expect(screen.queryByRole("button", { name: /new category/i })).not.toBeInTheDocument();

    // Filter controls
    expect(
      screen.getByPlaceholderText(/search filename, ground truth, or predicted/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Filters:")).toBeInTheDocument();
    expect(screen.getByText("Status: All")).toBeInTheDocument();
    expect(screen.getByText("Filename GT: All")).toBeInTheDocument();
    expect(screen.getByText("Predicted: All")).toBeInTheDocument();
    expect(screen.getByText("Match: All")).toBeInTheDocument();
    expect(screen.getByText("Final GT: All")).toBeInTheDocument();
    expect(screen.getByText("Re-run: All")).toBeInTheDocument();

    // No raw data parts
    expect(screen.queryByRole("tab", { name: /^raw$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /raw data/i })).not.toBeInTheDocument();
  }, 15000);

  it("opens create new dataset modal on click", async () => {
    renderWithProviders(<LabelDataPage />, { route: "/databank/label-data" });

    const newDsBtn = screen.getByRole("button", { name: /new dataset/i });
    fireEvent.click(newDsBtn);

    await waitFor(() => {
      expect(screen.getByText("Create New Dataset")).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/dataset name/i)).toBeInTheDocument();
  });

  it("opens add category modal on click", async () => {
    renderWithProviders(<LabelDataPage />, { route: "/databank/label-data" });

    const addCatBtn = screen.getByRole("button", { name: /add category/i });
    fireEvent.click(addCatBtn);

    await waitFor(() => {
      expect(screen.getByText(/add category to/i)).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/e\.g\. night, glare, high-contrast/i)).toBeInTheDocument();
  });

  it(
    "applies filters when clicking Reviewed, Unreviewed, Has GT, or No GT metadata pills",
    async () => {
      renderWithProviders(<LabelDataPage />, { route: "/databank/label-data" });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^reviewed:/i })).toBeInTheDocument();
      });

      // Click Reviewed
      const reviewedBtn = screen.getByRole("button", { name: /^reviewed:/i });
      fireEvent.click(reviewedBtn);

      await waitFor(() => {
        expect(screen.getByText("Status: Reviewed")).toBeInTheDocument();
      });

      // Click Unreviewed
      const unreviewedBtn = screen.getByRole("button", { name: /^unreviewed:/i });
      fireEvent.click(unreviewedBtn);

      await waitFor(() => {
        expect(screen.getByText("Status: Unreviewed")).toBeInTheDocument();
      });

      // Click Has GT
      const hasGtBtn = screen.getByRole("button", { name: /^has gt:/i });
      fireEvent.click(hasGtBtn);

      await waitFor(() => {
        expect(hasGtBtn).toHaveClass("ring-indigo-300");
      });

      // Click No GT
      const noGtBtn = screen.getByRole("button", { name: /^no gt:/i });
      fireEvent.click(noGtBtn);

      await waitFor(() => {
        expect(noGtBtn).toHaveClass("ring-rose-300");
      });
    },
    15000,
  );

  it(
    "changes category counts when clicking stats pills",
    async () => {
      renderWithProviders(<LabelDataPage />, { route: "/databank/label-data" });

      const generalTab = await screen.findByRole("tab", { name: /general/i });
      await waitFor(() => {
        expect(generalTab).toHaveTextContent("40");
      });

      // Click "Reviewed"
      const reviewedBtn = screen.getByRole("button", { name: /^reviewed:/i });
      fireEvent.click(reviewedBtn);

      await waitFor(() => {
        expect(generalTab).toHaveTextContent("15");
      });

      // Click "Unreviewed"
      const unreviewedBtn = screen.getByRole("button", { name: /^unreviewed:/i });
      fireEvent.click(unreviewedBtn);

      await waitFor(() => {
        expect(generalTab).toHaveTextContent("25");
      });

      // Click "Has GT"
      const hasGtBtn = screen.getByRole("button", { name: /^has gt:/i });
      fireEvent.click(hasGtBtn);

      await waitFor(() => {
        expect(generalTab).toHaveTextContent("30");
      });

      // Click "No GT"
      const noGtBtn = screen.getByRole("button", { name: /^no gt:/i });
      fireEvent.click(noGtBtn);

      await waitFor(() => {
        expect(generalTab).toHaveTextContent("10");
      });
    },
    15000,
  );

  it(
    "opens move to data bank modal with 2 input fields when entries are selected and moves entries",
    async () => {
      renderWithProviders(<LabelDataPage />, { route: "/databank/label-data" });

      // Wait for sample table to render row
      await waitFor(() => {
        expect(screen.getByText("1-887512.jpg")).toBeInTheDocument();
      });

      // Select the row checkbox
      const rowCheckbox = screen.getAllByRole("checkbox")[1];
      fireEvent.click(rowCheckbox);

      // Verify batch action toolbar appears with "Move to Data Bank" button
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /move to data bank/i })).toBeInTheDocument();
      });

      // Click "Move to Data Bank"
      const moveBtn = screen.getByRole("button", { name: /move to data bank/i });
      fireEvent.click(moveBtn);

      // Modal appears
      await waitFor(() => {
        expect(screen.getByText(/move 1 selected entry to data bank/i)).toBeInTheDocument();
      });

      // Check the 2 input fields exist in the modal
      expect(screen.getByLabelText(/target data bank/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/available category in data bank/i)).toBeInTheDocument();

      // Click confirm "Move Entries"
      const confirmMoveBtn = screen.getByRole("button", { name: /move entries/i });
      fireEvent.click(confirmMoveBtn);

      // Successfully called move
      await waitFor(() => {
        expect(screen.getByText(/moved 1 sample\(s\) successfully/i)).toBeInTheDocument();
      });
    },
    15000,
  );

  it(
    "includes 1000 and 10,000 page size options in table pagination",
    async () => {
      renderWithProviders(<LabelDataPage />, { route: "/databank/label-data" });

      await waitFor(() => {
        expect(screen.getByText("1-887512.jpg")).toBeInTheDocument();
      });

      const sizeChanger = screen.getByTitle(/25 \/ page/i);
      expect(sizeChanger).toBeInTheDocument();

      fireEvent.mouseDown(sizeChanger);

      await waitFor(() => {
        expect(screen.getByTitle(/1000 \/ page/i)).toBeInTheDocument();
        expect(screen.getByTitle(/10000 \/ page/i)).toBeInTheDocument();
      });
    },
    15000,
  );

  it(
    "isolates label layer: dataset selector only lists label datasets and category tabs exclude raw",
    async () => {
      renderWithProviders(<LabelDataPage />, { route: "/databank/label-data" });

      // Category tabs must never contain raw
      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /general/i })).toBeInTheDocument();
      });
      expect(screen.queryByRole("tab", { name: /^raw$/i })).not.toBeInTheDocument();

      // Find dataset select
      await waitFor(() => {
        expect(screen.getByText(/data-bank \(/i)).toBeInTheDocument();
      });

      const selectTrigger = screen.getByText(/data-bank \(/i);
      fireEvent.mouseDown(selectTrigger);

      await waitFor(() => {
        expect(screen.getByText(/curated-meters-v1/i)).toBeInTheDocument();
      });
      // Raw dataset raw-batch-2026 must NOT be in the label dataset dropdown
      expect(screen.queryByText(/raw-batch-2026/i)).not.toBeInTheDocument();
    },
    15000,
  );

  it(
    "renders Bounding Box column and draws bounding box overlay when opened",
    async () => {
      renderWithProviders(<LabelDataPage />, { route: "/databank/label-data" });

      await waitFor(() => {
        expect(screen.getByRole("columnheader", { name: /bounding box/i })).toBeInTheDocument();
        expect(screen.getByText("1-887512.jpg")).toBeInTheDocument();
      });

      const bboxTag = screen.getByText("[20, 15, 80, 65]");
      expect(bboxTag).toBeInTheDocument();

      fireEvent.click(bboxTag);

      await waitFor(() => {
        expect(screen.getByText(/review:\s*1-887512\.jpg/i)).toBeInTheDocument();
      });

      await waitFor(
        () => {
          expect(document.querySelector("canvas")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    },
    15000,
  );
});
