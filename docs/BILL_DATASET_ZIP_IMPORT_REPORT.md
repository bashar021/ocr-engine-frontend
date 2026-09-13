# Bill OCR Dataset ZIP Import — Implementation Report

**Date:** 2026-09-12

## 1. Files / components changed

### Backend (new)

- `ocr-engine/src/ocr_engine/document_intel/bill_dataset_package.py`
- `ocr-engine/src/ocr_engine/application/bill_dataset_import.py`
- `ocr-engine/tests/test_bill_dataset_package.py`

### Backend (modified)

- `ocr-engine/src/ocr_engine/application/evaluation_datasets.py` — bill upload branch; `annotation_status` filter; bill counts in dataset/sample dicts
- `ocr-engine/src/ocr_engine/api/routes/evaluation_datasets.py` — `annotation_status` query param
- `ocr-engine/src/ocr_engine/api/routes/bill.py` — import validate/import/summary/issues
- `ocr-engine/src/ocr_engine/config.py` — `bill_dataset_chunk_size`

### Frontend (new)

- `ocr-frontend/src/components/bill/dataset/BillZipUploadModal.tsx`

### Frontend (modified)

- `ocr-frontend/src/api/billDataset.ts` — validate/import/summary/issues APIs
- `ocr-frontend/src/pages/bill/dataset/BillDatasetsPage.tsx` — Bill ZIP upload workflow
- `ocr-frontend/src/pages/bill/dataset/BillDataListPage.tsx` — annotation_status filter
- `ocr-frontend/src/pages/bill/dataset/BillIssuesPage.tsx` — import issues table
- `ocr-frontend/src/features/bill/dataset/annotationStatus.ts` — prefer metadata.annotation_status
- `ocr-frontend/src/features/bill/dataset/capabilities.ts` — updated capability matrix
- `ocr-frontend/src/types/evaluation.ts` — `annotation_status` on ListSamplesParams
- `ocr-frontend/src/test/mocks/handlers.ts` — test-only MSW for import APIs

## 2. Backend endpoints added/modified

| Method | Path                                   | Purpose                                            |
| ------ | -------------------------------------- | -------------------------------------------------- |
| POST   | `/v1/bill/datasets/import/validate`    | Validate ZIP, return counts + issues               |
| POST   | `/v1/bill/datasets/import`             | Create dataset + import package                    |
| GET    | `/v1/bill/datasets/{id}/summary`       | KPI counts from metadata                           |
| GET    | `/v1/bill/datasets/{id}/issues`        | Persisted import issues                            |
| POST   | `/v1/evaluation/datasets/{id}/upload`  | **Branches** to bill importer when `ocr_type=bill` |
| GET    | `/v1/evaluation/datasets/{id}/samples` | New `annotation_status` filter                     |

## 3. Database / migrations

No new tables. Reuses `evaluation_datasets` + `evaluation_dataset_samples` with rich `metadata` JSON (`package_type: bill_ocr_v1`).

## 4. Storage

Extracts under `{EVALUATION_DATASET_ROOT}/bill/{name}/{version}/package/` with secured members only.

## 5. Background jobs

Import remains **synchronous** in the request (same as odometer ZIP). Large archives may need a future async worker — documented as remaining gap.

## 6. Frontend routes

Existing Bill Dataset workspace routes; upload entry on `/bill/datasets`.

## 7. Import state machine (persisted in dataset metadata)

`VALIDATING` → `IMPORTING` → `COMPLETED` | `COMPLETED_WITH_ISSUES` | `FAILED`  
Progress metrics: documents found/imported, annotation status counts, issue list (not invented %).

## 8. Manifest / annotation schema

- `manifest.jsonl` records: `document_id`, `file`, `annotation`, `annotation_status`, plus preserved extras
- Annotation JSON: arbitrary nested `data` / `source` — **no hard-coded invoice fields**
- Statuses: `LABELED` | `PARTIAL` | `UNLABELED` | `INVALID`
- Missing annotation file ⇒ `UNLABELED` (not `FIELD_ABSENT`)

## 9. Validation rules

Unsafe paths, zip bombs, missing/orphan annotations, duplicate IDs, unsupported/corrupt media, hash mismatch, annotation document_id mismatch.

## 10. Version / chunk

- Dataset `name` + `version` via evaluation dataset identity
- Logical chunks `chunk-001` … via `bill_dataset_chunk_size` (default 500), stored on sample metadata

## 11–14. Processing / review / evaluation / issues

- Imported samples appear in Data List / Annotations with real `annotation_status`
- Issues tab loads `GET …/issues`
- Evaluation still uses shared det/rec runner (partial for multi-field bill)
- Document process still via existing Bill OCR for individual docs

## 15. Tests executed

```text
ocr-engine: pytest tests/test_bill_dataset_package.py tests/test_evaluation_datasets.py  → 21 passed
ocr-frontend: npm test / build (run in verification step)
```

## 16. Odometer regression

`test_evaluation_datasets.py` still passes — odometer `extract_zip_to_dataset` path unchanged when `ocr_type != bill`.

## 17. Genuine blockers remaining

1. Async import worker for very large ZIPs (HTTP currently sync)
2. Bill field-level evaluation runner
3. Batch process imported samples through multipage bill pipeline as a job
4. Issue resolve/ignore CRUD
5. `GET /v1/documents` list for processed DOC-\* results
