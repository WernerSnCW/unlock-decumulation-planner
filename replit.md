# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── decumulation-planner/ # UK retirement drawdown planner (React + Vite)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `artifacts/decumulation-planner` (`@workspace/decumulation-planner`)

UK retirement drawdown planner. React + Vite frontend-only app (no backend, no API calls). All computation runs in-browser from JSON data files.

- **Styling**: Plain CSS with CSS custom properties (dark theme). No Tailwind. Fonts: Inter + JetBrains Mono.
- **Key CSS vars**: `--unlock-bg: #0E1114`, `--unlock-surface: #11161C`, `--unlock-accent: #00BB77`, `--unlock-muted: #9FB3C8`
- **Engine** (`src/engine/`):
  - `decumulation.ts` — pure `runSimulation(inputs, register, taxParams)` with per-asset-class value tracking, tax deduction from portfolio, and shadow year projection
  - `taxLogic.ts` — income tax with PA taper, CGT with basic/higher band split, PCLS/TFLS (uses `min(0.25 * gross, remainingLSA)`), IHT with BPR/NRB and year-gated scenario toggles
  - `trustLogic.ts` — CLT rolling 7-year window, PET taper, NEFI check
  - `warningEvaluator.ts` — register-level and year-level warnings (error/warning/info)
- **Data** (`src/data/`):
  - `mockRegister.json` — 8 assets (cash, ISA, pension, property, 2× VCT, EIS, AIM). VCT lots always have `is_iht_exempt: false` and `bpr_qualifying_date: null` (VCTs never qualify for BPR — IHTA 1984 s.105(3))
  - `taxParameters.json` — 2025/26 + 2026/27 UK tax rates (2026/27 has updated dividend rates: 10.75%/35.75%/39.35%); held flat from 2026/27 onwards
- **Components** (`src/components/`):
  - `InputPanel` — sidebar with income target, plan years, lifestyle, age, strategy, scenario toggles, gifting, inflation
  - `FundedYearsIndicator` — summary cards (funded years, total tax, estate, IHT)
  - `StrategyComparison` — runs all 4 strategies and displays comparison grid
  - `PortfolioChart` — stacked area chart by asset class (Recharts)
  - `IHTChart` — line chart with 2026/2027 reference lines
  - `WarningsPanel` — severity-badged warnings
  - `YearDetailTable` — expandable rows with per-asset draws and flags
  - `ActionPlan` — timeline-style "Modelled Sequence Under Selected Assumptions" (not "recommended"); translates simulation draws into year-by-year steps with per-year disclaimer footnote ("Illustrative — not financial advice"); "Key years" mode shows only significant years (first/last, milestones, draw-source changes, gift years, shortfalls, depletions) with skip indicators; "All years" mode shows every year; summary totals at bottom
  - `OptimiserPanel` — collapsible panel with 3 modes: Max Income (binary search for highest sustainable income), Max Estate (grid search over income+buffer to maximise net estate after IHT), Balanced (weighted score of income + estate). Respects legacy target and glory years. Shows results with "Apply to Plan" button that updates inputs. Handles infeasibility with warning message.
  - `DisclosurePanel` — collapsible assumptions and disclosure text
- **Drawdown Priorities**: Weighted multi-objective system with 4 continuous dimensions (tax_efficiency, iht_reduction, preserve_growth, liquidity). Sliders auto-normalise to sum to 1.0. Preset buttons: Tax, IHT, Income, Growth. Custom blends supported.
  - `PriorityWeights` interface replaces old `DrawdownStrategy` enum
  - `scoreAssetForDrawdown()` computes weighted composite score per asset per year
  - `STRATEGY_PRESETS` map: tax_optimised, iht_optimised, income_first, growth_first
  - StrategyComparison shows 5 columns: 4 pure presets + "Your Blend" (user's current weights)
- **Legacy target**: `legacy_target` input — soft preference only; living costs always funded first; engine raises `LEGACY_FLOOR_AT_RISK` warning when projected net estate falls below target but never hard-blocks draws; summary shows net_estate_after_iht, legacy_shortfall, and met/unmet status in the Estate card
- **Cash buffer**: `cash_reserve` input in SimulationInputs; draw logic and tax-payment logic both respect an aggregate cash floor across all cash assets — never draw total cash below the reserve threshold
- **IHT savings vs no-plan**: `calculateNoPlanIHT()` grows all assets at their rates for plan_years with no draws/gifts, then calculates IHT at plan end; the saving is `max(0, noPlanIHT - actualIHTAtPlanEnd)`, both compared at the same plan-end horizon
- **Asset depletion**: ActionPlan detects when any `valuesByAssetClass` transitions from >0 to 0 between consecutive years; shown with ⊘ icon in orange; triggers key-year inclusion
- **Scenario toggles**: Apply 2026 BPR Cap (£2.5M, 50% above), Apply 2027 Pension IHT (undrawn pension in estate)
- **Shadow horizon**: `max(plan_years, 35, 90 - current_age)` — always projects to at least age 90 or 35 years
- **BPR marginal scoring**: IHT-reduction score is proportional to marginal relief remaining vs £2.5M cap (within-cap=0.1, above-cap=0.4, pre-qualifying=0.65); VCT always scored as in-estate (0.8)
- **EIS deferred gains**: Revived deferred gains are CGT events, NOT income tax — stacked on top of taxable income only for CGT rate determination (18%/24%)
- **Glory Years**: Two-phase spending profile — `GloryYearsConfig { enabled, duration, multiplier }` in `SimulationInputs`. When enabled, spend target for first `duration` years is multiplied by `multiplier` (e.g. 1.5× for 5 years), then reverts to 1.0×. Sidebar has toggle + dual sliders (duration 1-15yr, multiplier 110%-300%) with live preview showing Glory phase vs Calm phase income amounts.
- **Optimiser**: `runOptimiser(inputs, register, taxParams, mode)` finds optimal income/buffer. Three modes:
  - `max_income`: binary search for highest sustainable annual income (respects legacy target + full funding)
  - `max_estate`: grid search over income × buffer candidates to maximise net estate after IHT
  - `balanced`: per-buffer binary income search, scored as 0.6×income + 0.4×estate
  All modes use unified `isFeasible()` check (fully funded + legacy met). Safe bounds: `incomeFloor=5000`, `incomeCeiling=max(6000, min(portfolio/years×2, 500000))`. Returns `OptimiserResult` with optimal_income, optimal_buffer, net_estate, funded_years, legacy_met, glory phase breakdown.
- **Conflict resolution**: Cash floor > Spend > Shortfall > Legacy (soft) > Gifts. Legacy never blocks living cost draws
- **Critical rules**:
  - VCT disposal: CGT always £0 (TCGA 1992 s.151A); early disposal (<5yr) may trigger income tax clawback
  - VCT is NEVER BPR-qualifying — excluded from BPR pool in scoring, IHT calc, and no-plan baseline
  - CLT rolling window: filter gift history to last 7 years only
  - Taxes are deducted from portfolio each year (drawn from most liquid assets first, respecting cash reserve)
  - Age input restricted to 55-90

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
