export interface OcrBoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
  label: string | null;
}

export interface ConfidenceBreakdown {
  detection_confidence: number | null;
  recognition_confidence: number | null;
  quality_score: number | null;
  final_confidence: number;
  composer_version?: string;
  penalties?: Array<Record<string, string | number>>;
}

export interface OcrResponse {
  request_id: string;
  status: "success" | "low_confidence" | "failed" | string;
  value: string | null;
  confidence: number | null;
  model_ref: string | null;
  error_code: string | null;
  message: string | null;
  detections: OcrBoundingBox[];
  selected_detection: OcrBoundingBox | null;
  image_size: { width: number; height: number } | null;
  confidence_breakdown: ConfidenceBreakdown | null;
  fail_stage: "detection" | "recognition" | "quality" | string | null;
}

export interface OcrJobResult {
  fileName: string;
  previewUrl: string;
  response?: OcrResponse;
  error?: string;
  loading?: boolean;
}
