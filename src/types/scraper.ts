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
  created_at: string;
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
