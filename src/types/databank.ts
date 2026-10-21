export interface DatabankMetrics {
  reviewed_samples: number;
  comparable_samples: number;
  exact_matches: number;
  mismatches: number;
  missing_predictions: number;
  exact_match_accuracy: number | null;
  computed_at?: string;
}

export interface DatabankTabMetricsEntry {
  upload?: DatabankMetrics | null;
  rerun?: DatabankMetrics | null;
  latest?: DatabankMetrics | null;
  latest_source?: "upload" | "rerun" | string | null;
}

export interface DatabankUploadProgress {
  id?: string;
  status: "running" | "completed" | "failed" | string;
  phase: "queued" | "extracting" | "predicting" | "done" | "failed" | string;
  message?: string | null;
  source_filename?: string | null;
  total_samples: number;
  processed_samples: number;
  added_samples?: number;
  progress_pct: number;
  started_at?: string | null;
  completed_at?: string | null;
  error?: string | null;
}

export interface DatabankDataset {
  id: string;
  ocr_type: string;
  name: string;
  version: string;
  description?: string | null;
  status: string;
  sample_count: number;
  reviewed_count: number;
  unreviewed_count: number;
  has_gt_count?: number;
  no_gt_count?: number;
  blurry_count?: number;
  raw_pending_count?: number;
  dataset_type?: string;
  category_counts?: Record<
    string,
    { total: number; reviewed: number; unreviewed?: number; has_gt?: number; no_gt?: number }
  >;
  custom_categories?: string[];
  reviewed_eval_chunk_count?: number;
  model_ref?: string | null;
  detection_artifact_id?: string | null;
  recognition_artifact_id?: string | null;
  upload_metrics?: DatabankMetrics | null;
  rerun_metrics?: DatabankMetrics | null;
  tab_metrics?: Record<string, DatabankTabMetricsEntry>;
  last_predict_at?: string | null;
  last_rerun_at?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  added_samples?: number;
  accepted?: boolean;
  message?: string | null;
  upload_progress?: DatabankUploadProgress | null;
}

export interface DatabankBBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
  label?: string | null;
}

export interface DatabankSample {
  id: string;
  dataset_id: string;
  filename: string;
  relative_path: string;
  has_ground_truth: boolean;
  ground_truth?: string | null;
  ground_truth_normalized?: string | null;
  corrected_gt?: string | null;
  final_gt?: string | null;
  review_status: "reviewed" | "unreviewed" | string;
  is_blurry?: boolean;
  category?: string;
  review_notes?: string | null;
  upload_predicted?: string | null;
  upload_confidence?: number | null;
  upload_match?: boolean | null;
  upload_bbox?: DatabankBBox | null;
  upload_error?: string | null;
  rerun_predicted?: string | null;
  rerun_confidence?: number | null;
  rerun_match?: boolean | null;
  rerun_bbox?: DatabankBBox | null;
  rerun_error?: string | null;
  corrected_bbox?: DatabankBBox | null;
  bbox_cleared?: boolean;
  display_bbox?: DatabankBBox | null;
  bbox?: DatabankBBox | null;
  width?: number | null;
  height?: number | null;
  size_bytes?: number | null;
  reviewed_at?: string | null;
  created_at?: string | null;
  lifecycle_state?: string | null;
  quality_tag?: string | null;
  metadata?: Record<string, unknown> | null;
  promoted?: boolean;
  match_after_save?: boolean | null;
}

export interface ListDatabankDatasetsResponse {
  total: number;
  limit: number;
  offset: number;
  datasets: DatabankDataset[];
}

export interface ListDatabankSamplesResponse {
  total: number;
  limit: number;
  offset: number;
  samples: DatabankSample[];
}
