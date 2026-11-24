import { useEffect, useRef } from "react";

import type { OcrBoundingBox } from "@/types/ocr";

export type ImageEnhancePreset =
  | "identity"
  | "invert"
  | "grayscale"
  | "clarity"
  | "contrast_stretch"
  | "denoise"
  | "custom";

export interface ImageEnhanceState {
  brightness: number;
  contrast: number;
  zoom: number;
  sharpen: number;
  invert: boolean;
  grayscale: boolean;
  saturate: number;
  blur: number;
}

export const DEFAULT_ENHANCE: ImageEnhanceState = {
  brightness: 1,
  contrast: 1.15,
  zoom: 1,
  sharpen: 0.2,
  invert: false,
  grayscale: false,
  saturate: 1,
  blur: 0,
};

export function enhanceFromPreset(preset: ImageEnhancePreset): ImageEnhanceState {
  switch (preset) {
    case "identity":
      return {
        brightness: 1,
        contrast: 1,
        zoom: 1,
        sharpen: 0,
        invert: false,
        grayscale: false,
        saturate: 1,
        blur: 0,
      };
    case "invert":
      return { ...DEFAULT_ENHANCE, invert: true, contrast: 1.3, sharpen: 0.35 };
    case "grayscale":
      return {
        ...DEFAULT_ENHANCE,
        grayscale: true,
        contrast: 1.4,
        saturate: 0,
        sharpen: 0.4,
      };
    case "clarity":
      return {
        ...DEFAULT_ENHANCE,
        brightness: 1.1,
        contrast: 1.55,
        sharpen: 0.7,
        saturate: 1.15,
      };
    case "contrast_stretch":
      return {
        ...DEFAULT_ENHANCE,
        brightness: 1.05,
        contrast: 2.1,
        sharpen: 0.25,
        saturate: 1.05,
      };
    case "denoise":
      return {
        ...DEFAULT_ENHANCE,
        blur: 0.6,
        contrast: 1.25,
        sharpen: 0.15,
        brightness: 1.05,
      };
    default:
      return { ...DEFAULT_ENHANCE };
  }
}

interface OcrImageViewerProps {
  src: string;
  boxes?: OcrBoundingBox[];
  selected?: OcrBoundingBox | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  className?: string;
  brightness?: number;
  contrast?: number;
  zoom?: number;
  sharpen?: number;
  invert?: boolean;
  grayscale?: boolean;
  saturate?: number;
  blur?: number;
  autoCenterSelected?: boolean;
}

export function OcrImageViewer({
  src,
  boxes = [],
  selected,
  imageWidth,
  imageHeight,
  className,
  brightness = 1,
  contrast = 1,
  zoom = 1,
  sharpen = 0,
  invert = false,
  grayscale = false,
  saturate = 1,
  blur = 0,
  autoCenterSelected = false,
}: OcrImageViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const maxW = canvas.parentElement?.clientWidth ?? 640;
      const fit = Math.min(1, maxW / img.width);
      const scale = fit * Math.max(0.5, Math.min(4, zoom));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      canvas.width = w;
      canvas.height = h;

      const filters: string[] = [
        `brightness(${brightness})`,
        `contrast(${contrast})`,
        `saturate(${grayscale ? 0 : saturate})`,
      ];
      if (grayscale) filters.push("grayscale(1)");
      if (invert) filters.push("invert(1)");
      if (blur > 0) filters.push(`blur(${blur}px)`);
      if (sharpen > 0) {
        filters.push(`contrast(${1 + sharpen * 0.8})`);
        if (!grayscale) filters.push(`saturate(${1 + sharpen * 0.3})`);
      }
      ctx.filter = filters.join(" ");
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.filter = "none";

      const sx = w / (imageWidth || img.width);
      const sy = h / (imageHeight || img.height);

      const drawBox = (box: OcrBoundingBox, color: string, width: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.strokeRect(
          box.x1 * sx,
          box.y1 * sy,
          (box.x2 - box.x1) * sx,
          (box.y2 - box.y1) * sy,
        );
        const label = `${box.label ?? "det"} ${((box.confidence ?? 0) * 100).toFixed(0)}%`;
        ctx.fillStyle = color;
        ctx.font = "12px IBM Plex Sans, sans-serif";
        ctx.fillText(label, box.x1 * sx, Math.max(12, box.y1 * sy - 4));
      };

      for (const box of boxes) {
        drawBox(box, "rgba(14, 165, 233, 0.95)", 2);
      }
      if (selected) {
        drawBox(selected, "rgba(16, 185, 129, 1)", 3);
        if (autoCenterSelected && canvas.parentElement) {
          const parent = canvas.parentElement;
          const boxCenterX = ((selected.x1 + selected.x2) / 2) * sx;
          const boxCenterY = ((selected.y1 + selected.y2) / 2) * sy;
          parent.scrollLeft = Math.max(0, boxCenterX - parent.clientWidth / 2);
          parent.scrollTop = Math.max(0, boxCenterY - parent.clientHeight / 2);
        }
      }
    };
    img.src = src;
  }, [
    src,
    boxes,
    selected,
    imageWidth,
    imageHeight,
    brightness,
    contrast,
    zoom,
    sharpen,
    invert,
    grayscale,
    saturate,
    blur,
    autoCenterSelected,
  ]);

  return (
    <div className={`overflow-auto ${className ?? ""}`}>
      <canvas ref={canvasRef} className="max-w-none rounded-lg shadow-sm" />
    </div>
  );
}
