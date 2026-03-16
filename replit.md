# Workspace

## Overview

This is a pnpm workspace monorepo using TypeScript, designed for a UK retirement drawdown planner. The project aims to provide a robust and flexible tool for financial planning, encompassing an API server and a client-side application. The core vision is to deliver a highly accurate and customizable simulation engine for retirement decumulation, with detailed tax and inheritance considerations, empowering users to make informed financial decisions. The project strives to lead the market in comprehensive and user-friendly retirement planning solutions.

## User Preferences

I prefer iterative development, with clear communication at each major step. Please ask before making any significant architectural changes or adding new external dependencies. I also prefer detailed explanations of complex logic, especially concerning financial calculations.

## System Architecture

The project is structured as a pnpm workspace monorepo.

**Core Technologies:**
- **Monorepo Tool**: pnpm workspaces
- **Node.js**: 24
- **TypeScript**: 5.9
- **API Framework**: Express 5
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod (v4) with `drizzle-zod`
- **API Codegen**: Orval (from OpenAPI spec)
- **Build Tool**: esbuild (CJS bundle)

**Monorepo Structure:**
- `artifacts/`: Contains deployable applications.
    - `api-server/`: Express API server responsible for data persistence and business logic.
    - `decumulation-planner/`: UK retirement drawdown planner, a React + Vite frontend application.
- `lib/`: Houses shared libraries and generated code.
    - `api-spec/`: Defines the OpenAPI specification and Orval codegen configuration.
    - `api-client-react/`: Generated React Query hooks for API interaction.
    - `api-zod/`: Generated Zod schemas from the OpenAPI spec for validation.
    - `db/`: Drizzle ORM schema and database connection management.
- `scripts/`: Contains utility scripts for various development tasks.

**TypeScript and Composite Projects:**
The monorepo leverages TypeScript's composite project features. Each package extends a base `tsconfig.base.json` with `composite: true`. The root `tsconfig.json` references all packages, enabling full dependency graph type checking from the root. Only declaration files (`.d.ts`) are emitted during type checking, with actual JavaScript bundling handled by esbuild/Vite.

**UI/UX Decisions for `decumulation-planner`:**
- **Styling**: Plain CSS with CSS custom properties for theming (including a dark theme). No Tailwind CSS is used. Fonts are Inter and JetBrains Mono.
- **Key CSS Variables**: `--unlock-bg: #0E1114`, `--unlock-surface: #11161C`, `--unlock-accent: #00BB77`, `--unlock-muted: #9FB3C8`.
- **Simulation Engine**:
    - Pure functional `runSimulation` with per-asset-class tracking, tax deductions, and shadow year projection.
    - Income yield (`income_generated`) is extracted from asset values each year after growth — growth rate is total return, income is the portion paid out. Capped at asset value.
    - Comprehensive tax logic including income tax, CGT, PCLS/TFLS, and IHT with BPR/NRB.
    - Trust logic for CLTs, PETs, and NEFI checks.
    - Warning evaluation system at register and year levels.
- **Frontend Features:**
    - **Data Input**: `InputPanel` for core simulation parameters (income target, plan years, age, strategy, scenario toggles, gifting, inflation).
    - **Summary & Comparison**: `FundedYearsIndicator`, `StrategyComparison` (compares four preset strategies plus user's blend), `PortfolioChart`, `IHTChart`.
    - **Detailed Views**: `WarningsPanel`, `YearDetailTable` (expandable rows with per-asset draws), `ActionPlan` (timeline of modelled sequence with disclaimers and key year modes).
    - **Asset Management**: `AssetEditor` modal for overriding asset values with unsaved changes guard and reset functionality.
    - **Strategy Mechanisms**: Boolean toggles for IHT and tax/income optimization, influencing asset drawdown scoring.
    - **Drawdown Priorities**: Weighted multi-objective system (tax efficiency, IHT reduction, preserve growth, liquidity) with sliders and preset buttons.
    - **Legacy Target**: Soft preference input; engine raises warnings for shortfalls but does not hard-block draws.
    - **Cash Buffer**: Input for `cash_reserve`; draw logic respects an aggregate cash floor.
    - **IHT Savings Calculation**: Compares planned IHT to a no-plan baseline.
    - **Optimiser Panel**: Collapsible panel with `Max Income`, `Max Estate`, and `Balanced` modes to find optimal income/buffer combinations.
    - **Glory Years**: Two-phase spending profile with configurable duration and multiplier.
- **Critical Rules & Logic:**
    - VCT specific rules: CGT exemption, early disposal clawback, never BPR-qualifying.
    - Pension IHT scoring changes based on year and toggle.
    - Property mortgage balance deducted for IHT calculations.
    - BPR warnings specific to EIS + AIM.
    - CLT rolling 7-year window.
    - Taxes deducted from portfolio, respecting cash reserve.
    - Age input restricted to 55-90.

## External Dependencies

- **PostgreSQL**: The primary database for data persistence, integrated via Drizzle ORM.
- **Orval**: Used for generating API client code and Zod schemas from the OpenAPI specification.
- **React Query**: Integrated into the frontend for data fetching and state management.
- **Recharts**: Utilized for charting within the `decumulation-planner` application.