export interface ScraperCategory {
  id: string;
  name: string;
  description: string;
  ocr_type: string;
  created_at: string;
  image_count: number;
}

export interface ScraperSessionConfig {
  seed_url?: string;
  keywords?: string;
  max_images?: number;
  max_pages?: number;
  depth?: number;
  category_id?: string;
  sources?: string[];
  max_per_source?: number;
}

export type ScraperSessionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "stopped";

export interface ScraperSession {
  id: string;
  seed_url: string;
  status: ScraperSessionStatus;
  config: Record<string, unknown>;
  category_id: string | null;
  category_name: string | null;
  image_count: number;
  pages_visited: number;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ScraperBBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ScraperImage {
  id: string;
  session_id: string;
  category_id: string | null;
  category_name: string | null;
  source_url: string;
  file_path: string;
  content_hash: string;
  alt_text: string | null;
  context: string | null;
  file_size_bytes: number;
  width: number;
  height: number;
  page_url: string;
  ground_truth?: string | null;
  gt_bbox?: ScraperBBox | null;
  provider?: string | null;
  license?: string | null;
  license_url?: string | null;
  created_at: string;
}

export interface PromoteToDatabankResult {
  dataset_id: string;
  promoted: number;
  skipped: { id: string; reason: string }[];
  sample_ids: string[];
}

export type ScraperLabelJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "stopped";

export interface ScraperLabelJob {
  id: string;
  category_id: string | null;
  session_id: string | null;
  status: ScraperLabelJobStatus;
  total: number;
  processed: number;
  saved: number;
  failed: number;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export type ScraperFilterJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "stopped";

export interface ScraperFilterJob {
  id: string;
  category_id: string | null;
  garbage_category_id: string | null;
  valid_category_id: string | null;
  prompt: string;
  model: string;
  status: ScraperFilterJobStatus;
  total: number;
  processed: number;
  valid_count: number;
  garbage_count: number;
  failed_count: number;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ScraperFilterPrompt {
  id: string;
  name: string;
  prompt: string;
  description?: string | null;
  is_default?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GeminiPrompt {
  id: string;
  name: string;
  prompt: string;
}

export interface GeminiModelOption {
  id: string;
  name: string;
}

export interface GeminiConfig {
  has_api_key: boolean;
  default_model: string;
  available_models?: GeminiModelOption[];
}

export interface ScraperStats {
  total_images: number;
  total_sessions: number;
  categories: { id: string; name: string; image_count: number }[];
  active_sessions: number;
  images_with_gt?: number;
  images_without_gt?: number;
  total_size_bytes?: number;
  uncategorized_images?: number;
}
