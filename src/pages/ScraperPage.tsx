import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  StopOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import {
  createCategory,
  deleteCategory,
  deleteImage,
  extractWithGemini,
  getCategories,
  getGeminiConfig,
  getGeminiPrompts,
  getImageBlob,
  getImages,
  getSessions,
  startScrape,
  stopSession,
  updateCategory,
  updateImageCategory,
  updateImageGroundTruth,
} from "@/api/scraper";
import { PageHeader } from "@/components/common/PageHeader";
import { formatBytes } from "@/utils/format";
import type {
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

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Tab 1: Scrape
// ---------------------------------------------------------------------------

function ScrapeTab() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  // Form state
  const [url, setUrl] = useState("");
  const [keywords, setKeywords] = useState("");
  const [maxImages, setMaxImages] = useState<number>(100);
  const [maxPages, setMaxPages] = useState<number>(10);
  const [depth, setDepth] = useState<number>(2);
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Add-category modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");

  // Session detail modal
  const [detailSession, setDetailSession] = useState<ScraperSession | null>(
    null,
  );

  const categoriesQuery = useQuery({
    queryKey: ["scraper", "categories"],
    queryFn: getCategories,
  });

  const sessionsQuery = useQuery({
    queryKey: ["scraper", "sessions"],
    queryFn: () => getSessions({ limit: 50 }),
    refetchInterval: 3000,
  });

  const scrapeMutation = useMutation({
    mutationFn: startScrape,
    onSuccess: () => {
      message.success("Autonomous scrape session started");
      setUrl("");
      setKeywords("");
      queryClient.invalidateQueries({ queryKey: ["scraper", "sessions"] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const stopMutation = useMutation({
    mutationFn: stopSession,
    onSuccess: () => {
      message.success("Session stopped");
      queryClient.invalidateQueries({ queryKey: ["scraper", "sessions"] });
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
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const handleStartScrape = useCallback(() => {
    const trimmedUrl = url.trim();
    const trimmedKeywords = keywords.trim();

    if (!trimmedUrl && !trimmedKeywords) {
      message.warning("Please provide search keywords for autonomous crawling");
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
    });
  }, [url, keywords, maxImages, maxPages, depth, categoryId, scrapeMutation, message]);

  const sessionColumns: ColumnsType<ScraperSession> = [
    {
      title: "Source / Keywords",
      dataIndex: "seed_url",
      key: "seed_url",
      ellipsis: true,
      render: (text: string) => {
        if (!text || text.startsWith("auto:")) {
          const kw = text ? text.replace(/^auto:/, "") : "Autonomous";
          return (
            <Space direction="vertical" size={2}>
              <Tag color="blue" icon={<SearchOutlined />}>
                Autonomous Search
              </Tag>
              <Typography.Text strong ellipsis={{ tooltip: kw }} style={{ maxWidth: 240 }}>
                "{kw}"
              </Typography.Text>
            </Space>
          );
        }
        return (
          <Typography.Text copyable={{ text }} style={{ maxWidth: 260 }}>
            {text.length > 50 ? `${text.slice(0, 50)}...` : text}
          </Typography.Text>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (status: ScraperSessionStatus) => (
        <Tag color={STATUS_COLORS[status]}>{status}</Tag>
      ),
    },
    {
      title: "Category",
      dataIndex: "category_name",
      key: "category_name",
      width: 150,
      render: (name: string | null) => (name ? <Tag color="geekblue">{name}</Tag> : "-"),
    },
    {
      title: "Images",
      dataIndex: "image_count",
      key: "image_count",
      width: 90,
      align: "right" as const,
      render: (count: number) => (
        <Typography.Text strong className="text-blue-600">
          {(count ?? 0).toLocaleString()}
        </Typography.Text>
      ),
    },
    {
      title: "Pages",
      dataIndex: "pages_visited",
      key: "pages_visited",
      width: 80,
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
      width: 100,
      render: (_: unknown, record: ScraperSession) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setDetailSession(record)}
          />
          {(record.status === "pending" || record.status === "running") && (
            <Popconfirm
              title="Stop this scrape session?"
              onConfirm={() => stopMutation.mutate(record.id)}
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<StopOutlined />}
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card
        title={
          <Space>
            <ThunderboltOutlined className="text-amber-500" />
            <span>Autonomous Web Image Harvester</span>
          </Space>
        }
        size="small"
      >
        <div className="space-y-4">
          <Alert
            type="info"
            showIcon
            message="Autonomous Multi-Engine Crawl (Bing Images & Wikimedia Commons)"
            description={
              <div className="text-xs space-y-1 mt-1 text-slate-600">
                <div>
                  • <strong>Zero Duplicate Guarantee:</strong> Dual-layer deduplication (URL hash + SHA-256 content hash) against all existing images in the category.
                </div>
                <div>
                  • <strong>Smart Search Memory:</strong> Remembers visited page URLs and search pagination offsets per category so repeating scrapes never visits already-scraped pages.
                </div>
                <div>
                  • <strong>High Capacity:</strong> Concurrent 8-worker parallel pipeline capable of scraping up to 100,000 (1 Lakh) images continuously.
                </div>
              </div>
            }
          />

          <Row gutter={[16, 16]}>
            <Col xs={24} md={14}>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Search Keyword(s) <span className="text-red-500">*</span>
              </label>
              <Input
                size="large"
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="e.g. electric meter display digits, car odometer numbers, fuel gauge"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                allowClear
              />
              <Typography.Text type="secondary" className="mt-1 block text-xs">
                Enter primary subject terms. The harvester automatically generates relevant query expansions to satisfy your requested count.
              </Typography.Text>
            </Col>

            <Col xs={24} md={10}>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Target Category <span className="text-red-500">*</span>
              </label>
              <Space.Compact className="!w-full">
                <Select
                  size="large"
                  className="!flex-1"
                  placeholder="Select or create category"
                  allowClear
                  value={categoryId}
                  onChange={setCategoryId}
                  loading={categoriesQuery.isLoading}
                  options={(categoriesQuery.data ?? []).map((c) => ({
                    label: `${c.name} (${c.image_count ?? 0} images)`,
                    value: c.id,
                  }))}
                />
                <Button
                  size="large"
                  icon={<PlusOutlined />}
                  onClick={() => setCatModalOpen(true)}
                  title="Create new category"
                >
                  New
                </Button>
              </Space.Compact>
              <Typography.Text type="secondary" className="mt-1 block text-xs">
                Deduplication & visited-page memory are permanently scoped to this category.
              </Typography.Text>
            </Col>

            <Col xs={24}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <label className="text-sm font-semibold text-slate-700">
                  Target Image Count (Up to 100,000 / 1 Lakh)
                </label>
                <Space size="small" wrap>
                  <span className="text-xs text-slate-500">Quick presets:</span>
                  {[50, 200, 1000, 5000, 20000, 100000].map((preset) => (
                    <Button
                      key={preset}
                      size="small"
                      type={maxImages === preset ? "primary" : "default"}
                      onClick={() => setMaxImages(preset)}
                    >
                      {preset >= 1000 ? `${preset / 1000}k${preset === 100000 ? " (1 Lakh)" : ""}` : preset}
                    </Button>
                  ))}
                </Space>
              </div>
              <InputNumber
                min={1}
                max={100000}
                value={maxImages}
                onChange={(v) => setMaxImages(v ?? 100)}
                className="!w-full"
                size="large"
                formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                parser={(val) => Number((val ?? "").replace(/\$\s?|(,*)/g, ""))}
              />
            </Col>
          </Row>

          {/* Advanced toggle for direct website URL crawling */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Space size="small">
                <SettingOutlined className="text-slate-500" />
                <span className="text-xs font-medium text-slate-700">
                  Advanced: Specific Website Crawl (Optional Override)
                </span>
                {url && <Tag color="blue">URL Specified</Tag>}
              </Space>
              <Button type="link" size="small">
                {showAdvanced ? "Hide" : "Show"}
              </Button>
            </div>

            {showAdvanced && (
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                <Row gutter={[16, 12]}>
                  <Col xs={24} md={14}>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Seed URL (Leave empty for Autonomous Web Search)
                    </label>
                    <Input
                      placeholder="https://example.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      allowClear
                    />
                  </Col>
                  <Col xs={12} sm={5}>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Max Pages Override
                    </label>
                    <InputNumber
                      min={1}
                      max={500}
                      value={maxPages}
                      onChange={(v) => setMaxPages(v ?? 10)}
                      className="!w-full"
                    />
                  </Col>
                  <Col xs={12} sm={5}>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Crawl Depth Override
                    </label>
                    <InputNumber
                      min={0}
                      max={5}
                      value={depth}
                      onChange={(v) => setDepth(v ?? 2)}
                      className="!w-full"
                    />
                  </Col>
                </Row>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              loading={scrapeMutation.isPending}
              onClick={handleStartScrape}
              className="px-8 !bg-blue-600 hover:!bg-blue-700"
            >
              Start Autonomous Harvester
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Recent Sessions" size="small">
        <Table
          rowKey="id"
          dataSource={sessionsQuery.data?.sessions ?? []}
          columns={sessionColumns}
          loading={sessionsQuery.isLoading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          size="small"
          scroll={{ x: 800 }}
        />
      </Card>

      {/* Add Category Modal */}
      <Modal
        title="Add Category"
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
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <Input
              placeholder="Category name"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Description
            </label>
            <Input.TextArea
              placeholder="Optional description"
              value={newCatDesc}
              onChange={(e) => setNewCatDesc(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </Modal>

      {/* Session Detail Modal */}
      <Modal
        title="Session Details"
        open={detailSession !== null}
        onCancel={() => setDetailSession(null)}
        footer={null}
        width={600}
      >
        {detailSession && (
          <div className="space-y-3">
            <div>
              <Typography.Text type="secondary" className="block text-xs">
                {detailSession.seed_url?.startsWith("auto:") ? "Autonomous Keywords" : "Target URL"}
              </Typography.Text>
              <Typography.Text strong className="text-base">
                {detailSession.seed_url?.startsWith("auto:")
                  ? detailSession.seed_url.replace("auto:", "")
                  : detailSession.seed_url}
              </Typography.Text>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <Typography.Text type="secondary" className="block text-xs">Status</Typography.Text>
                <Tag color={STATUS_COLORS[detailSession.status]}>{detailSession.status}</Tag>
              </div>
              <div>
                <Typography.Text type="secondary" className="block text-xs">Category</Typography.Text>
                <Typography.Text>{detailSession.category_name ?? "None"}</Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary" className="block text-xs">Images Scraped</Typography.Text>
                <Typography.Text strong className="text-blue-600">
                  {(detailSession.image_count ?? 0).toLocaleString()}
                </Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary" className="block text-xs">Pages / Offsets Visited</Typography.Text>
                <Typography.Text>{(detailSession.pages_visited ?? 0).toLocaleString()}</Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary" className="block text-xs">Started</Typography.Text>
                <Typography.Text>{new Date(detailSession.created_at).toLocaleString()}</Typography.Text>
              </div>
              {detailSession.completed_at && (
                <div>
                  <Typography.Text type="secondary" className="block text-xs">Completed</Typography.Text>
                  <Typography.Text>{new Date(detailSession.completed_at).toLocaleString()}</Typography.Text>
                </div>
              )}
            </div>
            {detailSession.error && (
              <Alert
                type="error"
                showIcon
                message="Session Error"
                description={detailSession.error}
                className="mt-2"
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Data Bank
// ---------------------------------------------------------------------------

function DataBankTab() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedImage, setSelectedImage] = useState<ScraperImage | null>(null);
  const [getValueImage, setGetValueImage] = useState<ScraperImage | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["scraper", "categories"],
    queryFn: getCategories,
  });

  const imagesQuery = useQuery({
    queryKey: ["scraper", "images", categoryFilter, search, page],
    queryFn: () =>
      getImages({
        category_id: categoryFilter,
        search: search || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteImage,
    onSuccess: () => {
      message.success("Image deleted");
      queryClient.invalidateQueries({ queryKey: ["scraper", "images"] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const updateCatMutation = useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string | null }) =>
      updateImageCategory(id, categoryId),
    onSuccess: () => {
      message.success("Category updated");
      queryClient.invalidateQueries({ queryKey: ["scraper", "images"] });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const handleCategoryChange = (id: string, categoryId: string | null) => {
    updateCatMutation.mutate({ id, categoryId });
    setSelectedImage((prev) =>
      prev && prev.id === id ? { ...prev, category_id: categoryId } : prev,
    );
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
    if (selectedImage?.id === id) {
      setSelectedImage(null);
    }
    if (getValueImage?.id === id) {
      setGetValueImage(null);
    }
  };

  const images = imagesQuery.data?.images ?? [];
  const total = imagesQuery.data?.total ?? 0;

  const columns: ColumnsType<ScraperImage> = [
    {
      title: "Alt Text",
      dataIndex: "alt_text",
      key: "alt_text",
      ellipsis: true,
      render: (text: string | null) =>
        text ? (
          <Typography.Text ellipsis style={{ maxWidth: 200 }}>
            {text}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
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
          placeholder="Category"
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
      title: "GT (Ground Truth)",
      dataIndex: "ground_truth",
      key: "ground_truth",
      width: 180,
      render: (text: string | null | undefined) =>
        text ? (
          <Tag color="cyan" style={{ fontSize: 13, padding: "2px 8px" }}>
            {text}
          </Tag>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: "Get Value",
      key: "get_value",
      width: 120,
      render: (_: unknown, record: ScraperImage) => (
        <Button
          size="small"
          type="primary"
          ghost
          icon={<ThunderboltOutlined />}
          onClick={() => setGetValueImage(record)}
        >
          Get Value
        </Button>
      ),
    },
    {
      title: "Dimensions",
      key: "dimensions",
      width: 110,
      render: (_: unknown, record: ScraperImage) =>
        record.width && record.height
          ? `${record.width} × ${record.height}`
          : "—",
    },
    {
      title: "Size",
      dataIndex: "file_size_bytes",
      key: "file_size_bytes",
      width: 90,
      render: (bytes: number) => formatBytes(bytes),
    },
    {
      title: "Source URL",
      dataIndex: "source_url",
      key: "source_url",
      ellipsis: true,
      render: (text: string) => (
        <Typography.Link
          href={text}
          target="_blank"
          rel="noopener noreferrer"
          ellipsis
          style={{ maxWidth: 200 }}
        >
          {text}
        </Typography.Link>
      ),
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_: unknown, record: ScraperImage) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setSelectedImage(record)}
          >
            View
          </Button>
          <Popconfirm
            title="Delete this image?"
            onConfirm={() => handleDelete(record.id)}
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          placeholder="All categories"
          allowClear
          value={categoryFilter}
          onChange={(v) => {
            setCategoryFilter(v);
            setPage(1);
          }}
          loading={categoriesQuery.isLoading}
          options={(categoriesQuery.data ?? []).map((c) => ({
            label: c.name,
            value: c.id,
          }))}
          style={{ minWidth: 180 }}
        />
        <Input.Search
          placeholder="Search by alt text or URL"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={() => setPage(1)}
          style={{ maxWidth: 320 }}
          prefix={<SearchOutlined />}
        />
        <Typography.Text type="secondary">
          {total} image{total !== 1 ? "s" : ""}
        </Typography.Text>
      </div>

      <Table
        rowKey="id"
        dataSource={images}
        columns={columns}
        loading={imagesQuery.isLoading}
        locale={{ emptyText: <Empty description="No images found" /> }}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          showSizeChanger: false,
          showTotal: (t) => `Total ${t} image${t !== 1 ? "s" : ""}`,
          onChange: (p) => setPage(p),
        }}
        size="small"
        scroll={{ x: 1000 }}
      />

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
        />
      )}

      {getValueImage && (
        <GetValueModal
          key={getValueImage.id}
          image={getValueImage}
          onClose={() => setGetValueImage(null)}
          onSaved={(updated) => {
            queryClient.invalidateQueries({ queryKey: ["scraper", "images"] });
            if (selectedImage?.id === updated.id) {
              setSelectedImage(updated);
            }
          }}
        />
      )}
    </div>
  );
}

function GetValueModal({
  image,
  onClose,
  onSaved,
}: {
  image: ScraperImage;
  onClose: () => void;
  onSaved: (updated: ScraperImage) => void;
}) {
  const { message } = App.useApp();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [previewFailed, setPreviewFailed] = useState(false);

  const [selectedPromptId, setSelectedPromptId] = useState<string>("odometer_reading");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem("gemini_api_key") || "");
  const [reviewedValue, setReviewedValue] = useState<string>(image.ground_truth || "");
  const [extractError, setExtractError] = useState<string | null>(null);
  const [usedModelTag, setUsedModelTag] = useState<string | null>(null);

  const promptsQuery = useQuery({
    queryKey: ["scraper", "prompts"],
    queryFn: getGeminiPrompts,
  });

  const configQuery = useQuery({
    queryKey: ["scraper", "gemini-config"],
    queryFn: getGeminiConfig,
  });

  const effectiveModel =
    selectedModel || configQuery.data?.default_model || "gemini-3.5-flash-lite";

  const activePromptText =
    customPrompt !== null
      ? customPrompt
      : (promptsQuery.data?.find((p) => p.id === selectedPromptId)?.prompt ??
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
    },
    onError: (err) => {
      const errMsg = getApiErrorMessage(err);
      setExtractError(errMsg);
      message.error(errMsg);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (gt: string) => updateImageGroundTruth(image.id, gt),
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
    if (apiKey) {
      localStorage.setItem("gemini_api_key", apiKey.trim());
    }
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
              disabled={!reviewedValue.trim()}
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
              <img
                src={previewUrl}
                alt={image.alt_text ?? "Image to extract"}
                className="h-full w-full object-contain"
              />
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
                value={selectedPromptId}
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

        {/* API Key setting */}
        <div className="rounded border border-dashed p-2.5 text-xs space-y-1.5 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-700">Gemini API Key:</span>
            {serverHasKey ? (
              <Tag color="success">Server API Key Configured</Tag>
            ) : (
              <Typography.Link
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get free API Key (Google AI Studio)
              </Typography.Link>
            )}
          </div>
          <Input.Password
            size="small"
            placeholder={
              serverHasKey
                ? "Optional override: enter custom Gemini API key"
                : "Enter your Gemini API key (saved in browser)"
            }
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

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
        <div className="space-y-1.5 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-blue-900">
              Review Extracted Value (Ground Truth):
            </label>
            <Space size="small">
              {usedModelTag && (
                <Tag color="geekblue">Model: {usedModelTag}</Tag>
              )}
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
            style={{ fontSize: 14, fontWeight: 500 }}
          />
          <Typography.Text type="secondary" className="block text-xs">
            Review and adjust the extracted value above, then click &quot;Save Ground Truth&quot; to save it on the row.
          </Typography.Text>
        </div>
      </div>
    </Modal>
  );
}

function ImagePreviewModal({
  image,
  categories,
  onClose,
  onChangeCategory,
  onDelete,
}: {
  image: ScraperImage;
  categories: ScraperCategory[];
  onClose: () => void;
  onChangeCategory: (categoryId: string | null) => void;
  onDelete: () => void;
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
      title={image.alt_text || "Image Details"}
      open
      onCancel={onClose}
      width={720}
      centered
      footer={
        <div className="flex items-center justify-between">
          <Popconfirm
            title="Delete this image?"
            onConfirm={onDelete}
          >
            <Button danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
          <Space>
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
              <span>
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
              <Tag color="cyan">{image.ground_truth}</Tag>
            ) : (
              <Typography.Text type="secondary">—</Typography.Text>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Categories
// ---------------------------------------------------------------------------

function CategoriesTab() {
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
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      message.success("Category deleted");
      queryClient.invalidateQueries({ queryKey: ["scraper", "categories"] });
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
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (v: string) => v || "-",
    },
    {
      title: "Images",
      dataIndex: "image_count",
      key: "image_count",
      width: 100,
      align: "right" as const,
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      width: 170,
      render: (v: string) => new Date(v).toLocaleString(),
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
                ? "This category has images. Remove them first."
                : undefined
            }
            onConfirm={() => {
              if (record.image_count > 0) {
                message.warning(
                  "Cannot delete category with images. Remove images first.",
                );
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Add Category
        </Button>
      </div>

      <Table
        rowKey="id"
        dataSource={categoriesQuery.data ?? []}
        columns={columns}
        loading={categoriesQuery.isLoading}
        pagination={false}
        size="small"
      />

      <Modal
        title={editingCat ? "Edit Category" : "Add Category"}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <Input
              placeholder="Category name"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Description
            </label>
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
// Main Page
// ---------------------------------------------------------------------------

const TAB_ITEMS = [
  { key: "scrape", label: "Scrape", children: <ScrapeTab /> },
  { key: "databank", label: "Data Bank", children: <DataBankTab /> },
  { key: "categories", label: "Categories", children: <CategoriesTab /> },
];

export function ScraperPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <PageHeader
        title="Image Scraper"
        description="Scrape, browse, and organize images from the web"
      />
      <div className="flex-1 p-6">
        <Tabs items={TAB_ITEMS} defaultActiveKey="scrape" />
      </div>
    </div>
  );
}
