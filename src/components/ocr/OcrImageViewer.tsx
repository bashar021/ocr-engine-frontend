import { useEffect, useRef } from "react";

import type { OcrBoundingBox } from "@/types/ocr";

interface OcrImageViewerProps {
  src: string;
  boxes?: OcrBoundingBox[];
  selected?: OcrBoundingBox | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  className?: string;
  /** Brightness multiplier (1 = normal). */
  brightness?: number;
  /** Contrast multiplier (1 = normal). */
  contrast?: number;
  /** Zoom scale (1 = fit). */
  zoom?: number;
  /** Extra sharpening via canvas filter (0–1). */
  sharpen?: number;
  /** Invert colors — can help read dark/blurry digits. */
  invert?: boolean;
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
      ];
      if (invert) filters.push("invert(1)");
      // CSS contrast bump approximates light sharpening for OCR readability.
      if (sharpen > 0) {
        filters.push(`contrast(${1 + sharpen * 0.8})`);
        filters.push(`saturate(${1 + sharpen * 0.3})`);
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
  ]);

  return (
    <div className={`overflow-auto ${className ?? ""}`}>
      <canvas ref={canvasRef} className="max-w-none rounded-lg shadow-sm" />
    </div>
  );
}
