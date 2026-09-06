import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { TrainingCenterLayout } from "@/components/training/TrainingCenterLayout";
import { DatabankListPage } from "@/pages/DatabankListPage";
import { EvaluationDatasetsPage } from "@/pages/EvaluationDatasetsPage";
import { EvaluationRunsPage } from "@/pages/EvaluationRunsPage";
import { ModelListPage } from "@/pages/ModelListPage";
import { ModelRefsPage } from "@/pages/ModelRefsPage";
import { OcrPlaygroundPage } from "@/pages/OcrPlaygroundPage";
import { RecognitionConfigsPage } from "@/pages/RecognitionConfigsPage";
import { TrainingCenterExperimentsPage } from "@/pages/TrainingCenterExperimentsPage";
import { TrainingCenterOverviewPage } from "@/pages/TrainingCenterOverviewPage";
import {
  TrainingCenterDatasetsPage,
  TrainingCenterDetectionPage,
  TrainingCenterEvaluationsPage,
  TrainingCenterModelsPage,
  TrainingCenterRecognitionPage,
} from "@/pages/TrainingCenterSections";
import { TrainingCycleDetailPage } from "@/pages/TrainingCycleDetailPage";
import { TrainingCurationPage } from "@/pages/TrainingCurationPage";
import { TrainingDatasetsPage } from "@/pages/TrainingDatasetsPage";
import { TrainingOverviewPage } from "@/pages/TrainingOverviewPage";
import { TrainingRunDetailPage } from "@/pages/TrainingRunDetailPage";
import { TrainingRunsPage } from "@/pages/TrainingRunsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/ocr" replace />} />
        <Route
          path="/models"
          element={<Navigate to="/models/list" replace />}
        />
        <Route path="/models/list" element={<ModelListPage />} />
        <Route path="/models/refs" element={<ModelRefsPage />} />
        <Route
          path="/models/recognition-configs"
          element={<RecognitionConfigsPage />}
        />
        <Route path="/models/overview" element={<Navigate to="/models/list" replace />} />
        <Route
          path="/evaluation"
          element={<Navigate to="/evaluation/datasets" replace />}
        />
        <Route
          path="/evaluation/datasets"
          element={<EvaluationDatasetsPage />}
        />
        <Route path="/evaluation/dataset-list" element={<DatabankListPage />} />
        <Route
          path="/evaluation/training-datasets"
          element={<TrainingDatasetsPage />}
        />
        <Route path="/evaluation/runs" element={<EvaluationRunsPage />} />
        <Route path="/training-center" element={<TrainingCenterLayout />}>
          <Route index element={<TrainingCenterOverviewPage />} />
          <Route path="detection" element={<TrainingCenterDetectionPage />} />
          <Route
            path="recognition"
            element={<TrainingCenterRecognitionPage />}
          />
          <Route
            path="experiments"
            element={<TrainingCenterExperimentsPage />}
          />
          <Route path="datasets" element={<TrainingCenterDatasetsPage />} />
          <Route
            path="evaluations"
            element={<TrainingCenterEvaluationsPage />}
          />
          <Route path="models" element={<TrainingCenterModelsPage />} />
          <Route path="cycles" element={<TrainingCenterOverviewPage />} />
          <Route path="cycles/:cycleId" element={<TrainingCycleDetailPage />} />
        </Route>
        <Route path="/training" element={<TrainingOverviewPage />} />
        <Route path="/training/runs" element={<TrainingRunsPage />} />
        <Route
          path="/training/runs/:runId"
          element={<TrainingRunDetailPage />}
        />
        <Route
          path="/training/datasets"
          element={<Navigate to="/evaluation/training-datasets" replace />}
        />
        <Route path="/training/curate" element={<TrainingCurationPage />} />
        <Route path="/ocr" element={<OcrPlaygroundPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/ocr" replace />} />
    </Routes>
  );
}
