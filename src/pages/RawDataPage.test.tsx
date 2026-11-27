import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { AppTopBar } from "@/components/layout/AppTopBar";
import { RawDataPage } from "@/pages/RawDataPage";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/test-utils";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("RawDataPage", () => {
  it("renders Raw Data page with dataset selector, batch buttons, and actions", async () => {
    renderWithProviders(<RawDataPage />, { route: "/databank/raw" });

    // The old title heading and description text must NOT be present
    expect(screen.queryByRole("heading", { name: "Raw Data" })).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Ingest unreviewed raw images, extract ground-truth digits via Gemini AI/i),
    ).not.toBeInTheDocument();

    // Dataset selector
    expect(screen.getByText("Dataset:")).toBeInTheDocument();

    // Batch action buttons at top bar (disabled when 0 rows are selected)
    const batchGeminiBtn = screen.getByRole("button", { name: /batch gemini gt/i });
    const moveBtn = screen.getByRole("button", { name: /move/i });
    const deleteBtn = screen.getByRole("button", { name: /delete selected/i });

    expect(batchGeminiBtn).toBeDisabled();
    expect(moveBtn).toBeDisabled();
    expect(deleteBtn).toBeDisabled();

    // Standard action buttons
    expect(screen.getByTitle("More actions")).toBeEnabled();
    expect(screen.getByRole("button", { name: /refresh/i })).toBeEnabled();

    // Metric cards
    await waitFor(() => {
      expect(screen.getByText("Total Raw Ingested")).toBeInTheDocument();
    }, { timeout: 8000 });
    expect(screen.getByText("Ground Truth Labeled")).toBeInTheDocument();
    expect(screen.getByText("Has Bounding Box")).toBeInTheDocument();
    expect(screen.getByText("Pending GT Review")).toBeInTheDocument();
    expect(screen.getByText("Failed Extraction")).toBeInTheDocument();

    // Category Short Tabs
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /all categories/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /raw \(pending\)/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /failed/i })).toBeInTheDocument();
    }, { timeout: 8000 });

    // Table columns
    await waitFor(() => {
      expect(screen.getByRole("columnheader", { name: /bounding box/i })).toBeInTheDocument();
    });

    // Filter toolbar
    expect(
      screen.getByPlaceholderText(/search by filename, ground truth, or predicted ocr string/i),
    ).toBeInTheDocument();
    expect(screen.getByText("All Raw Samples")).toBeInTheDocument();
    expect(screen.getByText("All (With & Without BBox)")).toBeInTheDocument();
  }, 25000);

  it("renders Table and Gallery view switcher at the most left side of the main OCR Platform header and shows loading state on switch", async () => {
    renderWithProviders(
      <>
        <AppTopBar />
        <RawDataPage />
      </>,
      { route: "/databank/raw" },
    );
    expect(screen.getByText("OCR Platform")).toBeInTheDocument();
    expect(screen.getByText("Table")).toBeInTheDocument();
    expect(screen.getByText("Gallery")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Gallery"));

    await waitFor(() => {
      expect(screen.getByText("Loading Gallery view...")).toBeInTheDocument();
    });
  });

  it("opens create new dataset modal on click via three dots menu", async () => {
    renderWithProviders(<RawDataPage />, { route: "/databank/raw" });

    fireEvent.click(screen.getByTitle("More actions"));
    await waitFor(() => {
      expect(screen.getByText("New Dataset")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("New Dataset"));

    await waitFor(() => {
      expect(screen.getByText("Create New Raw Dataset")).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/dataset name/i)).toBeInTheDocument();
  });

  it("isolates raw layer: dataset selector only lists raw datasets and excludes label datasets", async () => {
    renderWithProviders(<RawDataPage />, { route: "/databank/raw" });

    await waitFor(() => {
      expect(screen.getByText(/raw-batch-2026 \(/i)).toBeInTheDocument();
    });

    const selectTrigger = screen.getByText(/raw-batch-2026 \(/i);
    fireEvent.mouseDown(selectTrigger);

    // Label datasets must NOT be in the raw dataset dropdown
    expect(screen.queryByText(/^data-bank \(/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/curated-meters-v1/i)).not.toBeInTheDocument();
  });

  it(
    "displays Bounding Box column and draws bounding box overlay in modal",
    async () => {
      renderWithProviders(<RawDataPage />, { route: "/databank/raw" });

      // Wait for sample row
      await waitFor(() => {
        expect(screen.getByText("1-887512.jpg")).toBeInTheDocument();
      });

      // Check Bounding Box column header and cell tag
      expect(screen.getByRole("columnheader", { name: /bounding box/i })).toBeInTheDocument();
      const bboxTag = screen.getByText("[20, 15, 80, 65]");
      expect(bboxTag).toBeInTheDocument();

      // Click Bounding Box tag to open Review Modal
      fireEvent.click(bboxTag);

      await waitFor(() => {
        expect(screen.getByText(/inspect raw sample · 1-887512\.jpg/i)).toBeInTheDocument();
      });

      // Canvas exists in image viewer for drawing bounding box
      await waitFor(
        () => {
          expect(document.querySelector("canvas")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    },
    15000,
  );

  it(
    "opens move modal with 3 fields (dataset type, dataset, category) and moves entries",
    async () => {
      renderWithProviders(<RawDataPage />, { route: "/databank/raw" });

      // Wait for sample row
      await waitFor(() => {
        expect(screen.getByText("1-887512.jpg")).toBeInTheDocument();
      });

      // Select the row checkbox
      const rowCheckbox = screen.getAllByRole("checkbox")[1];
      fireEvent.click(rowCheckbox);

      // Move button is enabled
      const moveBtn = screen.getByRole("button", { name: /move/i });
      expect(moveBtn).toBeEnabled();

      fireEvent.click(moveBtn);

      // Modal appears
      await waitFor(() => {
        expect(screen.getByText(/move 1 selected entry/i)).toBeInTheDocument();
      });

      // Verify the 3 required fields exist in modal
      expect(screen.getByLabelText(/dataset type:/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^dataset:$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^category:$/i)).toBeInTheDocument();

      // Click confirm "Move Entries"
      const confirmMoveBtn = screen.getByRole("button", { name: /move entries/i });
      fireEvent.click(confirmMoveBtn);

      await waitFor(() => {
        expect(screen.getByText(/moved 1 sample\(s\) successfully/i)).toBeInTheDocument();
      });
    },
    30000,
  );

  it("opens Import Data from CSV modal via three dots menu", async () => {
    renderWithProviders(<RawDataPage />, { route: "/databank/raw" });

    // Find the three dots button
    const moreBtn = screen.getByTitle("More actions");
    expect(moreBtn).toBeInTheDocument();

    // Click three dots button to open dropdown
    fireEvent.click(moreBtn);

    // "Upload Raw Data", "Import Data", "Separate Duplicate", and "Export CSV" options should appear
    await waitFor(() => {
      expect(screen.getByText("Upload Raw Data")).toBeInTheDocument();
      expect(screen.getByText("Import Data")).toBeInTheDocument();
      expect(screen.getByText("Export CSV")).toBeInTheDocument();
    });

    // Click "Import Data"
    fireEvent.click(screen.getByText("Import Data"));

    // Modal opens with instructions and inputs
    await waitFor(() => {
      expect(screen.getByText("Import Data from CSV")).toBeInTheDocument();
    });

    expect(screen.getByText(/1\. Select CSV File:/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Odometer Column Header:/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. S3 URL Column Header:/i)).toBeInTheDocument();

    // Select a CSV file via file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    const csvFile = new File(
      ["odometer_value,s3_url\n12345,https://bucket.s3.amazonaws.com/a.jpg\n"],
      "data.csv",
      { type: "text/csv" },
    );
    fireEvent.change(fileInput, { target: { files: [csvFile] } });

    // Wait for file to be listed and auto-detected headers to populate or fill manually
    await waitFor(() => {
      expect(screen.getByText("data.csv")).toBeInTheDocument();
    });

    // Ensure if inputs are shown, fill them if not auto-detected yet
    const odoInput = screen.queryByPlaceholderText(/e\.g\. odometer_reading/i);
    if (odoInput) {
      fireEvent.change(odoInput, { target: { value: "odometer_value" } });
    }
    const urlInput = screen.queryByPlaceholderText(/e\.g\. s3_url or image_url/i);
    if (urlInput) {
      fireEvent.change(urlInput, { target: { value: "s3_url" } });
    }

    const startBtn = screen.getByRole("button", { name: /start import/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/CSV import accepted — downloading images in background/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/Please select a CSV file to upload\./i),
    ).not.toBeInTheDocument();
  });

  it("triggers Separate Duplicate from three dots menu", async () => {
    renderWithProviders(<RawDataPage />, { route: "/databank/raw" });

    await waitFor(() => {
      expect(screen.getByText(/raw-batch-2026 \(/i)).toBeInTheDocument();
    });

    const moreBtn = screen.getByTitle("More actions");
    fireEvent.click(moreBtn);

    await waitFor(() => {
      expect(screen.getByText("Separate Duplicate")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Separate Duplicate"));

    await waitFor(() => {
      expect(
        screen.getByText(/Duplicate separation started in background/i),
      ).toBeInTheDocument();
    });
  });
});
