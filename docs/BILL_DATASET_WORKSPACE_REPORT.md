# Bill OCR Dataset Management Workspace — Implementation Report

**Date:** 2026-09-12  
**Scope:** Frontend Dataset console for Bill OCR, integrated with real backend APIs only.

## 1. Dataset sidebar structure

When OCR type = `bill`:

**Bill OCR** (existing): Documents · Review queue · Profiles · Feedback · System  
**Bill Dataset** (new):

| Nav               | Route                  |
| ----------------- | ---------------------- |
| Datasets          | `/bill/datasets`       |
| Data list         | `/bill/data`           |
| Annotations       | `/bill/annotations`    |
| Review queue      | `/bill/dataset-review` |
| Processing jobs   | `/bill/jobs`           |
| Evaluation        | `/bill/evaluation`     |
| Versions & splits | `/bill/versions`       |
| Issues            | `/bill/issues`         |

Shared sticky **Dataset / Version / Chunk** context bar across all Dataset tabs (URL + localStorage).

## 2. Routes added

- Layout wrapper: `BillDatasetLayout` + `BillDatasetContextProvider`
- Eight dataset tab routes under `/bill/*` (see table above)
- Alias: `/bill/dataset` → `/bill/datasets`

## 3. Components / modules added

| Path                                            | Role                                                 |
| ----------------------------------------------- | ---------------------------------------------------- |
| `src/api/billDataset.ts`                        | Typed wrappers (`ocr_type`/`task_key=bill`)          |
| `src/features/bill/dataset/capabilities.ts`     | Capability matrix + explicit gaps                    |
| `src/features/bill/dataset/context.tsx`         | Shared dataset context                               |
| `src/features/bill/dataset/hooks.ts`            | TanStack Query hooks + job polling                   |
| `src/features/bill/dataset/annotationStatus.ts` | GT status from real sample fields                    |
| `src/components/bill/dataset/*`                 | Layout, context bar, health chips, capability alerts |
| `src/pages/bill/dataset/*`                      | Eight tab pages + tests                              |

## 4. Components modified

- `src/routes.tsx` — dataset routes
- `src/components/layout/AppSidebar.tsx` — Bill Dataset nav group + selection

## 5. Backend APIs integrated

- `GET/POST /v1/evaluation/datasets` (+ upload/archive/delete)
- `GET/PATCH …/samples`, sample images
- `GET/POST /v1/evaluations`, metrics, cancel, compare (via existing modal)
- `GET /v1/evaluations/hard-failures`
- `GET /v1/jobs?task_key=bill`, `POST …/cancel`
- `GET /v1/bill/jobs/{id}`
- `GET /v1/bill/feedback`, `POST …/export`
- `GET /v1/bill/profiles`, failure taxonomy
- `GET /v1/explorer/samples?task_key=bill`
- `GET /v1/canonical-datasets?task_key=bill`
- Document review deep-links to existing `/bill/documents/:id`

## 6–12. Capability summary (honest)

| Area            | Status                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Dataset import  | ZIP upload via shared evaluation API (**partial** — string GT / odometer ZIP layout)           |
| Annotations     | Sample string GT + bill feedback list (**partial** — no multi-field sample CRUD)               |
| Review          | Local inbox queue → real document workspace (**no server queue**)                              |
| Processing      | Sync process IDs + platform async jobs + eval runs (**no async multipage bill jobs**)          |
| Evaluation      | Shared eval runner (**partial** — det/rec string metrics)                                      |
| Versions/splits | Dataset version rows + `split_counts` + profiles + canonical (**no client-side split invent**) |
| Issues          | Taxonomy + hard-failures + local failures (**no issue workflow CRUD**)                         |
| Bulk ops        | Archive/delete dataset, cancel jobs, export feedback (supported only)                          |

## 13–15. Filters / performance

- Server pagination on samples/datasets/evals
- Debounced search
- Context chunk → sample `split` filter
- Job/eval polling only while active
- No full corpus download into browser

## 16–17. Tests / build

- `npm test` — Bill dataset workspace tests + existing suite
- `npm run build` — typecheck + production build **PASS**
- Lint: run with project oxlint

## 18. Backend capabilities unavailable (blockers)

1. `GET /v1/documents` list/search for processed bills
2. Link processed `DOC-*` ↔ evaluation dataset membership
3. Multi-field bill annotation CRUD on dataset samples
4. Bulk bill review corrections
5. Bill field-level evaluation runner
6. Async multipage bill process job API
7. Bill GT package import executor (beyond manifest validate)
8. Per-document issue resolve/ignore workflow
9. Split assign/update API for bill documents

## 19. Remaining production blockers

- Evaluation/dataset ZIP GT model remains odometer-oriented for bill `ocr_type`
- Databank predict/rerun still odometer-shaped if used
- Operators must use **Documents** inbox for full bill extraction review until document-list + membership APIs exist

## No-mock audit

Production UI paths call real APIs or show **CapabilityAlert** for gaps.  
`placeholder` hits are Ant Design input placeholders / React Query `placeholderData` only.  
Test MSW handlers remain test-only.
