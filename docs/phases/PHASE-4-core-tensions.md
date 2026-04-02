# Phase 4: Core Tensions Framework

**Effort:** 1-2 days | **Dependencies:** None (these 4 tensions do not depend on EIS rework) | **Risk:** Medium

---

## Feature

A tension detection engine that identifies when a user's financial goals conflict with each other, and presents the conflicts as decision cards with plain-English explanations, quantified financial impact, and resolution options that reconfigure the plan.

This phase implements the framework and the first 4 tensions. Later phases add the remaining 10 (most of which depend on the EIS rework).

---

## What a tension is

A tension arises when two or more of the user's goals are in conflict — either impossible to achieve simultaneously, or achievable only by sacrificing one to serve the other. The tool detects tensions automatically and surfaces them with a helper question and response options that immediately reconfigure the plan.

---

## Current state

- The app has a `warningEvaluator.ts` that checks for data quality issues (missing dates, incorrect flags) and portfolio health (shortfall, legacy at risk, BPR timing)
- There is a `legacy_target` input and a `cash_reserve` input
- There is no concept of goal conflicts, no goal capture beyond legacy and cash floor, no resolution actions
- When legacy is at risk, the engine automatically boosts IHT-preservation weights — but does not tell the user about the trade-off

---

## Required behaviour

### Goal capture

Add the following inputs to the simulation settings. These are soft targets — optimisation objectives, not hard constraints:

- `risk_tolerance`: 'conservative' | 'balanced' | 'growth' — maps to equity allocation defaults
- `eis_annual_target`: the user's desired annual EIS subscription amount (separate from the EIS strategy amount, which is what they actually invest)
- `property_to_children`: boolean — whether the user intends to pass property to their children
- `care_cost_reserve`: a GBP amount reserved for potential care costs
- `charitable_giving_target`: annual or total charitable giving target

The existing `legacy_target` and `cash_reserve` fields already serve as goals.

Add a "Goals" section to the settings UI where these can be set. They should have sensible defaults (risk_tolerance: 'balanced', others: 0 or false).

### Tension detection engine

A function that runs AFTER the simulation completes. It takes the simulation inputs, results, asset register, and tax parameters, and returns an array of detected tensions.

Each tension has this shape:

```
TensionEvent {
  id                    — e.g. "T1A", "T1B"
  tier                  — 1 (blocking issue) or 2 (preference decision)
  isCompounding         — does this tension accumulate over the plan horizon?
  severity              — 'Info' | 'Material' | 'Critical'
  severityBasis         — what the impact is measured against
  severityScore         — ratio (null for rule-based tensions like T1A)
  firstTriggeredYear    — plan year (1-indexed) when the tension first bites
  impactOneOff          — GBP impact for non-compounding tensions (null otherwise)
  impactCumulative      — GBP impact for compounding tensions (null otherwise)
  linkedTensionIds      — other tensions this one is related to
  resolutionOptions     — array of actions the user can take
  primaryMessageParams  — data needed to render the helper text
}
```

Each resolution option has:
```
ResolutionOption {
  label          — what the user sees
  actionType     — 'apply_parameter_change' | 'accept_tradeoff' | 'run_comparison' | 'open_manual_edit'
  parameterChange — which inputs to change (null for accept/manual)
}
```

### Suppression rule

Not every tension is worth showing. Apply this filter:

- Compounding tensions: only show if `abs(impactCumulative) >= 25,000`
- Non-compounding tensions: only show if `abs(impactOneOff) >= 5,000`

Also suppress tensions for asset classes not in the user's register, and tensions already resolved by current settings.

### The 4 tensions to implement in this phase

**T1A — Plan depletion (Tier 1)**
- Trigger: `funded_years < plan_years`
- Impact: `unfunded_years x annual_income_target`
- Severity: always rule-based, minimum Material. 5+ unfunded years = Critical.
- Helper: "Your plan runs out of assets at age [X]. Reduce income, draw from property earlier, or adjust the plan horizon?"
- Resolutions: reduce income to sustainable level, plan a property downsize, adjust plan horizon, adjust manually

**T1B — Legacy shortfall (Tier 2)**
- Trigger: `net_estate_after_iht < legacy_target`
- Impact: `legacy_target - net_estate_after_iht`
- Severity: ratio of shortfall to legacy target
- Helper: "At current settings, your projected estate at age [X] is [Y] — [Z] below your target. Reduce income slightly? Adjust the target? Accept the shortfall?"
- Resolutions: reduce income, lower legacy target, accept shortfall, adjust manually

**T10 — Cash floor breach (Tier 1)**
- Trigger: cash assets drop below `cash_reserve` within the plan horizon
- Impact: the shortfall amount
- Severity: Critical if breach is within 5 years, Material otherwise
- Helper: "Your cash floor of [X] will be breached in approximately [Y] years. Reduce income, lower the floor, or sell a property asset sooner?"
- Resolutions: reduce income, lower cash floor, accelerate property disposal, adjust manually

**T4 — IHT vs income tax trade-off (Tier 2)**
- Trigger: Run the simulation with both IHT-optimised and tax-optimised strategies. If the difference in total tax paid vs difference in IHT bill are both material (above suppression threshold), the tension exists.
- Impact: the delta in total lifetime tax vs the delta in IHT
- Severity: ratio of impact to total plan value
- Helper: "Are you more focused on minimising your tax bills while you're alive, or on maximising what passes to your beneficiaries?"
- Resolutions: prioritise income tax (switch to tax-optimised), prioritise estate (switch to IHT-optimised), keep balanced, adjust manually
- Note: this tension requires running two counterfactual simulations. Cache the results.

### Tensions UI

Two-section panel, placed on the Analysis page:

**Section 1: "Issues to resolve"** — Tier 1 tensions. Shown first, prominently. These are things that will damage the plan regardless of preferences.

**Section 2: "Decisions to consider"** — Tier 2 tensions. Shown after. These are genuine trade-offs where the user chooses.

Never mix Tier 1 and Tier 2 in the same section.

Each tension is a card showing:
- Plain-English name of the conflict
- One sentence stating the conflict with real numbers from the simulation
- Helper question
- 2-3 resolution option buttons
- "Adjust manually" always last

Selecting a resolution option immediately applies the parameter change and re-runs the simulation. The tension card updates to show whether the conflict is resolved.

### Resolution loop

A resolution might fix one tension but trigger another. After applying a resolution and re-simulating, re-run tension detection. Cap at 3 cycles — if tensions are still unstable after 3 rounds, show whatever remains.

---

## Acceptance criteria

1. Goal capture UI exists in settings with all fields listed above
2. T1A fires when funded_years < plan_years, with correct impact calculation
3. T1B fires when net_estate_after_iht < legacy_target
4. T10 fires when cash drops below cash_reserve within the plan
5. T4 fires when IHT-optimised and tax-optimised strategies produce materially different outcomes
6. Tensions below suppression thresholds are not shown
7. Tier 1 tensions appear in "Issues to resolve" section, Tier 2 in "Decisions to consider"
8. Clicking a resolution option changes the plan parameters, re-runs the simulation, and updates the tension display
9. The resolution loop does not run more than 3 cycles
10. Existing warnings in `warningEvaluator.ts` continue to work independently

---

## Constraints

- Tension detection runs AFTER the simulation, not during. It reads results and compares against goals. It does not change the simulation engine.
- Keep existing warnings. Tensions are strategic (goal conflicts); warnings are tactical (data quality, threshold alerts). They serve different purposes.
- Consider moving the existing `LEGACY_FLOOR_AT_RISK` warning into T1B to avoid duplication, but do not remove other warnings.
- T4 requires counterfactual simulation runs. Use `runSimulation()` with modified strategy weights. Cache results to avoid re-running on every render.

---

## Source reference

- Tension framework specification: `docs/EIS into Unlock.docx`, Part 2
- Tension test fixtures (T1A, T10, T12 JSON payloads): `docs/Tensions for Unlock.docx`
- Use the test fixtures as acceptance tests — if the engine produces those payloads for the described scenarios, the implementation is correct
