import { Outlet } from "react-router-dom";

import { BillDatasetContextProvider } from "@/features/bill/dataset/context";
import { DatasetContextBar } from "@/components/bill/dataset/DatasetContextBar";

/** Shared shell for Bill Dataset Management tabs. */
export function BillDatasetLayout() {
  return (
    <BillDatasetContextProvider>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DatasetContextBar />
        <div className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </BillDatasetContextProvider>
  );
}
