import { useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Row,
  Space,
  Tabs,
  Typography,
} from "antd";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ReloadOutlined } from "@ant-design/icons";

import { PageHeader } from "@/components/common/PageHeader";
import { BillStatusBadge, ConfidenceBadge } from "@/components/bill/BillBadges";
import { BillDocumentViewer } from "@/components/bill/BillDocumentViewer";
import { BillExtractionPanel } from "@/components/bill/BillExtractionPanel";
import {
  BillFailurePanel,
  BillProcessingTimeline,
  BillValidationPanel,
} from "@/components/bill/BillPanels";
import {
  useBillDocumentEvidence,
  useBillDocumentResult,
  useBillDocumentReview,
  useSubmitBillCorrection,
} from "@/features/bill/hooks";
import {
  getLocalBillDocument,
  loadBillBlob,
  updateLocalBillDocument,
} from "@/features/bill/localDocuments";
import {
  matchesPage,
  resolveBillPagePreview,
} from "@/features/bill/pagePreview";
import {
  formatBillFieldValue,
  normalizeBBox,
  type BillDocumentResult,
  type BillOcrBlock,
} from "@/types/bill";
import { getApiErrorMessage } from "@/api/client";

export function BillDocumentDetailPage() {
  const { documentId: rawId = "" } = useParams();
  const documentId = decodeURIComponent(rawId);
  const [searchParams, setSearchParams] = useSearchParams();
  const { message } = App.useApp();

  const local = getLocalBillDocument(documentId);
  const resultQuery = useBillDocumentResult(documentId);
  const evidenceQuery = useBillDocumentEvidence(documentId);
  const reviewQuery = useBillDocumentReview(documentId);
  const correctionMut = useSubmitBillCorrection(documentId);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSource, setPreviewSource] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(
    searchParams.get("field"),
  );
  const [selectedOcrId, setSelectedOcrId] = useState<string | null>(null);

  const result: BillDocumentResult | null =
    resultQuery.data && Object.keys(resultQuery.data).length
      ? resultQuery.data
      : (local?.resultSnapshot ?? null);

  useEffect(() => {
    let revoke: (() => void) | null = null;
    let cancelled = false;
    setPreviewLoading(true);
    (async () => {
      try {
        const blob = local?.blobKey ? await loadBillBlob(local.blobKey) : null;
        if (cancelled) return;
        const preview = await resolveBillPagePreview({
          documentId,
          pageNumber,
          localBlob: blob,
          fileName: local?.fileName,
          pagePreviews: result?.page_previews,
        });
        if (cancelled) {
          preview?.revoke();
          return;
        }
        if (!preview) {
          setImageUrl(null);
          setPreviewSource(null);
          return;
        }
        revoke = preview.revoke;
        setImageUrl(preview.imageUrl);
        setPageCount(preview.pageCount);
        setPreviewSource(preview.source);
        if (preview.pageNumber !== pageNumber) {
          setPageNumber(preview.pageNumber);
        }
      } catch {
        if (!cancelled) {
          setImageUrl(null);
          setPreviewSource(null);
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      revoke?.();
    };
  }, [
    documentId,
    pageNumber,
    local?.blobKey,
    local?.fileName,
    result?.page_previews,
  ]);

  useEffect(() => {
    if (resultQuery.data && Object.keys(resultQuery.data).length) {
      updateLocalBillDocument(documentId, {
        resultSnapshot: resultQuery.data,
        status: resultQuery.data.status ?? local?.status ?? "FAILED",
        reviewRequired: Boolean(resultQuery.data.review?.required),
        confidenceOverall: resultQuery.data.confidence?.overall,
        confidenceLevel:
          (resultQuery.data.confidence?.confidence_band as string | undefined) ||
          resultQuery.data.confidence?.level,
        validationStatus: resultQuery.data.validation?.status,
      });
    }
  }, [resultQuery.data, documentId, local?.status]);

  const allOcrBlocks: BillOcrBlock[] = useMemo(() => {
    const fromEvidence = evidenceQuery.data?.evidence_refs?.ocr_blocks;
    const fromResult = result?.evidence_refs?.ocr_blocks;
    return fromEvidence ?? fromResult ?? [];
  }, [evidenceQuery.data, result]);

  const ocrBlocks: BillOcrBlock[] = useMemo(() => {
    return allOcrBlocks.filter((b) => matchesPage(b.page_id, pageNumber));
  }, [allOcrBlocks, pageNumber]);

  const evidenceBoxes = useMemo(() => {
    if (!selectedField || !result?.fields?.[selectedField]) return [];
    const field = result.fields[selectedField]!;
    const boxes: Array<{ id: string; bbox: number[]; label?: string }> = [];
    for (const ev of field.evidence ?? []) {
      if (!ev || typeof ev !== "object") continue;
      const e = ev as Record<string, unknown>;
      const evPage = e.page_id as string | undefined;
      if (evPage && !matchesPage(evPage, pageNumber)) continue;
      const bb = normalizeBBox(e.bbox as number[] | undefined);
      if (bb) boxes.push({ id: String(e.source_id ?? e.id ?? selectedField), bbox: bb });
    }
    // Fallback: match OCR text containing raw value (current page)
    const raw = formatBillFieldValue(field.raw_value ?? field.value);
    if (!boxes.length && raw && raw !== "—") {
      for (const b of ocrBlocks) {
        if (b.text && raw.includes(b.text.slice(0, 12))) {
          const bb = normalizeBBox(b.bbox);
          if (bb) boxes.push({ id: b.id, bbox: bb, label: b.text });
        }
      }
    }
    return boxes;
  }, [selectedField, result, ocrBlocks, pageNumber]);

  const tableBoxes = useMemo(() => {
    return (result?.tables ?? [])
      .map((t, i) => {
        const pageId = (t as { page_id?: string }).page_id;
        if (pageId && !matchesPage(pageId, pageNumber)) return null;
        const bb = normalizeBBox((t as { bbox?: number[] }).bbox);
        if (!bb) return null;
        return {
          id: String((t as { id?: string }).id ?? `table-${i}`),
          bbox: bb,
          label: "table",
        };
      })
      .filter(Boolean) as Array<{ id: string; bbox: number[]; label?: string }>;
  }, [result, pageNumber]);

  const onSelectField = (field: string) => {
    setSelectedField(field);
    const next = new URLSearchParams(searchParams);
    next.set("field", field);
    setSearchParams(next, { replace: true });
  };

  const [form] = Form.useForm();

  const onCorrect = async () => {
    const values = await form.validateFields();
    try {
      const res = await correctionMut.mutateAsync({
        field: values.field,
        corrected_value: values.corrected_value,
        original_prediction: result?.fields?.[values.field]?.value,
        notes: values.notes,
        failure_type: values.failure_type,
        reviewer: values.reviewer || "ui-reviewer",
      });
      message.success(
        res.message ||
          `Correction recorded (${res.feedback_id ?? "ok"}). Extraction result is not auto-updated by the backend.`,
      );
      form.resetFields(["corrected_value", "notes"]);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const conflicts =
    (evidenceQuery.data?.conflicts as unknown[]) ?? result?.conflicts ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        breadcrumbs={[
          { title: "Bill documents", path: "/bill/documents" },
          { title: documentId },
        ]}
        title={local?.fileName || documentId}
        description="Document review workspace — preview, extraction, evidence, validation, failures, and corrections."
        actions={
          <Space>
            <Link to="/bill/review">
              <Button>Review queue</Button>
            </Link>
            <Button
              icon={<ReloadOutlined />}
              loading={resultQuery.isFetching}
              onClick={() => {
                void resultQuery.refetch();
                void evidenceQuery.refetch();
                void reviewQuery.refetch();
              }}
            >
              Refetch
            </Button>
          </Space>
        }
      />

      <div className="border-b border-slate-200 bg-white px-6 py-2">
        <Space wrap>
          <BillStatusBadge status={result?.status ?? local?.status} />
          <ConfidenceBadge
            level={
              (result?.confidence?.confidence_band as string | undefined) ||
              result?.confidence?.level ||
              local?.confidenceLevel
            }
            score={
              (result?.confidence?.calibrated_confidence as number | undefined) ??
              result?.confidence?.overall ??
              local?.confidenceOverall
            }
            calibrated={result?.confidence?.calibrated as boolean | undefined}
          />
          <Typography.Text type="secondary">
            Job: {local?.jobId ?? "—"}
          </Typography.Text>
          <Typography.Text type="secondary">
            Profile: {result?.processing?.profile_id ?? local?.profileId ?? "—"}
            {result?.processing?.profile_version
              ? ` @ ${result.processing.profile_version}`
              : ""}
          </Typography.Text>
          <Typography.Text type="secondary">
            Pipeline:{" "}
            {result?.processing?.pipeline_version ?? "—"}
          </Typography.Text>
          {result?.document_type === "UNKNOWN" ? (
            <Typography.Text type="warning">
              Unknown / unclassified format — generic extraction
            </Typography.Text>
          ) : null}
        </Space>
      </div>

      {(resultQuery.isError || evidenceQuery.isError) && (
        <div className="px-6 pt-3">
          <Typography.Text type="danger">
            Backend fetch issue:{" "}
            {getApiErrorMessage(resultQuery.error ?? evidenceQuery.error)}.
            Showing local process snapshot when available.
          </Typography.Text>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12} xl={13}>
            <Card
              size="small"
              title="Document viewer"
              className="h-full"
              extra={
                previewSource ? (
                  <Typography.Text type="secondary" className="text-xs">
                    Preview:{" "}
                    {previewSource === "backend"
                      ? "server page image"
                      : previewSource === "local-pdf"
                        ? "local PDF raster"
                        : "local image"}
                  </Typography.Text>
                ) : null
              }
            >
              <div className="h-[min(70vh,720px)]">
                <BillDocumentViewer
                  imageUrl={imageUrl}
                  ocrBlocks={ocrBlocks}
                  tableBoxes={tableBoxes}
                  evidenceBoxes={evidenceBoxes}
                  selectedIds={[
                    ...evidenceBoxes.map((b) => b.id),
                    ...(selectedOcrId ? [selectedOcrId] : []),
                  ]}
                  onSelectBox={setSelectedOcrId}
                  pageNumber={pageNumber}
                  pageCount={pageCount}
                  onPageChange={setPageNumber}
                  loading={previewLoading}
                  pageLabel={`${ocrBlocks.length} OCR blocks on page`}
                  emptyHint={
                    local?.blobKey
                      ? "Could not render preview from backend pages or local file."
                      : "No local upload retained and no backend page images yet. Re-process to generate page previews."
                  }
                />
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={12} xl={11}>
            <Card size="small" title="Extracted fields" className="mb-4">
              <BillExtractionPanel
                result={result}
                selectedField={selectedField}
                onSelectField={onSelectField}
              />
            </Card>
            <Card size="small" title="Human correction" className="mb-4">
              <Form
                form={form}
                layout="vertical"
                initialValues={{ field: selectedField ?? undefined }}
                key={selectedField ?? "none"}
              >
                <Form.Item
                  name="field"
                  label="Field"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="field key from schema" />
                </Form.Item>
                <Form.Item
                  name="corrected_value"
                  label="Corrected value"
                  rules={[{ required: true }]}
                >
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Form.Item name="notes" label="Notes">
                  <Input />
                </Form.Item>
                <Form.Item name="failure_type" label="Failure type">
                  <Input placeholder="e.g. FIELD_AMBIGUOUS" />
                </Form.Item>
                <Form.Item name="reviewer" label="Reviewer">
                  <Input placeholder="optional" />
                </Form.Item>
                <Button
                  type="primary"
                  loading={correctionMut.isPending}
                  onClick={() => void onCorrect()}
                >
                  Submit correction feedback
                </Button>
              </Form>
              <Typography.Paragraph type="secondary" className="!mt-3 !mb-0 text-xs">
                Backend records feedback only — it does not rewrite the stored
                extraction result.
              </Typography.Paragraph>
            </Card>
          </Col>
        </Row>

        <Card size="small" className="mt-4">
          <Tabs
            items={[
              {
                key: "ocr",
                label: `OCR (${ocrBlocks.length}/${allOcrBlocks.length})`,
                children: allOcrBlocks.length ? (
                  <div className="max-h-80 space-y-1 overflow-auto">
                    {allOcrBlocks.map((b) => {
                      const onPage = matchesPage(b.page_id, pageNumber);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          className={`block w-full rounded border px-2 py-1 text-left text-sm ${
                            selectedOcrId === b.id
                              ? "border-teal-600 bg-teal-50"
                              : onPage
                                ? "border-slate-200"
                                : "border-slate-100 opacity-50"
                          }`}
                          onClick={() => {
                            setSelectedOcrId(b.id);
                            if (b.page_id) {
                              const m = /^page-(\d+)$/.exec(b.page_id);
                              if (m) setPageNumber(Number(m[1]));
                            }
                          }}
                        >
                          <span className="font-mono text-xs text-slate-400">
                            {b.page_id ?? "page-?"} · {b.id}
                          </span>{" "}
                          {b.text}
                          {b.confidence != null ? (
                            <span className="ml-2 text-xs text-slate-500">
                              {(b.confidence * 100).toFixed(0)}%
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <Empty description="No OCR blocks in evidence" />
                ),
              },
              {
                key: "tables",
                label: `Tables (${result?.tables?.length ?? 0})`,
                children: result?.tables?.length ? (
                  <pre className="max-h-80 overflow-auto text-xs">
                    {JSON.stringify(result.tables, null, 2)}
                  </pre>
                ) : (
                  <Empty description="No tables were detected" />
                ),
              },
              {
                key: "validation",
                label: "Validation",
                children: (
                  <BillValidationPanel validation={result?.validation} />
                ),
              },
              {
                key: "failures",
                label: `Failures (${result?.failures?.length ?? 0})`,
                children: <BillFailurePanel failures={result?.failures} />,
              },
              {
                key: "conflicts",
                label: `Conflicts (${conflicts.length})`,
                children: conflicts.length ? (
                  <pre className="max-h-80 overflow-auto text-xs">
                    {JSON.stringify(conflicts, null, 2)}
                  </pre>
                ) : (
                  <Empty description="No conflicts reported" />
                ),
              },
              {
                key: "processing",
                label: "Processing",
                children: (
                  <BillProcessingTimeline
                    stageMetrics={result?.processing?.stage_metrics}
                  />
                ),
              },
              {
                key: "vlm",
                label: "VLM",
                children: (
                  <pre className="max-h-80 overflow-auto text-xs">
                    {JSON.stringify(
                      {
                        used: Boolean(result?.vlm),
                        vlm: result?.vlm ?? evidenceQuery.data?.vlm ?? null,
                        policy: result?.processing?.stage_metrics?.vlm_policy,
                      },
                      null,
                      2,
                    )}
                  </pre>
                ),
              },
              {
                key: "review",
                label: "Review payload",
                children: reviewQuery.data ? (
                  <pre className="max-h-80 overflow-auto text-xs">
                    {JSON.stringify(reviewQuery.data, null, 2)}
                  </pre>
                ) : (
                  <Empty description="Review payload not loaded" />
                ),
              },
              {
                key: "technical",
                label: "Technical",
                children: (
                  <pre className="max-h-80 overflow-auto text-xs">
                    {JSON.stringify(
                      {
                        document_id: documentId,
                        job_id: local?.jobId,
                        processing: result?.processing,
                        document_model: result?.document_model,
                        quality: result?.quality,
                        duplicate: result?.duplicate,
                        explanations: result?.explanations,
                      },
                      null,
                      2,
                    )}
                  </pre>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
