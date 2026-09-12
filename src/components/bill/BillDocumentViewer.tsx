import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox, Space, Typography } from "antd";
import {
  AimOutlined,
  FullscreenOutlined,
  LeftOutlined,
  RightOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";

import { normalizeBBox, type BillBBoxLike, type BillOcrBlock } from "@/types/bill";

export type OverlayLayer =
  | "ocr"
  | "tables"
  | "evidence"
  | "layout";

type Props = {
  imageUrl: string | null;
  ocrBlocks?: BillOcrBlock[];
  tableBoxes?: Array<{ id: string; bbox: BillBBoxLike; label?: string }>;
  evidenceBoxes?: Array<{ id: string; bbox: BillBBoxLike; label?: string }>;
  selectedIds?: string[];
  onSelectBox?: (id: string) => void;
  pageLabel?: string;
  pageNumber?: number;
  pageCount?: number;
  onPageChange?: (page: number) => void;
  loading?: boolean;
  emptyHint?: string;
};

export function BillDocumentViewer({
  imageUrl,
  ocrBlocks = [],
  tableBoxes = [],
  evidenceBoxes = [],
  selectedIds = [],
  onSelectBox,
  pageLabel,
  pageNumber = 1,
  pageCount = 1,
  onPageChange,
  loading = false,
  emptyHint,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [layers, setLayers] = useState<Record<OverlayLayer, boolean>>({
    ocr: true,
    tables: false,
    evidence: true,
    layout: false,
  });
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.onload = () => {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      draw(img);
    };
    img.onerror = () => {
      setNatural({ w: 0, h: 0 });
    };
    img.src = imageUrl;

    function draw(image: HTMLImageElement) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = Math.max(1, Math.floor(image.naturalWidth * zoom));
      const h = Math.max(1, Math.floor(image.naturalHeight * zoom));
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(image, 0, 0, w, h);

      const paint = (
        boxes: Array<{ id: string; bbox: BillBBoxLike; label?: string }>,
        color: string,
      ) => {
        for (const box of boxes) {
          const bb = normalizeBBox(box.bbox);
          if (!bb) continue;
          const [x1, y1, x2, y2] = bb;
          const selected = selectedSet.has(box.id);
          ctx.strokeStyle = selected ? "#f59e0b" : color;
          ctx.lineWidth = selected ? 3 : 1.5;
          ctx.strokeRect(x1 * zoom, y1 * zoom, (x2 - x1) * zoom, (y2 - y1) * zoom);
        }
      };

      if (layers.ocr) {
        paint(
          ocrBlocks.map((b) => ({ id: b.id, bbox: b.bbox, label: b.text })),
          "rgba(14, 165, 233, 0.9)",
        );
      }
      if (layers.tables) {
        paint(tableBoxes, "rgba(16, 185, 129, 0.9)");
      }
      if (layers.evidence) {
        paint(evidenceBoxes, "rgba(245, 158, 11, 0.95)");
      }
    }
  }, [
    imageUrl,
    zoom,
    layers,
    ocrBlocks,
    tableBoxes,
    evidenceBoxes,
    selectedSet,
  ]);

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSelectBox || !layers.ocr) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    const hit = [...ocrBlocks].reverse().find((b) => {
      const bb = normalizeBBox(b.bbox);
      if (!bb) return false;
      return x >= bb[0] && x <= bb[2] && y >= bb[1] && y <= bb[3];
    });
    if (hit) onSelectBox(hit.id);
  };

  if (!imageUrl && !loading) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 p-6">
        <Typography.Text type="secondary">
          {emptyHint ??
            "Document preview unavailable. Re-process the document or retain the original upload locally."}
        </Typography.Text>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Space wrap size="small">
          <Button
            size="small"
            icon={<ZoomOutOutlined />}
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
            aria-label="Zoom out"
          />
          <Button
            size="small"
            icon={<ZoomInOutlined />}
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            aria-label="Zoom in"
          />
          <Button
            size="small"
            icon={<AimOutlined />}
            onClick={() => setZoom(1)}
          >
            100%
          </Button>
          <Button
            size="small"
            icon={<FullscreenOutlined />}
            onClick={() => {
              if (natural.w) {
                const parent = canvasRef.current?.parentElement;
                const pw = parent?.clientWidth ?? natural.w;
                setZoom(Math.max(0.25, Math.min(2, pw / natural.w)));
              }
            }}
          >
            Fit width
          </Button>
          {pageCount > 1 && onPageChange ? (
            <>
              <Button
                size="small"
                icon={<LeftOutlined />}
                disabled={pageNumber <= 1 || loading}
                onClick={() => onPageChange(pageNumber - 1)}
                aria-label="Previous page"
              />
              <Typography.Text type="secondary">
                Page {pageNumber} / {pageCount}
              </Typography.Text>
              <Button
                size="small"
                icon={<RightOutlined />}
                disabled={pageNumber >= pageCount || loading}
                onClick={() => onPageChange(pageNumber + 1)}
                aria-label="Next page"
              />
            </>
          ) : pageLabel ? (
            <Typography.Text type="secondary">{pageLabel}</Typography.Text>
          ) : null}
          {pageCount > 1 && pageLabel ? (
            <Typography.Text type="secondary">{pageLabel}</Typography.Text>
          ) : null}
        </Space>
        <Space wrap size="small">
          {(Object.keys(layers) as OverlayLayer[]).map((key) => (
            <Checkbox
              key={key}
              checked={layers[key]}
              onChange={(e) =>
                setLayers((prev) => ({ ...prev, [key]: e.target.checked }))
              }
            >
              {key}
            </Checkbox>
          ))}
        </Space>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto rounded border border-slate-200 bg-slate-100">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
            <Typography.Text type="secondary">Loading preview…</Typography.Text>
          </div>
        ) : null}
        {imageUrl ? (
          <canvas
            ref={canvasRef}
            className="cursor-crosshair bg-white"
            onClick={onCanvasClick}
            role="img"
            aria-label="Bill document viewer"
          />
        ) : null}
      </div>
    </div>
  );
}
