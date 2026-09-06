import {
  CloudUploadOutlined,
  ScanOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Button,
  Empty,
  Progress,
  Radio,
  Select,
  Tag,
  Upload,
  message,
} from "antd";
import { useMemo, useRef, useState } from "react";

import { getApiErrorMessage } from "@/api/client";
import { runOdometerOcr } from "@/api/ocr";
import { OcrImageViewer } from "@/components/ocr/OcrImageViewer";
import { useModelRefsQuery } from "@/features/models/useModelRefsQuery";
import type { OcrJobResult } from "@/types/ocr";
import { formatPercent } from "@/utils/format";

type Mode = "single" | "batch";

function statusColor(status?: string) {
  if (status === "success") return "green";
  if (status === "low_confidence") return "gold";
  if (status === "failed") return "red";
  return "default";
}

export function OcrPlaygroundPage() {
  const [mode, setMode] = useState<Mode>("single");
  const [modelRef, setModelRef] = useState<string | undefined>();
  const [jobs, setJobs] = useState<OcrJobResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const filesRef = useRef<File[]>([]);

  const refsQuery = useModelRefsQuery({
    include_metrics: false,
    ocr_type: "odometer",
  });
  const refOptions = useMemo(
    () =>
      (refsQuery.data?.refs ?? [])
        .filter((r) => r.status === "active")
        .map((r) => ({
          value: r.model_ref,
          label: `${r.model_ref}${r.is_default ? " (default)" : ""}`,
        })),
    [refsQuery.data?.refs],
  );

  const active = jobs[activeIndex];

  const progress = useMemo(() => {
    if (!jobs.length) return 0;
    const done = jobs.filter(
      (j) => !j.loading && (j.response || j.error),
    ).length;
    return Math.round((done / jobs.length) * 100);
  }, [jobs]);

  const clearJobs = () => {
    for (const job of jobs) URL.revokeObjectURL(job.previewUrl);
    filesRef.current = [];
    setJobs([]);
    setActiveIndex(0);
  };

  const onFilesSelected = (files: File[]) => {
    if (!files.length) return;
    clearJobs();
    const selected = mode === "single" ? files.slice(0, 1) : files;
    filesRef.current = selected;
    setJobs(
      selected.map((file) => ({
        fileName: file.name,
        previewUrl: URL.createObjectURL(file),
      })),
    );
    setActiveIndex(0);
  };

  const runAll = async () => {
    if (!filesRef.current.length) {
      message.warning("Select at least one image");
      return;
    }
    setRunning(true);
    for (let i = 0; i < filesRef.current.length; i += 1) {
      const file = filesRef.current[i]!;
      setJobs((prev) =>
        prev.map((p, idx) =>
          idx === i ? { ...p, loading: true, error: undefined } : p,
        ),
      );
      setActiveIndex(i);
      try {
        const response = await runOdometerOcr(file, modelRef);
        setJobs((prev) =>
          prev.map((p, idx) =>
            idx === i
              ? { ...p, loading: false, response, error: undefined }
              : p,
          ),
        );
      } catch (error) {
        setJobs((prev) =>
          prev.map((p, idx) =>
            idx === i
              ? { ...p, loading: false, error: getApiErrorMessage(error) }
              : p,
          ),
        );
      }
    }
    setRunning(false);
  };

  return (
    <div className="ocr-landing-bg relative flex h-full min-h-0 flex-1 flex-col overflow-hidden text-slate-100">
      <div className="ocr-grid-overlay pointer-events-none absolute inset-0" />

      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 ring-1 ring-cyan-400/30">
            <ScanOutlined className="text-lg text-cyan-300" />
          </div>
          <div>
            <div className="font-display text-lg font-bold tracking-tight text-white">
              OCR Playground
            </div>
            <div className="text-xs text-slate-400">
              Odometer detection & recognition studio
            </div>
          </div>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<ThunderboltOutlined />}
          loading={running}
          onClick={() => void runAll()}
          disabled={!jobs.length}
          className="!border-cyan-400/40 !bg-cyan-500 !shadow-lg !shadow-cyan-500/20 hover:!bg-cyan-400"
        >
          Run OCR
        </Button>
      </header>

      <div className="relative z-10 min-h-0 flex-1 overflow-auto">
        <div className="mx-auto grid max-w-[1400px] gap-8 p-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:p-8">
          <aside className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
              <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300/90">
                Live pipeline
              </p>
              <h1 className="font-display mt-2 text-3xl font-extrabold leading-tight text-white">
                See the read.
                <span className="block text-cyan-200">Trust the box.</span>
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Drop dashboard photos, pick an active model ref, and inspect
                detections plus digit confidence in one view.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 backdrop-blur-sm">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Mode
              </div>
              <Radio.Group
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value);
                  clearJobs();
                }}
                optionType="button"
                buttonStyle="solid"
                className="!flex w-full [&_.ant-radio-button-wrapper]:flex-1 [&_.ant-radio-button-wrapper]:text-center"
                options={[
                  { value: "single", label: "Single" },
                  { value: "batch", label: "Batch" },
                ]}
              />

              <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Model ref
              </div>
              <Select
                allowClear
                className="w-full"
                placeholder="Default active model"
                options={refOptions}
                value={modelRef}
                onChange={setModelRef}
                loading={refsQuery.isLoading}
              />

              <Upload.Dragger
                className="mt-4 !border-white/15 !bg-white/5 hover:!border-cyan-400/40"
                multiple={mode === "batch"}
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                showUploadList={false}
                beforeUpload={(_, fileList) => {
                  onFilesSelected([...fileList] as File[]);
                  return false;
                }}
              >
                <p className="ant-upload-drag-icon !text-cyan-300">
                  <CloudUploadOutlined />
                </p>
                <p className="ant-upload-text !text-slate-200">
                  {mode === "single"
                    ? "Drop one dashboard image"
                    : "Drop multiple images"}
                </p>
                <p className="ant-upload-hint !text-slate-500">
                  JPEG / PNG / WebP
                </p>
              </Upload.Dragger>

              {jobs.length > 0 ? (
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-slate-400">
                    <span>
                      {jobs.length} image{jobs.length === 1 ? "" : "s"}
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <Progress
                    percent={progress}
                    size="small"
                    strokeColor="#22d3ee"
                    trailColor="rgba(255,255,255,0.08)"
                  />
                </div>
              ) : null}
            </div>

            {jobs.length > 1 ? (
              <div className="max-h-64 space-y-2 overflow-auto rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                {jobs.map((job, idx) => (
                  <button
                    key={`${job.fileName}-${idx}`}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                      idx === activeIndex
                        ? "bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-400/30"
                        : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <span className="truncate">{job.fileName}</span>
                    {job.loading ? (
                      <Tag>running</Tag>
                    ) : job.response ? (
                      <Tag color={statusColor(job.response.status)}>
                        {job.response.status}
                      </Tag>
                    ) : job.error ? (
                      <Tag color="red">error</Tag>
                    ) : (
                      <Tag>queued</Tag>
                    )}
                  </button>
                ))}
              </div>
            ) : null}
          </aside>

          <section className="min-w-0">
            {!active ? (
              <div className="flex h-full min-h-[480px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center backdrop-blur-sm">
                <ScanOutlined className="mb-4 text-5xl text-cyan-400/60" />
                <h2 className="font-display text-2xl font-bold text-white">
                  Upload to begin
                </h2>
                <p className="mt-2 max-w-md text-sm text-slate-400">
                  Your image, bounding boxes, and recognized mileage appear here
                  — tuned for quick visual QA before you ship a model ref.
                </p>
                <Empty
                  className="mt-6 [&_.ant-empty-description]:!text-slate-500"
                  description="Waiting for an image"
                />
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4 backdrop-blur-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">
                        {active.fileName}
                      </div>
                      <div className="text-xs text-slate-400">
                        Bounding boxes overlay
                      </div>
                    </div>
                    {active.response ? (
                      <Tag color={statusColor(active.response.status)}>
                        {active.response.status}
                      </Tag>
                    ) : null}
                  </div>
                  <OcrImageViewer
                    src={active.previewUrl}
                    boxes={active.response?.detections ?? []}
                    selected={active.response?.selected_detection}
                    imageWidth={active.response?.image_size?.width}
                    imageHeight={active.response?.image_size?.height}
                  />
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Reading
                    </div>
                    <div className="font-mono-brand mt-2 text-4xl font-semibold tracking-wider text-white">
                      {active.response?.value ?? "—"}
                    </div>
                    <div className="mt-2 text-sm text-slate-300">
                      Overall confidence{" "}
                      <span className="font-medium text-cyan-200">
                        {formatPercent(active.response?.confidence ?? null)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Model ref:{" "}
                      {active.response?.model_ref ?? modelRef ?? "default"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Confidence breakdown
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Detection</span>
                        <span className="font-medium text-slate-100">
                          {formatPercent(
                            active.response?.confidence_breakdown
                              ?.detection_confidence ??
                              active.response?.selected_detection?.confidence ??
                              null,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Recognition</span>
                        <span className="font-medium text-slate-100">
                          {formatPercent(
                            active.response?.confidence_breakdown
                              ?.recognition_confidence ?? null,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Quality</span>
                        <span className="font-medium text-slate-100">
                          {formatPercent(
                            active.response?.confidence_breakdown
                              ?.quality_score ?? null,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-white/10 pt-2">
                        <span className="text-slate-400">Final</span>
                        <span className="font-medium text-cyan-200">
                          {formatPercent(
                            active.response?.confidence_breakdown
                              ?.final_confidence ??
                              active.response?.confidence ??
                              null,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {active.response?.fail_stage ||
                  active.response?.status === "failed" ? (
                    <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                      <div className="font-semibold">
                        Failed at:{" "}
                        {active.response?.fail_stage ?? "unknown stage"}
                      </div>
                      <div className="mt-1 text-amber-200/90">
                        {active.response?.fail_stage === "recognition"
                          ? "Detection succeeded — bounding box is still shown."
                          : active.response?.fail_stage === "detection"
                            ? "No usable odometer region was found."
                            : active.response?.message ||
                              "OCR did not complete successfully."}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Detection boxes
                    </div>
                    <div className="mt-2 space-y-2 text-sm">
                      {(active.response?.detections ?? []).length === 0 ? (
                        <div className="text-slate-500">No boxes yet</div>
                      ) : (
                        (active.response?.detections ?? []).map((box, i) => (
                          <div
                            key={`${box.x1}-${i}`}
                            className="rounded-lg bg-white/5 px-3 py-2 font-mono-brand text-xs text-slate-300"
                          >
                            [{box.x1.toFixed(0)}, {box.y1.toFixed(0)}] → [
                            {box.x2.toFixed(0)}, {box.y2.toFixed(0)}] ·{" "}
                            {(box.confidence * 100).toFixed(1)}%
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {active.error ||
                  (active.response?.message &&
                    active.response.status === "failed") ? (
                    <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
                      {active.error || active.response?.message}
                      {active.response?.error_code
                        ? ` (${active.response.error_code})`
                        : ""}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
