# Welcome to SHEQ Harmony

Enterprise Safety, Health, Environment & Quality platform.

## Structure

```
SHEQ Harmony/
├── .env                 # Shared environment variables
├── docker-compose.yml   # Run frontend + backend with Docker
├── frontend/            # TanStack Start + React UI
└── backend/             # Express REST API
```

## Tech stack

- **Frontend:** React 19, TypeScript, TanStack Start/Router/Query, Tailwind CSS, shadcn/ui
- **Backend:** Node.js, Express, TypeScript
- **Docker:** Compose for local multi-service runs

## Quick start (local)

1. Copy env file (already present as `.env` / `.env.example`):

```sh
cp .env.example .env
```

2. Install dependencies:

```sh
npm run install:all
```

3. Run API + UI (two terminals):

```sh
npm run dev:backend
npm run dev:frontend
```

- Frontend: http://localhost:8080 (or the port Vite prints)
- Backend: http://localhost:4000
- Health: http://localhost:4000/api/health
- SHEQ data: http://localhost:4000/api/sheq

## Cloudinary (logos & uploads)

Add credentials to `.env` (see `.env.example`):

```sh
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
# or: CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

When configured:
- Company / template / form logos upload to Cloudinary CDN URLs
- Site pack files are stored in Cloudinary
- Filled-form logos & signatures are offloaded on save

If Cloudinary is not configured, the app falls back to local data URLs / disk storage.

## Docker

### Coolify / production

Use [docker-compose.yml](docker-compose.yml) only (Postgres + backend + nginx frontend on port 80).

1. Set env from [.env.example](.env.example) in Coolify (especially `POSTGRES_PASSWORD`, `DATABASE_URL`, `APP_URL`, `CORS_ORIGIN`).
2. Deploy as a **Docker Compose** resource.
3. Point your domain at the **frontend** service, port **80**.

### Local (ports + Vite HMR)

```sh
cp .env.example .env
./scripts/docker-up.sh
# or: docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

- Frontend: http://localhost:8082  
- Backend: http://localhost:4000  
- Postgres: localhost:5435  

Do **not** use `docker-compose.local.yml` on Coolify.
## API overview

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/sheq` | Full SHEQ payload |
| GET | `/api/sheq/sites` | Sites |
| GET | `/api/sheq/audits` | Audits |
| GET | `/api/sheq/templates` | Templates |
| GET | `/api/sheq/non-conformances` | NCs + workflow |
| GET | `/api/sheq/concerns` | Concerns + workflow |
| GET | `/api/sheq/kpis` | KPI groups |
| GET | `/api/sheq/dashboard` | Dashboard aggregates |

The frontend loads data from the backend via `/api/sheq` (Vite proxies `/api` to the backend in development).
