# OCR Frontend

React + TypeScript dashboard for the OCR Engine model registry.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4
- Ant Design
- TanStack Query + TanStack Table
- Vitest + Testing Library + MSW

## Setup

**Prefer starting both apps from the monorepo root:**

```bash
cd ..   # ocr-service/
./start.sh
```

**Frontend only:**

```bash
npm install
cp .env.example .env
npm run dev
```

App: http://localhost:5173  
API proxy: `/v1` → `http://127.0.0.1:8000` (see `vite.config.ts`)

Ensure the engine has CORS and an admin key:

```bash
# ocr-engine/.env
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
API_KEYS=dev-key-1
MODEL_ADMIN_REQUIRE_AUTH=true
```

## Scripts

| Command         | Purpose                |
| --------------- | ---------------------- |
| `npm run dev`   | Dev server             |
| `npm run build` | Production build       |
| `npm test`      | Unit / component tests |
| `npm run lint`  | Oxlint                 |

## Pages

- **Models** (`/models`) — upload artifacts, search/filter, paginated table with evaluation metrics
