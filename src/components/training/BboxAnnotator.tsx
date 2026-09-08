import { useCallback, useEffect, useRef, useState } from "react";

export interface DrawnBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface BboxAnnotatorProps {
  src: string;
  value: DrawnBox | null;
  onChange: (box: DrawnBox | null) => void;
  imageWidth?: number | null;
  imageHeight?: number | null;
  className?: string;
}

/**
 * Click-drag to draw a bounding box in image pixel coordinates.
 */
export function BboxAnnotator({
  src,
  value,
  onChange,
  imageWidth,
  imageHeight,
  className,
}: BboxAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<DrawnBox | null>(null);

  const redraw = useCallback(
    (box: DrawnBox | null) => {
      const canvas = canvasRef.current;
      const img = imgRef.current;
      if (!canvas || !img) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const maxW = canvas.parentElement?.clientWidth ?? 720;
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      const natW = imageWidth || img.width;
      const natH = imageHeight || img.height;
      const sx = w / natW;
      const sy = h / natH;

      if (box) {
        ctx.strokeStyle = "rgba(16, 185, 129, 1)";
        ctx.lineWidth = 3;
        ctx.strokeRect(
          box.x1 * sx,
          box.y1 * sy,
          (box.x2 - box.x1) * sx,
          (box.y2 - box.y1) * sy,
        );
        ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
        ctx.fillRect(
          box.x1 * sx,
          box.y1 * sy,
          (box.x2 - box.x1) * sx,
          (box.y2 - box.y1) * sy,
        );
      }
    },
    [imageWidth, imageHeight],
  );

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      redraw(draft ?? value);
    };
    img.src = src;
  }, [src, value, draft, redraw]);

  const toImageCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return null;
    const rect = canvas.getBoundingClientRect();
    const natW = imageWidth || img.width;
    const natH = imageHeight || img.height;
    const x = ((clientX - rect.left) / rect.width) * natW;
    const y = ((clientY - rect.top) / rect.height) * natH;
    return {
      x: Math.max(0, Math.min(natW, x)),
      y: Math.max(0, Math.min(natH, y)),
    };
  };

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        className="max-w-full cursor-crosshair rounded-lg border border-slate-200 shadow-sm"
        onMouseDown={(e) => {
          const p = toImageCoords(e.clientX, e.clientY);
          if (!p) return;
          startRef.current = p;
          setDragging(true);
          setDraft({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
        }}
        onMouseMove={(e) => {
          if (!dragging || !startRef.current) return;
          const p = toImageCoords(e.clientX, e.clientY);
          if (!p) return;
          const s = startRef.current;
          setDraft({
            x1: Math.min(s.x, p.x),
            y1: Math.min(s.y, p.y),
            x2: Math.max(s.x, p.x),
            y2: Math.max(s.y, p.y),
          });
        }}
        onMouseUp={() => {
          if (!dragging) return;
          setDragging(false);
          startRef.current = null;
          if (draft && draft.x2 - draft.x1 > 2 && draft.y2 - draft.y1 > 2) {
            onChange(draft);
          }
          setDraft(null);
        }}
        onMouseLeave={() => {
          if (dragging) {
            setDragging(false);
            startRef.current = null;
            setDraft(null);
          }
        }}
      />
      <div className="mt-2 flex gap-2 text-xs text-slate-500">
        <span>Drag to draw a detection box. Coordinates are image pixels.</span>
        {value ? (
          <button
            type="button"
            className="text-red-600 underline"
            onClick={() => onChange(null)}
          >
            Clear box
          </button>
        ) : null}
      </div>
    </div>
  );
}
