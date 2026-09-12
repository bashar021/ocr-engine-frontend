# Bill OCR Frontend — Production Verification Report

## Summary

Bill / Receipt OCR is now a dedicated document-intelligence workspace in the
existing React admin shell. Odometer Live OCR is unchanged. Production UI uses
real Bill backend APIs only; MSW responses exist **only** under `src/test/`.

## Architecture

| Area | Location |
|------|----------|
| API client | `src/api/bill.ts` |
| Types | `src/types/bill.ts` |
| Local inbox (no list API) | `src/features/bill/localDocuments.ts` + IndexedDB blobs |
| Hooks | `src/features/bill/hooks.ts` |
| Viewer / panels | `src/components/bill/*` |
| Pages | `src/pages/bill/*` |
| Routes | `/bill/documents`, `/:documentId`, `/review`, `/profiles`, `/feedback`, `/system` |
| Nav | Sidebar **Bill OCR** group |

## Backend integration map

| Capability | API | UI |
|------------|-----|----|
| Process image/PDF | `POST /v1/documents/process` | Documents upload |
| Job lookup | `GET /v1/bill/jobs/{id}` | (available via client) |
| Result | `GET /v1/documents/{id}/result` | Detail refetch |
| Evidence | `…/evidence` | OCR + conflicts + VLM tab |
| Review payload | `…/review` | Review tab |
| Correction | `POST …/review` | Human correction form |
| Profiles | `/v1/bill/profiles*` | Profiles pages |
| Feedback | `/v1/bill/feedback` | Feedback page |
| Providers/models | `/v1/bill/providers`, `/models` | System page |
| Failure taxonomy | `/v1/bill/failures/taxonomy` | System page |

## Honest backend gaps (surfaced in UI, not faked)

1. **No list-documents API** → local inbox + IndexedDB original file.
2. **No page image URLs** → overlays require retained local upload; PDF canvas overlays limited.
3. **Sync-only process** → no fake progress %.
4. **Review does not mutate extraction** → UI states this explicitly.
5. **Feedback export** returns server path, not browser download.
6. **Dashboard counts** are local-inbox only (no metrics endpoint).

## Tests / quality

- Unit/route tests: `src/pages/bill/BillWorkspace.test.tsx`
- MSW bill handlers: test-only in `src/test/mocks/handlers.ts`
- Odometer `/ocr` still covered

## Remaining limitations

- Full browser E2E against live Paddle models depends on local backend + model artifacts.
- Multipage PDF page-by-page raster preview not available without backend image serving.
- Line-item table is schema-agnostic JSON list (dynamic columns can be extended when line_items include stable column metadata).
