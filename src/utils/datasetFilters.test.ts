import { describe, expect, it } from "vitest";

import {
  isCategoryDataset,
  isCategoryDatasetName,
  isRawDataset,
  isRealLabelDataset,
} from "./datasetFilters";

describe("datasetFilters", () => {
  it("correctly identifies category datasets and excludes them from label datasets", () => {
    // Datasets created from category mirrors
    const categoryDatasets = [
      { name: "data-bank-reviewed", origin: "databank_reviewed" },
      { name: "data-bank-blurry", origin: "databank_blurry" },
      { name: "data-bank-dead", origin: "databank_dead" },
      { name: "data-bank-failed", origin: "databank_category" },
      { name: "data-bank-benchmark", origin: "databank_category" },
      { name: "databank-reviewed-chunk-1", origin: "databank_reviewed_chunk" },
      {
        name: "custom-category-ds",
        metadata: { databank_category: "high_glare", purpose: "databank_category_mirror" },
      },
    ];

    for (const ds of categoryDatasets) {
      expect(isCategoryDataset(ds)).toBe(true);
      expect(isRealLabelDataset(ds)).toBe(false);
    }
  });

  it("correctly identifies raw datasets and excludes them from label datasets", () => {
    const rawDatasets = [
      { name: "raw-data-bank", metadata: { dataset_type: "raw" } },
      { name: "raw-batch-2026-09", origin: "databank_raw_dataset" },
    ];

    for (const ds of rawDatasets) {
      expect(isRawDataset(ds)).toBe(true);
      expect(isRealLabelDataset(ds)).toBe(false);
    }
  });

  it("correctly accepts real label datasets", () => {
    const labelDatasets = [
      { name: "data-bank", metadata: { dataset_type: "label" } },
      { name: "databank-odometer-2026-09-01", origin: "databank_label_dataset" },
      { name: "databank-kaggle-data-bank", origin: "databank_label_dataset" },
      { name: "databank-carrum-odometer-bank", origin: "databank_label_dataset" },
      { name: "dashboard-eval", origin: "upload" },
    ];

    for (const ds of labelDatasets) {
      expect(isRealLabelDataset(ds)).toBe(true);
      expect(isCategoryDataset(ds)).toBe(false);
      expect(isRawDataset(ds)).toBe(false);
    }
  });

  it("identifies category dataset names by pattern", () => {
    expect(isCategoryDatasetName("data-bank-reviewed")).toBe(true);
    expect(isCategoryDatasetName("data-bank-blurry")).toBe(true);
    expect(isCategoryDatasetName("data-bank-dead")).toBe(true);
    expect(isCategoryDatasetName("data-bank-failed")).toBe(true);
    expect(isCategoryDatasetName("data-bank-benchmark")).toBe(true);
    expect(isCategoryDatasetName("data-bank")).toBe(false);
    expect(isCategoryDatasetName("dashboard-eval")).toBe(false);
    expect(isCategoryDatasetName("databank-odometer-2026-09-01")).toBe(false);
  });
});
