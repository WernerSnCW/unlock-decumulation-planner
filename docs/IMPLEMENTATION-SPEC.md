# Implementation Specification: Asset Growth, EIS Rework & Tensions Framework

**Prepared for:** Replit implementation resource
**Date:** April 2026
**Source documents:** `Asset Growth into Unlock.docx`, `EIS into Unlock.docx`, `Tensions for Unlock.docx`
**Codebase:** `artifacts/decumulation-planner/src/`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Impact Assessment](#2-impact-assessment)
3. [Workstream A: Asset Growth Defaults](#3-workstream-a-asset-growth-defaults)
4. [Workstream B: EIS Rework](#4-workstream-b-eis-rework)
5. [Workstream C: Tensions Framework](#5-workstream-c-tensions-framework)
6. [Implementation Order](#6-implementation-order)
7. [Risk Register](#7-risk-register)
8. [File Map](#8-file-map)
9. [Testing Strategy](#9-testing-strategy)

---

## 1. Executive Summary

Three specification documents define changes across three workstreams:

| Workstream | Scope | Risk | Effort |
|-----------|-------|------|--------|
| A: Asset Growth Defaults | Low — config + UI | Low | 2-3 days |
| B: EIS Rework | High — architectural redesign of EIS modelling | High | 8-12 days |
| C: Tensions Framework | High — new detection engine + UI layer | Medium | 6-8 days |

**Total estimated effort: 16-23 days.**

Workstream A is safe to implement independently. Workstreams B and C have interdependencies (tensions T2, T3, T6, T8, T9, T11-T14 all reference EIS behaviour) — implement B before C.

---

## 2. Impact Assessment

### 2.1 What exists today (current state)

| Area | Current Implementation |
|------|----------------------|
| Growth rates | Per-asset `assumed_growth_rate` field. No defaults by asset class. User sets manually or via CSV import. |
| EIS in drawdown | Included in main drawdown queue with liquidity score 0.4. Drawn like any other asset. |
| EIS growth model | Scenario-based exit multiples (2.9x/5.65x/10.25x) applied via exit ramp over 7 years. Not a growth rate. |
| EIS tracking | Portfolio-level vintage-year cohorts. No per-company granularity. |
| EIS exits | Manual CGT events array. No automatic exit modelling, no confirmed/estimated/modelled states. |
| EIS reinvestment | Does not exist. |
| EIS display | Shown at full value in asset register and portfolio chart. Not distinguished as "net capital at risk." |
| Loss relief | Calculated but spread evenly across investment years in worst-case scenario. No year-specific absorption check. |
| Warnings | 10+ register and year-level checks via `warningEvaluator.ts`. Simple severity sorting. |
| Tensions | Do not exist. No goal capture beyond `legacy_target`. No conflict detection. No resolution actions. |
| Risk tolerance | No global input. Modelled indirectly via strategy presets and mechanisms. |
| Cash floor | Exists as `cash_reserve` input. |

### 2.2 What must change

#### Workstream A: Asset Growth Defaults (LOW IMPACT)

**Files affected:** 2-3 files
- New config file for default growth rates
- `InputPanel.tsx` — add override UI with source explanations
- `AssetEditor.tsx` — auto-populate growth rate from defaults when asset class is selected

**Engine impact:** None. Growth rates are already per-asset inputs. This only changes how defaults are populated.

**Breaking changes:** None.

#### Workstream B: EIS Rework (HIGH IMPACT)

**Files affected:** 6-8 files
- `decumulation.ts` — major changes to EIS handling in drawdown loop
- New `EISPanel.tsx` component (replaces inline EIS chart in PortfolioChart)
- `PortfolioChart.tsx` — remove EIS programme from stacked area chart
- `InputPanel.tsx` — modify EIS settings to add exit horizon, reinvest toggle, per-company fields
- New `eisTypes.ts` — data model for per-company tracking
- `PlannerContext.tsx` — add EIS panel state management
- `AnalysisPage.tsx` — integrate new EIS panel below main plan
- Schema changes in `api-server` for per-company EIS data

**Engine impact:** Fundamental. EIS must be removed from the main drawdown queue and modelled as a parallel layer. The drawdown scoring function, asset iteration loop, and IHT calculation all need modification.

**Breaking changes:** Yes. EIS portfolio values in existing simulations will change because:
1. EIS no longer contributes to portfolio drawdown (liquid assets deplete faster)
2. EIS displayed at "net capital at risk" not gross value
3. BPR pool calculation changes from portfolio-level to per-lot

#### Workstream C: Tensions Framework (MEDIUM-HIGH IMPACT)

**Files affected:** 5-7 new files + modifications to 3-4 existing files
- New `tensionEngine.ts` — detection logic for 14 tensions
- New `TensionCard.tsx` — UI component for individual tensions
- New `TensionsPanel.tsx` — two-tier display (Issues / Decisions)
- New `goalCapture.ts` — goal input schema and defaults
- `warningEvaluator.ts` — may be partially superseded by tensions
- `InputPanel.tsx` or new `GoalSettingsPanel.tsx` — goal capture UI
- `AnalysisPage.tsx` or `PlanningPage.tsx` — render tensions panel
- `PlannerContext.tsx` — add tension detection to simulation pipeline
- Schema changes for goal storage

**Engine impact:** Moderate. Tension detection runs AFTER the simulation as a post-processing step. It does not change the simulation itself — it reads the results and compares against goals. However, resolution actions must trigger parameter changes and re-simulation.

**Breaking changes:** No. Tensions are additive.

---

## 3. Workstream A: Asset Growth Defaults

### 3.1 Specification summary

Each asset class gets a researched default growth rate, source explanation, and override range. The user sees the default with its basis and can override.

### 3.2 Implementation steps

#### Step A1: Create growth defaults config

**New file:** `src/data/assetGrowthDefaults.ts`

```typescript
export interface GrowthDefault {
  assetClass: string;
  defaultRate: number;
  overrideMin: number;
  overrideMax: number;
  source: string;           // short source basis for UI tooltip
  notes: string;            // longer explanation
  phase?: 'accumulation' | 'drawdown';  // for pension dual-phase
}

export const ASSET_GROWTH_DEFAULTS: GrowthDefault[] = [
  {
    assetClass: 'cash',
    defaultRate: 0.035,
    overrideMin: 0.01,
    overrideMax: 0.06,
    source: 'BoE base rate less savings drag',
    notes: 'Bank of England base rate 4.25% (April 2026), discounted for typical savings account drag.'
  },
  {
    assetClass: 'isa',
    defaultRate: 0.065,
    overrideMin: 0.02,
    overrideMax: 0.10,
    source: 'FCA mid (5%) to long-run nominal (7.5%)',
    notes: 'For stocks & shares ISAs. Cash ISAs should use the cash default (3.5%).'
  },
  {
    assetClass: 'pension',
    defaultRate: 0.045,   // drawdown phase default
    overrideMin: 0.02,
    overrideMax: 0.09,
    source: 'De-risked 60/40 blended for drawdown',
    notes: 'Assumes de-risked allocation in decumulation. Accumulation phase: 6.5%.',
    phase: 'drawdown'
  },
  {
    assetClass: 'property_investment',
    defaultRate: 0.03,
    overrideMin: 0.0,
    overrideMax: 0.07,
    source: 'Land Registry long-run; Savills forecast',
    notes: 'Capital appreciation only. Rental income is a separate income stream.'
  },
  {
    assetClass: 'property_residential',
    defaultRate: 0.03,
    overrideMin: 0.0,
    overrideMax: 0.07,
    source: 'Land Registry long-run; Savills forecast',
    notes: 'Main residence. Not normally in drawdown queue.'
  },
  {
    assetClass: 'aim_shares',
    defaultRate: 0.05,
    overrideMin: -0.05,
    overrideMax: 0.15,
    source: 'Main market discount; BPR value is primary driver',
    notes: 'AIM has underperformed main market by 2-3pp. Wide range reflects high outcome dispersion.'
  },
  {
    assetClass: 'vct',
    defaultRate: 0.03,
    overrideMin: -0.05,
    overrideMax: 0.08,
    source: 'NAV growth modest; dividends are the return',
    notes: 'Capital NAV growth only. Tax-free dividends modelled as separate income stream.'
  },
  // EIS is scenario-based, not rate-based — no default here
];
```

#### Step A2: Auto-populate growth rate in AssetEditor

**File:** `src/components/AssetEditor.tsx`

When the user selects or changes `asset_class` on an asset, auto-populate `assumed_growth_rate` with the default from the config above — but only if the current rate is 0 or the asset is newly created. Never overwrite a user-set rate silently.

Add a small info icon next to the growth rate field showing the source basis tooltip.

#### Step A3: Add inflation default

**File:** `src/context/PlannerContext.tsx`

Change the default `inflation_rate` from whatever it currently is to `0.025` (2.5%), per the spec.

#### Step A4: Growth rate override UI enhancement

**File:** `src/components/AssetEditor.tsx`

When editing growth rate, show the override range (min/max) from the config. If the user enters a value outside the range, show a warning (not a block).

### 3.3 Risks

- **None significant.** This is purely additive configuration. No engine changes.
- **Watch for:** Cash ISA vs Stocks & Shares ISA — the spec says they should use different rates. The current `asset_class` field doesn't distinguish ISA subtypes. Consider adding a note in the UI rather than a new field.

---

## 4. Workstream B: EIS Rework

### 4.1 Specification summary

The spec demands a **two-layer architecture**:
1. **Main plan:** EIS shown at "net capital at risk" (gross invested minus 30% relief), zero growth, excluded from drawdown queue
2. **EIS panel:** Separate projection panel below the main plan with 3 scenarios shown simultaneously, exit horizon slider, reinvest/harvest toggle, per-company tracking

This is a fundamental architectural change from the current single-layer model.

### 4.2 Critical changes to the engine

#### B1: Remove EIS from the drawdown queue

**File:** `src/engine/decumulation.ts`

In the `calculatePriority()` function (~line 340), EIS assets currently get a liquidity score of 0.4. Change:

```typescript
// BEFORE (current)
if (asset.assetClass === 'eis') {
  ihtScore = ...; // calculated based on BPR status
}

// AFTER (new)
if (asset.assetClass === 'eis') {
  return -1;  // Signal: exclude from drawdown entirely
}
```

In the drawdown loop (Step 3, ~line 1080), filter out assets where `calculatePriority` returns -1:

```typescript
const drawdownOrder = assets
  .filter(a => a.value > 0 && !a.transferred && calculatePriority(a, ...) >= 0)
  .sort(...)
```

#### B2: Display EIS at net capital at risk

In the asset register and portfolio chart, EIS value should display as:
```
netCapitalAtRisk = grossInvested - incomeTaxRelief
```

This requires a new computed field, not stored on the asset. The `AssetEditor` grid and `PortfolioPage` summary should show this computed value for EIS assets, with a "planning amount only" sub-label.

#### B3: Per-company EIS tracking (new data model)

**New file:** `src/engine/eisTypes.ts`

```typescript
export interface EISCompany {
  id: string;
  companyName: string;
  amountInvested: number;
  subscriptionDate: string;         // ISO date
  schemeType: 'eis' | 'seis';
  status: 'modelled' | 'estimated' | 'confirmed';
  estimatedValue: number | null;    // user-entered, optional
  actualProceeds: number | null;    // on confirmed exit
  exitDate: string | null;          // on confirmed exit or write-off
  lossReliefClaimed: number;        // on confirmed write-off
  bprQualifyingDate: string;        // subscription + 2 years
  cgtExemptDate: string;            // subscription + 3 years
  reliefClaimed: number;            // 30% EIS or 50% SEIS
  deferredGain: number;             // CGT deferral amount
}

export type EISPlanState = 'modelled' | 'estimated' | 'confirmed';
// Confirmed cannot be downgraded
```

**Migration:** Existing `EISCohort` data (vintage-year level) should continue to work for users who don't enter per-company detail. The per-company layer is optional — when populated, it overrides the cohort-level model.

#### B4: Three-scenario EIS projection panel

**New file:** `src/components/EISProjectionPanel.tsx`

This replaces the current inline EIS comparison chart. It renders:
- X-axis aligned to main plan timeline
- Y-axis: portfolio value (GBP)
- Horizontal baseline band at net capital at risk (A = I - R)
- Below baseline: shaded loss relief zone
- Scenario 1 (All Fail): flat line at net effective loss N = I - R - L
- Scenarios 2 & 3: shaded bands (ranges), not single lines
- Vertical dashed line at selected exit horizon
- Confirmed exit events as distinct point markers

Controls:
- Exit horizon slider: 3 / 5 / 7 / 10 / 12+ years (default: 7)
- Reinvest/Harvest toggle

#### B5: Reinvestment logic

When "Reinvest" is toggled on, ALL of the following must fire:
1. Exit proceeds never touch main plan cashflow
2. A new EIS lot is created with fresh subscription date
3. New 30% income tax relief event applied
4. Fresh 3-year CGT exemption clock
5. Fresh 2-year BPR qualifying clock
6. Main plan income funded entirely from other assets during reinvestment years

Surface a warning:
> "Reinvesting delays liquidity and extends your reliance on other assets for income. Your [cash/ISA/pension] will need to fund income for approximately [X] additional years."

#### B6: Failure timing distribution

Default: losses distributed across years 2-6 of holding period (not all year 1). Display as planning convention. User can override in advanced settings.

#### B7: "Stop waiting" prompt

After 10 years with no confirmed exit, prompt:
> "Your EIS portfolio has had no confirmed exit in [X] years. If no exit occurs, the maximum value you should plan around is [N] after loss relief. Would you like to model this as a write-off?"

Two options: "Yes, model as write-off" (second confirmation required) / "No, keep as active."

#### B8: Per-lot BPR clocks

Currently BPR is tracked at portfolio level. Must change to per-lot (per-company) with individual 2-year clocks. BPR pool in IHT calculation updated per lot as clocks complete.

### 4.3 Files affected

| File | Change type |
|------|------------|
| `decumulation.ts` | Major — remove EIS from drawdown, change IHT BPR to per-lot |
| `eisTypes.ts` | New — per-company data model |
| `EISProjectionPanel.tsx` | New — replaces inline chart |
| `PortfolioChart.tsx` | Modify — remove EIS programme from stacked area |
| `InputPanel.tsx` | Modify — add exit horizon, reinvest toggle, per-company fields |
| `AnalysisPage.tsx` | Modify — add EIS panel below main charts |
| `PortfolioPage.tsx` | Modify — show EIS at net capital at risk |
| `PlannerContext.tsx` | Modify — manage EIS panel state |
| `EISScenarioComparison.tsx` | Modify — update to use new model |
| API schema | Modify — add per-company EIS storage |

### 4.4 Risks

- **HIGH: Regression.** Removing EIS from drawdown fundamentally changes simulation output for every user with EIS. All existing simulations will show different results.
- **HIGH: Complexity.** Per-company tracking with three plan states (modelled/estimated/confirmed) and state transitions is significant state management complexity.
- **MEDIUM: Data migration.** Existing EIS strategy data stored in JSONB needs migration path to per-company format.
- **Mitigation:** Keep the vintage-year cohort model as fallback for users without per-company data. Only activate per-company when the user enters company-level detail.

---

## 5. Workstream C: Tensions Framework

### 5.1 Specification summary

14 defined tensions across 5 groups:
- Group 1: Income vs Estate (T1A, T1B, T2, T3)
- Group 2: Tax Efficiency vs Income (T4, T5, T6)
- Group 3: Estate vs Risk (T7, T8)
- Group 4: Planning Horizon (T9, T10)
- Group 5: EIS-specific (T11, T12, T13, T14)

Two tiers: Tier 1 (blocking issues) and Tier 2 (preference decisions).

Each tension has: trigger condition, financial impact (one-off or cumulative), severity, helper question, resolution options that reconfigure the plan.

### 5.2 Goal capture (prerequisite)

**New inputs required** (add to SimulationInputs):

```typescript
// Already exists:
legacy_target: number;       // net-of-IHT bequest goal
cash_reserve: number;        // cash floor

// NEW fields needed:
risk_tolerance: 'conservative' | 'balanced' | 'growth';
eis_annual_target: number;   // EIS annual subscription target (separate from EIS strategy amount)
property_to_children: boolean;
care_cost_reserve: number;
charitable_giving_target: number;
```

These are soft targets (optimisation objectives). Add a "Goals" section to InputPanel or a dedicated GoalSettingsPanel.

### 5.3 Tension detection engine

**New file:** `src/engine/tensionEngine.ts`

```typescript
export interface TensionEvent {
  id: string;                    // T1A, T1B, T2, etc.
  tier: 1 | 2;
  isCompounding: boolean;
  severity: 'Info' | 'Material' | 'Critical';
  severityBasis: 'spendable_portfolio' | 'legacy_target' | 'rule_based';
  severityScore: number | null;  // null for rule-based
  resolutionStage: 'viability' | 'tax' | 'estate';
  firstTriggeredYear: number;    // 1-indexed plan year
  impactOneOff: number | null;   // null for compounding tensions
  impactCumulative: number | null; // null for non-compounding
  primaryTensionId: string | null;
  linkedTensionIds: string[];
  resolutionOptions: ResolutionOption[];
  primaryMessageParams: Record<string, any>;
  engineContextRefs: string[];
}

export interface ResolutionOption {
  label: string;
  actionType: 'apply_parameter_change' | 'accept_tradeoff' | 'run_comparison' | 'open_manual_edit';
  parameterChange: Record<string, any> | null;
  comparisonScenario?: string;
}

export function detectTensions(
  inputs: SimulationInputs,
  result: SimulationResult,
  assets: Asset[],
  taxParams: TaxParametersFile
): TensionEvent[];
```

#### Suppression rule (implement exactly):

```
show_tension =
  (is_compounding AND abs(impact_cumulative) >= 25000)
  OR
  (NOT is_compounding AND abs(impact_one_off) >= 5000)
```

#### Tension implementations (priority order):

**Phase 1 — Ship first (core tensions):**
- T1A: Plan depletion (Tier 1) — `funded_years < plan_years`
- T1B: Legacy shortfall (Tier 2) — `net_estate_after_iht < legacy_target`
- T10: Cash floor breach (Tier 1) — cash drops below `cash_reserve` within plan
- T4: IHT vs income tax trade-off (Tier 2)

**Phase 2 — After EIS rework:**
- T2: Triple constraint (income + EIS + legacy)
- T3: Income draw erodes BPR assets
- T6: EIS reinvestment vs income availability
- T8: BPR cliff before qualifying period (Tier 1)
- T9: Plan horizon vs EIS holding period

**Phase 3 — Advanced:**
- T5: CGT event on property sale
- T7: Legacy requires more risk than tolerance
- T11: EIS vs pension tax relief comparison
- T12: EIS loss relief absorption
- T13: Phantom wealth (illiquid EIS vs income timing)
- T14: Legacy contingent on EIS performance

### 5.4 Tension UI

**New files:**
- `src/components/TensionCard.tsx`
- `src/components/TensionsPanel.tsx`

TensionsPanel renders two sections:
1. **"Issues to resolve"** (Tier 1) — shown first, prominently
2. **"Decisions to consider"** (Tier 2) — shown after

Each TensionCard shows:
- Plain-English tension name
- One-sentence conflict statement with numbers
- Helper question
- 2-3 resolution options as buttons
- "Adjust manually" always last

Selecting a resolution option:
1. Applies the `parameterChange` to inputs
2. Triggers re-simulation
3. Tension card updates to show whether conflict is resolved

**Placement:** Analysis page, between the action plan and the warnings panel. Or as a new "Decisions" tab.

### 5.5 Relationship with existing warnings

Existing `warningEvaluator.ts` warnings should remain — they catch data quality issues (missing dates, incorrect flags) which are distinct from goal conflicts. Tensions are strategic; warnings are tactical.

Consider moving the `LEGACY_FLOOR_AT_RISK` warning into T1B tension to avoid duplication.

### 5.6 Risks

- **MEDIUM: Resolution action side effects.** A resolution that changes one parameter may trigger or resolve other tensions. Must detect in a loop until stable.
- **MEDIUM: UX complexity.** 14 tensions could overwhelm. Suppression thresholds help but need testing with real portfolios.
- **LOW: Engine performance.** Some tensions require counterfactual simulation runs (e.g., T4 needs both IHT-optimised and tax-optimised results). Cache results.

---

## 6. Implementation Order

### Phase 1: Asset Growth Defaults (2-3 days)
- Steps A1-A4
- No dependencies. Safe to ship independently.
- Test: verify auto-population, verify override range warnings

### Phase 2: EIS Rework — Data Model (3-4 days)
- Steps B1-B3
- Create per-company data model
- Remove EIS from drawdown queue
- Implement net capital at risk display
- Test: verify drawdown no longer touches EIS assets

### Phase 3: EIS Rework — Projection Panel (3-4 days)
- Steps B4-B8
- Build EIS projection panel with 3 scenarios
- Implement reinvestment toggle with all downstream effects
- Add exit horizon controls, failure timing, stop-waiting prompt
- Per-lot BPR clocks
- Test: verify all 6 reinvestment effects fire, verify BPR clocks

### Phase 4: Core Tensions (3-4 days)
- Steps C1-C4 (T1A, T1B, T10, T4 only)
- Goal capture UI
- Tension detection engine (4 tensions)
- TensionCard and TensionsPanel UI
- Resolution action → re-simulation loop
- Test: verify trigger conditions, verify resolution actions reconfigure plan

### Phase 5: EIS-dependent Tensions (3-4 days)
- Steps C5 (T2, T3, T6, T8, T9)
- Requires Phase 3 complete (EIS rework)
- Test with EIS-heavy portfolios

### Phase 6: Advanced Tensions (2-3 days)
- Steps C6 (T5, T7, T11-T14)
- T11 requires shadow optimal run (cache)
- T12 requires per-year loss relief absorption check
- Test with diverse personas (see persona table in spec)

---

## 7. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| EIS drawdown removal breaks existing results | High | Certain | Feature flag: `eis_v2_model: boolean` in settings. Allow rollback. |
| Per-company EIS data migration | Medium | Likely | Keep cohort model as fallback. Per-company is opt-in. |
| Tension resolution infinite loop | Medium | Possible | Max 3 re-detection cycles. If unstable after 3, show all remaining tensions. |
| Counterfactual runs slow down UI | Low | Possible | Cache comparison runs. Debounce tension detection. |
| Spec ambiguity on EIS scenario ranges | Medium | Likely | Scenarios 2 & 3 use ranges not lines. Need to define range bounds (10th-90th percentile? Min-max?). Ask Tom for historical data or use fixed multiples. |
| 14 tensions overwhelm users | Medium | Possible | Suppression thresholds are defined. Test with real portfolios. Consider progressive disclosure. |

---

## 8. File Map

### New files to create

| File | Purpose |
|------|---------|
| `src/data/assetGrowthDefaults.ts` | Growth rate defaults, ranges, sources |
| `src/engine/eisTypes.ts` | Per-company EIS data model |
| `src/engine/tensionEngine.ts` | Tension detection logic (14 tensions) |
| `src/components/EISProjectionPanel.tsx` | EIS-specific projection chart with scenarios |
| `src/components/TensionCard.tsx` | Individual tension card component |
| `src/components/TensionsPanel.tsx` | Two-tier tensions display panel |
| `src/components/GoalSettingsPanel.tsx` | Goal capture UI (income, legacy, risk, etc.) |

### Files to modify

| File | Changes |
|------|---------|
| `src/engine/decumulation.ts` | Remove EIS from drawdown queue, per-lot BPR, net capital at risk |
| `src/engine/warningEvaluator.ts` | Move legacy warning to tensions, keep data warnings |
| `src/components/InputPanel.tsx` | Growth rate defaults, EIS exit horizon/reinvest, goal capture |
| `src/components/AssetEditor.tsx` | Auto-populate growth from defaults, EIS per-company fields |
| `src/components/PortfolioChart.tsx` | Remove EIS programme from stacked area chart |
| `src/components/EISScenarioComparison.tsx` | Update to use new two-layer model |
| `src/pages/PortfolioPage.tsx` | Show EIS at net capital at risk with sub-label |
| `src/pages/AnalysisPage.tsx` | Add EIS panel, add tensions panel |
| `src/pages/PlanningPage.tsx` | Goal settings access |
| `src/context/PlannerContext.tsx` | EIS panel state, tension detection in pipeline |

### Files to NOT touch

| File | Reason |
|------|--------|
| `src/engine/taxLogic.ts` | Tax calculations are correct and complete |
| `src/engine/trustLogic.ts` | Trust handling is independent |
| `src/data/taxParameters.json` | Tax parameters are correct |
| `src/components/LearningCentre.tsx` | Unrelated to these workstreams |
| `src/pages/AdminPage.tsx` | Admin functions unrelated |
| `src/pages/LandingPage.tsx` | Landing page unrelated |

---

## 9. Testing Strategy

### Workstream A tests

1. Create a new asset with class "isa" — verify growth rate auto-populates to 6.5%
2. Change asset class from "isa" to "cash" — verify growth rate updates to 3.5%
3. Override growth rate to 12% — verify warning shown (outside 2-10% range)
4. Existing assets with user-set rates — verify NOT overwritten

### Workstream B tests

1. **Drawdown exclusion:** Enable EIS, run simulation, verify EIS assets are never drawn down
2. **Net capital at risk:** Invest 100k EIS, verify display shows 70k (100k - 30% relief)
3. **Loss formula:** Verify N = I - R - L where L = (I - R) * marginal_rate
4. **Reinvestment toggle:** Toggle on, verify all 6 downstream effects fire
5. **BPR per-lot:** Create 2 EIS companies with different dates, verify BPR qualifies independently
6. **Stop-waiting prompt:** Set up EIS with 10+ years, verify prompt appears
7. **Confirmed exit:** Record an exit, verify cash flows into main plan as dated event

### Workstream C tests

Use the **test fixtures from `Tensions for Unlock.docx`** — three full JSON payloads (T12, T10, T1A) with expected rendered copy and validation notes.

1. **T1A:** Set up portfolio that depletes at year 14 of 23 — verify tension fires with correct impact
2. **T10:** Set draw_pension_early = true — verify IHT increase tension fires
3. **T12:** 60% equity, 15% withdrawal rate — verify sequence risk tension fires
4. **Suppression:** Set up a tension with impact below threshold — verify NOT shown
5. **Resolution:** Click a resolution option — verify parameter changes, plan recalculates, tension updates
6. **Tier ordering:** Create mix of Tier 1 and Tier 2 — verify Tier 1 shown first
7. **Clustering:** Create T12 that links to T1A — verify meta-label shown

### Regression tests

Run the existing 178-test engine matrix (`docs/engine-matrix.test.ts`) after each phase to catch regressions. EIS-related tests will need updating after Phase 2 (expected — the model fundamentally changes).

---

## Appendix: Key Constants & Formulas

### Loss relief formula (implement exactly)

```
I  = gross investment
R  = 30% * I              (income tax relief, or 50% for SEIS)
A  = I - R                (net capital at risk)
L  = A * m                (loss relief, where m = user's marginal tax rate)
N  = I - R - L            (net effective loss after all reliefs)
```

For additional-rate taxpayer (45%): N = 100,000 - 30,000 - 31,500 = 38,500

### Tension suppression rule

```
show_tension =
  (is_compounding AND abs(impact_cumulative) >= 25,000)
  OR
  (NOT is_compounding AND abs(impact_one_off) >= 5,000)
```

### EIS scenario multiples (existing, keep)

| Quality Tier | Bear | Base Case | Bull | Worst Case |
|-------------|------|-----------|------|------------|
| Cautious | 1.45x | 2.90x | 4.35x | 0x |
| Base | 2.825x | 5.65x | 8.475x | 0x |
| Strong | 5.125x | 10.25x | 15.375x | 0x |

### Severity scoring

```
severityScore = abs(impact) / severityBasis_value

Critical:  score >= 0.50
Material:  score >= 0.10
Info:      score < 0.10

Exception: T1A severity is always rule-based, never ratio-based
```
