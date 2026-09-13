import { Navigate } from "react-router-dom";

import { BillSystemPage } from "@/pages/bill/BillSystemPage";

/** Pipeline / providers — reuse system page content under Models nav. */
export function BillModelsPipelinePage() {
  return <BillSystemPage />;
}

export function BillSystemRedirect() {
  return <Navigate to="/bill/models/pipeline" replace />;
}

export function BillProfilesRedirect() {
  return <Navigate to="/bill/models/profiles" replace />;
}
