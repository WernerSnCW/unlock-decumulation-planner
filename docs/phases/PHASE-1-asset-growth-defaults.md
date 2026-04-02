# Phase 1: Asset Growth Defaults

**Effort:** Half a day | **Dependencies:** None | **Risk:** Low

---

## Feature

When a user creates a new asset and selects an asset class, the system must auto-populate the growth rate field with a researched default value. The user can override it freely. If the override falls outside a recommended range, show a visual warning but do not block the input.

Each default must have a short source explanation visible in the UI so the user understands where the number comes from.

---

## Current state

- Growth rates are per-asset via the `assumed_growth_rate` field on the `Asset` interface
- There are no defaults by asset class — every rate is set manually by the user or via CSV import
- The inflation rate default is currently set in `PlannerContext.tsx` as part of `DEFAULT_INPUTS`

---

## Required defaults

| Asset Class | Default Rate | Min | Max | Source Basis |
|------------|-------------|-----|-----|-------------|
| Cash | 3.5% | 1% | 6% | BoE base rate less savings drag |
| ISA (equities) | 6.5% | 2% | 10% | FCA mid (5%) to long-run nominal (7.5%) |
| Pension (drawdown) | 4.5% | 2% | 9% | De-risked 60/40 blend for decumulation |
| Property (investment) | 3.0% | 0% | 7% | Land Registry long-run; capital only |
| Property (residential) | 3.0% | 0% | 7% | Land Registry long-run |
| AIM shares | 5.0% | -5% | 15% | Main market discount; high dispersion |
| VCT (NAV) | 3.0% | -5% | 8% | Capital modest; dividends are the return |
| EIS | N/A | N/A | N/A | Scenario-based — not a single rate |

Inflation default should be 2.5% (above FCA's 2% regulatory assumption to reflect near-term stickiness).

---

## Acceptance criteria

1. Creating a new asset with class "isa" auto-populates growth rate to 6.5%
2. Changing that asset's class to "cash" updates the growth rate to 3.5%
3. An asset with a growth rate the user has already set is never overwritten by a default
4. Overriding growth rate to 12% on an ISA shows a warning (outside 2-10% range) but the value is accepted
5. Each growth rate field has a tooltip or info icon showing the source basis text
6. All defaults are stored in a single config file — not scattered across components
7. A fresh simulation uses 2.5% inflation by default

---

## Constraints

- Do not modify the simulation engine (`decumulation.ts`). Growth rates are already per-asset inputs — this phase only changes how defaults are populated in the UI.
- Do not modify tax logic, trust logic, or tax parameters.
- Do not add a new asset class field to distinguish cash ISA from stocks & shares ISA. Instead, add a UI note on ISA assets suggesting the cash rate (3.5%) for cash ISAs.
- Do not block user overrides. Warnings only.

---

## Source reference

Full research with FCA, ONS, Barclays, Vanguard, and AIC data is in `docs/Asset Growth into Unlock.docx`.
