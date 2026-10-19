import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  GlobalOutlined,
  PlusOutlined,
  SearchOutlined,
  StopOutlined,
} from "@ant-design/icons";
import {
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
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/api/client";
import {
  createCategory,
  deleteCategory,
  deleteImage,
  getCategories,
  getImageBlob,
  getImages,
  getSessions,
  startScrape,
  stopSession,
  updateCategory,
  updateImageCategory,
} from "@/api/scraper";
import { PageHeader } from "@/components/common/PageHeader";
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
  const queryClient = useQueryClient();

  // Form state
  const [url, setUrl] = useState("");
  const [keywords, setKeywords] = useState("");
  const [maxImages, setMaxImages] = useState<number>(20);
  const [maxPages, setMaxPages] = useState<number>(5);
  const [depth, setDepth] = useState<number>(1);
  const [categoryId, setCategoryId] = useState<string | undefined>();

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
      message.success("Scrape session started");
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
    if (!url.trim()) {
      message.warning("Please enter a URL");
      return;
    }
    scrapeMutation.mutate({
      seed_url: url.trim(),
      keywords: keywords.trim() || undefined,
      max_images: maxImages,
      max_pages: maxPages,
      depth,
      category_id: categoryId,
    });
  }, [url, keywords, maxImages, maxPages, depth, categoryId, scrapeMutation]);

  const sessionColumns: ColumnsType<ScraperSession> = [
    {
      title: "URL",
      dataIndex: "seed_url",
      key: "seed_url",
      ellipsis: true,
      render: (text: string) => (
        <Typography.Text copyable={{ text }} style={{ maxWidth: 260 }}>
          {text.length > 50 ? `${text.slice(0, 50)}...` : text}
        </Typography.Text>
      ),
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
      width: 140,
      render: (name: string | null) => name ?? "-",
    },
    {
      title: "Images",
      dataIndex: "image_count",
      key: "image_count",
      width: 80,
      align: "right" as const,
    },
    {
      title: "Pages",
      dataIndex: "pages_visited",
      key: "pages_visited",
      width: 80,
      align: "right" as const,
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
      <Card title="New Scrape" size="small">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <label className="mb-1 block text-sm font-medium">
              URL <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            {/^https?:\/\/([^.]+\.)?google\.[^/]+\/search/i.test(url) && (
              <Typography.Text type="secondary" className="mt-1 block text-xs">
                Google Images opens in a real Chromium window. If Google asks for CAPTCHA,
                solve it there and scraping resumes automatically.
              </Typography.Text>
            )}
          </Col>
          <Col xs={24} md={12}>
            <label className="mb-1 block text-sm font-medium">Keywords</label>
            <Input
              placeholder="odometer, dashboard, car"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <label className="mb-1 block text-sm font-medium">
              Max Images
            </label>
            <InputNumber
              min={1}
              // max={200}
              value={maxImages}
              onChange={(v) => setMaxImages(v ?? 20)}
              className="!w-full"
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <label className="mb-1 block text-sm font-medium">Max Pages</label>
            <InputNumber
              min={1}
              max={20}
              value={maxPages}
              onChange={(v) => setMaxPages(v ?? 5)}
              className="!w-full"
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <label className="mb-1 block text-sm font-medium">Depth</label>
            <InputNumber
              min={0}
              max={3}
              value={depth}
              onChange={(v) => setDepth(v ?? 1)}
              className="!w-full"
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <Space.Compact className="!w-full">
              <Select
                className="!flex-1"
                placeholder="Select category"
                allowClear
                value={categoryId}
                onChange={setCategoryId}
                loading={categoriesQuery.isLoading}
                options={(categoriesQuery.data ?? []).map((c) => ({
                  label: c.name,
                  value: c.id,
                }))}
              />
              <Button icon={<PlusOutlined />} onClick={() => setCatModalOpen(true)} />
            </Space.Compact>
          </Col>
          <Col xs={24} md={4} className="flex items-end">
            <Button
              type="primary"
              icon={<GlobalOutlined />}
              loading={scrapeMutation.isPending}
              onClick={handleStartScrape}
              block
            >
              Start Scraping
            </Button>
          </Col>
        </Row>
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
          <div className="space-y-2">
            <p>
              <strong>URL:</strong> {detailSession.seed_url}
            </p>
            <p>
              <strong>Status:</strong>{" "}
              <Tag color={STATUS_COLORS[detailSession.status]}>
                {detailSession.status}
              </Tag>
            </p>
            <p>
              <strong>Category:</strong>{" "}
              {detailSession.category_name ?? "None"}
            </p>
            <p>
              <strong>Images found:</strong> {detailSession.image_count}
            </p>
            <p>
              <strong>Pages visited:</strong> {detailSession.pages_visited}
            </p>
            <p>
              <strong>Started:</strong>{" "}
              {new Date(detailSession.created_at).toLocaleString()}
            </p>
            {detailSession.completed_at && (
              <p>
                <strong>Completed:</strong>{" "}
                {new Date(detailSession.completed_at).toLocaleString()}
              </p>
            )}
            {detailSession.error && (
              <p>
                <strong>Error:</strong>{" "}
                <Typography.Text type="danger">
                  {detailSession.error}
                </Typography.Text>
              </p>
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
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

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

  const images = imagesQuery.data?.images ?? [];
  const total = imagesQuery.data?.total ?? 0;

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

      {imagesQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spin size="large" />
        </div>
      ) : images.length === 0 ? (
        <Empty description="No images found" />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <ImageCard
              key={img.id}
              image={img}
              categories={categoriesQuery.data ?? []}
              onDelete={() => deleteMutation.mutate(img.id)}
              onChangeCategory={(catId) =>
                updateCatMutation.mutate({ id: img.id, categoryId: catId })
              }
            />
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex justify-center pt-4">
          <Button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Typography.Text className="mx-4 leading-8">
            Page {page} of {Math.ceil(total / PAGE_SIZE)}
          </Typography.Text>
          <Button
            disabled={page >= Math.ceil(total / PAGE_SIZE)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function ImageCard({
  image,
  categories,
  onDelete,
  onChangeCategory,
}: {
  image: ScraperImage;
  categories: ScraperCategory[];
  onDelete: () => void;
  onChangeCategory: (categoryId: string | null) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setPreviewFailed(false);
    setPreviewUrl(undefined);
    void getImageBlob(image.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (active) setPreviewFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.id]);

  return (
    <Card
      size="small"
      cover={
        <div className="flex h-40 items-center justify-center overflow-hidden bg-gray-100">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={image.alt_text ?? "scraped image"}
              className="h-full w-full object-contain"
            />
          ) : previewFailed ? (
            <Typography.Text type="secondary">Preview unavailable</Typography.Text>
          ) : (
            <Spin size="small" />
          )}
        </div>
      }
      actions={[
        <Popconfirm
          key="delete"
          title="Delete this image?"
          onConfirm={onDelete}
        >
          <DeleteOutlined />
        </Popconfirm>,
      ]}
    >
      <Card.Meta
        title={
          <Typography.Text ellipsis style={{ fontSize: 12 }}>
            {image.alt_text || "No alt text"}
          </Typography.Text>
        }
        description={
          <div className="space-y-1">
            <Typography.Link
              href={image.source_url}
              target="_blank"
              rel="noopener noreferrer"
              ellipsis
              style={{ fontSize: 11 }}
            >
              {image.source_url}
            </Typography.Link>
            <div>
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
                style={{ width: "100%" }}
              />
            </div>
          </div>
        }
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Categories
// ---------------------------------------------------------------------------

function CategoriesTab() {
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
