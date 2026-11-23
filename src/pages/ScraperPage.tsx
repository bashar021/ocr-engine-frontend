import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  CompassOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FilterOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  RocketOutlined,
  SearchOutlined,
  StopOutlined,
  TableOutlined,
  TagsOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Popconfirm,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import {
  batchDeleteImages,
  batchUpdateImageCategory,
  createCategory,
  deleteCategory,
  deleteImage,
  extractWithGemini,
  getCategories,
  getGeminiConfig,
  getGeminiPrompts,
  getImageBlob,
  getImages,
  getLabelJob,
  getSessions,
  getStats,
  listLabelJobs,
  promoteToDatabank,
  startLabelJob,
  startScrape,
  stopLabelJob,
  stopSession,
  updateCategory,
  updateImageCategory,
  updateImageGroundTruth,
} from "@/api/scraper";
import { PageHeader } from "@/components/common/PageHeader";
import { useDebounce } from "@/hooks/useDebounce";
import { formatBytes } from "@/utils/format";
import type {
  ScraperBBox,
  ScraperCategory,
  ScraperImage,
  ScraperSession,
  ScraperSessionStatus,
} from "@/types/scraper";

const STATUS_COLORS: Record<ScraperSessionStatus, string> = {
  pending: "default",
  running: "processing",
  completed: "success",
  failed: "error",
  stopped: "warning",
};

const SUGGESTED_KEYWORDS = [
  "odometer reading dashboard",
  "car speed meter gauge",
  "digital vehicle odometer",
  "analog speedometer cluster",
  "car mileage meter digits",
];

const DEFAULT_SOURCES = ["duckduckgo", "bing", "wikimedia", "openverse"];
const SOURCE_OPTIONS = [
  { value: "duckduckgo", label: "DuckDuckGo (Fast & High-res)" },
  { value: "bing", label: "Bing Images" },
  { value: "wikimedia", label: "Wikimedia Commons" },
  { value: "openverse", label: "Openverse" },
  { value: "flickr", label: "Flickr (needs API key)" },
];
const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  SOURCE_OPTIONS.map((o) => [o.value, o.label.replace(/ \(.*\)$/, "")]),
);

function ProviderTag({ provider }: { provider?: string | null }) {
  if (!provider) return null;
  return (
    <Tag color="purple" className="m-0 text-[11px]">
      {SOURCE_LABELS[provider] ?? provider}
    </Tag>
  );
}

function LicenseText({
  license,
  licenseUrl,
}: {
  license?: string | null;
  licenseUrl?: string | null;
}) {
  if (!license) return null;
  return licenseUrl ? (
    <a href={licenseUrl} target="_blank" rel="noreferrer" className="text-xs">
      {license}
    </a>
  ) : (
    <span className="text-xs text-slate-600">{license}</span>
  );
}

const PRESET_IMAGE_COUNTS = [50, 100, 250, 500, 1000, 5000];

// Max labeled images gathered for the "Send labeled → databank" shortcut in one
// click (promote takes explicit ids, so we cap the id-gathering query).
const PROMOTE_CATEGORY_CAP = 500;

// Preferred Gemini prompt id per category ocr_type (falls back to the first
// available prompt when there's no match).
const PROMPT_BY_OCR_TYPE: Record<string, string> = {
  odometer: "odometer_reading",
  bill: "invoice_total",
};

// Lightweight, format-level ground-truth validation per ocr_type (frontend guard
// only — returns an error message or null).
function validateGroundTruth(value: string, ocrType?: string): string | null {
  const v = value.trim();
  if (!v) return null; // emptiness is handled by the caller
  if (ocrType === "odometer" && !/^\d+(\.\d+)?$/.test(v)) {
    return "Odometer ground truth should be digits only (with an optional decimal point).";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Image Thumbnail helper component with blob caching
// ---------------------------------------------------------------------------

function ImageThumbnail({
  imageId,
  altText,
  className = "h-14 w-14",
  onClick,
}: {
  imageId: string;
  altText?: string | null;
  className?: string;
  onClick?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;

    void getImageBlob(imageId)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setUrl(objectUrl);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageId]);

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      className={`relative flex items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-100 ${className} ${
        onClick ? "cursor-pointer transition hover:border-blue-400 hover:shadow-xs" : ""
      }`}
    >
      {loading ? (
        <Spin size="small" />
      ) : url ? (
        <img
          src={url}
          alt={altText || "thumbnail"}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : failed ? (
        <PictureOutlined className="text-slate-400" />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// View 1: Spyder Page (Execution removed from main view, opened via "Run Spyder" modal)
// ---------------------------------------------------------------------------

export function SpyderPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  // Run Spyder Harvester Modal state (closed manually on button click)
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runSuccessNotice, setRunSuccessNotice] = useState<string | null>(null);

  // Form state
  const [url, setUrl] = useState("");
  const [keywords, setKeywords] = useState("");
  const [maxImages, setMaxImages] = useState<number>(100);
  const [maxPages, setMaxPages] = useState<number>(10);
  const [depth, setDepth] = useState<number>(2);
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [sources, setSources] = useState<string[]>(DEFAULT_SOURCES);
  const [maxPerSource, setMaxPerSource] = useState<number | undefined>(undefined);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Add-category modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");

  // Session detail modal
  const [detailSession, setDetailSession] = useState<ScraperSession | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["scraper", "categories"],
    queryFn: getCategories,
  });

  const sessionsQuery = useQuery({
    queryKey: ["scraper", "sessions"],
    queryFn: () => getSessions({ limit: 100 }),
    // Only poll while a session is actually pending/running; idle otherwise.
    refetchInterval: (query) => {
      const list = query.state.data?.sessions ?? [];
      const anyActive = list.some(
        (s) => s.status === "pending" || s.status === "running",
      );
      return anyActive ? 3000 : false;
    },
  });

  const scrapeMutation = useMutation({
    mutationFn: startScrape,
    onSuccess: (session) => {
      setRunSuccessNotice(
        `Spyder crawler session #${session.id.slice(0, 8)} started successfully! Crawling in background.`,
      );
      setUrl("");
      setKeywords("");
      setSources(DEFAULT_SOURCES);
      setMaxPerSource(undefined);
      queryClient.invalidateQueries({ queryKey: ["scraper", "sessions"] });
      queryClient.invalidateQueries({ queryKey: ["scraper", "stats"] });
      message.success("Autonomous Spyder harvester session started");
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const stopMutation = useMutation({
    mutationFn: stopSession,
    onSuccess: () => {
      message.success("Session stopped");
      queryClient.invalidateQueries({ queryKey: ["scraper", "sessions"] });
      queryClient.invalidateQueries({ queryKey: ["scraper", "stats"] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const createCatMutation = useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      createCategory(name, description),
    onSuccess: (cat) => {
      message.success(`Category "${cat.name}" created`);
      setCatModalOpen(false);
      setNewCatName("");
      setNewCatDesc("");
      setCategoryId(cat.id);
      queryClient.invalidateQueries({ queryKey: ["scraper", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["scraper", "stats"] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const handleStartScrape = useCallback(() => {
    const trimmedUrl = url.trim();
    const trimmedKeywords = keywords.trim();

    if (!trimmedUrl && !trimmedKeywords) {
      message.warning("Please provide search keywords or a seed URL for Spyder crawling");
      return;
    }
    if (!categoryId) {
      message.warning("Please select or create a category to enable zero-duplication tracking");
      return;
    }

    scrapeMutation.mutate({
      seed_url: trimmedUrl || undefined,
      keywords: trimmedKeywords || undefined,
      max_images: maxImages,
      max_pages: trimmedUrl ? maxPages : undefined,
      depth: trimmedUrl ? depth : undefined,
      category_id: categoryId,
      // Nothing selected = let the server use its defaults.
      sources: sources.length ? sources : undefined,
      max_per_source: maxPerSource,
    });
  }, [
    url,
    keywords,
    maxImages,
    maxPages,
    depth,
    categoryId,
    sources,
    maxPerSource,
    scrapeMutation,
    message,
  ]);

  // Re-run a stopped/failed session with the same keywords/category/sources.
  // The server resumes autonomous runs from stored cursors.
  const handleRunAgain = useCallback(
    (record: ScraperSession) => {
      const cfg = record.config as {
        keywords?: unknown;
        sources?: unknown;
        max_per_source?: unknown;
      };
      const kw =
        typeof cfg.keywords === "string" && cfg.keywords.trim()
          ? cfg.keywords.trim()
          : record.seed_url?.startsWith("auto:")
            ? record.seed_url.replace(/^auto:/, "")
            : undefined;
      if (!kw) {
        message.warning("This session has no stored keywords to run again");
        return;
      }
      const prevSources = Array.isArray(cfg.sources)
        ? (cfg.sources as unknown[]).filter(
            (x): x is string => typeof x === "string",
          )
        : [];
      scrapeMutation.mutate({
        keywords: kw,
        category_id: record.category_id ?? undefined,
        sources: prevSources.length ? prevSources : undefined,
        max_per_source:
          typeof cfg.max_per_source === "number" ? cfg.max_per_source : undefined,
      });
    },
    [scrapeMutation, message],
  );

  const sessions = sessionsQuery.data?.sessions ?? [];
  const activeCount = sessions.filter(
    (s) => s.status === "pending" || s.status === "running",
  ).length;
  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const totalHarvestedInSessions = sessions.reduce(
    (acc, s) => acc + (s.image_count ?? 0),
    0,
  );

  const sessionColumns: ColumnsType<ScraperSession> = [
    {
      title: "Query / Seed URL",
      dataIndex: "seed_url",
      key: "seed_url",
      ellipsis: true,
      render: (text: string) => {
        if (!text || text.startsWith("auto:")) {
          const kw = text ? text.replace(/^auto:/, "") : "Autonomous Search";
          return (
            <Space direction="vertical" size={2}>
              <Tag color="blue" icon={<SearchOutlined />}>
                Spyder Search
              </Tag>
              <Typography.Text strong ellipsis={{ tooltip: kw }} style={{ maxWidth: 280 }}>
                &ldquo;{kw}&rdquo;
              </Typography.Text>
            </Space>
          );
        }
        return (
          <Typography.Text copyable={{ text }} style={{ maxWidth: 280 }} ellipsis>
            {text}
          </Typography.Text>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: ScraperSessionStatus, record: ScraperSession) => {
        // A "completed" run that saved nothing is really an empty result, not a success.
        if (status === "completed" && (record.image_count ?? 0) === 0) {
          return (
            <Tooltip title={record.error || "No images were found for this query."}>
              <Tag color="warning" icon={<ExclamationCircleOutlined />}>
                empty
              </Tag>
            </Tooltip>
          );
        }
        const statusTag = (
          <Tag color={STATUS_COLORS[status]}>
            {status === "running" ? (
              <Space size={4}>
                <Spin size="small" />
                <span>running</span>
              </Space>
            ) : (
              status
            )}
          </Tag>
        );
        return status === "failed" && record.error ? (
          <Tooltip title={record.error}>{statusTag}</Tooltip>
        ) : (
          statusTag
        );
      },
    },
    {
      title: "Category",
      dataIndex: "category_name",
      key: "category_name",
      width: 140,
      render: (name: string | null) =>
        name ? <Tag color="geekblue">{name}</Tag> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "Harvested",
      dataIndex: "image_count",
      key: "image_count",
      width: 120,
      align: "right" as const,
      render: (count: number, record: ScraperSession) => (
        <Space size={4}>
          <Typography.Text strong className="font-mono text-sm text-blue-600">
            {(count ?? 0).toLocaleString()}
          </Typography.Text>
          {count > 0 && (
            <Tooltip title="View images in Scrape Data">
              <Button
                type="link"
                size="small"
                className="p-0 text-xs"
                onClick={() => navigate(`/scraper/data?session_id=${record.id}`)}
              >
                View
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: "Pages Visited",
      dataIndex: "pages_visited",
      key: "pages_visited",
      width: 105,
      align: "right" as const,
      render: (pages: number) => (pages ?? 0).toLocaleString(),
    },
    {
      title: "Started",
      dataIndex: "created_at",
      key: "created_at",
      width: 170,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: "Actions",
      key: "actions",
      width: 220,
      render: (_: unknown, record: ScraperSession) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setDetailSession(record)}
          >
            Details
          </Button>
          {(record.status === "pending" || record.status === "running") && (
            <Popconfirm
              title="Stop this crawler session?"
              onConfirm={() => stopMutation.mutate(record.id)}
            >
              <Button type="text" size="small" danger icon={<StopOutlined />}>
                Stop
              </Button>
            </Popconfirm>
          )}
          {(record.status === "stopped" || record.status === "failed") && (
            <Popconfirm
              title="Run again with the same settings?"
              description="Continues where the previous run left off."
              onConfirm={() => handleRunAgain(record)}
            >
              <Button
                size="small"
                icon={<ReloadOutlined />}
                loading={scrapeMutation.isPending}
              >
                Run again
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-slate-50/50">
      <PageHeader
        title="Spyder"
        description="Harvest images from the web and monitor crawl sessions"
        actions={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => sessionsQuery.refetch()}
              loading={sessionsQuery.isFetching}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              size="middle"
              icon={<ThunderboltOutlined />}
              onClick={() => {
                setRunSuccessNotice(null);
                setRunModalOpen(true);
              }}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 font-medium shadow-xs"
            >
              Run Spyder
            </Button>
          </Space>
        }
      />

      <div className="flex-1 space-y-5 p-6">
        {/* KPI Strip */}
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Card size="small" className="border-slate-200 shadow-xs">
              <Statistic
                title={
                  <span className="text-xs font-medium text-slate-500">
                    Active Crawlers
                  </span>
                }
                value={activeCount}
                prefix={
                  activeCount > 0 ? (
                    <Spin size="small" className="mr-1" />
                  ) : (
                    <ThunderboltOutlined className="text-amber-500" />
                  )
                }
                valueStyle={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: activeCount > 0 ? "#0284c7" : "#1e293b",
                }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={6}>
            <Card size="small" className="border-slate-200 shadow-xs">
              <Statistic
                title={
                  <span className="text-xs font-medium text-slate-500">
                    Completed Sessions
                  </span>
                }
                value={completedCount}
                prefix={<CheckCircleOutlined className="text-emerald-500" />}
                valueStyle={{ fontSize: "1.25rem", fontWeight: 700, color: "#059669" }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={6}>
            <Card size="small" className="border-slate-200 shadow-xs">
              <Statistic
                title={
                  <span className="text-xs font-medium text-slate-500">
                    Harvested (All Sessions)
                  </span>
                }
                value={totalHarvestedInSessions}
                prefix={<PictureOutlined className="text-blue-500" />}
                valueStyle={{ fontSize: "1.25rem", fontWeight: 700, color: "#2563eb" }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={6}>
            <Card size="small" className="border-slate-200 shadow-xs">
              <Statistic
                title={
                  <span className="text-xs font-medium text-slate-500">
                    Total Sessions
                  </span>
                }
                value={sessions.length}
                prefix={<CompassOutlined className="text-indigo-500" />}
                valueStyle={{ fontSize: "1.25rem", fontWeight: 700, color: "#4f46e5" }}
              />
            </Card>
          </Col>
        </Row>

        {/* Sessions Monitor Table */}
        <Card
          title={
            <div className="flex items-center justify-between">
              <Space>
                <CompassOutlined className="text-blue-500" />
                <span className="font-semibold text-slate-800">Spyder Crawl Sessions</span>
                <Badge
                  count={sessions.length}
                  overflowCount={999}
                  style={{ backgroundColor: "#0284c7" }}
                />
              </Space>
              <Button
                type="primary"
                ghost
                size="small"
                icon={<ThunderboltOutlined />}
                onClick={() => {
                  setRunSuccessNotice(null);
                  setRunModalOpen(true);
                }}
              >
                New Crawl
              </Button>
            </div>
          }
          size="small"
          className="border-slate-200 shadow-xs"
        >
          {sessions.length === 0 ? (
            <div className="py-12 text-center">
              <Empty
                description="No Spyder crawl sessions have been launched yet"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  onClick={() => {
                    setRunSuccessNotice(null);
                    setRunModalOpen(true);
                  }}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600"
                >
                  Run Spyder Now
                </Button>
              </Empty>
            </div>
          ) : (
            <Table
              rowKey="id"
              dataSource={sessions}
              columns={sessionColumns}
              loading={sessionsQuery.isLoading}
              pagination={{ pageSize: 15, showSizeChanger: true }}
              size="small"
              scroll={{ x: 850 }}
            />
          )}
        </Card>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* "Run Spyder" Execution Modal (Manual Close Only)                   */}
      {/* ------------------------------------------------------------------- */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-white shadow-xs">
              <ThunderboltOutlined />
            </div>
            <span className="font-semibold text-slate-800">Run Spyder Harvester</span>
            <Tag color="cyan" className="ml-2">
              Bing + Wikimedia Parallel Crawler
            </Tag>
          </div>
        }
        open={runModalOpen}
        onCancel={() => setRunModalOpen(false)}
        maskClosable={false}
        keyboard={false}
        width={760}
        centered
        footer={
          <div className="flex items-center justify-between">
            <Button onClick={() => setRunModalOpen(false)}>Close</Button>
            <Space>
              <Button
                type="primary"
                size="middle"
                icon={<RocketOutlined />}
                loading={scrapeMutation.isPending}
                onClick={handleStartScrape}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 font-medium"
              >
                Start Harvester
              </Button>
            </Space>
          </div>
        }
      >
        <div className="space-y-4 pt-2">
          {runSuccessNotice && (
            <Alert
              type="success"
              showIcon
              message="Harvester Dispatched"
              description={
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-slate-700">{runSuccessNotice}</span>
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    icon={<DatabaseOutlined />}
                    onClick={() => {
                      setRunModalOpen(false);
                      navigate("/scraper/data");
                    }}
                  >
                    View in Scrape Data
                  </Button>
                </div>
              }
              closable
              onClose={() => setRunSuccessNotice(null)}
            />
          )}

          <Alert
            type="info"
            showIcon
            message="How harvesting works"
            description={
              <div className="mt-1 space-y-1 text-xs text-slate-600">
                <div>
                  • <strong>Keywords only (default):</strong> searches Bing Images &amp; Wikimedia Commons for your query. Max Pages / Depth do not apply.
                </div>
                <div>
                  • <strong>Google image-search URL:</strong> a <code>google.com</code> image-search link is rendered in a browser and scraped (may hit a CAPTCHA).
                </div>
                <div>
                  • <strong>Any other Seed URL:</strong> crawls that site's same-origin pages up to Max Pages / Depth, keeping images that match your keywords.
                </div>
                <div className="text-slate-500">
                  Duplicates are skipped by URL and image hash within the chosen category.
                </div>
              </div>
            }
          />

          <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Search Keywords / Query
              </label>
              <Input
                placeholder="e.g. odometer reading dashboard, speed meter display"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                size="large"
                prefix={<SearchOutlined className="text-slate-400" />}
                allowClear
              />
              <div className="mt-1 text-xs text-slate-500">
                Required unless you set a Seed URL under Optional Crawler Settings.
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span className="font-medium text-slate-600">Quick queries:</span>
                {SUGGESTED_KEYWORDS.map((kw) => (
                  <Tag
                    key={kw}
                    className="cursor-pointer transition hover:border-blue-400 hover:text-blue-600"
                    onClick={() => setKeywords(kw)}
                  >
                    {kw}
                  </Tag>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Target Category <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <Select
                    placeholder="Select category"
                    value={categoryId}
                    onChange={setCategoryId}
                    loading={categoriesQuery.isLoading}
                    style={{ flex: 1 }}
                    options={(categoriesQuery.data ?? []).map((c) => ({
                      label: `${c.name} (${c.image_count} images)`,
                      value: c.id,
                    }))}
                    showSearch
                    optionFilterProp="label"
                  />
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => setCatModalOpen(true)}
                    title="Create new category"
                  >
                    New
                  </Button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Target Images Count
                </label>
                <InputNumber
                  min={1}
                  max={10000}
                  value={maxImages}
                  onChange={(v) => setMaxImages(v ?? 100)}
                  style={{ width: "100%" }}
                  placeholder="100"
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {PRESET_IMAGE_COUNTS.map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      className={`rounded px-1.5 py-0.5 text-xs transition ${
                        maxImages === cnt
                          ? "bg-teal-700 text-white font-medium"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                      onClick={() => setMaxImages(cnt)}
                    >
                      {cnt.toLocaleString()}
                    </button>
                  ))}
                </div>
                {maxImages > 1000 && (
                  <div className="mt-1.5 flex items-start gap-1 text-xs text-amber-600">
                    <ExclamationCircleOutlined className="mt-0.5" />
                    <span>
                      Large target — the harvest runs in the background and can
                      take a long time. Start smaller to sample quality first.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label
                id="spyder-sources-label"
                className="mb-1 block text-sm font-semibold text-slate-700"
              >
                Sources
              </label>
              <Checkbox.Group
                aria-labelledby="spyder-sources-label"
                value={sources}
                onChange={(v) => setSources(v as string[])}
                className="flex flex-col gap-1"
              >
                {SOURCE_OPTIONS.map((o) => (
                  <Checkbox key={o.value} value={o.value}>
                    {o.label}
                  </Checkbox>
                ))}
              </Checkbox.Group>
              <div className="mt-2 flex items-center gap-2">
                <label
                  htmlFor="spyder-max-per-source"
                  className="text-xs font-medium text-slate-600"
                >
                  Max per source
                </label>
                <InputNumber
                  id="spyder-max-per-source"
                  min={1}
                  size="small"
                  value={maxPerSource}
                  onChange={(v) => setMaxPerSource(v ?? undefined)}
                  placeholder="No cap"
                  style={{ width: 110 }}
                />
              </div>
              <div className="mt-1.5 text-xs text-slate-500">
                None selected = Bing + Wikimedia + Openverse. Flickr needs an API
                key on the server; DuckDuckGo is an unofficial, best-effort
                endpoint.
              </div>
            </div>

            {/* Advanced parameters section */}
            <div className="border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Optional Crawler Settings
                </span>
                <Button
                  type="link"
                  size="small"
                  className="p-0 text-xs"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? "Hide Advanced" : "Show Advanced"}
                </Button>
              </div>

              {showAdvanced && (
                <div className="mt-3 space-y-3">
                  <Alert
                    type="warning"
                    showIcon
                    className="py-1.5"
                    message={
                      <span className="text-xs">
                        These settings apply only when you provide a Seed URL
                        (site crawl). In keyword-only mode they are ignored.
                      </span>
                    }
                  />
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Seed URL (optional — crawl a specific site)
                    </label>
                    <Input
                      placeholder="https://example.com/gallery"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      size="small"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Max Pages to Visit
                      </label>
                      <InputNumber
                        min={1}
                        max={5000}
                        value={maxPages}
                        onChange={(v) => setMaxPages(v ?? 10)}
                        size="small"
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Crawl Depth
                      </label>
                      <InputNumber
                        min={0}
                        max={5}
                        value={depth}
                        onChange={(v) => setDepth(v ?? 2)}
                        size="small"
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Add Category Modal */}
      <Modal
        title="Create Image Category"
        open={catModalOpen}
        onCancel={() => setCatModalOpen(false)}
        onOk={() => {
          if (!newCatName.trim()) {
            message.warning("Category name is required");
            return;
          }
          createCatMutation.mutate({
            name: newCatName.trim(),
            description: newCatDesc.trim() || undefined,
          });
        }}
        confirmLoading={createCatMutation.isPending}
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Category Name</label>
            <Input
              placeholder="e.g. Odometers, Number Plates, Meters"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Description (Optional)</label>
            <Input.TextArea
              placeholder="Brief description of images in this category"
              value={newCatDesc}
              onChange={(e) => setNewCatDesc(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </Modal>

      {/* Session Details Modal */}
      <Modal
        title="Spyder Session Details"
        open={detailSession !== null}
        onCancel={() => setDetailSession(null)}
        footer={
          <div className="flex items-center justify-between">
            <Button onClick={() => setDetailSession(null)}>Close</Button>
            {detailSession && (detailSession.image_count ?? 0) > 0 && (
              <Button
                type="primary"
                icon={<DatabaseOutlined />}
                onClick={() => {
                  const sId = detailSession.id;
                  setDetailSession(null);
                  navigate(`/scraper/data?session_id=${sId}`);
                }}
              >
                View Harvested Images in Scrape Data
              </Button>
            )}
          </div>
        }
        width={620}
      >
        {detailSession && (
          <div className="space-y-4 pt-2">
            <div>
              <Typography.Text type="secondary" className="block text-xs">
                Query / Source
              </Typography.Text>
              <Typography.Text strong className="text-base text-slate-800">
                {detailSession.seed_url?.startsWith("auto:")
                  ? detailSession.seed_url.replace("auto:", "")
                  : detailSession.seed_url}
              </Typography.Text>
            </div>

            <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <Typography.Text type="secondary" className="block text-xs">Status</Typography.Text>
                <Tag color={STATUS_COLORS[detailSession.status]} className="mt-0.5">
                  {detailSession.status}
                </Tag>
              </div>
              <div>
                <Typography.Text type="secondary" className="block text-xs">Category</Typography.Text>
                <Typography.Text strong>{detailSession.category_name ?? "Uncategorized"}</Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary" className="block text-xs">Images Harvested</Typography.Text>
                <Typography.Text strong className="font-mono text-lg text-blue-600">
                  {(detailSession.image_count ?? 0).toLocaleString()}
                </Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary" className="block text-xs">Pages Visited</Typography.Text>
                <Typography.Text strong className="font-mono text-lg text-slate-700">
                  {(detailSession.pages_visited ?? 0).toLocaleString()}
                </Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary" className="block text-xs">Started At</Typography.Text>
                <Typography.Text className="text-xs">
                  {new Date(detailSession.created_at).toLocaleString()}
                </Typography.Text>
              </div>
              {detailSession.completed_at && (
                <div>
                  <Typography.Text type="secondary" className="block text-xs">Completed At</Typography.Text>
                  <Typography.Text className="text-xs">
                    {new Date(detailSession.completed_at).toLocaleString()}
                  </Typography.Text>
                </div>
              )}
            </div>

            {detailSession.error && (
              <Alert
                type="error"
                showIcon
                message="Crawl Log"
                description={detailSession.error}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View 2: Scrape Data Page (Comprehensive Filter Toolbar, Grid & Table view)
// ---------------------------------------------------------------------------

export function ScrapeDataPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters state initialized from URL query params
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(
    searchParams.get("category_id") || undefined,
  );
  const [sessionFilter, setSessionFilter] = useState<string | undefined>(
    searchParams.get("session_id") || undefined,
  );
  const [gtFilter, setGtFilter] = useState<"all" | "with_gt" | "without_gt">(
    (searchParams.get("gt") as "all" | "with_gt" | "without_gt") || "all",
  );
  const [resFilter, setResFilter] = useState<"all" | "high" | "medium" | "small">(
    (searchParams.get("res") as "all" | "high" | "medium" | "small") || "all",
  );
  const [providerFilter, setProviderFilter] = useState<string | undefined>(undefined);
  const [licensedOnly, setLicensedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<string>(
    searchParams.get("sort") || "created_at_desc",
  );
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const debouncedSearch = useDebounce(searchInput, 400);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [viewMode, setViewMode] = useState<"table" | "gallery">("table");

  // Selection for batch actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchCategoryModalOpen, setBatchCategoryModalOpen] = useState(false);
  const [batchTargetCategory, setBatchTargetCategory] = useState<string | undefined>();

  // Backend bulk-label job tracking (T7) — id of the job currently being polled.
  const [labelJobId, setLabelJobId] = useState<string | null>(null);

  // Modals state
  const [selectedImage, setSelectedImage] = useState<ScraperImage | null>(null);
  const [getValueImage, setGetValueImage] = useState<ScraperImage | null>(null);
  const [bulkLabelOpen, setBulkLabelOpen] = useState(false);

  // Sync state back to URL
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (categoryFilter) next.set("category_id", categoryFilter);
    else next.delete("category_id");

    if (sessionFilter) next.set("session_id", sessionFilter);
    else next.delete("session_id");

    if (gtFilter !== "all") next.set("gt", gtFilter);
    else next.delete("gt");

    if (resFilter !== "all") next.set("res", resFilter);
    else next.delete("res");

    if (sortBy !== "created_at_desc") next.set("sort", sortBy);
    else next.delete("sort");

    if (debouncedSearch) next.set("search", debouncedSearch);
    else next.delete("search");

    setSearchParams(next, { replace: true });
  }, [categoryFilter, sessionFilter, gtFilter, resFilter, sortBy, debouncedSearch, setSearchParams, searchParams]);

  // Queries
  const categoriesQuery = useQuery({
    queryKey: ["scraper", "categories"],
    queryFn: getCategories,
  });

  const sessionsQuery = useQuery({
    queryKey: ["scraper", "sessions"],
    queryFn: () => getSessions({ limit: 100 }),
  });

  const statsQuery = useQuery({
    queryKey: ["scraper", "stats"],
    queryFn: getStats,
  });

  // Calculate resolution limits based on filter
  const resolutionParams = useMemo(() => {
    if (resFilter === "high") return { min_width: 800 };
    if (resFilter === "medium") return { min_width: 300, max_width: 799 };
    if (resFilter === "small") return { max_width: 299 };
    return {};
  }, [resFilter]);

  const imagesQuery = useQuery({
    queryKey: [
      "scraper",
      "images",
      categoryFilter,
      sessionFilter,
      gtFilter,
      resFilter,
      providerFilter,
      licensedOnly,
      sortBy,
      debouncedSearch,
      page,
      pageSize,
    ],
    queryFn: () =>
      getImages({
        category_id: categoryFilter,
        session_id: sessionFilter,
        search: debouncedSearch || undefined,
        has_ground_truth:
          gtFilter === "with_gt" ? true : gtFilter === "without_gt" ? false : undefined,
        provider: providerFilter,
        has_license: licensedOnly ? true : undefined,
        ...resolutionParams,
        sort_by: sortBy,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
  });

  // Labeled count for the currently-selected category (one lightweight query).
  const categoryLabeledQuery = useQuery({
    queryKey: ["scraper", "images", "labeled-count", categoryFilter],
    queryFn: () =>
      getImages({ category_id: categoryFilter, has_ground_truth: true, limit: 1 }),
    enabled: Boolean(categoryFilter),
  });

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: deleteImage,
    onSuccess: () => {
      message.success("Image deleted");
      queryClient.invalidateQueries({ queryKey: ["scraper", "images"] });
      queryClient.invalidateQueries({ queryKey: ["scraper", "stats"] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteImages,
    onSuccess: (res) => {
      message.success(`Deleted ${res.deleted_count} selected images`);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["scraper", "images"] });
      queryClient.invalidateQueries({ queryKey: ["scraper", "stats"] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const updateCatMutation = useMutation({
    mutationFn: ({ id, catId }: { id: string; catId: string | null }) =>
      updateImageCategory(id, catId),
    onSuccess: () => {
      message.success("Category updated");
      queryClient.invalidateQueries({ queryKey: ["scraper", "images"] });
      queryClient.invalidateQueries({ queryKey: ["scraper", "stats"] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const batchCatMutation = useMutation({
    mutationFn: ({ ids, catId }: { ids: string[]; catId: string | null }) =>
      batchUpdateImageCategory(ids, catId),
    onSuccess: (res) => {
      message.success(`Assigned category to ${res.updated_count} images`);
      setSelectedIds([]);
      setBatchCategoryModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["scraper", "images"] });
      queryClient.invalidateQueries({ queryKey: ["scraper", "stats"] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  // T5 — promote selected images into the databank.
  const promoteMutation = useMutation({
    mutationFn: (imageIds: string[]) => promoteToDatabank(imageIds),
    onSuccess: (res) => {
      const skippedNote =
        res.skipped.length > 0
          ? ` · skipped ${res.skipped.length} (${res.skipped[0]?.reason ?? "see details"})`
          : "";
      message.success(`Promoted ${res.promoted}${skippedNote}`);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["scraper", "images"] });
      queryClient.invalidateQueries({ queryKey: ["scraper", "stats"] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  // T8 — promote every labeled image in the active category. Promote takes ids,
  // so we gather the labeled ids from a has_ground_truth query, capped for safety.
  const promoteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const { images: labeledImages, total: labeledTotal } = await getImages({
        category_id: categoryId,
        has_ground_truth: true,
        limit: PROMOTE_CATEGORY_CAP,
      });
      const ids = labeledImages.map((i) => i.id);
      const result = await promoteToDatabank(ids);
      return { result, labeledTotal, capped: labeledTotal > ids.length };
    },
    onSuccess: ({ result, capped }) => {
      const skippedNote =
        result.skipped.length > 0 ? ` · skipped ${result.skipped.length}` : "";
      const capNote = capped
        ? ` (first ${PROMOTE_CATEGORY_CAP} labeled images)`
        : "";
      message.success(`Promoted ${result.promoted}${skippedNote}${capNote}`);
      queryClient.invalidateQueries({ queryKey: ["scraper", "images"] });
      queryClient.invalidateQueries({ queryKey: ["scraper", "stats"] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  // T7 — start a backend bulk-label job for the whole active category.
  const startLabelJobMutation = useMutation({
    mutationFn: (categoryId: string) => startLabelJob({ category_id: categoryId }),
    onSuccess: (job) => {
      setLabelJobId(job.id);
      message.success("Auto-label job started");
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  // Poll the active job; refetchInterval returns a number while pending/running
  // and false once terminal (same pattern the sessions query uses).
  const labelJobQuery = useQuery({
    queryKey: ["scraper", "label-jobs", labelJobId],
    queryFn: () => getLabelJob(labelJobId as string),
    enabled: Boolean(labelJobId),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "pending" || s === "running" ? 2000 : false;
    },
  });
  const labelJob = labelJobQuery.data ?? null;
  const labelJobActive =
    labelJob?.status === "pending" || labelJob?.status === "running";

  const stopLabelJobMutation = useMutation({
    mutationFn: (id: string) => stopLabelJob(id),
    onSuccess: () => void labelJobQuery.refetch(),
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  // Reconnect to a still-running job for this category when the page (re)mounts.
  useQuery({
    queryKey: ["scraper", "label-jobs", "active", categoryFilter],
    queryFn: async () => {
      const jobs = await listLabelJobs({ category_id: categoryFilter, limit: 5 });
      const active = jobs.find(
        (j) => j.status === "pending" || j.status === "running",
      );
      if (active) setLabelJobId(active.id);
      return jobs;
    },
    enabled: Boolean(categoryFilter) && !labelJobId,
  });

  // Fire completion side-effects exactly once per job (ref guard keeps this out
  // of render and avoids a set-state-in-effect lint warning).
  const notifiedJobRef = useRef<string | null>(null);
  useEffect(() => {
    if (!labelJob) return;
    const terminal =
      labelJob.status === "completed" ||
      labelJob.status === "failed" ||
      labelJob.status === "stopped";
    if (!terminal || notifiedJobRef.current === labelJob.id) return;
    notifiedJobRef.current = labelJob.id;
    if (labelJob.status === "completed") {
      message.success(
        `Auto-label done — saved ${labelJob.saved}, failed ${labelJob.failed}`,
      );
    } else if (labelJob.status === "failed") {
      message.error(labelJob.error || "Auto-label job failed");
    } else {
      message.info("Auto-label job stopped");
    }
    queryClient.invalidateQueries({ queryKey: ["scraper", "images"] });
    queryClient.invalidateQueries({ queryKey: ["scraper", "stats"] });
  }, [labelJob, message, queryClient]);

  const handleCategoryChange = (id: string, newCatId: string | null) => {
    updateCatMutation.mutate({ id, catId: newCatId });
    setSelectedImage((prev) =>
      prev && prev.id === id ? { ...prev, category_id: newCatId } : prev,
    );
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
    if (selectedImage?.id === id) setSelectedImage(null);
    if (getValueImage?.id === id) setGetValueImage(null);
    setSelectedIds((prev) => prev.filter((i) => i !== id));
  };

  const handleResetFilters = () => {
    setCategoryFilter(undefined);
    setSessionFilter(undefined);
    setGtFilter("all");
    setResFilter("all");
    setProviderFilter(undefined);
    setLicensedOnly(false);
    setSortBy("created_at_desc");
    setSearchInput("");
    setPage(1);
  };

  const isFiltered = Boolean(
    categoryFilter ||
      sessionFilter ||
      gtFilter !== "all" ||
      resFilter !== "all" ||
      Boolean(providerFilter) ||
      licensedOnly ||
      sortBy !== "created_at_desc" ||
      searchInput,
  );

  const images = imagesQuery.data?.images ?? [];
  const total = imagesQuery.data?.total ?? 0;
  const stats = statsQuery.data;

  // Table columns definition
  const columns: ColumnsType<ScraperImage> = [
    {
      title: "Preview",
      key: "thumbnail",
      width: 72,
      render: (_: unknown, record: ScraperImage) => (
        <ImageThumbnail
          imageId={record.id}
          altText={record.alt_text}
          onClick={() => setSelectedImage(record)}
        />
      ),
    },
    {
      title: "Alt Text / Source",
      dataIndex: "alt_text",
      key: "alt_text",
      ellipsis: true,
      render: (text: string | null, record: ScraperImage) => (
        <div className="space-y-1">
          <Typography.Text
            strong={Boolean(text)}
            ellipsis={{ tooltip: text ?? record.source_url }}
            className="block text-slate-800"
            style={{ maxWidth: 280 }}
          >
            {text || <span className="italic text-slate-400">No alt text</span>}
          </Typography.Text>
          <Typography.Link
            href={record.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-xs text-slate-500 hover:text-blue-600"
            style={{ maxWidth: 280 }}
          >
            {record.source_url}
          </Typography.Link>
        </div>
      ),
    },
    {
      title: "Category",
      dataIndex: "category_id",
      key: "category_id",
      width: 170,
      render: (_: unknown, record: ScraperImage) => (
        <Select
          size="small"
          placeholder="Unassigned"
          allowClear
          value={record.category_id ?? undefined}
          onChange={(val) => handleCategoryChange(record.id, val ?? null)}
          options={(categoriesQuery.data ?? []).map((c) => ({
            label: c.name,
            value: c.id,
          }))}
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: "Ground Truth (GT)",
      dataIndex: "ground_truth",
      key: "ground_truth",
      width: 170,
      render: (text: string | null | undefined, record: ScraperImage) =>
        text ? (
          <Space size={4} wrap>
            <Tag color="cyan" className="font-mono text-xs px-2 py-0.5">
              {text}
            </Tag>
            {record.gt_bbox && (
              <Tag color="green" className="text-xs">
                bbox ✓
              </Tag>
            )}
          </Space>
        ) : (
          <Tag color="orange" className="text-xs">
            Needs GT
          </Tag>
        ),
    },
    {
      title: "Get Value (AI)",
      key: "get_value",
      width: 125,
      render: (_: unknown, record: ScraperImage) => (
        <Button
          size="small"
          type="primary"
          ghost
          icon={<ThunderboltOutlined />}
          onClick={() => setGetValueImage(record)}
          className="text-xs"
        >
          Get Value
        </Button>
      ),
    },
    {
      title: "Source / License",
      key: "provenance",
      width: 170,
      render: (_: unknown, record: ScraperImage) =>
        record.provider || record.license ? (
          <div className="space-y-1">
            <ProviderTag provider={record.provider} />
            <div>
              <LicenseText license={record.license} licenseUrl={record.license_url} />
            </div>
          </div>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: "Dimensions",
      key: "dimensions",
      width: 115,
      render: (_: unknown, record: ScraperImage) =>
        record.width && record.height ? (
          <span className="font-mono text-xs text-slate-600">
            {record.width} × {record.height}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      title: "Size",
      dataIndex: "file_size_bytes",
      key: "file_size_bytes",
      width: 90,
      render: (bytes: number) => (
        <span className="text-xs text-slate-600">{formatBytes(bytes)}</span>
      ),
    },
    {
      title: "Harvested",
      dataIndex: "created_at",
      key: "created_at",
      width: 160,
      render: (v: string) => (
        <span className="text-xs text-slate-500">
          {new Date(v).toLocaleDateString()} {new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_: unknown, record: ScraperImage) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setSelectedImage(record)}
            title="Inspect image"
          />
          <Popconfirm
            title="Delete this image?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              title="Delete image"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-slate-50/50">
      <PageHeader
        title="Scrape Data"
        description="Filter, inspect, and label harvested images with Gemini AI"
      />

      <div className="flex-1 space-y-5 p-6">
        {/* KPI Overview Strip */}
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Card size="small" className="border-slate-200 shadow-xs">
              <Statistic
                title={
                  <span className="text-xs font-medium text-slate-500">
                    Total Harvested Images
                  </span>
                }
                value={stats?.total_images ?? total}
                prefix={<PictureOutlined className="text-blue-500" />}
                suffix={
                  stats?.total_size_bytes ? (
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      ({formatBytes(stats.total_size_bytes)})
                    </span>
                  ) : null
                }
                valueStyle={{ fontSize: "1.25rem", fontWeight: 700, color: "#1e293b" }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={6}>
            <Card size="small" className="border-slate-200 shadow-xs">
              <Statistic
                title={
                  <span className="text-xs font-medium text-slate-500">
                    Ground Truth Labeled
                  </span>
                }
                value={stats?.images_with_gt ?? 0}
                prefix={<CheckCircleOutlined className="text-emerald-500" />}
                suffix={
                  stats?.total_images ? (
                    <Tag color="success" className="ml-1 text-xs">
                      {((stats.images_with_gt ?? 0) / stats.total_images * 100).toFixed(0)}%
                    </Tag>
                  ) : null
                }
                valueStyle={{ fontSize: "1.25rem", fontWeight: 700, color: "#059669" }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={6}>
            <Card size="small" className="border-slate-200 shadow-xs">
              <Statistic
                title={
                  <span className="text-xs font-medium text-slate-500">
                    Pending GT Review
                  </span>
                }
                value={stats?.images_without_gt ?? 0}
                prefix={<ExclamationCircleOutlined className="text-amber-500" />}
                valueStyle={{ fontSize: "1.25rem", fontWeight: 700, color: "#d97706" }}
              />
            </Card>
          </Col>

          <Col xs={12} sm={6}>
            <Card size="small" className="border-slate-200 shadow-xs">
              <Statistic
                title={
                  <span className="text-xs font-medium text-slate-500">
                    Active Categories
                  </span>
                }
                value={stats?.categories?.length ?? categoriesQuery.data?.length ?? 0}
                prefix={<TagsOutlined className="text-indigo-500" />}
                valueStyle={{ fontSize: "1.25rem", fontWeight: 700, color: "#4f46e5" }}
              />
            </Card>
          </Col>
        </Row>

        {/* Comprehensive Filter Bar Card */}
        <Card size="small" className="border-slate-200 bg-white shadow-xs">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FilterOutlined className="text-blue-600" />
                <span className="text-sm font-semibold text-slate-800">
                  Filter Scrape Data
                </span>
                {isFiltered && (
                  <Tag color="blue" closable onClose={handleResetFilters}>
                    Filters active
                  </Tag>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Segmented
                  value={viewMode}
                  onChange={(v) => setViewMode(v as "table" | "gallery")}
                  options={[
                    { label: "Table", value: "table", icon: <TableOutlined /> },
                    { label: "Gallery", value: "gallery", icon: <AppstoreOutlined /> },
                  ]}
                  size="small"
                />
                {isFiltered && (
                  <Button
                    size="small"
                    icon={<ClearOutlined />}
                    onClick={handleResetFilters}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Row of Filter Controls */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {/* 1. Category Filter */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Category
                </label>
                <Select
                  placeholder="All Categories"
                  allowClear
                  value={categoryFilter}
                  onChange={(v) => {
                    setCategoryFilter(v);
                    setPage(1);
                  }}
                  loading={categoriesQuery.isLoading}
                  options={(categoriesQuery.data ?? []).map((c) => ({
                    label: `${c.name} (${c.image_count})`,
                    value: c.id,
                  }))}
                  style={{ width: "100%" }}
                  size="middle"
                />
              </div>

              {/* 2. Session Filter */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Crawl Session
                </label>
                <Select
                  placeholder="All Sessions"
                  allowClear
                  value={sessionFilter}
                  onChange={(v) => {
                    setSessionFilter(v);
                    setPage(1);
                  }}
                  loading={sessionsQuery.isLoading}
                  options={(sessionsQuery.data?.sessions ?? []).map((s) => {
                    const kw = s.seed_url?.startsWith("auto:")
                      ? s.seed_url.replace("auto:", "")
                      : s.seed_url;
                    return {
                      label: `${kw || "Session"} (${s.image_count} imgs) - ${new Date(s.created_at).toLocaleDateString()}`,
                      value: s.id,
                    };
                  })}
                  style={{ width: "100%" }}
                  size="middle"
                  showSearch
                  optionFilterProp="label"
                />
              </div>

              {/* 3. Ground Truth Filter */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Ground Truth (GT) Status
                </label>
                <Select
                  value={gtFilter}
                  onChange={(v) => {
                    setGtFilter(v);
                    setPage(1);
                  }}
                  options={[
                    { label: "All Images", value: "all" },
                    { label: "Labeled (Has GT)", value: "with_gt" },
                    { label: "Unlabeled (Needs GT)", value: "without_gt" },
                  ]}
                  style={{ width: "100%" }}
                  size="middle"
                />
              </div>

              {/* 4. Resolution Filter */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Image Resolution
                </label>
                <Select
                  value={resFilter}
                  onChange={(v) => {
                    setResFilter(v);
                    setPage(1);
                  }}
                  options={[
                    { label: "All Resolutions", value: "all" },
                    { label: "High Res (≥ 800px)", value: "high" },
                    { label: "Medium Res (300 - 800px)", value: "medium" },
                    { label: "Low Res (< 300px)", value: "small" },
                  ]}
                  style={{ width: "100%" }}
                  size="middle"
                />
              </div>

              {/* Provider + license filters */}
              <div>
                <label
                  htmlFor="provider-filter"
                  className="mb-1 block text-xs font-medium text-slate-500"
                >
                  Source
                </label>
                <Select
                  id="provider-filter"
                  value={providerFilter ?? "all"}
                  onChange={(v) => {
                    setProviderFilter(v === "all" ? undefined : v);
                    setPage(1);
                  }}
                  options={[
                    { label: "All Sources", value: "all" },
                    ...SOURCE_OPTIONS.map((o) => ({
                      label: SOURCE_LABELS[o.value],
                      value: o.value,
                    })),
                  ]}
                  style={{ width: "100%" }}
                  size="middle"
                />
                <Checkbox
                  className="mt-1.5 text-xs"
                  checked={licensedOnly}
                  onChange={(e) => {
                    setLicensedOnly(e.target.checked);
                    setPage(1);
                  }}
                >
                  Licensed only
                </Checkbox>
              </div>

              {/* 5. Sort By */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Sort Order
                </label>
                <Select
                  value={sortBy}
                  onChange={(v) => {
                    setSortBy(v);
                    setPage(1);
                  }}
                  options={[
                    { label: "Newest First", value: "created_at_desc" },
                    { label: "Oldest First", value: "created_at_asc" },
                    { label: "Largest File Size", value: "size_desc" },
                    { label: "Smallest File Size", value: "size_asc" },
                  ]}
                  style={{ width: "100%" }}
                  size="middle"
                />
              </div>
            </div>

            {/* Search row */}
            <div className="pt-1">
              <Input
                placeholder="Search by alt text, URL, or ground truth string..."
                allowClear
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                prefix={<SearchOutlined className="text-slate-400" />}
                size="middle"
              />
            </div>
          </div>
        </Card>

        {/* Batch Actions Bar (visible when items selected) */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50/70 px-4 py-2.5 text-sm">
            <Space>
              <CheckCircleOutlined className="text-teal-600" />
              <span className="font-semibold text-teal-900">
                {selectedIds.length} image{selectedIds.length !== 1 ? "s" : ""} selected
              </span>
            </Space>
            <Space size="small">
              <Popconfirm
                title={`Send ${selectedIds.length} image${selectedIds.length !== 1 ? "s" : ""} to the databank?`}
                description="Labeled images are promoted into the reviewed databank dataset."
                onConfirm={() => promoteMutation.mutate(selectedIds)}
              >
                <Button
                  size="small"
                  type="primary"
                  icon={<DatabaseOutlined />}
                  loading={promoteMutation.isPending}
                >
                  Send to databank
                </Button>
              </Popconfirm>
              <Button
                size="small"
                type="primary"
                ghost
                icon={<ThunderboltOutlined />}
                onClick={() => setBulkLabelOpen(true)}
              >
                Auto-label (AI)
              </Button>
              <Button
                size="small"
                icon={<TagsOutlined />}
                onClick={() => setBatchCategoryModalOpen(true)}
              >
                Assign Category
              </Button>
              <Popconfirm
                title={`Delete ${selectedIds.length} selected images?`}
                description="This will permanently delete the images and disk files."
                onConfirm={() => batchDeleteMutation.mutate(selectedIds)}
              >
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  loading={batchDeleteMutation.isPending}
                >
                  Delete Selected
                </Button>
              </Popconfirm>
              <Button size="small" type="text" onClick={() => setSelectedIds([])}>
                Deselect All
              </Button>
            </Space>
          </div>
        )}

        {/* Dataset-readiness card for the active category (T8) with the backend
            bulk-label job controls (T7). */}
        {categoryFilter && (() => {
          const catTotal =
            categoriesQuery.data?.find((c) => c.id === categoryFilter)?.image_count ?? 0;
          const labeled = categoryLabeledQuery.data?.total;
          const unlabeled =
            labeled == null ? undefined : Math.max(0, catTotal - labeled);
          const pct =
            labeled == null || catTotal === 0
              ? 0
              : Math.round((labeled / catTotal) * 100);
          return (
            <Card size="small" className="border-slate-200 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Statistic
                    title={<span className="text-xs text-slate-500">Labeled</span>}
                    value={labeled == null ? "—" : labeled}
                    valueStyle={{ fontSize: "1.1rem", fontWeight: 700, color: "#0891b2" }}
                  />
                  <Statistic
                    title={<span className="text-xs text-slate-500">Unlabeled</span>}
                    value={unlabeled == null ? "—" : unlabeled}
                    valueStyle={{ fontSize: "1.1rem", fontWeight: 700, color: "#d97706" }}
                  />
                  <div className="min-w-[160px]">
                    <div className="mb-1 text-xs text-slate-500">
                      % labeled · {catTotal.toLocaleString()} total
                    </div>
                    <Progress percent={pct} size="small" status="active" />
                  </div>
                </div>
                <Space size="small" wrap>
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    icon={<ThunderboltOutlined />}
                    loading={startLabelJobMutation.isPending}
                    disabled={labelJobActive}
                    onClick={() => startLabelJobMutation.mutate(categoryFilter)}
                  >
                    Auto-label all unlabeled (AI)
                  </Button>
                  <Popconfirm
                    title="Send all labeled images in this category to the databank?"
                    description={`Promotes up to ${PROMOTE_CATEGORY_CAP} labeled images into the reviewed databank dataset.`}
                    onConfirm={() => promoteCategoryMutation.mutate(categoryFilter)}
                  >
                    <Button
                      size="small"
                      type="primary"
                      icon={<DatabaseOutlined />}
                      loading={promoteCategoryMutation.isPending}
                      disabled={!labeled}
                    >
                      Send labeled → databank
                    </Button>
                  </Popconfirm>
                </Space>
              </div>

              {/* Live progress of the backend bulk-label job (T7). */}
              {labelJob && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="font-medium">Auto-label job:</span>
                      <Tag
                        color={
                          labelJob.status === "completed"
                            ? "success"
                            : labelJob.status === "failed"
                              ? "error"
                              : labelJob.status === "stopped"
                                ? "warning"
                                : "processing"
                        }
                      >
                        {labelJob.status}
                      </Tag>
                      <span>
                        {labelJob.processed}/{labelJob.total} processed · saved{" "}
                        {labelJob.saved} · failed {labelJob.failed}
                      </span>
                    </div>
                    {labelJobActive && (
                      <Button
                        size="small"
                        danger
                        icon={<StopOutlined />}
                        loading={stopLabelJobMutation.isPending}
                        onClick={() => stopLabelJobMutation.mutate(labelJob.id)}
                      >
                        Stop
                      </Button>
                    )}
                  </div>
                  <Progress
                    className="mt-1"
                    percent={
                      labelJob.total > 0
                        ? Math.round((labelJob.processed / labelJob.total) * 100)
                        : 0
                    }
                    size="small"
                    status={
                      labelJob.status === "failed"
                        ? "exception"
                        : labelJobActive
                          ? "active"
                          : "normal"
                    }
                  />
                </div>
              )}
            </Card>
          );
        })()}

        {/* Content: Table or Gallery View */}
        {viewMode === "table" ? (
          <Card size="small" className="border-slate-200 shadow-xs">
            <Table
              rowKey="id"
              dataSource={images}
              columns={columns}
              loading={imagesQuery.isLoading}
              rowSelection={{
                selectedRowKeys: selectedIds,
                onChange: (keys) => setSelectedIds(keys as string[]),
              }}
              locale={{ emptyText: <Empty description="No scraped images found matching filters" /> }}
              pagination={{
                current: page,
                pageSize,
                total,
                showSizeChanger: true,
                pageSizeOptions: ["24", "48", "96"],
                showTotal: (t) => `Total ${t.toLocaleString()} images`,
                onChange: (p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                },
              }}
              size="small"
              scroll={{ x: 1100 }}
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {imagesQuery.isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Spin tip="Loading gallery images..." />
              </div>
            ) : images.length === 0 ? (
              <Card className="py-12 text-center">
                <Empty description="No scraped images found matching filters" />
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {images.map((img) => {
                  const isSelected = selectedIds.includes(img.id);
                  return (
                    <div
                      key={img.id}
                      className={`group relative flex flex-col justify-between overflow-hidden rounded-lg border bg-white shadow-xs transition hover:shadow-md ${
                        isSelected ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-200"
                      }`}
                    >
                      {/* Top image container */}
                      <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
                        <ImageThumbnail
                          imageId={img.id}
                          altText={img.alt_text}
                          className="h-full w-full rounded-none"
                          onClick={() => setSelectedImage(img)}
                        />
                        {/* Checkbox badge */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (e.target.checked) {
                              setSelectedIds((prev) => [...prev, img.id]);
                            } else {
                              setSelectedIds((prev) => prev.filter((i) => i !== img.id));
                            }
                          }}
                          className="absolute top-2 left-2 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        {/* Resolution badge */}
                        {img.width && img.height && (
                          <div className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-[10px] text-white font-mono backdrop-blur-xs">
                            {img.width}×{img.height}
                          </div>
                        )}
                      </div>

                      {/* Card Body */}
                      <div className="space-y-2 p-2.5">
                        <div className="flex items-center justify-between gap-1">
                          <Tag
                            color={img.category_name ? "blue" : "default"}
                            className="m-0 max-w-[120px] truncate text-[11px]"
                          >
                            {img.category_name || "Uncategorized"}
                          </Tag>
                          {img.ground_truth ? (
                            <Space size={2}>
                              <Tag color="cyan" className="m-0 font-mono text-[11px] font-medium">
                                {img.ground_truth}
                              </Tag>
                              {img.gt_bbox && (
                                <Tag color="green" className="m-0 text-[10px]">
                                  bbox ✓
                                </Tag>
                              )}
                            </Space>
                          ) : (
                            <Tag color="orange" className="m-0 text-[10px]">
                              Needs GT
                            </Tag>
                          )}
                        </div>

                        {(img.provider || img.license) && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <ProviderTag provider={img.provider} />
                            <LicenseText license={img.license} licenseUrl={img.license_url} />
                          </div>
                        )}

                        <Typography.Text
                          ellipsis={{ tooltip: img.alt_text || img.source_url }}
                          className="block text-xs leading-tight text-slate-700"
                        >
                          {img.alt_text || <span className="italic truncate text-slate-400">No alt text</span>}
                        </Typography.Text>

                        {/* Card actions */}
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                          <Button
                            size="small"
                            type="text"
                            icon={<ThunderboltOutlined className="text-amber-500" />}
                            onClick={() => setGetValueImage(img)}
                            className="px-1 text-xs"
                          >
                            Value
                          </Button>
                          <Space size={2}>
                            <Button
                              size="small"
                              type="text"
                              icon={<EyeOutlined />}
                              onClick={() => setSelectedImage(img)}
                            />
                            <Popconfirm
                              title="Delete this image?"
                              onConfirm={() => handleDelete(img.id)}
                            >
                              <Button
                                size="small"
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                              />
                            </Popconfirm>
                          </Space>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination for gallery */}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
              <Typography.Text type="secondary" className="text-xs">
                Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total.toLocaleString()} images
              </Typography.Text>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                showSizeChanger
                pageSizeOptions={["24", "48", "96"]}
                onChange={(p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                }}
              />
            </div>
          </div>
        )}

        {/* Batch Assign Category Modal */}
        <Modal
          title={`Assign Category to ${selectedIds.length} Images`}
          open={batchCategoryModalOpen}
          onCancel={() => setBatchCategoryModalOpen(false)}
          onOk={() => {
            batchCatMutation.mutate({
              ids: selectedIds,
              catId: batchTargetCategory || null,
            });
          }}
          confirmLoading={batchCatMutation.isPending}
        >
          <div className="space-y-3 pt-2">
            <p className="text-xs text-slate-600">
              Select the category you want to apply to all {selectedIds.length} selected images:
            </p>
            <Select
              placeholder="Select target category"
              allowClear
              value={batchTargetCategory}
              onChange={setBatchTargetCategory}
              options={(categoriesQuery.data ?? []).map((c) => ({
                label: c.name,
                value: c.id,
              }))}
              style={{ width: "100%" }}
            />
          </div>
        </Modal>

        {/* Image Preview / Inspector Modal */}
        {selectedImage && (
          <ImagePreviewModal
            key={selectedImage.id}
            image={selectedImage}
            categories={categoriesQuery.data ?? []}
            onClose={() => setSelectedImage(null)}
            onChangeCategory={(catId) =>
              handleCategoryChange(selectedImage.id, catId)
            }
            onDelete={() => handleDelete(selectedImage.id)}
            onOpenGetValue={() => {
              const img = selectedImage;
              setSelectedImage(null);
              setGetValueImage(img);
            }}
          />
        )}

        {/* Get Value (Gemini AI) Modal */}
        {getValueImage && (
          <GetValueModal
            key={getValueImage.id}
            image={getValueImage}
            ocrType={
              categoriesQuery.data?.find(
                (c) => c.id === getValueImage.category_id,
              )?.ocr_type
            }
            onClose={() => setGetValueImage(null)}
            onSaved={(updated) => {
              queryClient.invalidateQueries({ queryKey: ["scraper", "images"] });
              queryClient.invalidateQueries({ queryKey: ["scraper", "stats"] });
              if (selectedImage?.id === updated.id) {
                setSelectedImage(updated);
              }
            }}
          />
        )}

        {/* Bulk Auto-label (Gemini AI) Modal */}
        {bulkLabelOpen && (
          <BulkLabelModal
            images={images.filter((i) => selectedIds.includes(i.id))}
            categories={categoriesQuery.data ?? []}
            onClose={() => setBulkLabelOpen(false)}
            onDone={() => {
              queryClient.invalidateQueries({ queryKey: ["scraper", "images"] });
              queryClient.invalidateQueries({ queryKey: ["scraper", "stats"] });
              queryClient.invalidateQueries({ queryKey: ["scraper", "categories"] });
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View 3: Categories Page
// ---------------------------------------------------------------------------

export function ScraperCategoriesPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ScraperCategory | null>(null);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");

  const categoriesQuery = useQuery({
    queryKey: ["scraper", "categories"],
    queryFn: getCategories,
  });

  const createMutation = useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      createCategory(name, description),
    onSuccess: () => {
      message.success("Category created");
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["scraper", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["scraper", "stats"] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; description?: string };
    }) => updateCategory(id, data),
    onSuccess: () => {
      message.success("Category updated");
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["scraper", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["scraper", "stats"] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      message.success("Category deleted");
      queryClient.invalidateQueries({ queryKey: ["scraper", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["scraper", "stats"] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingCat(null);
    setCatName("");
    setCatDesc("");
  };

  const openCreate = () => {
    setEditingCat(null);
    setCatName("");
    setCatDesc("");
    setModalOpen(true);
  };

  const openEdit = (cat: ScraperCategory) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatDesc(cat.description ?? "");
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!catName.trim()) {
      message.warning("Category name is required");
      return;
    }
    if (editingCat) {
      updateMutation.mutate({
        id: editingCat.id,
        data: { name: catName.trim(), description: catDesc.trim() || undefined },
      });
    } else {
      createMutation.mutate({
        name: catName.trim(),
        description: catDesc.trim() || undefined,
      });
    }
  };

  const columns: ColumnsType<ScraperCategory> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text: string) => <Typography.Text strong>{text}</Typography.Text>,
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (v: string) => v || <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "Images Harvested",
      dataIndex: "image_count",
      key: "image_count",
      width: 140,
      align: "right" as const,
      render: (c: number) => (
        <span className="font-mono text-sm font-semibold text-blue-600">
          {(c ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      width: 170,
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_: unknown, record: ScraperCategory) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          />
          <Popconfirm
            title="Delete this category?"
            description={
              record.image_count > 0
                ? "This category has images. Remove or move them first."
                : undefined
            }
            onConfirm={() => {
              if (record.image_count > 0) {
                message.warning("Cannot delete category with images. Remove images first.");
                return;
              }
              deleteMutation.mutate(record.id);
            }}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-slate-50/50">
      <PageHeader
        title="Scraper Categories"
        description="Manage categories for crawl deduplication and image organization"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Add Category
          </Button>
        }
      />

      <div className="flex-1 space-y-4 p-6">
        <Card size="small" className="border-slate-200 shadow-xs">
          <Table
            rowKey="id"
            dataSource={categoriesQuery.data ?? []}
            columns={columns}
            loading={categoriesQuery.isLoading}
            pagination={false}
            size="small"
          />
        </Card>
      </div>

      <Modal
        title={editingCat ? "Edit Category" : "Add Category"}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <Input
              placeholder="e.g. Odometers"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <Input.TextArea
              placeholder="Optional description"
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Get Value Modal (Gemini AI Ground Truth Extraction)
// ---------------------------------------------------------------------------

function GetValueModal({
  image,
  ocrType,
  onClose,
  onSaved,
}: {
  image: ScraperImage;
  ocrType?: string;
  onClose: () => void;
  onSaved: (updated: ScraperImage) => void;
}) {
  const { message } = App.useApp();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [previewFailed, setPreviewFailed] = useState(false);

  const [selectedPromptId, setSelectedPromptId] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [reviewedValue, setReviewedValue] = useState<string>(image.ground_truth || "");
  const [bbox, setBbox] = useState<ScraperBBox | null>(image.gt_bbox ?? null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [usedModelTag, setUsedModelTag] = useState<string | null>(null);

  const gtError = validateGroundTruth(reviewedValue, ocrType);

  const promptsQuery = useQuery({
    queryKey: ["scraper", "prompts"],
    queryFn: getGeminiPrompts,
  });

  const configQuery = useQuery({
    queryKey: ["scraper", "gemini-config"],
    queryFn: getGeminiConfig,
  });

  // Default prompt derived from the image's category (ocr_type), falling back to
  // the first available prompt — instead of always defaulting to odometer.
  const defaultPromptId = useMemo(() => {
    const prompts = promptsQuery.data;
    if (!prompts || prompts.length === 0) return "";
    const preferredId = ocrType ? PROMPT_BY_OCR_TYPE[ocrType] : undefined;
    return (
      (preferredId && prompts.find((p) => p.id === preferredId)?.id) ||
      prompts[0].id
    );
  }, [promptsQuery.data, ocrType]);
  const effectivePromptId = selectedPromptId || defaultPromptId;

  const effectiveModel =
    selectedModel || configQuery.data?.default_model || "gemini-3.5-flash-lite";

  const activePromptText =
    customPrompt !== null
      ? customPrompt
      : (promptsQuery.data?.find((p) => p.id === effectivePromptId)?.prompt ??
        (promptsQuery.data?.[0]?.prompt || ""));

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;

    void getImageBlob(image.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setPreviewUrl(objectUrl);
          setImageLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setPreviewFailed(true);
          setImageLoading(false);
        }
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.id]);

  const extractMutation = useMutation({
    mutationFn: (vars: { prompt: string; apiKey?: string; model?: string }) =>
      extractWithGemini(image.id, {
        prompt: vars.prompt,
        api_key: vars.apiKey || undefined,
        model: vars.model || effectiveModel,
      }),
    onSuccess: (data) => {
      setExtractError(null);
      setUsedModelTag(data.model);
      message.success("Extracted response from Gemini! Review below before saving.");
      setReviewedValue(data.extracted_value);
      setBbox(data.bbox ?? null);
    },
    onError: (err) => {
      const errMsg = getApiErrorMessage(err);
      setExtractError(errMsg);
      message.error(errMsg);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (gt: string) => updateImageGroundTruth(image.id, gt, bbox),
    onSuccess: (updated) => {
      message.success("Ground truth saved to image row!");
      onSaved(updated);
      onClose();
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const handlePromptSelect = (promptId: string) => {
    setSelectedPromptId(promptId);
    const found = (promptsQuery.data ?? []).find((p) => p.id === promptId);
    setCustomPrompt(found ? found.prompt : "");
  };

  const handleExtract = () => {
    if (!activePromptText.trim()) {
      message.warning("Please enter or select a prompt");
      return;
    }
    setExtractError(null);
    extractMutation.mutate({
      prompt: activePromptText.trim(),
      apiKey: apiKey.trim() || undefined,
      model: effectiveModel,
    });
  };

  const handleSave = () => {
    if (!reviewedValue.trim()) {
      message.warning("Ground truth value cannot be empty");
      return;
    }
    if (gtError) {
      message.warning(gtError);
      return;
    }
    saveMutation.mutate(reviewedValue.trim());
  };

  const serverHasKey = Boolean(configQuery.data?.has_api_key);

  const modelOptions =
    configQuery.data?.available_models && configQuery.data.available_models.length > 0
      ? configQuery.data.available_models.map((m) => ({ label: m.name, value: m.id }))
      : [
          { label: "Gemini 3.5 Flash Lite (Fastest & Stable)", value: "gemini-3.5-flash-lite" },
          { label: "Gemini 3.5 Flash", value: "gemini-3.5-flash" },
          { label: "Gemini 3 Flash Preview", value: "gemini-3-flash-preview" },
        ];

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <ThunderboltOutlined className="text-amber-500" />
          <span>Get Ground Truth Value (Gemini AI)</span>
        </div>
      }
      open
      onCancel={onClose}
      maskClosable={false}
      width={760}
      centered
      footer={
        <div className="flex items-center justify-between">
          <Button onClick={onClose}>Cancel</Button>
          <Space>
            <Button
              type="primary"
              disabled={!reviewedValue.trim() || Boolean(gtError)}
              loading={saveMutation.isPending}
              onClick={handleSave}
            >
              Save Ground Truth
            </Button>
          </Space>
        </div>
      }
    >
      <div className="space-y-4 pt-2">
        {/* Top: Image thumbnail & info */}
        <div className="flex gap-4 rounded-lg border bg-gray-50 p-3">
          <div className="flex h-32 w-44 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-200">
            {imageLoading ? (
              <Spin size="small" />
            ) : previewUrl ? (
              <div className="relative inline-block">
                <img
                  src={previewUrl}
                  alt={image.alt_text ?? "Image to extract"}
                  className="max-h-32 max-w-[176px] object-contain"
                />
                {/* bbox overlay — coords are pixels relative to the natural image
                    size, mapped to percentages of the tightly-wrapped preview. */}
                {bbox && image.width > 0 && image.height > 0 && (
                  <div
                    className="pointer-events-none absolute border-2 border-emerald-400 bg-emerald-400/10"
                    style={{
                      left: `${(bbox.x1 / image.width) * 100}%`,
                      top: `${(bbox.y1 / image.height) * 100}%`,
                      width: `${((bbox.x2 - bbox.x1) / image.width) * 100}%`,
                      height: `${((bbox.y2 - bbox.y1) / image.height) * 100}%`,
                    }}
                  />
                )}
              </div>
            ) : previewFailed ? (
              <Typography.Text type="secondary" className="text-xs">
                Image preview unavailable
              </Typography.Text>
            ) : null}
          </div>
          <div className="flex flex-1 flex-col justify-center space-y-1 text-xs">
            <div>
              <Typography.Text strong>Image ID: </Typography.Text>
              <Typography.Text copyable={{ text: image.id }} code>
                {image.id.slice(0, 16)}...
              </Typography.Text>
            </div>
            {image.alt_text && (
              <div>
                <Typography.Text strong>Alt Text: </Typography.Text>
                <span>{image.alt_text}</span>
              </div>
            )}
            {image.category_name && (
              <div>
                <Typography.Text strong>Category: </Typography.Text>
                <Tag color="blue">{image.category_name}</Tag>
              </div>
            )}
            <div>
              <Typography.Text strong>Current Ground Truth: </Typography.Text>
              {image.ground_truth ? (
                <Tag color="cyan">{image.ground_truth}</Tag>
              ) : (
                <Typography.Text type="secondary">Not set</Typography.Text>
              )}
            </div>
          </div>
        </div>

        {/* Prompt Selection & Model Selection */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Select Prompt:
              </label>
              <Select
                value={effectivePromptId || undefined}
                onChange={handlePromptSelect}
                loading={promptsQuery.isLoading}
                options={(promptsQuery.data ?? []).map((p) => ({
                  label: p.name,
                  value: p.id,
                }))}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Gemini Model:
              </label>
              <Select
                value={effectiveModel}
                onChange={(val) => setSelectedModel(val)}
                loading={configQuery.isLoading}
                options={modelOptions}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">
              Prompt Instructions (customizable):
            </label>
            <Input.TextArea
              rows={2}
              value={activePromptText}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Prompt to instruct Gemini..."
            />
          </div>
        </div>

        {/* API Key setting — only shown when the server has no key configured.
            The key is kept in component state only (never persisted to the browser). */}
        {serverHasKey ? (
          <div className="rounded border border-dashed p-2.5 text-xs bg-gray-50/50">
            <Tag color="success">Server API Key Configured</Tag>
            <span className="ml-1 text-gray-500">
              Requests use the server-side Gemini key.
            </span>
          </div>
        ) : (
          <div className="rounded border border-dashed p-2.5 text-xs space-y-1.5 bg-gray-50/50">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">Gemini API Key:</span>
              <Typography.Link
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get free API Key (Google AI Studio)
              </Typography.Link>
            </div>
            <Input.Password
              size="small"
              placeholder="Enter your Gemini API key (used for this session only)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        )}

        {/* Action: Hit Gemini API Button */}
        <div className="flex items-center justify-between">
          <Typography.Text type="secondary" className="text-xs">
            Using model: <Typography.Text code>{effectiveModel}</Typography.Text>
          </Typography.Text>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={extractMutation.isPending}
            onClick={handleExtract}
          >
            {extractMutation.isPending ? "Extracting from Gemini..." : "Hit Gemini API"}
          </Button>
        </div>

        {/* Error notification if extraction fails */}
        {extractError && (
          <Alert
            type="error"
            showIcon
            closable
            onClose={() => setExtractError(null)}
            message="Gemini API Error"
            description={extractError}
          />
        )}

        {/* Response Review Section */}
        <div className="space-y-1.5 rounded-lg border border-teal-200 bg-teal-50/40 p-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-teal-900">
              Review Extracted Value (Ground Truth):
            </label>
            <Space size="small">
              {usedModelTag && (
                <Tag color="geekblue">Model: {usedModelTag}</Tag>
              )}
              {bbox && <Tag color="green">bbox ✓</Tag>}
              {reviewedValue && (
                <Tag color="purple">Ready to Save</Tag>
              )}
            </Space>
          </div>
          <Input.TextArea
            rows={2}
            value={reviewedValue}
            onChange={(e) => setReviewedValue(e.target.value)}
            placeholder="Extracted value will appear here after hitting Gemini. You can review and edit before saving."
            status={gtError ? "error" : undefined}
            style={{ fontSize: 14, fontWeight: 500 }}
          />
          {gtError ? (
            <Typography.Text type="danger" className="block text-xs">
              {gtError}
            </Typography.Text>
          ) : (
            <Typography.Text type="secondary" className="block text-xs">
              Review and adjust the extracted value above, then click &quot;Save Ground Truth&quot; to save it on the row.
            </Typography.Text>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Bulk Auto-label Modal (Gemini AI) — client-side orchestration of per-image
// extract calls across a selection, with a review step before saving.
// ---------------------------------------------------------------------------

interface BulkRow {
  image: ScraperImage;
  ocrType?: string;
  value: string;
  bbox?: ScraperBBox | null;
  accepted: boolean;
  error?: string;
}

function BulkLabelModal({
  images,
  categories,
  onClose,
  onDone,
}: {
  images: ScraperImage[];
  categories: ScraperCategory[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { message } = App.useApp();
  const [phase, setPhase] = useState<"config" | "running" | "review">("config");
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [moveFailedToCategory, setMoveFailedToCategory] = useState(true);

  const failedCategory = useMemo(
    () =>
      categories.find((c) =>
        ["failed-in-labeling", "failed_in_labeling", "failed in labeling"].includes(
          c.name.trim().toLowerCase(),
        ),
      ),
    [categories],
  );

  const promptsQuery = useQuery({
    queryKey: ["scraper", "prompts"],
    queryFn: getGeminiPrompts,
  });
  const configQuery = useQuery({
    queryKey: ["scraper", "gemini-config"],
    queryFn: getGeminiConfig,
  });

  const ocrTypeOf = useCallback(
    (img: ScraperImage) =>
      img.category_id
        ? categories.find((c) => c.id === img.category_id)?.ocr_type
        : undefined,
    [categories],
  );

  const dominantOcrType = images[0] ? ocrTypeOf(images[0]) : undefined;

  // Default prompt derived from the selection's category (ocr_type), falling back
  // to the first available prompt.
  const defaultPromptId = useMemo(() => {
    const prompts = promptsQuery.data;
    if (!prompts || prompts.length === 0) return "";
    const preferredId = dominantOcrType
      ? PROMPT_BY_OCR_TYPE[dominantOcrType]
      : undefined;
    return (
      (preferredId && prompts.find((p) => p.id === preferredId)?.id) ||
      prompts[0].id
    );
  }, [promptsQuery.data, dominantOcrType]);
  const effectivePromptId = selectedPromptId || defaultPromptId;

  const serverHasKey = Boolean(configQuery.data?.has_api_key);
  const effectiveModel =
    selectedModel || configQuery.data?.default_model || "gemini-3.5-flash-lite";
  const promptText =
    promptsQuery.data?.find((p) => p.id === effectivePromptId)?.prompt ?? "";

  const modelOptions =
    configQuery.data?.available_models &&
    configQuery.data.available_models.length > 0
      ? configQuery.data.available_models.map((m) => ({
          label: m.name,
          value: m.id,
        }))
      : [
          { label: "Gemini 3.5 Flash Lite", value: "gemini-3.5-flash-lite" },
          { label: "Gemini 3.5 Flash", value: "gemini-3.5-flash" },
        ];

  const runExtraction = async () => {
    if (!promptText.trim()) {
      message.warning("Select a prompt first");
      return;
    }
    setPhase("running");
    setProgress(0);
    const out: BulkRow[] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const ot = ocrTypeOf(img);
      try {
        const res = await extractWithGemini(img.id, {
          prompt: promptText.trim(),
          api_key: apiKey.trim() || undefined,
          model: effectiveModel,
        });
        const value = res.extracted_value ?? "";
        const err = validateGroundTruth(value, ot) ?? undefined;
        out.push({
          image: img,
          ocrType: ot,
          value,
          bbox: res.bbox ?? null,
          accepted: Boolean(value) && !err,
          error: err,
        });
      } catch (e) {
        out.push({
          image: img,
          ocrType: ot,
          value: "",
          accepted: false,
          error: getApiErrorMessage(e),
        });
      }
      setProgress(i + 1);
    }
    setRows(out);
    setPhase("review");
  };

  const updateRow = (id: string, patch: Partial<BulkRow>) =>
    setRows((prev) =>
      prev.map((r) => {
        if (r.image.id !== id) return r;
        const next = { ...r, ...patch };
        next.error = validateGroundTruth(next.value, next.ocrType) ?? undefined;
        return next;
      }),
    );

  const acceptedRows = rows.filter(
    (r) => r.accepted && r.value.trim() && !r.error,
  );
  const failedRows = rows.filter(
    (r) => !r.accepted || !r.value.trim() || Boolean(r.error),
  );

  const saveAccepted = async () => {
    const shouldMoveFailed =
      moveFailedToCategory && failedCategory && failedRows.length > 0;
    if (acceptedRows.length === 0 && !shouldMoveFailed) {
      message.warning("No accepted values to save or failed images to move");
      return;
    }
    setSaving(true);
    let saved = 0;
    for (const r of acceptedRows) {
      try {
        await updateImageGroundTruth(r.image.id, r.value.trim(), r.bbox);
        saved += 1;
      } catch {
        /* keep going; failed rows stay unsaved */
      }
    }

    let movedCount = 0;
    if (shouldMoveFailed) {
      try {
        const failedIds = failedRows.map((r) => r.image.id);
        const res = await batchUpdateImageCategory(failedIds, failedCategory.id);
        movedCount = res.updated_count ?? failedIds.length;
      } catch (e) {
        message.error(`Failed to move failed images: ${getApiErrorMessage(e)}`);
      }
    }
    setSaving(false);

    const parts: string[] = [];
    if (saved > 0) {
      parts.push(`Saved ground truth for ${saved} image${saved === 1 ? "" : "s"}`);
    }
    if (movedCount > 0) {
      parts.push(
        `moved ${movedCount} failed image${
          movedCount === 1 ? "" : "s"
        } to "${failedCategory?.name}"`,
      );
    }
    if (parts.length > 0) {
      message.success(parts.join("; "));
    }
    onDone();
    onClose();
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <ThunderboltOutlined className="text-amber-500" />
          <span>
            Auto-label {images.length} image{images.length === 1 ? "" : "s"}{" "}
            (Gemini AI)
          </span>
        </div>
      }
      open
      onCancel={onClose}
      maskClosable={false}
      width={760}
      centered
      footer={
        phase === "review" ? (
          <div className="flex items-center justify-between">
            <Button onClick={onClose}>Close</Button>
            <Button
              type="primary"
              loading={saving}
              disabled={
                acceptedRows.length === 0 &&
                !(moveFailedToCategory && failedCategory && failedRows.length > 0)
              }
              onClick={() => void saveAccepted()}
            >
              {acceptedRows.length > 0
                ? `Save ${acceptedRows.length} accepted${
                    moveFailedToCategory && failedCategory && failedRows.length > 0
                      ? ` & move ${failedRows.length} failed`
                      : ""
                  }`
                : `Move ${failedRows.length} failed to '${failedCategory?.name}'`}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <Button onClick={onClose} disabled={phase === "running"}>
              Cancel
            </Button>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={phase === "running"}
              onClick={() => void runExtraction()}
            >
              {phase === "running"
                ? `Extracting ${progress}/${images.length}…`
                : `Extract ${images.length}`}
            </Button>
          </div>
        )
      }
    >
      {phase !== "review" ? (
        <div className="space-y-3 pt-2">
          <Alert
            type="info"
            showIcon
            message="Runs Gemini on each selected image one by one, then lets you review every value before anything is saved."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Prompt
              </label>
              <Select
                value={effectivePromptId || undefined}
                onChange={setSelectedPromptId}
                loading={promptsQuery.isLoading}
                options={(promptsQuery.data ?? []).map((p) => ({
                  label: p.name,
                  value: p.id,
                }))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Model
              </label>
              <Select
                value={effectiveModel}
                onChange={setSelectedModel}
                options={modelOptions}
                style={{ width: "100%" }}
              />
            </div>
          </div>
          {!serverHasKey && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Gemini API Key (used for this session only)
              </label>
              <Input.Password
                size="small"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Gemini API key"
              />
            </div>
          )}
          {phase === "running" && (
            <Progress
              percent={Math.round(
                (progress / Math.max(1, images.length)) * 100,
              )}
            />
          )}
        </div>
      ) : (
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Review each value. Only accepted rows are saved.</span>
            <span>
              <span className="font-medium text-emerald-600">
                {acceptedRows.length} accepted
              </span>{" "}
              ·{" "}
              <span className="font-medium text-amber-600">
                {failedRows.length} failed/skipped
              </span>
            </span>
          </div>

          {failedCategory && failedRows.length > 0 && (
            <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <div className="flex items-center gap-1.5">
                <ExclamationCircleOutlined className="text-amber-600" />
                <span>
                  <strong>{failedRows.length}</strong> image
                  {failedRows.length === 1 ? "" : "s"} failed or not accepted
                </span>
              </div>
              <Checkbox
                checked={moveFailedToCategory}
                onChange={(e) => setMoveFailedToCategory(e.target.checked)}
              >
                <span className="text-xs">
                  Move failed images to category{" "}
                  <strong>&quot;{failedCategory.name}&quot;</strong>
                </span>
              </Checkbox>
            </div>
          )}

          <div className="max-h-[52vh] space-y-2 overflow-auto pr-1">
            {rows.map((r) => (
              <div
                key={r.image.id}
                className="flex items-start gap-2 rounded-md border border-slate-200 p-2"
              >
                <Checkbox
                  checked={r.accepted}
                  onChange={(e) =>
                    updateRow(r.image.id, { accepted: e.target.checked })
                  }
                  className="mt-1"
                />
                <ImageThumbnail
                  imageId={r.image.id}
                  altText={r.image.alt_text}
                  className="h-12 w-12 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <Input
                    size="small"
                    value={r.value}
                    status={r.error ? "error" : undefined}
                    onChange={(e) =>
                      updateRow(r.image.id, { value: e.target.value })
                    }
                    placeholder="No value extracted"
                  />
                  {r.error ? (
                    <div className="mt-0.5 text-[11px] text-red-500">
                      {r.error}
                    </div>
                  ) : !r.value ? (
                    <div className="mt-0.5 text-[11px] text-amber-600 italic">
                      No value extracted by AI
                    </div>
                  ) : (
                    r.bbox && (
                      <Tag color="green" className="mt-1 text-[10px]">
                        bbox ✓
                      </Tag>
                    )
                  )}
                  {moveFailedToCategory &&
                    failedCategory &&
                    (!r.accepted || !r.value.trim() || r.error) && (
                      <Tag color="orange" className="mt-1 text-[10px]">
                        → will move to {failedCategory.name}
                      </Tag>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Image Preview / Inspector Modal
// ---------------------------------------------------------------------------

function ImagePreviewModal({
  image,
  categories,
  onClose,
  onChangeCategory,
  onDelete,
  onOpenGetValue,
}: {
  image: ScraperImage;
  categories: ScraperCategory[];
  onClose: () => void;
  onChangeCategory: (categoryId: string | null) => void;
  onDelete: () => void;
  onOpenGetValue?: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;

    void getImageBlob(image.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setPreviewUrl(objectUrl);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setPreviewFailed(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.id]);

  return (
    <Modal
      title={image.alt_text || "Image Inspector"}
      open
      onCancel={onClose}
      width={720}
      centered
      footer={
        <div className="flex items-center justify-between">
          <Popconfirm title="Delete this image?" onConfirm={onDelete}>
            <Button danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
          <Space>
            {onOpenGetValue && (
              <Button
                type="primary"
                ghost
                icon={<ThunderboltOutlined />}
                onClick={onOpenGetValue}
              >
                Get Value (AI)
              </Button>
            )}
            {image.source_url && (
              <Button
                href={image.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Source
              </Button>
            )}
            <Button type="primary" onClick={onClose}>
              Close
            </Button>
          </Space>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex min-h-[260px] max-h-[480px] items-center justify-center overflow-hidden rounded bg-gray-50 border p-2">
          {loading ? (
            <Spin tip="Loading image..." />
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt={image.alt_text ?? "Scraped image"}
              className="max-h-[460px] w-auto max-w-full object-contain"
            />
          ) : previewFailed ? (
            <Typography.Text type="secondary">
              Preview unavailable
            </Typography.Text>
          ) : null}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-24 font-medium text-gray-500">Category:</span>
            <Select
              size="small"
              placeholder="Category"
              allowClear
              value={image.category_id ?? undefined}
              onChange={(value) => onChangeCategory(value ?? null)}
              options={categories.map((c) => ({
                label: c.name,
                value: c.id,
              }))}
              style={{ minWidth: 200 }}
            />
          </div>
          {image.alt_text && (
            <div className="flex items-start gap-2">
              <span className="w-24 font-medium text-gray-500">Alt text:</span>
              <span className="flex-1 text-gray-800">{image.alt_text}</span>
            </div>
          )}
          <div className="flex items-start gap-2">
            <span className="w-24 font-medium text-gray-500">Source URL:</span>
            <Typography.Link
              href={image.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 break-all"
            >
              {image.source_url}
            </Typography.Link>
          </div>
          {(image.provider || image.license) && (
            <div className="flex items-center gap-2">
              <span className="w-24 font-medium text-gray-500">Source:</span>
              <ProviderTag provider={image.provider} />
              <LicenseText license={image.license} licenseUrl={image.license_url} />
            </div>
          )}
          {image.page_url && (
            <div className="flex items-start gap-2">
              <span className="w-24 font-medium text-gray-500">Page URL:</span>
              <Typography.Link
                href={image.page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 break-all"
              >
                {image.page_url}
              </Typography.Link>
            </div>
          )}
          {(image.width > 0 || image.height > 0) && (
            <div className="flex items-center gap-2">
              <span className="w-24 font-medium text-gray-500">Dimensions:</span>
              <span className="font-mono">
                {image.width} × {image.height} px
              </span>
            </div>
          )}
          {image.file_size_bytes > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-24 font-medium text-gray-500">File size:</span>
              <span>{formatBytes(image.file_size_bytes)}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="w-24 font-medium text-gray-500">Created:</span>
            <span>{new Date(image.created_at).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-24 font-medium text-gray-500">Ground Truth:</span>
            {image.ground_truth ? (
              <Tag color="cyan" className="font-mono text-sm px-2 py-0.5">
                {image.ground_truth}
              </Tag>
            ) : (
              <Typography.Text type="secondary">— Not set</Typography.Text>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Backward-compatible Root Page Component
// ---------------------------------------------------------------------------

export function ScraperPage({
  defaultTab = "spyder",
}: {
  defaultTab?: "spyder" | "data" | "categories";
}) {
  const location = useLocation();

  if (location.pathname.startsWith("/scraper/data") || defaultTab === "data") {
    return <ScrapeDataPage />;
  }
  if (
    location.pathname.startsWith("/scraper/categories") ||
    defaultTab === "categories"
  ) {
    return <ScraperCategoriesPage />;
  }
  return <SpyderPage />;
}
