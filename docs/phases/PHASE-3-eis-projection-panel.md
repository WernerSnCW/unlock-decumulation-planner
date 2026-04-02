# Phase 3: EIS Projection Panel & UI

**Effort:** 1-2 days | **Dependencies:** Phase 2 must be complete | **Risk:** Medium

---

## Feature

A dedicated EIS projection panel that sits below the main plan charts on the Analysis page. It has its own chart, its own scenario controls, and runs independently from the main plan timeline but shares the same X-axis (years).

This panel replaces the current inline EIS comparison in the portfolio chart. The main portfolio chart should no longer include the EIS programme as a stacked area — EIS is a separate visual layer.

---

## Current state

- EIS comparison is shown as a dashed overlay line on the main portfolio chart (`PortfolioChart.tsx`) comparing two scenarios
- There is an `EISScenarioComparison.tsx` component on the Planning page that shows a 5-column table (No EIS, All Fail, Bear, Base Case, Bull)
- There is no dedicated EIS projection chart
- There are no exit horizon controls or reinvestment toggles

---

## Required behaviour

### EIS projection chart

The panel must display a chart with:

- **X-axis:** Years, aligned to the main plan timeline
- **Y-axis:** Portfolio value in GBP
- **Baseline band:** Horizontal band at net capital at risk (A = I - R) — this is the "you put this much in after relief" line
- **Below baseline:** Shaded zone representing loss relief value
- **Scenario 1 (All Fail):** Single flat line at N (net effective loss after all reliefs)
- **Scenarios 2 and 3 (Typical and Strong):** Shaded bands showing a range of outcomes, not single lines. Use the existing scenario multiples as guidance — the bear-to-bull range for the selected quality tier gives the band width
- **Exit horizon:** Vertical dashed line at the user's selected exit year
- **Confirmed exit events:** Dated point markers, visually distinct from the scenario lines

### Controls

- **Exit horizon slider:** 3 / 5 / 7 / 10 / 12+ years. Default: 7 years.
- **Reinvest / Harvest toggle**

### Reinvestment logic

When "Reinvest" is toggled on, all of the following must happen simultaneously:

1. Exit proceeds never touch the main plan cashflow
2. A new EIS lot is created with a fresh subscription date
3. New 30% income tax relief is applied (assumed eligible)
4. Fresh 3-year CGT exemption clock starts on the new lot
5. Fresh 2-year BPR qualifying clock starts on the new lot
6. Main plan income must be funded entirely from other assets during the reinvestment years

When reinvest is selected, surface a warning:

> "Reinvesting delays liquidity and extends your reliance on other assets for income. Your [cash/ISA/pension] will need to fund income for approximately [X] additional years."

### Failure timing

"All fail" does not mean everything fails in year 1. The default model distributes losses across years 2-6 of the holding period. Present this as a planning convention:

> "Default planning assumption: where all investments fail, losses are assumed to crystallise progressively across years 2-6 unless overridden in advanced settings."

The user should be able to override the distribution in advanced settings.

### "Stop waiting" prompt

After 10 years with no confirmed exit event recorded, the system should prompt:

> "Your EIS portfolio has had no confirmed exit in [X] years. If no exit occurs, the maximum value you should plan around is [N] after loss relief. Would you like to model this as a write-off?"

Two options: "Yes, model as write-off" (requires second confirmation) / "No, keep as active position."

This must never auto-write-off silently.

### Transition on first confirmed exit

When the first confirmed exit is recorded against any EIS company:
- The panel label changes from "Projection" to "Actual + projected"
- The chart shows confirmed events as point markers distinct from scenario lines
- The main plan receives the confirmed cash and recalculates

### Main plan banner

When the user has EIS in their portfolio, the main plan should display a banner:

> "Your EIS portfolio (net capital at risk: [amount]) is not included in your drawdown projections. See the EIS section below to model potential outcomes."

---

## Acceptance criteria

1. EIS projection panel appears on the Analysis page below the main charts when the user has EIS holdings
2. Three scenarios are visible simultaneously on the chart — all fail as a flat line, typical and strong as shaded bands
3. Exit horizon slider changes the vertical dashed line position and updates projections
4. Toggling "Reinvest" fires all 6 downstream effects and displays the warning
5. After 10 years with no confirmed exit, the stop-waiting prompt appears
6. Recording a confirmed exit changes the panel label and shows the exit as a point marker
7. The main portfolio chart no longer includes EIS programme as a stacked area
8. The EIS banner appears on the main plan when EIS is in the portfolio
9. Loss distribution defaults to years 2-6, not a year-1 cliff

---

## Constraints

- The EIS scenario comparison table on the Planning page can remain — it serves a different purpose (comparing plan-wide metrics across scenarios). This panel is about the EIS portfolio projection specifically.
- Do not change the EIS strategy configuration UI (quality tiers, allocation modes, etc.) — that stays in the settings bar on the Planning page.
- The EIS projection chart must share the same X-axis range (years) as the main plan charts so the user can visually align them.

---

## Source reference

Full specification is in `docs/EIS into Unlock.docx`, Part 1 (Layer 2: EIS projection panel, Scenario display, Horizon controls, Reinvestment toggle, Failure timing, Real data entry, Stop waiting).
