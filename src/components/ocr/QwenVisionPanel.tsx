import { CloudUploadOutlined, SendOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Input, Tag, Upload, message } from "antd";
import { useEffect, useState } from "react";

import { getApiErrorMessage } from "@/api/client";
import { chatWithQwen, type QwenVisionResponse } from "@/api/qwen";

const { TextArea } = Input;

export function QwenVisionPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(
    "Read all visible text in this image. Return the answer clearly.",
  );
  const [response, setResponse] = useState<QwenVisionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const selectFile = (nextFile: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setResponse(null);
    setError(null);
  };

  const send = async () => {
    if (!file) {
      message.warning("Choose an image first");
      return;
    }
    if (!prompt.trim()) {
      message.warning("Enter a prompt for Qwen2.5-VL");
      return;
    }
    setRunning(true);
    setError(null);
    setResponse(null);
    try {
      setResponse(await chatWithQwen(file, prompt.trim()));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="relative z-10 min-h-0 flex-1 overflow-auto">
      <div className="mx-auto grid max-w-[1440px] gap-8 p-8 lg:grid-cols-[400px_minmax(0,1fr)] lg:p-10">
        <aside className="space-y-6">
          <div className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-6 backdrop-blur-sm">
            <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-violet-200">
              Direct vision chat
            </p>
            <h1 className="font-display mt-3 text-4xl font-extrabold leading-tight text-white">
              Ask Qwen about an image.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              Your image and prompt are sent directly to the local
              <code className="mx-1 rounded bg-black/20 px-1.5 py-0.5 text-violet-100">
                qwen2.5vl:7b
              </code>
              model. The OCR detection and recognition pipeline is not used.
            </p>
          </div>

          <Alert
            type="info"
            showIcon
            message="One-time local setup"
            description={
              <span>
                Start Ollama with <code>ollama serve</code>, then download the
                model with <code>ollama pull qwen2.5vl:7b</code>. Keep Ollama
                running while using this workspace.
              </span>
            }
          />

          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 backdrop-blur-sm">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Image
            </div>
            <Upload.Dragger
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              maxCount={1}
              showUploadList={false}
              beforeUpload={(nextFile) => {
                selectFile(nextFile);
                return false;
              }}
              className="!border-white/15 !bg-white/5 hover:!border-violet-400/50 [&_.ant-upload]:!py-7"
            >
              <p className="ant-upload-drag-icon !text-3xl !text-violet-300">
                <CloudUploadOutlined />
              </p>
              <p className="ant-upload-text !text-base !text-slate-200">
                {file ? file.name : "Drop an image or click to browse"}
              </p>
              <p className="ant-upload-hint !text-sm !text-slate-500">
                JPEG / PNG / WebP · one image per message
              </p>
            </Upload.Dragger>

            <div className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Custom prompt
            </div>
            <TextArea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={6}
              placeholder="For example: Read the odometer and answer with only the number."
              className="!border-white/15 !bg-white/5 !text-slate-100 placeholder:!text-slate-500"
            />
            <Button
              type="primary"
              size="large"
              block
              icon={<SendOutlined />}
              loading={running}
              disabled={!file || !prompt.trim()}
              onClick={() => void send()}
              className="mt-4 !h-11 !border-violet-400/40 !bg-violet-500 hover:!bg-violet-400"
            >
              Ask Qwen2.5-VL
            </Button>
          </div>
        </aside>

        <section className="min-w-0">
          {!file ? (
            <div className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-10 text-center backdrop-blur-sm">
              <CloudUploadOutlined className="mb-5 text-6xl text-violet-300/70" />
              <h2 className="font-display text-3xl font-bold text-white">Upload an image to begin</h2>
              <p className="mt-3 max-w-md text-base text-slate-400">
                Qwen2.5-VL will answer only from the image and prompt you provide.
              </p>
              <Empty className="mt-8 [&_.ant-empty-description]:!text-slate-500" description="Waiting for an image" />
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 backdrop-blur-sm">
                <div className="mb-4 text-base font-medium text-white">{file.name}</div>
                {previewUrl ? <img src={previewUrl} alt={file.name} className="max-h-[680px] w-full rounded-2xl object-contain" /> : null}
              </div>
              <div className="space-y-5">
                <div className="rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-950/60 to-slate-950/90 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-violet-200">Qwen response</div>
                    <Tag color="purple">qwen2.5vl:7b</Tag>
                  </div>
                  {running ? (
                    <div className="mt-4 text-slate-300">Qwen is analyzing the image…</div>
                  ) : response ? (
                    <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap break-words font-sans text-base leading-7 text-slate-100">
                      {response.response}
                    </pre>
                  ) : (
                    <div className="mt-4 text-slate-400">Send your prompt to see the model response here.</div>
                  )}
                </div>
                {response ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 text-sm text-slate-400">
                    <div>Model: <span className="text-slate-200">{response.model}</span></div>
                    {response.eval_count != null ? <div className="mt-2">Generated tokens: {response.eval_count}</div> : null}
                  </div>
                ) : null}
                {error ? <Alert type="error" showIcon message="Qwen request failed" description={error} /> : null}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
