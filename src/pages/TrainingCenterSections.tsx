import { Card, Typography } from "antd";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/common/PageHeader";

/** Thin Training Center panels that reuse existing product pages. */
export function TrainingCenterSectionPage({
  title,
  description,
  links,
}: {
  title: string;
  description: string;
  links: { label: string; to: string }[];
}) {
  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { title: "Training Center", path: "/training-center" },
          { title },
        ]}
      />
      <div className="space-y-3 p-6">
        <Typography.Paragraph type="secondary">
          {description}
        </Typography.Paragraph>
        <div className="grid gap-3 md:grid-cols-2">
          {links.map((l) => (
            <Card key={l.to} size="small">
              <Link to={l.to} className="font-medium">
                {l.label}
              </Link>
              <Typography.Paragraph
                type="secondary"
                className="!mb-0 !mt-1 text-sm"
              >
                Opens the existing {l.label.toLowerCase()} workspace.
              </Typography.Paragraph>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TrainingCenterDetectionPage() {
  return (
    <TrainingCenterSectionPage
      title="Detection"
      description="Detection remains an independent lineage. Recognition cycles skip detection by default."
      links={[
        { label: "Model artifacts", to: "/models/list" },
        { label: "Training runs", to: "/training/runs" },
        { label: "Pipeline refs", to: "/models/refs" },
      ]}
    />
  );
}

export function TrainingCenterRecognitionPage() {
  return (
    <TrainingCenterSectionPage
      title="Recognition"
      description="PaddleOCR recognition training, crop packs, and recognition configs."
      links={[
        { label: "Recognition configs", to: "/models/recognition-configs" },
        {
          label: "Training datasets / crop packs",
          to: "/evaluation/training-datasets",
        },
        { label: "Curate failures", to: "/training/curate" },
        { label: "Training runs", to: "/training/runs" },
      ]}
    />
  );
}

export function TrainingCenterDatasetsPage() {
  return (
    <TrainingCenterSectionPage
      title="Datasets"
      description="Evaluation datasets, training packs, and protected-test sets."
      links={[
        { label: "Evaluation datasets", to: "/evaluation/datasets" },
        { label: "Training datasets", to: "/evaluation/training-datasets" },
        { label: "Databank", to: "/evaluation/dataset-list" },
      ]}
    />
  );
}

export function TrainingCenterEvaluationsPage() {
  return (
    <TrainingCenterSectionPage
      title="Evaluations"
      description="Full-image E2E evaluation runs used by the protected-test gate."
      links={[
        { label: "Evaluation runs", to: "/evaluation/runs" },
        { label: "Evaluation datasets", to: "/evaluation/datasets" },
      ]}
    />
  );
}

export function TrainingCenterModelsPage() {
  return (
    <TrainingCenterSectionPage
      title="Models"
      description="Production detector+recognizer pairs, candidates, and rollback targets."
      links={[
        { label: "Model list", to: "/models/list" },
        { label: "Pipeline refs", to: "/models/refs" },
        { label: "Model overview", to: "/models/overview" },
      ]}
    />
  );
}
