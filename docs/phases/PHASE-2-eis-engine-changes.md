# Phase 2: EIS Engine Changes

**Effort:** 2 days | **Dependencies:** None (but ideally after Phase 1) | **Risk:** HIGH

---

## Feature

EIS (Enterprise Investment Scheme) assets must be removed from the main drawdown queue and treated as a locked, non-growing parallel position. The main plan should never draw income from EIS holdings. EIS must be displayed at "net capital at risk" (gross invested minus income tax relief received), not at gross value.

A per-company data model must be introduced so that each EIS investment can be tracked individually with its own BPR qualifying clock, status, and exit history.

---

## Why this is necessary

EIS capital is locked. You cannot sell EIS shares on demand. The return is binary — an investment might return nothing or 20 times the original amount. The timeline is unknowable. Loss relief changes the effective cost of failure. The current model treats EIS like any other asset and draws from it to fund income. That is wrong and produces misleading results.

---

## Current state

- EIS is included in the main drawdown queue with a liquidity score of 0.4 (drawn after cash/ISA, before pension)
- EIS is valued using scenario-based exit multiples (2.9x/5.65x/10.25x) applied via an exit ramp over 7 years
- EIS tracking is at vintage-year cohort level (one `EISCohort` entry per year of investment) — no per-company granularity
- BPR qualification is tracked at portfolio level, not per-lot
- The drawdown scoring function `calculatePriority()` in `decumulation.ts` scores EIS alongside all other assets
- EIS displays at full invested value in the portfolio chart and asset register

---

## Required behaviour

### Drawdown exclusion

The simulation engine must never draw from EIS assets to fund income. EIS assets should be filtered out of the drawdown ordering entirely. They remain in the portfolio for IHT calculations and estate value, but they are not available as income sources.

### Net capital at risk display

Wherever EIS value is displayed (asset register, portfolio summary, charts), it must show:

```
netCapitalAtRisk = grossInvested - incomeTaxReliefClaimed
```

This is a computed value, not stored on the asset. It must be labelled as "planning amount only — not a market valuation."

### Loss relief formula

Implement exactly:

```
I = gross investment
R = 30% x I (income tax relief; 50% for SEIS)
A = I - R (net capital at risk)
L = A x m (loss relief, where m = user's marginal tax rate)
N = I - R - L (net effective loss after all reliefs)
```

For an additional-rate taxpayer (45%) investing 100,000: N = 100,000 - 30,000 - 31,500 = 38,500. Never show 100,000 as the downside.

### Per-company data model

Each EIS investment should be trackable at company level with:

- Company name
- Amount invested
- Subscription date (drives BPR and CGT clocks)
- Scheme type (EIS or SEIS)
- Status: one of three states — **Modelled** (scenario assumption only), **Estimated** (user has entered a valuation), **Confirmed** (actual exit or write-off recorded with date and proceeds)
- Estimated value (optional, user-entered)
- Actual proceeds and exit date (on confirmed exit)
- Loss relief claimed (on confirmed write-off)
- Per-lot BPR qualifying date (subscription + 2 years)
- Per-lot CGT exempt date (subscription + 3 years)

**Confirmed events cannot be downgraded to Modelled or Estimated.** They are permanent records. When a confirmed exit is recorded, the proceeds flow into the main plan as a dated cashflow event.

### Per-lot BPR clocks

Each EIS company must have its own 2-year BPR qualifying clock based on its subscription date. The IHT model's BPR pool must be calculated by summing only those lots where the clock has completed, not by treating the entire EIS portfolio as one block.

### Migration

The existing vintage-year cohort model (`EISCohort` in `decumulation.ts`) must continue to work for users who do not enter per-company detail. The per-company layer is optional — when populated, it overrides the cohort-level model. Do not force a data migration.

---

## Acceptance criteria

1. Run a simulation with EIS in the portfolio — EIS assets are never drawn from to fund income
2. Liquid assets (cash, ISA, GIA) deplete faster than before because they are now covering income that EIS used to cover
3. EIS is displayed at net capital at risk (70,000 for a 100,000 EIS investment with 30% relief claimed)
4. The label "planning amount only" appears next to EIS values in the asset register
5. Loss formula produces N = 38,500 for a 100,000 investment at 45% marginal rate
6. Two EIS companies with different subscription dates qualify for BPR independently based on their individual 2-year clocks
7. A confirmed exit on one company flows cash into the main plan; other companies remain as modelled positions
8. Existing portfolios without per-company data continue to work using the vintage-year cohort model

---

## Risks

- **Regression is certain.** Removing EIS from drawdown changes simulation output for every portfolio that includes EIS. This is by design (the current model is wrong), but it will surprise users. Add a feature flag (`eis_v2_model: boolean`) so the old behaviour can be restored during testing.
- **Per-company state management is complex.** The three-state lifecycle (Modelled → Estimated → Confirmed) with the rule that Confirmed cannot be downgraded needs careful state management and validation.
- **Data migration.** Existing EIS strategy data is stored as JSONB in the database. The per-company layer must be additive — do not break existing data.

---

## Constraints

- Do not modify tax logic (`taxLogic.ts`) or trust logic (`trustLogic.ts`)
- Keep the existing EIS strategy configuration (quality tiers, scenarios, allocation modes) — this phase changes how EIS is treated in the drawdown and displayed, not how EIS investments are configured
- The EIS programme allocation mechanism (Step 4b in the engine — sourcing capital from other assets to fund EIS investments) should continue to work as before. Only the drawdown queue treatment changes.

---

## Source reference

Full EIS display and architecture specification is in `docs/EIS into Unlock.docx`, Part 1 (Layer 1: Main plan).
