import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";

const STORAGE_KEY = "bill.dataset.context.v1";

export type BillDatasetContextState = {
  datasetId: string | null;
  version: string | null;
  chunk: string | null; // split filter: train|val|test|all
  setDatasetId: (id: string | null) => void;
  setVersion: (v: string | null) => void;
  setChunk: (c: string | null) => void;
  clearContext: () => void;
};

const BillDatasetContext = createContext<BillDatasetContextState | null>(null);

function readStored(): {
  datasetId: string | null;
  version: string | null;
  chunk: string | null;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { datasetId: null, version: null, chunk: null };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      datasetId: typeof parsed.datasetId === "string" ? parsed.datasetId : null,
      version: typeof parsed.version === "string" ? parsed.version : null,
      chunk: typeof parsed.chunk === "string" ? parsed.chunk : null,
    };
  } catch {
    return { datasetId: null, version: null, chunk: null };
  }
}

function writeStored(state: {
  datasetId: string | null;
  version: string | null;
  chunk: string | null;
}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function BillDatasetContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const stored = readStored();

  const datasetId = searchParams.get("datasetId") || stored.datasetId || null;
  const version = searchParams.get("version") || stored.version || null;
  const chunk = searchParams.get("chunk") || stored.chunk || null;

  const sync = useCallback(
    (next: {
      datasetId: string | null;
      version: string | null;
      chunk: string | null;
    }) => {
      writeStored(next);
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next.datasetId) p.set("datasetId", next.datasetId);
          else p.delete("datasetId");
          if (next.version) p.set("version", next.version);
          else p.delete("version");
          if (next.chunk && next.chunk !== "all") p.set("chunk", next.chunk);
          else p.delete("chunk");
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setDatasetId = useCallback(
    (id: string | null) => {
      sync({ datasetId: id, version: null, chunk });
    },
    [sync, chunk],
  );

  const setVersion = useCallback(
    (v: string | null) => {
      sync({ datasetId, version: v, chunk });
    },
    [sync, datasetId, chunk],
  );

  const setChunk = useCallback(
    (c: string | null) => {
      sync({ datasetId, version, chunk: c });
    },
    [sync, datasetId, version],
  );

  const clearContext = useCallback(() => {
    sync({ datasetId: null, version: null, chunk: null });
  }, [sync]);

  const value = useMemo(
    () => ({
      datasetId,
      version,
      chunk,
      setDatasetId,
      setVersion,
      setChunk,
      clearContext,
    }),
    [
      datasetId,
      version,
      chunk,
      setDatasetId,
      setVersion,
      setChunk,
      clearContext,
    ],
  );

  return (
    <BillDatasetContext.Provider value={value}>
      {children}
    </BillDatasetContext.Provider>
  );
}

export function useBillDatasetContext(): BillDatasetContextState {
  const ctx = useContext(BillDatasetContext);
  if (!ctx) {
    throw new Error(
      "useBillDatasetContext must be used within BillDatasetContextProvider",
    );
  }
  return ctx;
}

/** Optional hook for pages outside the layout */
export function useOptionalBillDatasetContext(): BillDatasetContextState | null {
  return useContext(BillDatasetContext);
}

/** Stable no-op for pages that render context bar outside provider — unused */
export function useLocalBillDatasetContextState(): BillDatasetContextState {
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [chunk, setChunk] = useState<string | null>(null);
  return {
    datasetId,
    version,
    chunk,
    setDatasetId,
    setVersion,
    setChunk,
    clearContext: () => {
      setDatasetId(null);
      setVersion(null);
      setChunk(null);
    },
  };
}
