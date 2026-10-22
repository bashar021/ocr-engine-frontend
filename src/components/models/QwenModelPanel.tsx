import { CheckCircleOutlined, CloudServerOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Spin, Tag } from "antd";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getQwenModelStatus } from "@/api/qwen";
import { formatBytes } from "@/utils/format";

export function QwenModelPanel() {
  const statusQuery = useQuery({
    queryKey: ["vision", "qwen", "status"],
    queryFn: getQwenModelStatus,
    refetchInterval: 30_000,
  });
  const status = statusQuery.data;
  const details = status?.details ?? {};

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Card
        className="max-w-4xl"
        title={
          <div className="flex items-center gap-2">
            <ThunderboltOutlined className="text-violet-600" />
            <span>Vision language model</span>
          </div>
        }
        extra={
          <Button size="small" onClick={() => void statusQuery.refetch()} loading={statusQuery.isFetching}>
            Refresh status
          </Button>
        }
      >
        {statusQuery.isLoading ? (
          <div className="py-8 text-center"><Spin /></div>
        ) : statusQuery.isError ? (
          <Alert type="error" showIcon message="Unable to check the local Qwen model" />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xl font-semibold text-slate-900">{status?.model ?? "qwen2.5vl:7b"}</span>
              {status?.available ? (
                <Tag icon={<CheckCircleOutlined />} color="success">Installed and ready</Tag>
              ) : (
                <Tag color="warning">Not available</Tag>
              )}
              <Tag color="purple">LLM</Tag>
              <Tag color="geekblue">Ollama</Tag>
            </div>

            <p className="max-w-2xl text-slate-600">
              A local multimodal model for direct image-and-prompt conversations. It is not an OCR registry artifact and does not participate in the detection or recognition pipeline.
            </p>

            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Provider"><CloudServerOutlined className="mr-1" />Local Ollama</Descriptions.Item>
              <Descriptions.Item label="Endpoint">{status?.ollama_base_url ?? "http://127.0.0.1:11434"}</Descriptions.Item>
              <Descriptions.Item label="Model size">{status?.size_bytes != null ? formatBytes(status.size_bytes) : "—"}</Descriptions.Item>
              <Descriptions.Item label="Parameters">{typeof details.parameter_size === "string" ? details.parameter_size : "—"}</Descriptions.Item>
              <Descriptions.Item label="Family">{typeof details.family === "string" ? details.family : "Qwen2.5-VL"}</Descriptions.Item>
              <Descriptions.Item label="Usage">Live OCR → Qwen2.5-VL direct</Descriptions.Item>
            </Descriptions>

            {status?.available ? (
              <Alert
                type="success"
                showIcon
                message="Ready for direct image chat"
                description="Send an image with any custom prompt from the Live OCR Qwen2.5-VL direct workspace. The existing OCR pipeline is bypassed."
              />
            ) : (
              <Alert type="warning" showIcon message="Qwen2.5-VL is not ready" description={status?.error ?? "Start Ollama and install the model."} />
            )}

            <Button type="primary" icon={<ThunderboltOutlined />}>
              <Link to="/ocr">Open Qwen2.5-VL direct chat</Link>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
