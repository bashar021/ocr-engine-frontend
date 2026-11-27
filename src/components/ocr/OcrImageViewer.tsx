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
  cropToSelected?: boolean;
  onSelectedChange?: (nextBox: OcrBoundingBox) => void;
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
  cropToSelected = false,
  onSelectedChange,
}: OcrImageViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const loadedSrcRef = useRef<string | null>(null);
  const transformRef = useRef<{ sx: number; sy: number; refW: number; refH: number } | null>(null);
  const dragStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    origBox: OcrBoundingBox;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const renderImage = (img: HTMLImageElement) => {
      imgRef.current = img;
      loadedSrcRef.current = src;
      const maxW = canvas.parentElement?.clientWidth ?? 640;
      const maxH = canvas.parentElement?.clientHeight ?? 480;
      const clampedZoom = Math.max(0.5, Math.min(4, zoom));

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

      if (cropToSelected && selected) {
        const refW = imageWidth || img.width;
        const refH = imageHeight || img.height;
        const toImgX = img.width / refW;
        const toImgY = img.height / refH;
        const cx1 = Math.max(0, Math.min(img.width - 1, selected.x1 * toImgX));
        const cy1 = Math.max(0, Math.min(img.height - 1, selected.y1 * toImgY));
        const cx2 = Math.max(cx1 + 1, Math.min(img.width, selected.x2 * toImgX));
        const cy2 = Math.max(cy1 + 1, Math.min(img.height, selected.y2 * toImgY));
        const cropW = Math.max(1, cx2 - cx1);
        const cropH = Math.max(1, cy2 - cy1);

        const fit = Math.min(maxW / cropW, maxH / cropH);
        const scale = fit * clampedZoom;
        const w = Math.max(1, Math.round(cropW * scale));
        const h = Math.max(1, Math.round(cropH * scale));
        canvas.width = w;
        canvas.height = h;

        ctx.filter = filters.join(" ");
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, cx1, cy1, cropW, cropH, 0, 0, w, h);
        ctx.filter = "none";
        return;
      }

      const fit = Math.min(1, maxW / img.width);
      const scale = fit * clampedZoom;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      canvas.width = w;
      canvas.height = h;

      ctx.filter = filters.join(" ");
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.filter = "none";

      const refW = imageWidth || img.width;
      const refH = imageHeight || img.height;
      const sx = w / refW;
      const sy = h / refH;
      transformRef.current = { sx, sy, refW, refH };

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
        if (autoCenterSelected && !dragStateRef.current && canvas.parentElement) {
          const parent = canvas.parentElement;
          const boxCenterX = ((selected.x1 + selected.x2) / 2) * sx;
          const boxCenterY = ((selected.y1 + selected.y2) / 2) * sy;
          parent.scrollLeft = Math.max(0, boxCenterX - parent.clientWidth / 2);
          parent.scrollTop = Math.max(0, boxCenterY - parent.clientHeight / 2);
        }
      }
    };

    if (loadedSrcRef.current === src && imgRef.current && imgRef.current.complete) {
      renderImage(imgRef.current);
    } else {
      const img = new Image();
      img.onload = () => renderImage(img);
      img.src = src;
    }
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
    cropToSelected,
  ]);

  const isPointInSelectedBox = (clientX: number, clientY: number): boolean => {
    const canvas = canvasRef.current;
    const t = transformRef.current;
    if (!canvas || !t || !selected) return false;
    const rect = canvas.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const pad = 6;
    const bx1 = selected.x1 * t.sx - pad;
    const by1 = selected.y1 * t.sy - pad;
    const bx2 = selected.x2 * t.sx + pad;
    const by2 = selected.y2 * t.sy + pad;
    return cx >= bx1 && cx <= bx2 && cy >= by1 && cy <= by2;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSelectedChange || !selected || cropToSelected) return;
    if (!isPointInSelectedBox(e.clientX, e.clientY)) return;
    e.preventDefault();
    dragStateRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      origBox: { ...selected },
    };
    if (canvasRef.current) {
      canvasRef.current.style.cursor = "grabbing";
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const t = transformRef.current;
    if (!onSelectedChange || !selected || cropToSelected || !t) {
      if (canvas) canvas.style.cursor = "default";
      return;
    }

    const drag = dragStateRef.current;
    if (drag) {
      const dx = (e.clientX - drag.startClientX) / t.sx;
      const dy = (e.clientY - drag.startClientY) / t.sy;
      const boxW = drag.origBox.x2 - drag.origBox.x1;
      const boxH = drag.origBox.y2 - drag.origBox.y1;
      const nx1 = Math.max(0, Math.min(t.refW - boxW, drag.origBox.x1 + dx));
      const ny1 = Math.max(0, Math.min(t.refH - boxH, drag.origBox.y1 + dy));
      onSelectedChange({
        ...drag.origBox,
        x1: Math.round(nx1),
        y1: Math.round(ny1),
        x2: Math.round(nx1 + boxW),
        y2: Math.round(ny1 + boxH),
      });
      return;
    }

    if (canvas) {
      canvas.style.cursor = isPointInSelectedBox(e.clientX, e.clientY) ? "grab" : "default";
    }
  };

  const stopDragging = () => {
    if (!dragStateRef.current) return;
    dragStateRef.current = null;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = "grab";
    }
  };

  return (
    <div className={`flex overflow-auto ${className ?? ""}`}>
      <canvas
        ref={canvasRef}
        className="m-auto max-w-none rounded-lg shadow-sm"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
      />
    </div>
  );
}
