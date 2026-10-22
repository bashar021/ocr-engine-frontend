/**
 * Utilities for identifying and filtering label datasets vs category datasets and raw datasets.
 */

const CATEGORY_ORIGINS = new Set([
  "databank_category",
  "databank_blurry",
  "databank_dead",
  "databank_reviewed",
  "databank_reviewed_chunk",
]);

const CATEGORY_NAMES = new Set([
  "data-bank-reviewed",
  "data-bank-blurry",
  "data-bank-dead",
  "data-bank-failed",
  "data-bank-benchmark",
  "databank-reviewed",
  "databank-blurry",
  "databank-dead",
  "databank-failed",
  "databank-benchmark",
]);

/**
 * Checks if a dataset represents a category slice (e.g. reviewed, blurry, dead, benchmark, etc.)
 */
export function isCategoryDataset(dataset: {
  name?: string | null;
  origin?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  const name = (dataset.name || "").toLowerCase().trim();
  const origin = (dataset.origin || "").toLowerCase().trim();
  const meta = dataset.metadata || {};
  const metaOrigin = String(meta.origin || "").toLowerCase().trim();
  const purpose = String(meta.purpose || "").toLowerCase().trim();

  // 1. Explicit Category Origins
  if (CATEGORY_ORIGINS.has(origin) || CATEGORY_ORIGINS.has(metaOrigin)) {
    return true;
  }

  // 2. Category Mirror Purposes
  if (
    purpose.includes("_mirror") &&
    (purpose.includes("category") ||
      purpose.includes("reviewed") ||
      purpose.includes("dead") ||
      purpose.includes("blurry") ||
      purpose.includes("failed") ||
      purpose.includes("benchmark"))
  ) {
    return true;
  }

  // 3. Category flag in metadata
  if (meta.databank_category || meta.category) {
    return true;
  }

  // 4. Known Category Dataset Name Patterns
  if (CATEGORY_NAMES.has(name)) {
    return true;
  }

  if (
    /^data-bank-(reviewed|blurry|dead|failed|benchmark)($|-)/.test(name) ||
    /^databank-(reviewed|blurry|dead|failed|benchmark)($|-)/.test(name)
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if a dataset is part of the raw dataset layer.
 */
export function isRawDataset(dataset: {
  name?: string | null;
  origin?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  const name = (dataset.name || "").toLowerCase().trim();
  const origin = (dataset.origin || "").toLowerCase().trim();
  const meta = dataset.metadata || {};
  return (
    meta.dataset_type === "raw" ||
    origin === "databank_raw_dataset" ||
    name === "raw-data-bank" ||
    name.startsWith("raw-")
  );
}

/**
 * Returns true if the dataset is a genuine Label Dataset (not raw and not a category slice).
 */
export function isRealLabelDataset(dataset: {
  name?: string | null;
  origin?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  if (isRawDataset(dataset)) return false;
  if (isCategoryDataset(dataset)) return false;
  return true;
}

/**
 * Helper to check by dataset name alone (e.g. for evaluation run snapshots).
 */
export function isCategoryDatasetName(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = name.toLowerCase().trim();
  if (CATEGORY_NAMES.has(n)) return true;
  return (
    /^data-bank-(reviewed|blurry|dead|failed|benchmark)($|-)/.test(n) ||
    /^databank-(reviewed|blurry|dead|failed|benchmark)($|-)/.test(n)
  );
}
