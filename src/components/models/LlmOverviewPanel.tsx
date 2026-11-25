import { useState, useEffect, useCallback } from "react";
import {
  Card,
  Row,
  Col,
  Tag,
  Button,
  Table,
  Badge,
  Progress,
  Collapse,
  Space,
  Tooltip,
  Switch,
  message,
} from "antd";
import {
  ThunderboltOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  KeyOutlined,
  ClockCircleOutlined,
  ApiOutlined,
  CloudServerOutlined,
  SwapOutlined,
  InfoCircleOutlined,
  CodeOutlined,
  GlobalOutlined,
  CompassOutlined,
} from "@ant-design/icons";
import {
  getLlmOverview,
  testLlmConnection,
  resetGeminiKeyPool,
  type LlmOverviewResponse,
  type LlmLogItem,
} from "@/api/llm";

export function LlmOverviewPanel() {
  const [data, setData] = useState<LlmOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [resettingPool, setResettingPool] = useState<boolean>(false);

  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await getLlmOverview();
      setData(res);
    } catch (err: any) {
      if (!quiet) {
        message.error(err?.message || "Failed to fetch LLM overview data");
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData(true);
    }, 8000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const handleTestConnection = async (provider: string) => {
    setTestingProvider(provider);
    try {
      const res = await testLlmConnection(provider);
      if (res.success) {
        message.success(`${res.message} (${res.latency_ms}ms)`);
      } else {
        message.error(`${res.message}`);
      }
      fetchData(true);
    } catch (err: any) {
      message.error(err?.message || `Failed to test connection to ${provider}`);
    } finally {
      setTestingProvider(null);
    }
  };

  const handleResetPool = async () => {
    setResettingPool(true);
    try {
      const res = await resetGeminiKeyPool();
      message.success(res.message);
      fetchData(true);
    } catch (err: any) {
      message.error(err?.message || "Failed to reset key pool");
    } finally {
      setResettingPool(false);
    }
  };

  const summary = data?.summary || {
    total_calls: 0,
    successful_calls: 0,
    failed_calls: 0,
    success_rate: 100,
    quota_swaps_count: 0,
    avg_latency_ms: 0,
    last_activity: null,
  };

  const gemini = data?.providers?.gemini;
  const ollama = data?.providers?.ollama;
  const openai = data?.providers?.openai;

  const logColumns = [
    {
      title: "Timestamp",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 170,
      render: (ts: string) => {
        try {
          const d = new Date(ts);
          return (
            <span className="text-xs text-slate-500 font-mono">
              {d.toLocaleTimeString()} {d.toLocaleDateString([], { month: "short", day: "numeric" })}
            </span>
          );
        } catch {
          return <span className="text-xs text-slate-400 font-mono">{ts}</span>;
        }
      },
    },
    {
      title: "Provider & Model",
      key: "provider_model",
      width: 180,
      render: (_: any, r: LlmLogItem) => (
        <Space direction="vertical" size={2}>
          <div className="flex orientation-horizontal orientation-gap-1 items-center gap-1">
            <Tag
              color={
                r.provider === "gemini"
                  ? "blue"
                  : r.provider === "ollama_qwen"
                  ? "purple"
                  : r.provider === "openai"
                  ? "green"
                  : "default"
              }
              className="text-[11px] font-medium"
            >
              {r.provider === "ollama_qwen" ? "Ollama" : r.provider.toUpperCase()}
            </Tag>
            {r.swapped_key && (
              <Tooltip title="Quota limit triggered key swap">
                <Tag color="gold" className="text-[10px] px-1 py-0">
                  <SwapOutlined /> Rotated
                </Tag>
              </Tooltip>
            )}
          </div>
          <span className="text-xs text-slate-600 font-mono">{r.model}</span>
        </Space>
      ),
    },
    {
      title: "Feature",
      dataIndex: "feature",
      key: "feature",
      width: 150,
      render: (f: string) => {
        const featLabels: Record<string, { label: string; color: string }> = {
          databank_raw: { label: "Raw Extraction", color: "cyan" },
          scraper: { label: "Scraper Labeling", color: "geekblue" },
          scraper_filter: { label: "Scraper Filter", color: "magenta" },
          evaluation: { label: "Evaluation", color: "orange" },
          playground: { label: "Playground", color: "purple" },
        };
        const item = featLabels[f] || { label: f, color: "default" };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      title: "Status & Latency",
      key: "status_lat",
      width: 140,
      render: (_: any, r: LlmLogItem) => (
        <Space size={6}>
          {r.success ? (
            <Badge status="success" text={<span className="text-xs text-emerald-700 font-medium">OK</span>} />
          ) : (
            <Badge status="error" text={<span className="text-xs text-rose-600 font-medium">Error</span>} />
          )}
          <span className="text-xs text-slate-500 font-mono">
            {r.latency_ms > 0 ? `${r.latency_ms}ms` : "-"}
          </span>
        </Space>
      ),
    },
    {
      title: "Output / Details",
      dataIndex: "details",
      key: "details",
      render: (d: string | null, r: LlmLogItem) => {
        if (r.error) {
          return <span className="text-xs text-rose-600 font-mono truncate max-w-md block">{r.error}</span>;
        }
        if (!d) return <span className="text-xs text-slate-400 italic">No output logged</span>;
        return (
          <Tooltip title={d}>
            <span className="text-xs text-slate-700 font-mono truncate max-w-md block">
              {d.length > 90 ? `${d.slice(0, 90)}...` : d}
            </span>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-1 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ThunderboltOutlined className="text-amber-500" />
              External & Multimodal LLM Operations
            </h1>
            <Tag color="blue" className="font-semibold uppercase tracking-wider text-[10px]">
              Hybrid Architecture
            </Tag>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Real-time monitoring, multi-key quota management, and performance analytics for external APIs (Gemini, OpenAI) and local vision backends (Qwen2.5-VL).
          </p>
        </div>

        <div className="flex orientation-horizontal items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span>Auto-refresh:</span>
            <Switch
              size="small"
              checked={autoRefresh}
              onChange={setAutoRefresh}
            />
          </div>
          <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={() => fetchData()}
            loading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" className="h-full border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total LLM Requests
              </span>
              <ThunderboltOutlined className="text-blue-500 text-base" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
              {summary.total_calls.toLocaleString()}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="text-emerald-600 font-medium">
                {summary.successful_calls} success
              </span>
              <span>•</span>
              <span className="text-rose-500 font-medium">
                {summary.failed_calls} failed
              </span>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card size="small" className="h-full border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Success Rate
              </span>
              <CheckCircleOutlined className="text-emerald-500 text-base" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
              {summary.success_rate}%
            </div>
            <div className="mt-1">
              <Progress
                percent={summary.success_rate}
                size="small"
                status={summary.success_rate >= 95 ? "success" : "exception"}
                showInfo={false}
              />
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card size="small" className="h-full border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Key Pool & Quota Swaps
              </span>
              <SwapOutlined className="text-amber-500 text-base" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
              {summary.quota_swaps_count}
              <span className="text-xs text-slate-400 font-normal ml-1">swaps</span>
            </div>
            <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
              <span>Pool Size: {gemini?.key_pool?.total_keys || 0} keys</span>
              <span className="text-emerald-600 font-medium">
                {gemini?.key_pool?.standby_keys_count || 0} standby
              </span>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card size="small" className="h-full border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Average Latency
              </span>
              <ClockCircleOutlined className="text-purple-500 text-base" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
              {summary.avg_latency_ms} <span className="text-sm font-normal text-slate-400">ms</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {summary.last_activity ? (
                <span>Last active: {new Date(summary.last_activity).toLocaleTimeString()}</span>
              ) : (
                <span>No requests recorded yet</span>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Provider Details Cards */}
      <div>
        <h2 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <CloudServerOutlined className="text-blue-600" />
          Configured LLM Providers & Key Pools
        </h2>

        <Row gutter={[16, 16]}>
          {/* Google Gemini Card */}
          <Col xs={24} lg={8}>
            <Card
              size="small"
              className="h-full border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
              title={
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                    <span className="font-semibold text-slate-900">Google Gemini</span>
                  </div>
                  {gemini?.configured ? (
                    <Tag color="success">OPERATIONAL</Tag>
                  ) : (
                    <Tag color="error">NO KEY</Tag>
                  )}
                </div>
              }
            >
              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="text-slate-500">Active Model:</span>
                  <div className="mt-0.5">
                    <Tag color="geekblue" className="font-mono text-xs">
                      {gemini?.default_model || "gemini-3.5-flash-lite"}
                    </Tag>
                  </div>
                </div>

                {/* Key Pool Visualizer */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <KeyOutlined className="text-amber-500" /> Key Rotation Pool
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {gemini?.key_pool?.total_keys || 0} keys registered
                    </span>
                  </div>

                  {gemini?.key_pool?.keys && gemini.key_pool.keys.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {gemini.key_pool.keys.map((k) => (
                        <div
                          key={k.index}
                          className={`flex items-center justify-between p-1.5 rounded border text-[11px] font-mono ${
                            k.status === "active"
                              ? "bg-emerald-50/70 border-emerald-300 text-emerald-900 font-semibold"
                              : k.status === "exhausted"
                              ? "bg-rose-50/70 border-rose-300 text-rose-800"
                              : "bg-white border-slate-200 text-slate-600"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">#{k.index + 1}</span>
                            <span>{k.masked_key}</span>
                          </div>
                          <div>
                            {k.status === "active" && (
                              <Tag color="success" className="mr-0 text-[10px] px-1 py-0">
                                ACTIVE
                              </Tag>
                            )}
                            {k.status === "standby" && (
                              <Tag color="blue" className="mr-0 text-[10px] px-1 py-0">
                                STANDBY
                              </Tag>
                            )}
                            {k.status === "exhausted" && (
                              <Tooltip title={`Cooldown remaining: ${k.exhausted_remaining_seconds}s (${k.exhausted_reason || "Quota limit"})`}>
                                <Tag color="error" className="mr-0 text-[10px] px-1 py-0">
                                  EXHAUSTED
                                </Tag>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">No keys in GEMINI_API_KEY array</div>
                  )}

                  <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                    <InfoCircleOutlined className="text-blue-500" />
                    Automatically cascades to next key upon 429 quota exhaustion.
                  </div>
                </div>

                {/* Gemini Stats */}
                <div className="grid grid-cols-3 gap-2 py-1 text-center bg-white rounded-lg border border-slate-100 p-2">
                  <div>
                    <div className="text-slate-400 text-[11px]">Calls</div>
                    <div className="font-semibold text-slate-800 font-mono text-sm">
                      {gemini?.stats?.calls || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[11px]">Successes</div>
                    <div className="font-semibold text-emerald-600 font-mono text-sm">
                      {gemini?.stats?.successes || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[11px]">Avg Latency</div>
                    <div className="font-semibold text-slate-800 font-mono text-sm">
                      {gemini?.stats?.avg_latency_ms || 0}ms
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    icon={<ApiOutlined />}
                    loading={testingProvider === "gemini"}
                    onClick={() => handleTestConnection("gemini")}
                    className="flex-1"
                  >
                    Test Ping
                  </Button>
                  <Button
                    size="small"
                    icon={<SwapOutlined />}
                    loading={resettingPool}
                    onClick={handleResetPool}
                    title="Reset quota exhausted statuses immediately"
                  >
                    Reset Pool
                  </Button>
                </div>
              </div>
            </Card>
          </Col>

          {/* OpenAI (External Future / Ready) Card */}
          <Col xs={24} lg={8}>
            <Card
              size="small"
              className="h-full border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
              title={
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        openai?.configured ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                    <span className="font-semibold text-slate-900">OpenAI</span>
                  </div>
                  {openai?.configured ? (
                    <Tag color="success">READY</Tag>
                  ) : (
                    <Tag color="default">NOT CONFIGURED</Tag>
                  )}
                </div>
              }
            >
              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="text-slate-500">Configured Models:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Tag color="green" className="font-mono text-xs">
                      {openai?.default_model || "gpt-4o-mini"}
                    </Tag>
                    <Tag className="font-mono text-xs">gpt-4o</Tag>
                    <Tag className="font-mono text-xs">o3-mini</Tag>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-700">Environment Setup</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      OPENAI_API_KEY
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Set <code className="bg-white px-1 py-0.5 rounded border border-slate-200">OPENAI_API_KEY</code> in <code className="bg-white px-1 py-0.5 rounded border border-slate-200">ocr-engine/.env</code> to unlock GPT-4o vision extraction & comparative evaluations.
                  </p>
                  <div className="mt-2 text-[11px] text-slate-500">
                    Status: {openai?.configured ? `${openai.keys_count} key(s) detected` : "Empty key list []"}
                  </div>
                </div>

                {/* OpenAI Stats */}
                <div className="grid grid-cols-3 gap-2 py-1 text-center bg-white rounded-lg border border-slate-100 p-2">
                  <div>
                    <div className="text-slate-400 text-[11px]">Calls</div>
                    <div className="font-semibold text-slate-800 font-mono text-sm">
                      {openai?.stats?.calls || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[11px]">Successes</div>
                    <div className="font-semibold text-emerald-600 font-mono text-sm">
                      {openai?.stats?.successes || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[11px]">Status</div>
                    <div className="font-semibold text-slate-700 font-mono text-sm">
                      {openai?.configured ? "Armed" : "Standby"}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    disabled={!openai?.configured}
                    icon={<ApiOutlined />}
                    loading={testingProvider === "openai"}
                    onClick={() => handleTestConnection("openai")}
                    className="w-full"
                  >
                    Test OpenAI Connection
                  </Button>
                </div>
              </div>
            </Card>
          </Col>

          {/* Local Ollama (Qwen2.5-VL) Card */}
          <Col xs={24} lg={8}>
            <Card
              size="small"
              className="h-full border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
              title={
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        ollama?.status === "ready"
                          ? "bg-purple-500 animate-pulse"
                          : ollama?.status === "offline"
                          ? "bg-rose-400"
                          : "bg-amber-400"
                      }`}
                    />
                    <span className="font-semibold text-slate-900">Local Ollama (Vision)</span>
                  </div>
                  <Tag
                    color={
                      ollama?.status === "ready"
                        ? "purple"
                        : ollama?.status === "offline"
                        ? "default"
                        : "warning"
                    }
                  >
                    {ollama?.status === "ready"
                      ? "ONLINE"
                      : ollama?.status === "offline"
                      ? "OFFLINE"
                      : "MODEL MISSING"}
                  </Tag>
                </div>
              }
            >
              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="text-slate-500">Target Model & Endpoint:</span>
                  <div className="mt-0.5 flex items-center justify-between">
                    <Tag color="purple" className="font-mono text-xs">
                      {ollama?.target_model || "qwen2.5vl:7b"}
                    </Tag>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {ollama?.base_url || "http://127.0.0.1:11434"}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-700">Model Runtime Specs</span>
                    {ollama?.ping_latency_ms != null && (
                      <span className="text-[11px] text-emerald-600 font-mono font-medium">
                        {ollama.ping_latency_ms}ms ping
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div>
                      Size:{" "}
                      <span className="font-mono font-semibold">
                        {ollama?.model_size_bytes
                          ? `${(ollama.model_size_bytes / 1e9).toFixed(1)} GB`
                          : "Unknown"}
                      </span>
                    </div>
                    <div>
                      Family:{" "}
                      <span className="font-mono font-semibold">
                        {ollama?.model_details?.family || "qwen2.5-vl"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Role: Real-time image pre-filtering & non-odometer garbage discarding.
                  </div>
                </div>

                {/* Ollama Stats */}
                <div className="grid grid-cols-3 gap-2 py-1 text-center bg-white rounded-lg border border-slate-100 p-2">
                  <div>
                    <div className="text-slate-400 text-[11px]">Calls</div>
                    <div className="font-semibold text-slate-800 font-mono text-sm">
                      {ollama?.stats?.calls || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[11px]">Successes</div>
                    <div className="font-semibold text-emerald-600 font-mono text-sm">
                      {ollama?.stats?.successes || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[11px]">Avg Latency</div>
                    <div className="font-semibold text-slate-800 font-mono text-sm">
                      {ollama?.stats?.avg_latency_ms || 0}ms
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    icon={<ApiOutlined />}
                    loading={testingProvider === "ollama"}
                    onClick={() => handleTestConnection("ollama")}
                    className="w-full"
                  >
                    Test Local Ollama
                  </Button>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>

      {/* Extensible Future Providers Section */}
      <Card
        size="small"
        className="border-dashed border-slate-300 bg-slate-50/50"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CompassOutlined className="text-slate-600 text-lg" />
            <div>
              <span className="font-semibold text-slate-800 text-sm">
                Future Multimodal & External LLM Integrations
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                The OCR service is designed for provider extensibility. Additional external LLMs can be plugged in without downtime.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tag color="orange" className="font-mono text-xs">
              Anthropic Claude (3.7 Sonnet)
            </Tag>
            <Tag color="cyan" className="font-mono text-xs">
              DeepSeek-VL & OpenRouter
            </Tag>
          </div>
        </div>
      </Card>

      {/* Feature & Model Usage Breakdown */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            size="small"
            title={
              <span className="font-semibold text-slate-800 flex items-center gap-2">
                <GlobalOutlined className="text-teal-600" />
                Usage Breakdown by Feature
              </span>
            }
            className="h-full border-slate-200"
          >
            {data?.by_feature && data.by_feature.length > 0 ? (
              <div className="space-y-3">
                {data.by_feature.map((f) => {
                  const pct =
                    summary.total_calls > 0
                      ? Math.round((f.calls / summary.total_calls) * 100)
                      : 0;
                  return (
                    <div key={f.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">{f.label}</span>
                        <span className="text-slate-500 font-mono">
                          {f.calls} calls ({pct}%) • avg {f.avg_latency_ms}ms
                        </span>
                      </div>
                      <Progress percent={pct} size="small" showInfo={false} strokeColor="#0d9488" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-6 text-center italic">
                No feature calls recorded yet
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            size="small"
            title={
              <span className="font-semibold text-slate-800 flex items-center gap-2">
                <ThunderboltOutlined className="text-indigo-600" />
                Usage Breakdown by Model
              </span>
            }
            className="h-full border-slate-200"
          >
            {data?.by_model && data.by_model.length > 0 ? (
              <div className="space-y-3">
                {data.by_model.map((m) => {
                  const pct =
                    summary.total_calls > 0
                      ? Math.round((m.calls / summary.total_calls) * 100)
                      : 0;
                  return (
                    <div key={m.model} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-medium text-slate-700">{m.model}</span>
                        <span className="text-slate-500 font-mono">
                          {m.calls} calls ({pct}%) • avg {m.avg_latency_ms}ms
                        </span>
                      </div>
                      <Progress percent={pct} size="small" showInfo={false} strokeColor="#6366f1" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-6 text-center italic">
                No model calls recorded yet
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Active Prompts Library */}
      <Card
        size="small"
        title={
          <span className="font-semibold text-slate-800 flex items-center gap-2">
            <CodeOutlined className="text-blue-600" />
            Active Prompt & Extraction Rules Library
          </span>
        }
        className="border-slate-200"
      >
        <Collapse
          defaultActiveKey={["tight_odometer"]}
          ghost
          items={[
            {
              key: "tight_odometer",
              label: (
                <div className="flex items-center justify-between w-full pr-4">
                  <span className="font-medium text-slate-800 text-xs">
                    3-Condition Odometer & Tight 2D Bounding Box Prompt (Active in Databank Raw & Scraper)
                  </span>
                  <Tag color="cyan">Gemini Vision 3.5 Flash</Tag>
                </div>
              ),
              children: (
                <div className="bg-slate-900 text-slate-100 p-3.5 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-72">
                  {data?.prompts?.odometer_tight_bbox_prompt ||
                    "Loading prompt instructions..."}
                </div>
              ),
            },
            {
              key: "system_instruction",
              label: (
                <div className="flex items-center justify-between w-full pr-4">
                  <span className="font-medium text-slate-800 text-xs">
                    Automotive Odometer Domain System Instruction
                  </span>
                  <Tag color="blue">System Prompt</Tag>
                </div>
              ),
              children: (
                <div className="bg-slate-900 text-slate-100 p-3.5 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {data?.prompts?.odometer_system_instruction ||
                    "You are a specialized automotive meter and odometer OCR system."}
                </div>
              ),
            },
            {
              key: "visible_text",
              label: (
                <div className="flex items-center justify-between w-full pr-4">
                  <span className="font-medium text-slate-800 text-xs">
                    General Visible Text Extraction Prompt
                  </span>
                  <Tag color="default">Fallback</Tag>
                </div>
              ),
              children: (
                <div className="bg-slate-900 text-slate-100 p-3.5 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {data?.prompts?.visible_text_prompt ||
                    "Read all visible text in the image."}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Live Activity Log Table */}
      <Card
        size="small"
        title={
          <div className="flex items-center justify-between py-0.5">
            <span className="font-semibold text-slate-800 flex items-center gap-2">
              <ClockCircleOutlined className="text-slate-600" />
              Recent LLM Invocations & Event Log
            </span>
            <span className="text-xs text-slate-500 font-normal">
              Showing last {data?.recent_logs?.length || 0} events
            </span>
          </div>
        }
        className="border-slate-200"
      >
        <Table
          dataSource={data?.recent_logs || []}
          columns={logColumns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10, showSizeChanger: true }}
          locale={{ emptyText: "No LLM requests logged yet" }}
        />
      </Card>
    </div>
  );
}
