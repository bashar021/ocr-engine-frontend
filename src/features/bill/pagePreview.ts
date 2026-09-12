/** Load bill page previews: backend JPEG pages first, then local PDF/image raster. */

import {
  getBillPageImageObjectUrl,
  listBillDocumentPages,
  type BillPagePreview,
} from "@/api/bill";

export type PagePreviewSource = "backend" | "local-pdf" | "local-image";

export type ResolvedPagePreview = {
  imageUrl: string;
  pageCount: number;
  pageNumber: number;
  source: PagePreviewSource;
  revoke: () => void;
};

function isPdfBlob(blob: Blob, fileName?: string): boolean {
  if (blob.type === "application/pdf") return true;
  return Boolean(fileName?.toLowerCase().endsWith(".pdf"));
}

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

export async function getPdfPageCount(blob: Blob): Promise<number> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  return pdf.numPages;
}

export async function rasterizePdfPage(
  blob: Blob,
  pageNumber: number,
  scale = 2,
): Promise<string> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const page = await pdf.getPage(
    Math.min(Math.max(1, pageNumber), pdf.numPages),
  );
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable for PDF rasterization");
  await page.render({ canvasContext: ctx, viewport }).promise;
  const out = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PDF page encode failed"))),
      "image/jpeg",
      0.92,
    );
  });
  return URL.createObjectURL(out);
}

export async function resolveBillPagePreview(opts: {
  documentId: string;
  pageNumber: number;
  localBlob?: Blob | null;
  fileName?: string;
  pagePreviews?: BillPagePreview[] | null;
}): Promise<ResolvedPagePreview | null> {
  const pageNumber = Math.max(1, opts.pageNumber);

  // Prefer backend-persisted page JPEGs (works for PDF + images after process).
  try {
    let pages = opts.pagePreviews ?? null;
    if (!pages?.length) {
      const listed = await listBillDocumentPages(opts.documentId);
      pages = listed.pages;
    }
    if (pages?.length) {
      const count = pages.length;
      const n = Math.min(pageNumber, count);
      const url = await getBillPageImageObjectUrl(opts.documentId, n);
      return {
        imageUrl: url,
        pageCount: count,
        pageNumber: n,
        source: "backend",
        revoke: () => URL.revokeObjectURL(url),
      };
    }
  } catch {
    // Fall through to local blob
  }

  const blob = opts.localBlob;
  if (!blob) return null;

  if (isPdfBlob(blob, opts.fileName)) {
    const count = await getPdfPageCount(blob);
    const n = Math.min(pageNumber, count);
    const url = await rasterizePdfPage(blob, n);
    return {
      imageUrl: url,
      pageCount: count,
      pageNumber: n,
      source: "local-pdf",
      revoke: () => URL.revokeObjectURL(url),
    };
  }

  const url = URL.createObjectURL(blob);
  return {
    imageUrl: url,
    pageCount: 1,
    pageNumber: 1,
    source: "local-image",
    revoke: () => URL.revokeObjectURL(url),
  };
}

export function pageIdForNumber(pageNumber: number): string {
  return `page-${pageNumber}`;
}

export function matchesPage(
  pageId: string | undefined,
  pageNumber: number,
): boolean {
  if (!pageId) return pageNumber === 1;
  return (
    pageId === pageIdForNumber(pageNumber) || pageId === String(pageNumber)
  );
}
