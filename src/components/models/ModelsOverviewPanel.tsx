import {
  ApiOutlined,
  ClusterOutlined,
  ExperimentOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";

const STEPS = [
  {
    icon: <ClusterOutlined className="text-teal-700" />,
    title: "Upload model artifacts",
    body: "Register immutable SemVer weights for detection and recognition (.pt, .onnx, .json, …). Each upload becomes a versioned artifact with digest and status.",
  },
  {
    icon: <LinkOutlined className="text-teal-700" />,
    title: "Create a model ref",
    body: "Bind one detection artifact + one recognition artifact into a logical model_ref (e.g. v1). This is what OCR clients call at inference time.",
  },
  {
    icon: <ApiOutlined className="text-teal-700" />,
    title: "Activate for serving",
    body: "Activate (and optionally set default) so /v1/ocr/odometer and /v1/ocr/odometer/{model_ref} load that pipeline. Disable to take it out of rotation without deleting artifacts.",
  },
  {
    icon: <ExperimentOutlined className="text-teal-700" />,
    title: "Evaluate offline",
    body: "Use Dataset to upload ZIP datasets, poll ingest, run evaluations against a model_ref, and inspect metrics / sample results.",
  },
];

export function ModelsOverviewPanel() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="max-w-3xl">
        <h2 className="text-lg font-semibold text-slate-900">
          How models work
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          OCR serving uses a two-stage pipeline. Artifacts are the uploaded
          weights; model refs are the named bindings you point traffic and
          evaluations at.
        </p>
      </div>

      <ol className="mt-8 grid gap-4 md:grid-cols-2">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="rounded-lg border border-slate-100 bg-slate-50/80 p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-700 shadow-sm">
                {index + 1}
              </span>
              <span className="text-base">{step.icon}</span>
              <h3 className="text-sm font-semibold text-slate-900">
                {step.title}
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              {step.body}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-dashed border-slate-200 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Models
          </div>
          <p className="mt-2 text-sm text-slate-700">
            Artifact inventory: name, version, role, runtime, digest, training
            accuracy.
          </p>
        </div>
        <div className="rounded-lg border border-dashed border-slate-200 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Model refs
          </div>
          <p className="mt-2 text-sm text-slate-700">
            Bound pipelines with evaluation counts and accuracy / latency
            metrics.
          </p>
        </div>
        <div className="rounded-lg border border-dashed border-slate-200 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Next steps
          </div>
          <p className="mt-2 text-sm text-slate-700">
            Open{" "}
            <Link to="/evaluation/datasets" className="text-teal-700 underline">
              Dataset
            </Link>{" "}
            or{" "}
            <Link to="/ocr" className="text-teal-700 underline">
              OCR playground
            </Link>{" "}
            for live inference with bounding boxes.
          </p>
        </div>
      </div>
    </div>
  );
}
