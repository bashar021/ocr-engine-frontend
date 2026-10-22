import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { TrainingCenterLayout } from "@/components/training/TrainingCenterLayout";
import { BillDatasetLayout } from "@/components/bill/dataset/BillDatasetLayout";
import { BillAnnotationsPage } from "@/pages/bill/dataset/BillAnnotationsPage";
import { BillDataListPage } from "@/pages/bill/dataset/BillDataListPage";
import { BillDatasetEvalPage } from "@/pages/bill/dataset/BillDatasetEvalPage";
import { BillDatasetReviewPage } from "@/pages/bill/dataset/BillDatasetReviewPage";
import { BillDatasetsPage } from "@/pages/bill/dataset/BillDatasetsPage";
import { BillEvaluationDatasetsPage } from "@/pages/bill/dataset/BillEvaluationDatasetsPage";
import { BillIssuesPage } from "@/pages/bill/dataset/BillIssuesPage";
import { BillJobsPage } from "@/pages/bill/dataset/BillJobsPage";
import { BillVersionsPage } from "@/pages/bill/dataset/BillVersionsPage";
import { BillDocumentDetailPage } from "@/pages/bill/BillDocumentDetailPage";
import { BillDocumentsPage } from "@/pages/bill/BillDocumentsPage";
import { BillFeedbackPage } from "@/pages/bill/BillFeedbackPage";
import {
  BillProfileDetailPage,
} from "@/pages/bill/BillProfilesPage";
import { BillModelsFieldsPage } from "@/pages/bill/models/BillModelsFieldsPage";
import {
  BillModelsPipelinePage,
  BillProfilesRedirect,
  BillSystemRedirect,
} from "@/pages/bill/models/BillModelsPipelinePage";
import { BillModelsProfilesPage } from "@/pages/bill/models/BillModelsProfilesPage";
import { BillReviewQueuePage } from "@/pages/bill/BillReviewQueuePage";
import { DatabankListPage } from "@/pages/DatabankListPage";
import { RawDataPage } from "@/pages/RawDataPage";
import { LabelDataPage } from "@/pages/LabelDataPage";
import { DatabankDatasetsPage } from "@/pages/DatabankDatasetsPage";
import { EvaluatedHardDatasetPage } from "@/pages/EvaluatedHardDatasetPage";
import { EvaluationComparisonPage } from "@/pages/EvaluationComparisonPage";
import { EvaluationDatasetsPage } from "@/pages/EvaluationDatasetsPage";
import { EvaluationRunsPage } from "@/pages/EvaluationRunsPage";
import { ImportExportPage } from "@/pages/ImportExportPage";
import { JobsPage } from "@/pages/JobsPage";
import { ModelListPage } from "@/pages/ModelListPage";
import { ModelRefsPage } from "@/pages/ModelRefsPage";
import { OcrPlaygroundPage } from "@/pages/OcrPlaygroundPage";
import { ScraperPage } from "@/pages/ScraperPage";
import { RecognitionConfigsPage } from "@/pages/RecognitionConfigsPage";
import { SettingsPage } from "@/pages/SettingsPage";
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
import { AugmentationDatasetPage } from "@/pages/AugmentationDatasetPage";
import { TrainDetectorPage } from "@/pages/TrainDetectorPage";
import { FineTuneModelPage } from "@/pages/FineTuneModelPage";
import { TrainingCurationPage } from "@/pages/TrainingCurationPage";
import { TrainingDatasetsPage } from "@/pages/TrainingDatasetsPage";
import { TrainingOverviewPage } from "@/pages/TrainingOverviewPage";
import { TrainingRunDetailPage } from "@/pages/TrainingRunDetailPage";
import { TrainingRunsPage } from "@/pages/TrainingRunsPage";
import {
  AuditHistoryPage,
  ClientsPage,
  DeploymentsPage,
  ReleasesPage,
} from "@/pages/platform/PlatformPages";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/ocr" replace />} />
        <Route path="/releases" element={<ReleasesPage />} />
        <Route path="/deployments" element={<DeploymentsPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/history" element={<AuditHistoryPage />} />
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
        <Route
          path="/models/overview"
          element={<Navigate to="/models/list" replace />}
        />
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
          path="/data-explorer"
          element={<Navigate to="/evaluation/datasets" replace />}
        />
        <Route
          path="/annotation"
          element={<Navigate to="/evaluation/datasets" replace />}
        />
        <Route
          path="/evaluation/training-datasets"
          element={<TrainingDatasetsPage />}
        />
        <Route path="/evaluation/runs" element={<EvaluationRunsPage />} />
        <Route
          path="/evaluation/comparison"
          element={<EvaluationComparisonPage />}
        />
        <Route
          path="/evaluation/hard-cases"
          element={<EvaluatedHardDatasetPage />}
        />
        <Route
          path="/evaluation/review"
          element={<EvaluatedHardDatasetPage />}
        />
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
          path="/training/new-detector"
          element={<TrainDetectorPage />}
        />
        <Route
          path="/training/fine-tune"
          element={<FineTuneModelPage />}
        />
        <Route
          path="/training/datasets"
          element={<Navigate to="/evaluation/training-datasets" replace />}
        />
        <Route path="/training/curate" element={<TrainingCurationPage />} />
        <Route
          path="/training/curation"
          element={<Navigate to="/training/curate" replace />}
        />
        <Route
          path="/training/augmentation"
          element={<AugmentationDatasetPage />}
        />
        <Route path="/ocr" element={<OcrPlaygroundPage />} />
        <Route path="/scraper" element={<Navigate to="/scraper/spyder" replace />} />
        <Route path="/scraper/spyder" element={<ScraperPage defaultTab="spyder" />} />
        <Route path="/scraper/data" element={<ScraperPage defaultTab="data" />} />
        <Route path="/scraper/categories" element={<ScraperPage defaultTab="categories" />} />
        <Route path="/databank" element={<Navigate to="/databank/raw" replace />} />
        <Route path="/databank/raw" element={<RawDataPage />} />
        <Route path="/databank/label-data" element={<LabelDataPage />} />
        <Route path="/databank/datasets" element={<DatabankDatasetsPage />} />
        <Route
          path="/bill"
          element={<Navigate to="/bill/documents" replace />}
        />
        <Route path="/bill/documents" element={<BillDocumentsPage />} />
        <Route
          path="/bill/documents/:documentId"
          element={<BillDocumentDetailPage />}
        />
        <Route path="/bill/review" element={<BillReviewQueuePage />} />
        <Route path="/bill/profiles" element={<BillProfilesRedirect />} />
        <Route
          path="/bill/profiles/:profileId"
          element={<BillProfileDetailPage />}
        />
        <Route path="/bill/feedback" element={<BillFeedbackPage />} />
        <Route path="/bill/system" element={<BillSystemRedirect />} />
        <Route
          path="/bill/models"
          element={<Navigate to="/bill/models/profiles" replace />}
        />
        <Route
          path="/bill/models/profiles"
          element={<BillModelsProfilesPage />}
        />
        <Route path="/bill/models/fields" element={<BillModelsFieldsPage />} />
        <Route
          path="/bill/models/pipeline"
          element={<BillModelsPipelinePage />}
        />
        <Route path="/bill/data" element={<BillDataListPage />} />
        <Route
          path="/bill/evaluation-datasets"
          element={<BillEvaluationDatasetsPage />}
        />
        <Route
          path="/bill/dataset"
          element={<Navigate to="/bill/datasets" replace />}
        />
        <Route element={<BillDatasetLayout />}>
          <Route path="/bill/datasets" element={<BillDatasetsPage />} />
          <Route path="/bill/annotations" element={<BillAnnotationsPage />} />
          <Route
            path="/bill/dataset-review"
            element={<BillDatasetReviewPage />}
          />
          <Route path="/bill/jobs" element={<BillJobsPage />} />
          <Route path="/bill/evaluation" element={<BillDatasetEvalPage />} />
          <Route path="/bill/versions" element={<BillVersionsPage />} />
          <Route path="/bill/issues" element={<BillIssuesPage />} />
        </Route>
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/import-export" element={<ImportExportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/ocr" replace />} />
    </Routes>
  );
}
