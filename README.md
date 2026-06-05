# LibraMS — School Library Management System

A full-featured school library management system built for NDMU IBED Library. Handles catalog management, circulation (checkout/return/holds), student engagement, kiosk self-service, teacher features, and admin operations.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + TypeScript + Hono |
| Admin Dashboard | React 18 + shadcn/ui + TanStack Table |
| Student / Kiosk Portal | React 18 + Vite + Framer Motion + Zustand |
| Database | PostgreSQL 15 + pgvector |
| Cache / Sessions | Redis 7 |
| Search | Meilisearch v1.11 |
| Job Queue | BullMQ |
| Email | SendGrid |
| SMS | Twilio |
| Push | Firebase Cloud Messaging |
| AI | Claude API |
| Storage | MinIO (S3-compatible) |
| Monitoring | Prometheus + Grafana |

---

## Quick Start

### 1. Start infrastructure

```bash
docker compose up -d
```

Starts: PostgreSQL 15, Redis 7, Meilisearch, MinIO, Prometheus, Grafana.

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — set DATABASE_URL, JWT secrets, etc.
```

### 4. Run migrations + seed

```bash
pnpm db:migrate
pnpm db:seed
```

Default seed accounts:

| Email | Password | Role |
|-------|----------|------|
| `admin@librams.dev` | `admin1234` | admin |
| `librarian@school.edu` | `admin1234` | librarian |

### 5. Start dev servers

```bash
pnpm dev:api        # API → http://localhost:3000
pnpm dev:web        # Student/kiosk portal → http://localhost:5173
pnpm dev:admin      # Admin dashboard → http://localhost:5174
```

---

## Project Structure

```
librams/
├── apps/
│   ├── api/          # Hono backend — port 3000
│   │   └── src/
│   │       ├── routes/        # Route definitions
│   │       ├── controllers/   # Request handlers
│   │       ├── services/      # Business logic
│   │       ├── middleware/    # Auth, rate limit, logging
│   │       ├── db/            # Drizzle schema + migrations
│   │       └── lib/           # Meilisearch, JWT, ISBN lookup
│   ├── web/          # Student + kiosk portal — port 5173
│   └── admin/        # Staff dashboard — port 5174
├── packages/
│   └── shared/       # Shared Zod schemas + TypeScript types
├── docker-compose.yml
└── docs/
    └── PROGRESS.md   # Full task tracker
```

---

## Features

### Admin Dashboard (`/admin`)
- Circulation desk — checkout, return, shelving queue
- Catalog management — add/edit/delete books, ISBN auto-fill, cover upload
- Students — roster, search, profile, checkout history
- Staff management — Library Staff + Faculty tabs, invite flow
- Bulk import — students and teachers via CSV
- Reports — circulation stats, overdue, popular books
- Fines — list, waive, mark paid
- Inventory — shelf audit, missing books report
- School years + class sections with teacher/student rosters
- Webhooks, audit log, school settings

### Student Portal (`/`)
- Search catalog (Meilisearch + pgvector semantic)
- Book detail + hold placement
- My checkouts + renewals
- Reading lists, book clubs, badges, challenges
- Camera barcode scanner (Quagga2)
- PWA — installable, offline-capable

### Kiosk UI (`/kiosk`)
- Attract screen with cover mosaic
- AI search bar with bilingual (EN/TL) typewriter placeholders
- Self-checkout wizard with 10s auto-return
- Guest browse + student PIN login
- Inactivity auto-logout overlay

### Teacher Features
- School year and class section management
- Assign required/optional books to sections
- Students see assigned books on their portal

---

## Key Commands

```bash
pnpm dev:api              # Start API (tsx watch)
pnpm dev:web              # Start student portal (Vite)
pnpm dev:admin            # Start admin dashboard (Vite)
pnpm test                 # Run all tests (521 passing)
pnpm typecheck            # TypeScript check across all packages
pnpm db:generate          # Generate Drizzle migration from schema changes
pnpm db:migrate           # Apply pending migrations
pnpm db:seed              # Seed dev data
pnpm db:studio            # Open Drizzle Studio (visual DB browser)
docker compose up -d      # Start all infrastructure services
docker compose down       # Stop infrastructure
```

---

## Authentication

- **Students** — student ID + PIN (auto-detected) or email + password (after self-setup)
- **Staff / Teachers** — email + password; invite link sent on account creation
- **OAuth** — Google and Microsoft SSO supported
- **LDAP / AD** — service-account bind → user-bind flow
- **JWT** — 8h access token, 30d rotating refresh token

---

## Environment Variables (apps/api/.env)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `MEILI_URL` | Meilisearch host |
| `MEILI_MASTER_KEY` | Meilisearch master key |
| `ACCESS_TOKEN_SECRET` | JWT access token secret (min 32 chars) |
| `REFRESH_TOKEN_SECRET` | JWT refresh token secret (min 32 chars) |
| `CORS_ORIGIN` | Comma-separated allowed origins |
| `SENDGRID_API_KEY` | SendGrid API key (email) |
| `GOOGLE_BOOKS_API_KEY` | Google Books API key (ISBN lookup) |
| `MINIO_ENDPOINT` | MinIO host for book cover storage |

---

## Progress

All 6 phases complete — 80 tasks. See [`docs/PROGRESS.md`](docs/PROGRESS.md) for the full task tracker.

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Catalog + Circulation + Auth + Web Portal | ✅ |
| 2 | Engagement (clubs, badges, challenges, PWA) | ✅ |
| 3 | Admin dashboard + bulk import + analytics | ✅ |
| 4 | LDAP/SSO + ML search + webhooks + multi-tenant | ✅ |
| 5 | Admin UI completion + fines + notification config | ✅ |
| 6 | Kiosk UI + teacher features + i18n + S3 + RFID | ✅ |
| Post | Student/teacher data entry + account self-service | ✅ |
