/**
 * Client-side Bill document inbox.
 * Backend has no list-documents API — we persist process IDs + original blobs locally.
 */

import type { BillDocumentResult, BillLocalDocument, BillProcessStatus } from "@/types/bill";

const META_KEY = "bill.documents.v1";
const DB_NAME = "bill-ocr-blobs";
const STORE = "files";

function readMeta(): BillLocalDocument[] {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BillLocalDocument[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeMeta(docs: BillLocalDocument[]) {
  localStorage.setItem(META_KEY, JSON.stringify(docs));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

export async function saveBillBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("blob save failed"));
  });
  db.close();
}

export async function loadBillBlob(key: string): Promise<Blob | null> {
  const db = await openDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error("blob load failed"));
  });
  db.close();
  return blob;
}

export async function deleteBillBlob(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("blob delete failed"));
  });
  db.close();
}

export function listLocalBillDocuments(): BillLocalDocument[] {
  return readMeta().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getLocalBillDocument(id: string): BillLocalDocument | undefined {
  return readMeta().find((d) => d.id === id || d.documentId === id || d.jobId === id);
}

export function upsertLocalBillDocument(doc: BillLocalDocument): void {
  const all = readMeta();
  const idx = all.findIndex((d) => d.id === doc.id);
  if (idx >= 0) all[idx] = doc;
  else all.unshift(doc);
  writeMeta(all);
}

export function updateLocalBillDocument(
  id: string,
  patch: Partial<BillLocalDocument>,
): BillLocalDocument | undefined {
  const all = readMeta();
  const idx = all.findIndex((d) => d.id === id || d.documentId === id);
  if (idx < 0) return undefined;
  all[idx] = { ...all[idx]!, ...patch };
  writeMeta(all);
  return all[idx];
}

export async function removeLocalBillDocument(id: string): Promise<void> {
  const all = readMeta();
  const doc = all.find((d) => d.id === id || d.documentId === id);
  if (!doc) return;
  writeMeta(all.filter((d) => d.id !== doc.id));
  await deleteBillBlob(doc.blobKey);
}

export function documentFromProcessResponse(args: {
  file: File;
  blobKey: string;
  response: {
    job_id: string;
    document_id?: string;
    status?: BillProcessStatus;
    result?: BillDocumentResult | null;
    multipage?: boolean;
    page_count?: number;
    processing?: { pipeline_version?: string };
  };
  startedAt: number;
}): BillLocalDocument {
  const result = args.response.result ?? null;
  const failures = result?.failures ?? [];
  return {
    id: args.response.document_id || args.response.job_id,
    jobId: args.response.job_id,
    documentId: args.response.document_id || args.response.job_id,
    fileName: args.file.name,
    fileType: args.file.type || "application/octet-stream",
    fileSize: args.file.size,
    pageCount: args.response.page_count ?? result?.document_model?.page_count ?? 1,
    multipage: Boolean(args.response.multipage || result?.multipage),
    status: (args.response.status || result?.status || "FAILED") as BillProcessStatus,
    documentType: result?.document_type,
    profileId: result?.processing?.profile_id,
    profileVersion: result?.processing?.profile_version,
    confidenceOverall: result?.confidence?.overall,
    confidenceLevel:
      (result?.confidence?.confidence_band as string | undefined) ||
      result?.confidence?.level,
    reviewRequired: Boolean(result?.review?.required),
    validationStatus: result?.validation?.status,
    failureCodes: failures.map((f) => f.code).filter(Boolean),
    createdAt: new Date().toISOString(),
    processingMs: Date.now() - args.startedAt,
    blobKey: args.blobKey,
    resultSnapshot: result,
  };
}
