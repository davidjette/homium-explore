# Homium Explore

A full-stack platform for designing Homium shared-appreciation homeownership programs and generating investor-grade pro forma reports. Users select a target geography, configure fund parameters, and instantly model 30-year outcomes with PDF export.

**Live:** [homium-explore](https://davidjette.github.io/homium-explore/) (frontend) | [API](https://udf-fund-model.onrender.com/health) (backend)

## Architecture

```
Browser (React SPA)                   Render (Node/Express)              Neon
┌──────────────────┐    HTTPS     ┌───────────────────────┐         ┌──────────┐
│  GitHub Pages    │ ──────────── │  Express API          │ ─────── │ PostgreSQL│
│                  │   /api/*     │                       │  pg     │          │
│  /               │              │  /health              │         │ states   │
│  /explore        │              │  /api/v2/funds/*      │         │ counties │
│  /design         │              │  /api/v2/funds/report │         │ zip_codes│
│  /program        │              │  /api/v1/udf/*        │         └──────────┘
└──────────────────┘              └───────────────────────┘
  Vite + React 19                   Fund Engine + Puppeteer PDF
  Tailwind CSS 4                    @sparticuz/chromium
  Recharts                          Resend (email)
```

**Frontend** is a Vite/React SPA deployed to GitHub Pages. It calls the backend API for housing data, fund modeling, and PDF generation.

**Backend** is an Express API deployed to Render. It runs the fund simulation engine, queries housing data from Neon PostgreSQL, and generates 5-page landscape pro forma PDFs via Puppeteer.

## Directory Structure

```
homium-explore/
├── src/                        # Frontend (React SPA)
│   ├── components/
│   │   ├── landing/            # Homepage: Hero, AffordabilityTool, ProgramCards, etc.
│   │   └── shared/             # PdfExportButton, LeadCaptureModal
│   ├── design-system/          # Button, Card, Layout, Map, Select, Typography, tokens
│   ├── hooks/                  # useLeadCapture
│   ├── lib/
│   │   ├── api.ts              # Backend API client (fetch wrappers)
│   │   ├── types.ts            # Shared TypeScript types (FundConfig, WizardState, etc.)
│   │   ├── payoff.ts           # Log-normal payoff schedule generator + presets
│   │   ├── analytics.ts        # Event tracking
│   │   └── leadCapture.ts      # Lead form logic
│   └── pages/
│       ├── Landing.tsx          # Homepage with affordability tool
│       ├── Explorer.tsx         # Interactive state/county explorer
│       ├── Studio.tsx           # Fund design wizard
│       └── Program.tsx          # Program results + PDF export
├── public/                     # Static assets (favicon, wordmark)
├── server/                     # Backend (Express API)
│   ├── src/
│   │   ├── api/
│   │   │   ├── server.ts       # Express app, route registration, middleware
│   │   │   ├── fund-routes.ts  # /api/v2/funds/* — model CRUD, housing data
│   │   │   ├── fund-persistence-routes.ts  # DB CRUD, analytics queries
│   │   │   ├── report-routes.ts # PDF generation + email endpoints
│   │   │   ├── auth-routes.ts  # JWT login/verify
│   │   │   └── auth.ts         # API key + JWT middleware
│   │   ├── engine/
│   │   │   ├── fund-model.ts   # Fund config builder + model runner
│   │   │   ├── types.ts        # All TypeScript interfaces
│   │   │   ├── fund-aggregator.ts  # Scenario execution (cohort generation)
│   │   │   ├── cohort-waterfall.ts # Year-by-year equity/balance calcs
│   │   │   ├── blender.ts      # Weighted scenario blending (LO/MID/HI)
│   │   │   ├── affordability.ts # Affordability gap calculation
│   │   │   ├── topoff-calculator.ts # Top-off sensitivity analysis (HPA vs wage growth)
│   │   │   └── share-conversion.ts # Share issuance math
│   │   ├── reports/
│   │   │   ├── proforma-report.ts  # 5-page HTML template (36KB)
│   │   │   ├── report-engine.ts    # Report orchestration
│   │   │   ├── pdf-generator.ts    # Puppeteer HTML-to-PDF
│   │   │   ├── email-service.ts    # Resend email wrapper
│   │   │   └── us-map-paths.ts     # SVG path data for state map
│   │   ├── integrations/
│   │   │   └── housing-data.ts # State/county/ZIP data queries (Neon + external API fallback)
│   │   └── db/
│   │       ├── pool.ts         # PostgreSQL connection (Neon)
│   │       ├── migrate.ts      # Migration runner
│   │       └── services/
│   │           └── fund-service.ts # Fund CRUD & analytics queries
│   ├── db/
│   │   ├── migrations/
│   │   │   ├── 001_initial_schema.sql  # UDF-specific tables
│   │   │   ├── 002_generic_funds.sql   # Generic fund tables
│   │   │   └── 003_housing_data.sql    # Housing data tables
│   │   └── seed/
│   │       ├── seed.ts
│   │       └── seed-housing.ts   # Seed county/ZIP data from external API
│   ├── test/                   # Vitest test suite (9 files)
│   ├── scripts/
│   │   └── ingest-housing-data.ts  # ArcGIS XLSX → Neon ingestion
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
├── .github/workflows/
│   └── deploy.yml              # GitHub Pages CI/CD
├── render.yaml                 # Render deployment config
├── package.json                # Frontend dependencies
├── vite.config.ts              # Vite config + API proxy
└── tsconfig.json               # Frontend TypeScript config
```

## Frontend

Built with **React 19**, **React Router 7**, **Tailwind CSS 4**, and **Recharts**.

### Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Homepage with affordability tool, program cards, video embed |
| `/explore` | Explorer | Interactive map — select state/county, view housing data |
| `/design` | Studio | 4-step fund design wizard with live preview |
| `/program` | Program | Model results: 30-year projections, charts, PDF export |

### Studio Wizard Features

The `/design` page is a 4-step wizard for designing shared appreciation programs:

1. **Choose Your Market** — State, county, and ZIP code selection with real-time market data. Optional fund naming.
2. **Define Your Borrower** — Target AMI, home price, interest rate, down payment configuration.
3. **Design Your Program** — Homium SAM percentage, program fees, mutual-exclusion fund sizing (fixed home count or total raise).
4. **Model Your Fund** — Management fees, reinvestment toggle, payoff schedule (Early/Moderate/Long-term presets with peak year and concentration sliders), and optional affordability sensitivity analysis.

**Direct links** — Pre-populate the wizard via URL params:
```
/design?state=UT&county=Salt+Lake&zip=84104&name=Brix+on+Tenth
```

**Geography drill-down** — State → County → ZIP with market data updating at each level. County/ZIP data for all 50 states via external API fallback with in-memory caching.

**Payoff schedule** — Log-normal distribution with 3 presets and fine-grained sliders. Inline SVG sparkline preview.

**Affordability sensitivity** — Optional analysis showing top-off capital needed when HPA outpaces wage growth (only available when reinvesting proceeds).

### Design System

Custom component library in `src/design-system/`: Button, Card, Layout (nav + footer), Map (US choropleth), Select, Typography. Design tokens define the Homium color palette and spacing scale.

### State Management

- **TanStack Query** for server state (housing data, model results)
- **sessionStorage** for passing wizard results to the Program page (bypasses lead capture gate)
- No global state library — data flows through the wizard linearly

### API Client

`src/lib/api.ts` wraps all backend calls. Base URL defaults to the Render deployment but can be overridden via `VITE_API_URL` environment variable.

## Backend

Built with **Express 4**, **TypeScript**, **PostgreSQL (Neon)**, and **Puppeteer**.

### Fund Model Engine

The core engine in `server/src/engine/` simulates 30-year fund outcomes:

1. **Configure** — Define geography, raise amount, fees, assumptions, scenarios
2. **Generate cohorts** — Each year, calculate how many homeowners the fund can support based on available capital, home prices, and Homium shared-appreciation percentage
3. **Run waterfall** — For each cohort, project 30 years of equity growth, payoffs, and capital returns
4. **Blend scenarios** — Weight LO/MID/HI scenarios to produce blended projections
5. **Calculate affordability** — Show how Homium's shared appreciation closes the affordability gap

Key types (from `server/src/engine/types.ts`):
- `FundConfig` — Complete fund configuration (geography, raise, fees, assumptions, program, scenarios)
- `ScenarioConfig` — Per-scenario parameters (name, weight, median income/home value)
- `FundModelResult` — Full output (scenario results, blended 30-year projections, total homeowners)

### PDF Report Pipeline

Generates a **5–6 page landscape pro forma** PDF:

1. **Cover** — Program name, geography, key metrics
2. **Opportunity** — Affordability analysis, market data
3. **Detail** — 30-year fund projections table
4. **Charts** — Equity growth, homeowner count, ROI visualizations
5. **Affordability Sensitivity** *(optional)* — Top-off schedule, home value vs income divergence chart, 30-year summary (only included when user opts in)
6. **Disclaimer** — Legal language

Pipeline: `report-routes.ts` builds fund data → `proforma-report.ts` generates self-contained HTML with inline CSS → `pdf-generator.ts` renders via Puppeteer (using `@sparticuz/chromium` on Render for serverless compatibility) → returns PDF buffer.

Concurrency is limited to one PDF at a time (Puppeteer is memory-heavy on the free Render tier).

### API Routes

**Housing Data**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/funds/housing/states` | All 50 states + DC with median income/home price |
| GET | `/api/v2/funds/housing/state/:state` | Single state data |
| GET | `/api/v2/funds/housing/state/:state/counties` | Counties in a state (DB + external API fallback) |
| GET | `/api/v2/funds/housing/state/:state/zips` | ZIP codes in a state (DB + external API fallback) |
| GET | `/api/v2/funds/housing/county/:state/:county` | Single county data |
| GET | `/api/v2/funds/housing/affordability` | Affordability analysis with query params |

**Fund Model**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v2/funds/create` | Create and run a fund model |
| POST | `/api/v2/funds/run` | Run model with full FundConfig |
| POST | `/api/v2/funds/auto-populate` | Auto-generate fund from state + raise amount |
| GET | `/api/v2/funds/share-conversion` | Share issuance calculation |

**Reports**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v2/funds/report/pdf` | Generate and download pro forma PDF |
| POST | `/api/v2/funds/report/email` | Generate PDF and email to recipient |
| GET | `/api/v2/funds/report/preview` | Dev: render HTML preview in browser |

**Persistence**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v2/funds/db/save` | Save fund config to database |
| GET | `/api/v2/funds/db/list` | List saved funds |
| GET | `/api/v2/funds/db/:id` | Get saved fund by ID |
| DELETE | `/api/v2/funds/db/:id` | Delete saved fund |

**Legacy (v1)**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/udf/scenarios` | Hardcoded Utah Dream Fund scenarios |
| GET | `/api/v1/udf/blended` | Blended UDF results |
| POST | `/api/v1/udf/simulate` | Custom UDF simulation |

## Database

**Neon PostgreSQL** (serverless) with 3 migration files:

| Table | Records | Description |
|-------|---------|-------------|
| `housing_states` | 51 | State abbreviation, name, median income, median home price, median rent |
| `housing_counties` | ~30 (UT seeded) | County-level income, home price, rent by state |
| `housing_zips` | ~240 (UT seeded) | ZIP-level housing data with city, county, state |
| `fund_configs` | Variable | Saved fund configurations |
| `fund_scenarios` | Variable | Saved scenario definitions |
| `fund_results` | Variable | Saved model run results |

Migrations run automatically on deploy (`node dist/db/migrate.js` before server start).

**Data sources:**
- **Neon DB** — Utah county/ZIP data seeded via `server/db/seed/seed-housing.ts`
- **External API fallback** — For states not seeded locally, the backend fetches ZIP-level data from an external housing API (`unabashed-empathy.onrender.com`), aggregates by county, and caches in memory. First request per state takes a few seconds; subsequent requests are instant.
- **State-level data** — All 50 states available via external API fallback in `housing-data.ts`

To seed additional states:
```bash
cd server
npx tsx db/seed/seed-housing.ts CO    # Seed Colorado
npx tsx db/seed/seed-housing.ts       # Seed all states with known zip prefixes
```

## Getting Started

### Prerequisites

- Node.js >= 18
- A Neon PostgreSQL database (or any PostgreSQL instance)

### Frontend

```bash
npm install
npm run dev          # Starts Vite dev server on http://localhost:5173
```

The Vite dev server proxies `/api/*` requests to the backend (defaults to the Render deployment).

To point at a local backend instead:
```bash
# In vite.config.ts, the proxy target is already configured.
# Just start the local backend (see below) and requests will route there.
```

### Backend

```bash
cd server
npm install
cp .env.example .env  # Add your NEON_UDF_DATABASE_URL

npm run migrate      # Run database migrations
npm run dev          # Starts Express on http://localhost:3001
```

### Both Together (Local Development)

Terminal 1:
```bash
cd server && npm run dev    # API on :3001
```

Terminal 2:
```bash
npm run dev                 # Frontend on :5173, proxies /api to Render
                            # Update vite.config.ts proxy target to localhost:3001 for local
```

## Deployment

### Frontend — GitHub Pages

Automatic on push to `main`. The GitHub Actions workflow (`.github/workflows/deploy.yml`) builds the Vite app and deploys to GitHub Pages.

Base path is `/homium-explore/` (configured in `vite.config.ts`).

### Backend — Render

Automatic on push to `main`. Render watches this repo and deploys from the `server/` directory (configured in `render.yaml`).

Build: `npm install --include=dev && npm run build` (TypeScript compilation)
Start: `node dist/db/migrate.js; node dist/api/server.js` (migrations then server)

The service is named `udf-fund-model` and runs on the premium tier.

## Environment Variables

### Frontend

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `VITE_API_URL` | No | `https://udf-fund-model.onrender.com/api` | Backend API base URL |

### Backend (`server/.env`)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `NEON_UDF_DATABASE_URL` | Yes | — | Neon PostgreSQL connection string |
| `DATABASE_URL` | Alt | — | Alternative to NEON_UDF_DATABASE_URL |
| `NODE_ENV` | Yes (prod) | — | Controls Chromium path for PDF generation |
| `RESEND_API_KEY` | No | — | Resend API key for emailing pro forma reports |
| `PORT` | No | `3001` | Server port |
| `FUND_API_KEY` | No | — | API key for write-endpoint protection |
| `FUND_AUTH_PASSWORD` | No | — | Password for JWT authentication |

## Testing

```bash
cd server
npm test              # Run all tests (Vitest)
npm run test:watch    # Watch mode
```

9 test suites covering: API routes, authentication, engine calculations, capital recycling, fund deployment validation, fund persistence, and v2 API endpoints.
