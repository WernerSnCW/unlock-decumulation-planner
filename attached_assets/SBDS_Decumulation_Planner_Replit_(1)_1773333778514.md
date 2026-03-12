# Spec-Driven Design Build — Unlock Decumulation Planner
### Replit Build-Ready Version

**This document is self-contained. Everything needed to build this tool is here.**  
Do not ask for clarification. All open questions have been resolved below.  
For tax logic and algorithm detail, refer to `Unlock_Decumulation_Engine_Spec_v1.2.json` (included in repo).

---

# 1. Feature Overview

## Feature Name
Unlock Decumulation Planner

## Summary
A planning tool for UK high-net-worth investors that answers: **given my assets, how long will my money last — and in what order should I draw from them?**

The user sets three inputs (annual income target, plan duration, lifestyle level). The tool reads a mock asset register, runs a year-by-year simulation, and outputs a complete plan: funded years, tax drag by year, IHT trajectory, gifting impact, and warnings. Four drawdown strategies are compared side by side.

Assets are never manually entered. They come from the register. The tool is read-and-compute only.

---

# 2. Problem Statement

UK HNW investors with multi-asset portfolios — ISAs, pensions, VCTs, EIS, rental property, cash — have no tool that tells them in what order to draw from those assets. Getting it wrong is expensive:

- Drawing pension too early wastes IHT exemption (pre-April 2027 rule change)
- Drawing pension too late after April 2027 leaves undrawn pension inside the estate
- Drawing ISA before cash permanently loses tax-free compounding
- Selling property in a high-income year pushes CGT from 18% to 24%
- Traditional IFAs cannot advise on VCTs or EIS — the tool fills that gap

Unlock must produce the equivalent of a Towry Lifetime Financial Plan — dynamically, in real time, covering all asset classes including those IFAs cannot touch.

---

# 3. Users

## Primary Users
UK HNW investors aged 55–75 with portfolios of £500k–£5M+. Self-directed or adviser-informed. Financially literate but not tax specialists. Expect precision, not jargon.

## Secondary Users
Unlock team demonstrating the tool to prospective investors. Must work reliably in a 5-minute demo.

---

# 4. Desired Outcome

- User enters three numbers and immediately sees a funded timeline, IHT trajectory, and draw-down breakdown
- Switching strategy updates outputs instantly — no reload
- The 2026 and 2027 scenario toggles make proposed rule change consequences tangible
- Output is clearly labelled as a planning estimate, not tax advice
- A first-time user understands the output without training
- The tool demonstrates reliably from a cold start

---

# 5. Scope

## In Scope

- Three-input form: annual income target, plan years, lifestyle level
- current_age input (required — anchors shadow projection)
- Optional inputs: inflation rate, state pension, annual gift amount + type
- Asset register loaded from `src/data/mockRegister.json` — no manual entry
- Year-by-year simulation engine per `Unlock_Decumulation_Engine_Spec_v1.2.json`
- Four drawdown strategies with instant switching
- Strategy comparison panel (four metrics, four strategies)
- Funded years indicator
- Shadow projection to age 90 (greyed extension of main chart)
- Portfolio value chart — stacked area, by asset class, by year
- IHT trajectory chart — single line with rule-change year markers
- Tax drag summary card
- Gifting module — gift amount, type, CLT rolling total, PET taper display
- Scenario toggles: apply_2026_bpr_cap, apply_2027_pension_iht (both default ON)
- Scenario disclaimer banner when either toggle is active
- Warnings panel — all triggered flags, severity-coded
- Per-year detail table — scrollable, expandable rows
- Disclosure panel — collapsible, contains all model assumptions
- TFLS remaining balance display on pension section

## Out of Scope

- Live asset register integration
- User authentication or accounts
- Saving or persisting plans
- PDF / CSV export
- Spouse or joint planning
- Monte Carlo simulation
- RNRB calculation
- Care cost modelling
- DB pension capital value
- Mobile layout
- Full HMRC share matching (average-cost proxy used instead)
- Discretionary trust ten-year / exit charges
- Beneficiary income tax on inherited pension

---

# 6. Functional Requirements

**FR-01** The system must accept three primary inputs: `annual_income_target` (£ number), `plan_years` (integer), `lifestyle_multiplier` (enum). These are the only required inputs to produce output.

**FR-02** `current_age` is required before simulation runs. Default: 65. Shadow horizon = max(plan_years, 90 − current_age).

**FR-03** The system must load asset data exclusively from `src/data/mockRegister.json`. No manual asset entry. If the register fails to parse, show the empty state.

**FR-04** The system must run the full 9-step annual simulation algorithm per the v1.2 spec using the selected drawdown strategy.

**FR-05** Simulation recalculates automatically on any input change. Debounce: 400ms. No "Run" button needed.

**FR-06** The funded years indicator must show: years funded, pass/fail against plan horizon, and whether the shadow projection to age 90 is also funded. Green = fully funded. Amber = funded within plan but not to 90. Red = shortfall within plan years.

**FR-07** Portfolio chart: stacked area chart. One colour per asset class (see Section 8). X-axis = plan year. Y-axis = £ value. Shadow projection years (beyond plan_years) shown in same chart, greyed out past the plan_years boundary. Vertical marker at first_shortfall_year if plan depletes.

**FR-08** IHT chart: single line. X-axis = plan year. Y-axis = £ IHT bill. Vertical dashed markers at April 2026 (BPR cap) and April 2027 (pension IHT) when respective toggles are ON. Both charts share the same x-axis scale.

**FR-09** Strategy comparison panel: four columns (one per strategy), four rows (funded years, total tax paid, IHT at plan end, first shortfall year). Selected strategy highlighted.

**FR-10** Switching drawdown strategy updates all charts, figures and the comparison panel immediately without clearing inputs.

**FR-11** Scenario toggles update all outputs immediately when flipped. When either toggle is ON, an amber banner appears: *"Scenario assumptions active — these are proposed rules, not current law."*

**FR-12** Warnings panel lists all triggered warning_triggers from the spec. Severity levels: error (red), warning (amber), info (blue-grey). Errors also appear above the chart area. Panel is always visible when warnings exist.

**FR-13** Gifting module: annual_gift_amount input, gift_type selector (Discretionary Trust / PET / NEFI). Displays CLT 7-year running total. Displays PET taper relief schedule when gift_type = PET. Displays NEFI warning when income surplus test is not met.

**FR-14** Per-year detail table: scrollable. Columns: Year, Portfolio Value, IHT Bill, Spend Target, Income Tax, CGT, Draws (by asset class), Flags. Rows with any flag are highlighted (amber for warning, red for error). Expandable row to show draws_by_asset detail.

**FR-15** Disclosure panel: collapsible. Collapsed by default. One-click to expand. Contains all items from `global_assumptions` in spec. Permanently visible on output page (not in a settings route).

**FR-16** TFLS remaining balance displayed adjacent to pension in draws_by_asset detail. Updates each year as LSA is consumed.

**FR-17** Input validation: inline errors on out-of-range values. Non-blocking. annual_income_target: £20k–£500k. plan_years: 5–50. current_age: 40–90. state_pension_annual: £0–£50k. annual_gift_amount: £0–£500k.

**FR-18** On load, the system must scan the register for MISSING_ACQUISITION_DATE and MISSING_ACQUISITION_COST lots and surface these as errors in the warnings panel before simulation runs.

---

# 7. Behaviour Rules

- Inputs panel is always visible (left sidebar, not a modal or step)
- Simulation output updates as user types (400ms debounce) — instant feedback
- Strategy selector is a tab or toggle row, not buried in a dropdown
- Switching strategy never resets inputs
- Scenario toggles never reset inputs
- Errors (severity = error) appear BOTH in the warnings panel and in a fixed banner above the chart area
- Warnings panel does not auto-collapse — stays open while warnings exist
- CLT rolling total warning fires at £260k (amber, APPROACHING) and £325k (red, BREACHED)
- NEFI reclassification: the system warns only — it does not change the gift_type automatically
- Property disposal: treated as a user-specified year event. In v1, no disposal year selector needed — model property as sold in the year it appears in the priority queue. The algorithm flags if there is a better year.
- All financial figures displayed with £ sign and comma-separated thousands. No pence for values over £10k.
- Charts must render with zero data gracefully (empty state, not a broken chart)
- Loading overlay applies only to the chart area — inputs remain interactive during recalculation
- Disclosure panel content is static text — no interactivity required

---

# 8. UX / Design Requirements

## Colour Palette

Use the exact Unlock CSS custom properties. Define these as CSS variables in `src/App.css`:

```css
:root {
  /* Core */
  --unlock-bg:       #0E1114;
  --unlock-surface:  #11161C;
  --unlock-text:     #EAF2F7;
  --unlock-muted:    #9FB3C8;
  --unlock-accent:   #00BB77;
  --unlock-border:   rgba(234, 242, 247, 0.10);

  /* Status tones */
  --tone-success:    #00BB77;   /* mint/green — success, funded, primary */
  --tone-warning:    #F59E0B;   /* amber — warnings, CLT approaching */
  --tone-error:      #EF4444;   /* red — errors, shortfall */
  --tone-info:       #818CF8;   /* violet — info flags */

  /* Border radii */
  --radius-sm:  4px;
  --radius-md:  10px;
  --radius-lg:  14px;

  /* Chart colours — one per asset class */
  --chart-cash:     #6B7280;
  --chart-isa:      #00BB77;
  --chart-pension:  #3B82F6;
  --chart-property: #F59E0B;
  --chart-vct:      #A855F7;
  --chart-eis:      #22D3EE;
  --chart-aim:      #F97316;
  --chart-shadow:   rgba(255,255,255,0.04);  /* greyed region beyond plan years */
  --chart-iht:      #EF4444;
}
```

Accent green `#00BB77` is the Unlock brand colour. Use it for all primary CTAs, active states, funded indicators, and the ISA chart series. Do not substitute teal or emerald variants.

## Typography

Fonts: Inter (primary) + JetBrains Mono (tabular data). Load from Google Fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

- **UI text, headings, labels:** Inter
- **All financial figures, table values, year numbers:** JetBrains Mono — prevents column shift in tables
- **Large hero stats (funded years total, IHT total):** Inter 700, large (32–40px)
- **Body / captions:** Inter 400, `--unlock-muted`

## Component Style

```css
/* Cards / panels */
.card {
  background: var(--unlock-surface);
  border: 1px solid var(--unlock-border);
  border-radius: var(--radius-lg);       /* 14px */
  box-shadow: 0 28px 120px rgba(0,0,0,0.55);
}

/* Glassmorphism — for floating panels, scenario banner */
.glass {
  background: rgba(17, 22, 28, 0.80);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--unlock-border);
  border-radius: var(--radius-lg);
}

/* Subtle radial accent glow — behind key panels */
.accent-glow {
  background: radial-gradient(
    ellipse at 50% 0%,
    rgba(0, 187, 119, 0.10) 0%,
    transparent 70%
  );
}

/* Primary button */
.btn-primary {
  background: var(--unlock-accent);
  color: var(--unlock-bg);
  border-radius: var(--radius-md);
  font-family: Inter, sans-serif;
  font-weight: 600;
  border: none;
}

/* Secondary button */
.btn-secondary {
  background: transparent;
  border: 1px solid var(--unlock-accent);
  color: var(--unlock-accent);
  border-radius: var(--radius-md);
}

/* Input fields */
input, select {
  background: var(--unlock-bg);
  border: 1px solid var(--unlock-border);
  color: var(--unlock-text);
  border-radius: var(--radius-sm);
  font-family: Inter, sans-serif;
}
input:focus, select:focus {
  border-color: var(--unlock-accent);
  outline: none;
}

/* Toggle (scenario toggles) */
.toggle-active   { background: var(--unlock-accent); }
.toggle-inactive { background: rgba(234,242,247,0.15); }

/* Tables */
.table-header { background: var(--unlock-surface); }
.table-row-even { background: var(--unlock-surface); }
.table-row-odd  { background: var(--unlock-bg); }

/* Severity badges */
.badge-error   { background: rgba(239,68,68,0.12);  color: #EF4444; border: 1px solid rgba(239,68,68,0.3); }
.badge-warning { background: rgba(245,158,11,0.12); color: #F59E0B; border: 1px solid rgba(245,158,11,0.3); }
.badge-info    { background: rgba(129,140,248,0.12);color: #818CF8; border: 1px solid rgba(129,140,248,0.3); }
```

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER — Unlock logo + "Decumulation Planner" title          │
├──────────────┬──────────────────────────────────────────────┤
│              │  Scenario banner (amber, when active)         │
│  INPUT       │  ┌──────────────────────────────────────────┐│
│  PANEL       │  │ Funded Years + Tax Drag Summary cards     ││
│  (300px)     │  └──────────────────────────────────────────┘│
│              │  ┌──────────────────────────────────────────┐│
│  Inputs:     │  │ Strategy Comparison panel                 ││
│  - Income    │  └──────────────────────────────────────────┘│
│  - Years     │  ┌──────────────────────────────────────────┐│
│  - Lifestyle │  │ Portfolio Chart (stacked area)            ││
│  - Age       │  └──────────────────────────────────────────┘│
│  - Inflation │  ┌──────────────────────────────────────────┐│
│  ─────────── │  │ IHT Trajectory Chart                      ││
│  Strategy    │  └──────────────────────────────────────────┘│
│  tabs        │  ┌────────────────┐ ┌────────────────────────┤
│  ─────────── │  │ Warnings Panel │ │ Per-Year Detail Table   │
│  Toggles     │  └────────────────┘ └────────────────────────┤
│  ─────────── │  ┌──────────────────────────────────────────┐│
│  Gifting     │  │ Disclosure Panel (collapsed)              ││
│  ─────────── │  └──────────────────────────────────────────┘│
│  Optional    │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

Minimum viewport: 1280px. No mobile layout required.

---

# 9. UX States

**Default** — Inputs at defaults (£80k, 25 years, Comfortable, age 65). Mock register loaded. Simulation runs immediately. All output populated.

**Loading** — Skeleton overlay on chart area only (not sidebar). Input panel remains fully interactive. Duration matches debounce + compute time.

**Empty** — Register returns no assets. Show: *"No assets found in your register. Add assets to the register to begin planning."* No simulation output rendered.

**Fully funded** — funded_years ≥ plan_years AND shadow projection funded to 90. Funded indicator: teal badge "Funded for [N] years ✓".

**Partially funded** — funded_years ≥ plan_years but shadow projection depletes before 90. Funded indicator: amber badge "Funded for [N] years — review age 90 projection".

**Shortfall** — funded_years < plan_years. Funded indicator: red badge "Shortfall in year [N]". Red banner above charts: *"Your plan runs out of funds in year [N] at age [current_age + N]. Consider reducing lifestyle level or reviewing growth assumptions."* Portfolio chart shows vertical red marker at shortfall year.

**Error** — Simulation throws. Show: *"An error occurred running your plan. Check your inputs and try again."* No partial output.

**Validation** — Inline field error adjacent to input. Non-blocking. Other outputs still shown if other inputs are valid.

**Warning active** — Warnings panel expands automatically. Error-severity warnings appear in banner above charts. Info flags shown in panel only.

**Scenario active** — Amber banner below header: *"One or more scenario assumptions are active. These model proposed rules that have not been enacted into law. [Show assumptions ↓]"*

---

# 10. Data Requirements

## User Inputs

| Field | Type | Default | Range / Options |
|---|---|---|---|
| annual_income_target | number | 80000 | 20000–500000 |
| plan_years | integer | 25 | 5–50 |
| lifestyle_multiplier | enum | comfortable | modest(×0.7) / comfortable(×1.0) / generous(×1.5) / unlimited(×2.2) |
| current_age | integer | 65 | 40–90 |
| inflation_rate | enum | 0.03 | 0.02 / 0.03 / 0.04 / 0.05 |
| drawdown_strategy | enum | tax_optimised | tax_optimised / iht_optimised / income_first / growth_first |
| annual_gift_amount | number | 0 | 0–500000 |
| gift_type | enum | pet | discretionary_trust / pet / nefi |
| state_pension_annual | number | 0 | 0–50000 |
| apply_2026_bpr_cap | boolean | true | — |
| apply_2027_pension_iht | boolean | true | — |

## Mock Asset Register

**Copy this exactly into `src/data/mockRegister.json`:**

```json
[
  {
    "asset_id": "cash-001",
    "wrapper_type": "unwrapped",
    "asset_class": "cash",
    "label": "Barclays Current & Savings",
    "current_value": 220000,
    "acquisition_date": "2020-01-01",
    "acquisition_cost": 220000,
    "tax_relief_claimed": 0,
    "assumed_growth_rate": 0.045,
    "income_generated": 9900,
    "is_iht_exempt": false,
    "bpr_qualifying_date": null,
    "bpr_last_reviewed": null,
    "cgt_exempt_date": null,
    "mortgage_balance": 0,
    "pension_type": null,
    "tfls_used_amount": 0,
    "mpaa_triggered": false,
    "in_drawdown": false,
    "flexible_isa": false,
    "deferred_gain_amount": null,
    "relief_claimed_type": "none",
    "allowable_improvement_costs": 0,
    "estimated_disposal_cost_pct": 0,
    "estimated_disposal_cost_amount": null
  },
  {
    "asset_id": "isa-001",
    "wrapper_type": "isa",
    "asset_class": "isa",
    "label": "Stocks & Shares ISA — Vanguard",
    "current_value": 510000,
    "acquisition_date": "2015-04-06",
    "acquisition_cost": 320000,
    "tax_relief_claimed": 0,
    "assumed_growth_rate": 0.06,
    "income_generated": 0,
    "is_iht_exempt": false,
    "bpr_qualifying_date": null,
    "bpr_last_reviewed": null,
    "cgt_exempt_date": null,
    "mortgage_balance": 0,
    "pension_type": null,
    "tfls_used_amount": 0,
    "mpaa_triggered": false,
    "in_drawdown": false,
    "flexible_isa": false,
    "deferred_gain_amount": null,
    "relief_claimed_type": "none",
    "allowable_improvement_costs": 0,
    "estimated_disposal_cost_pct": 0,
    "estimated_disposal_cost_amount": null
  },
  {
    "asset_id": "pension-001",
    "wrapper_type": "pension",
    "asset_class": "pension",
    "label": "SIPP — Hargreaves Lansdown",
    "current_value": 720000,
    "acquisition_date": "2005-04-06",
    "acquisition_cost": 410000,
    "tax_relief_claimed": 164000,
    "assumed_growth_rate": 0.055,
    "income_generated": 0,
    "is_iht_exempt": false,
    "bpr_qualifying_date": null,
    "bpr_last_reviewed": null,
    "cgt_exempt_date": null,
    "mortgage_balance": 0,
    "pension_type": "sipp",
    "tfls_used_amount": 45000,
    "mpaa_triggered": false,
    "in_drawdown": false,
    "flexible_isa": false,
    "deferred_gain_amount": null,
    "relief_claimed_type": "none",
    "allowable_improvement_costs": 0,
    "estimated_disposal_cost_pct": 0,
    "estimated_disposal_cost_amount": null
  },
  {
    "asset_id": "property-001",
    "wrapper_type": "unwrapped",
    "asset_class": "property_investment",
    "label": "Buy-to-let — Fulham flat",
    "current_value": 865000,
    "acquisition_date": "2008-06-15",
    "acquisition_cost": null,
    "tax_relief_claimed": 0,
    "assumed_growth_rate": 0.03,
    "income_generated": 28000,
    "is_iht_exempt": false,
    "bpr_qualifying_date": null,
    "bpr_last_reviewed": null,
    "cgt_exempt_date": null,
    "mortgage_balance": 120000,
    "pension_type": null,
    "tfls_used_amount": 0,
    "mpaa_triggered": false,
    "in_drawdown": false,
    "flexible_isa": false,
    "deferred_gain_amount": null,
    "relief_claimed_type": "none",
    "allowable_improvement_costs": 35000,
    "estimated_disposal_cost_pct": 0.025,
    "estimated_disposal_cost_amount": null
  },
  {
    "asset_id": "vct-001",
    "wrapper_type": "unwrapped",
    "asset_class": "vct",
    "label": "Octopus Titan VCT — 2019 tranche",
    "current_value": 420000,
    "acquisition_date": "2019-11-15",
    "acquisition_cost": 380000,
    "tax_relief_claimed": 114000,
    "assumed_growth_rate": 0.07,
    "income_generated": 16000,
    "is_iht_exempt": true,
    "bpr_qualifying_date": "2021-11-15",
    "bpr_last_reviewed": "2025-06-01",
    "cgt_exempt_date": "2024-11-15",
    "mortgage_balance": 0,
    "pension_type": null,
    "tfls_used_amount": 0,
    "mpaa_triggered": false,
    "in_drawdown": false,
    "flexible_isa": false,
    "deferred_gain_amount": null,
    "relief_claimed_type": "income_tax_relief",
    "allowable_improvement_costs": 0,
    "estimated_disposal_cost_pct": 0,
    "estimated_disposal_cost_amount": null
  },
  {
    "asset_id": "vct-002",
    "wrapper_type": "unwrapped",
    "asset_class": "vct",
    "label": "Octopus Titan VCT — 2024 tranche",
    "current_value": 195000,
    "acquisition_date": "2024-10-20",
    "acquisition_cost": 195000,
    "tax_relief_claimed": 58500,
    "assumed_growth_rate": 0.07,
    "income_generated": 4000,
    "is_iht_exempt": false,
    "bpr_qualifying_date": "2026-10-20",
    "bpr_last_reviewed": null,
    "cgt_exempt_date": "2029-10-20",
    "mortgage_balance": 0,
    "pension_type": null,
    "tfls_used_amount": 0,
    "mpaa_triggered": false,
    "in_drawdown": false,
    "flexible_isa": false,
    "deferred_gain_amount": null,
    "relief_claimed_type": "income_tax_relief",
    "allowable_improvement_costs": 0,
    "estimated_disposal_cost_pct": 0,
    "estimated_disposal_cost_amount": null
  },
  {
    "asset_id": "eis-001",
    "wrapper_type": "unwrapped",
    "asset_class": "eis",
    "label": "Deepmind Ventures EIS — Series B",
    "current_value": 310000,
    "acquisition_date": "2021-03-10",
    "acquisition_cost": 200000,
    "tax_relief_claimed": 60000,
    "assumed_growth_rate": 0.12,
    "income_generated": 0,
    "is_iht_exempt": true,
    "bpr_qualifying_date": "2023-03-10",
    "bpr_last_reviewed": "2025-03-10",
    "cgt_exempt_date": "2024-03-10",
    "mortgage_balance": 0,
    "pension_type": null,
    "tfls_used_amount": 0,
    "mpaa_triggered": false,
    "in_drawdown": false,
    "flexible_isa": false,
    "deferred_gain_amount": 85000,
    "relief_claimed_type": "both",
    "allowable_improvement_costs": 0,
    "estimated_disposal_cost_pct": 0,
    "estimated_disposal_cost_amount": null
  },
  {
    "asset_id": "aim-001",
    "wrapper_type": "unwrapped",
    "asset_class": "aim_shares",
    "label": "AIM Portfolio — Bestinvest managed",
    "current_value": 280000,
    "acquisition_date": "2022-08-01",
    "acquisition_cost": 230000,
    "tax_relief_claimed": 0,
    "assumed_growth_rate": 0.065,
    "income_generated": 3200,
    "is_iht_exempt": true,
    "bpr_qualifying_date": "2024-08-01",
    "bpr_last_reviewed": "2025-01-15",
    "cgt_exempt_date": null,
    "mortgage_balance": 0,
    "pension_type": null,
    "tfls_used_amount": 0,
    "mpaa_triggered": false,
    "in_drawdown": false,
    "flexible_isa": false,
    "deferred_gain_amount": null,
    "relief_claimed_type": "none",
    "allowable_improvement_costs": 0,
    "estimated_disposal_cost_pct": 0.01,
    "estimated_disposal_cost_amount": null
  }
]
```

**Register notes:**
- property-001 has `acquisition_cost: null` — this triggers `MISSING_ACQUISITION_COST` warning on load
- vct-002 has `bpr_qualifying_date: "2026-10-20"` — not yet qualifying in 2026 plan year 1, triggers `BPR_NOT_YET_QUALIFYING`
- eis-001 has `deferred_gain_amount: 85000` — crystallises on disposal, adds to taxable income
- pension-001 has `tfls_used_amount: 45000` — remaining LSA = £268,275 − £45,000 = £223,275

## Tax Parameters File

**Copy this exactly into `src/data/taxParameters.json`:**

```json
{
  "schedule": [
    {
      "tax_year": "2025/26",
      "plan_year_start": 1,
      "personal_allowance": 12570,
      "basic_rate_threshold": 50270,
      "higher_rate_threshold": 125140,
      "pa_taper_start": 100000,
      "basic_rate": 0.20,
      "higher_rate": 0.40,
      "additional_rate": 0.45,
      "dividend_basic_rate": 0.0875,
      "dividend_higher_rate": 0.3375,
      "dividend_additional_rate": 0.3935,
      "dividend_allowance": 500,
      "psa_basic": 1000,
      "psa_higher": 500,
      "psa_additional": 0,
      "cgt_exempt_amount": 3000,
      "cgt_rate_basic": 0.18,
      "cgt_rate_higher": 0.24,
      "iht_rate": 0.40,
      "iht_rate_lifetime_clt": 0.20,
      "nil_rate_band": 325000,
      "tfls_lifetime_limit": 268275,
      "annual_gift_exemption": 3000,
      "isa_annual_limit": 20000,
      "pension_annual_allowance": 60000,
      "mpaa": 10000,
      "vct_annual_limit": 200000,
      "eis_annual_limit": 1000000,
      "eis_ki_annual_limit": 2000000,
      "bpr_full_relief_cap": 1000000
    }
  ],
  "hold_flat_from": "2025/26",
  "hold_flat_disclosure": "Tax parameters beyond 2025/26 are held at 2025/26 values. Actual future rates may differ."
}
```

**In the engine, always look up parameters for the current plan year. Year 1 → 2025/26. Year N beyond the schedule → use last entry. Never hardcode any of these values in engine code.**

## Output Schema

Per-year array fields (from spec):
`year, total_portfolio_value, iht_exempt_total, estimated_iht_bill, income_tax_this_year, cgt_this_year, spend_target_nominal, spend_met, shortfall, baseline_cash_income, gifted_this_year, clt_7yr_cumulative, tfls_remaining, draws_by_asset, flags`

Plan summary fields:
`funded_years, fully_funded, first_shortfall_year, total_spent, total_income_tax_paid, total_cgt_paid, total_tax_paid, total_gifted, estate_at_end, iht_at_end, iht_saving_vs_no_plan, shadow_funded_years`

---

# 11. Technical Guidelines

## Unlock Architecture Context

The Unlock platform is **local-first**. The desktop app is the system of record — it runs locally, stores data in a local SQLite database, and performs all processing. The cloud is a sync layer only (encrypted snapshots). Mobile is a viewer only.

This Replit prototype sits in that architecture as follows:

- It simulates the **desktop app's planning module** — the layer that reads the local asset register and runs calculations
- In production, `mockRegister.json` is replaced by a query to the local SQLite database
- The simulation engine (`decumulation.js`) is the exact code that will run locally — it must stay portable and have no cloud or browser dependencies
- There is no authentication in this prototype — in production, the desktop app controls access
- No data leaves the browser in this prototype — consistent with the local-first privacy model

**Implication for the build:** Keep all business logic in pure JS modules. No API calls. No external data fetching. The engine reads from the JSON files as a stand-in for the local database. This makes the transition from prototype to desktop build straightforward.

## Stack

| Item | Choice |
|---|---|
| Framework | React 18 (Vite) |
| Charts | recharts |
| Styling | Plain CSS with CSS custom properties (see Section 8) — no Tailwind (Replit PostCSS issues) |
| State | React useState / useReducer only — no Redux |
| Fonts | Google Fonts — Inter + JetBrains Mono |
| Icons | lucide-react |
| Data | JSON files — no API calls |

## package.json dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "recharts": "^2.10.0",
    "lucide-react": "^0.383.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.0.0"
  }
}
```

## File Structure

```
/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── App.css
│   ├── engine/
│   │   ├── decumulation.js        ← pure simulation loop
│   │   ├── taxLogic.js            ← income tax, CGT, IHT, PCLS
│   │   ├── trustLogic.js          ← CLT rolling window, PET taper, NEFI
│   │   └── warningEvaluator.js    ← evaluates all warning_triggers
│   ├── data/
│   │   ├── mockRegister.json      ← copy from Section 10
│   │   └── taxParameters.json     ← copy from Section 10
│   └── components/
│       ├── InputPanel.jsx
│       ├── StrategyTabs.jsx
│       ├── ScenarioToggles.jsx
│       ├── GiftingModule.jsx
│       ├── FundedYearsIndicator.jsx
│       ├── StrategyComparison.jsx
│       ├── PortfolioChart.jsx
│       ├── IHTChart.jsx
│       ├── TaxDragSummary.jsx
│       ├── WarningsPanel.jsx
│       ├── YearDetailTable.jsx
│       └── DisclosurePanel.jsx
```

## Engine Architecture

`decumulation.js` exports one function:
```js
export function runSimulation(inputs, register, taxParams) {
  // returns { perYear: [...], summary: {...} }
}
```

This function must be a pure function. It must not import from React, recharts, or any UI library. It can be called from a Node.js backend without modification.

`taxLogic.js` exports pure utility functions:
```js
export function getParamsForYear(taxParams, planYear) { }
export function calculateIncomeTax(taxableIncome, params, incomeTypes) { }
export function calculatePCLS(grossCrystallisation, remainingLSA) { }
export function calculateCGT(gain, totalIncomeInYear, params) { }
export function calculateIHTBill(estate, bprTotal, cltCumulative, pensionValue, toggles, params) { }
```

`trustLogic.js` exports:
```js
export function getCLTCumulative(giftHistory, currentYear) { }   // rolling 7-year window
export function getPETTaperRate(yearsSinceGift) { }
export function checkNEFI(baselineCashIncome, spendTarget, giftAmount) { }
```

`warningEvaluator.js` exports:
```js
export function evaluateWarnings(yearSnapshot, register, inputs, toggles) { }
// returns array of { id, severity, message }
```

## Critical Implementation Rules

These are known pitfalls from the spec review — implement exactly as stated:

**PCLS (pension tax-free cash):**
```js
// CORRECT
const max_pcls = 0.25 * gross_crystallisation;
const pcls = Math.min(max_pcls, remaining_lsa);
const taxable_draw = gross_crystallisation - pcls;
remaining_lsa -= pcls;

// DO NOT use ratio-based formula — it is mathematically unstable
```

**VCT disposal:**
```js
// CORRECT — VCT shares are CGT-exempt on disposal (TCGA 1992 s.151A)
// Early disposal (< 5 years) triggers income tax relief clawback only
const clawback = lot.relief_claimed_type !== 'none' ? lot.tax_relief_claimed : 0;
const cgt = 0;  // always zero for VCT disposal

// DO NOT apply CGT to VCT disposals
```

**CLT rolling window:**
```js
// CORRECT — time-series, not cumulative total
// giftHistory = [{ year: 1, amount: 12000 }, { year: 2, amount: 12000 }, ...]
function getCLTCumulative(giftHistory, currentYear) {
  return giftHistory
    .filter(g => g.year > currentYear - 7)  // last 7 years only
    .reduce((sum, g) => sum + g.amount, 0);
}

// DO NOT use a simple running total — old gifts must age out
```

**Annual gift exemption ordering:**
```js
// Apply £3k exemption BEFORE classifying remainder as CLT/PET
const exemption = Math.min(giftAmount, availableAnnualExemption);  // max £6k with carry-forward
const classifiable = giftAmount - exemption;
// Only classifiable portion counts toward CLT rolling total
```

**Income type ordering for tax bands:**
```
1. Non-savings income (pension draws, rental, state pension) → against personal allowance first
2. Savings income (interest) → net of PSA
3. Dividend income → net of dividend allowance
```

**NRB stacking for IHT:**
```js
const available_nrb = Math.max(0, params.nil_rate_band - clt_7yr_cumulative);
const iht = Math.max(0, taxable_estate - available_nrb) * params.iht_rate;
```

---

# 12. Acceptance Criteria

The build is complete when all of the following are verifiable without explanation:

- [ ] Load the page cold — simulation output appears within 2 seconds using default inputs
- [ ] Change annual_income_target — charts update within 500ms
- [ ] Switch strategy to iht_optimised — comparison panel updates, IHT line changes
- [ ] Toggle apply_2027_pension_iht OFF then ON — IHT chart changes visibly in post-2027 years
- [ ] Set annual_gift_amount to £50,000, gift_type to discretionary_trust — CLT total accumulates correctly; warning fires at £260k
- [ ] Set annual_income_target to £250,000 — plan depletes; portfolio chart shows depletion marker; funded years indicator shows red
- [ ] Check warnings panel — MISSING_ACQUISITION_COST appears for Fulham flat on load
- [ ] Check warnings panel — BPR_NOT_YET_QUALIFYING appears for Octopus 2024 tranche in year 1
- [ ] Per-year table shows TFLS remaining declining in pension draw years
- [ ] EIS lot (eis-001) disposal year shows deferred_gain_amount (£85,000) added to taxable income
- [ ] Disclosure panel: collapsed on load, expands on click, shows all model assumptions
- [ ] `src/engine/decumulation.js` has no import from react, recharts, or any UI library
- [ ] `src/data/taxParameters.json` present — no tax constants hardcoded in engine files
- [ ] No console errors on fresh load in Chrome

---

# 13. Constraints

- Mock data only — no live register
- No authentication
- Desktop only — minimum 1280px viewport
- Tax parameters: 2025/26 only — future years hold-flat
- Single individual — no spouse/joint planning
- Average-cost CGT approximation — not full HMRC share matching (VCT/EIS always lot-level)
- No trust ten-year / exit charges
- No RNRB
- No care costs
- DB pension = flat income stream
- Post-2027 pension IHT = estate-level only (no beneficiary income tax)
- No PDF/CSV export

---

# 14. Resolved Decisions

All open questions from the design phase have been resolved. Do not re-open these:

| Question | Decision |
|---|---|
| Property disposal year selection | User does not select. Property sold when it appears in the strategy priority queue. Algorithm flags if a better year exists. |
| Mock register | Use exact JSON in Section 10. Total portfolio ≈ £3.5M. |
| Chart colour assignment | Use exact hex values in Section 8 colour table. |
| Strategy comparison layout | Four-column table. Columns = strategies. Rows = funded years / total tax / IHT at end / first shortfall. Selected strategy column highlighted in teal. |
| Annual gift — single or split | Single amount, single type per year. |
| Shadow projection display | Greyed continuation of main portfolio chart. Chart width extends to shadow horizon. Shadow region shown with reduced opacity and hatching or tonal difference. |
| Tax reserve visibility | Show `tax_reserve_on_baseline_income` as its own row in the per-year detail table. Label: "Tax on investment income". Helps users understand why draw exceeds spend target. |

---

# 15. Delivery Expectations

The output must include:

- Working React app running on Replit (green Run button → app loads in browser)
- `src/engine/decumulation.js` — pure simulation function, commented
- `src/data/taxParameters.json` and `src/data/mockRegister.json` — exactly as in Section 10
- All components in `src/components/` — one file per component
- `README.md` containing:
  - Setup: `npm install` then `npm run dev`
  - Architecture overview (3–5 sentences)
  - List of assumptions made beyond this SBDS
  - List of items not yet implemented
- No console errors on fresh load
- No hardcoded tax figures in any engine file

---

# 16. Build Rules

1. **Do not guess tax logic.** All tax calculations are specified in `Unlock_Decumulation_Engine_Spec_v1.2.json`. Read it before implementing any engine function.
2. **Visual style is exact.** Use `--unlock-accent: #00BB77` as the brand green. Use CSS custom properties from Section 8. Do not substitute other greens or teal variants.
3. **Engine is a pure function.** `decumulation.js` imports nothing from React. If you find yourself importing a hook inside the engine, you are in the wrong file.
4. **Local-first architecture.** No API calls. No external data fetching. `mockRegister.json` is the stand-in for the local SQLite database. The engine must be portable to a desktop Node.js environment without modification.
5. **VCT disposal has no CGT.** Do not add CGT to VCT disposals. This is corrected from an earlier spec version — the correction stands.
6. **PCLS formula is fixed.** Use `min(0.25 × gross_crystallisation, remaining_lsa)`. Do not use a ratio formula.
7. **CLT is a time-series.** Track as `[{year, amount}]`. Filter to last 7 years on every calculation. Do not use a running total.
8. **NEFI is a warning only.** Never automatically reclassify gift_type. The system warns; the user decides.
9. **All UX states must exist.** Default, loading, empty, funded, shortfall, error, validation, warning, scenario-active. Test each one.
10. **JetBrains Mono for all numbers.** Every financial figure, year, percentage, and count displayed in the UI must use JetBrains Mono. Inter for everything else.

---

# 17. Reference Documents

| Document | Purpose |
|---|---|
| `Unlock_Decumulation_Engine_Spec_v1.2.json` | Authoritative source for all tax logic, algorithm, schema, constraints |
| `SBDS_Decumulation_Planner_Replit.md` | This document — build specification and single source of truth |

**Spec version:** v1.2  
**Date:** March 2026  
**Author:** Tom King, Unlock
