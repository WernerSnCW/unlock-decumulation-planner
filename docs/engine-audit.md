# Engine Calculation Audit

**Date:** 2026-03-27
**Status:** Pending fixes

---

## Critical Issues

### 1. CGT Basic Rate Band Overstated by PA Amount
**File:** `taxLogic.ts`, line 206
**Severity:** HIGH — directly undercharges CGT

```typescript
// CURRENT (wrong):
const basicBandRemaining = Math.max(0, params.basic_rate_threshold - taxableIncome);

// CORRECT:
const basicBandRemaining = Math.max(0, (params.basic_rate_threshold - params.personal_allowance) - taxableIncome);
```

Uses `basic_rate_threshold` (50,270) instead of the band width (37,700). Since `taxableIncome` is already net of PA, this overstates the basic band remaining by 12,570. Too much gain is taxed at 18% instead of 24%.

**Example:** On a £50k gain with £20k taxable income, CGT is undercharged by ~£754/year.

Additionally, the caller (decumulation.ts line 1132) uses `params.personal_allowance` directly without applying the PA taper for high earners (>£100k), compounding this issue.

---

### 2. VCT Relief Not Capped at Income Tax Liability
**File:** `decumulation.ts`, ~line 922
**Severity:** HIGH — overstates tax benefits

```typescript
// CURRENT (no cap):
const relief = newAllocation * reliefRate;
vctAnnualRelief = relief;

// SHOULD mirror EIS which caps at estTaxForCap (line 772)
```

EIS relief is correctly capped at the investor's estimated tax bill, but VCT relief has no such cap. A large VCT investment (e.g. £200k at 30% = £60k relief) could generate relief exceeding the investor's actual tax liability (e.g. £20k), which isn't allowed.

---

### 3. Missing Residence Nil Rate Band (RNRB)
**File:** `taxLogic.ts`, `calculateIHTBill` function
**Severity:** HIGH — overstates IHT by up to £70,000

Only the standard NRB (£325k) is used. The UK RNRB (up to £175k) is available when:
- The estate includes a residential property
- The property is left to direct descendants (children, grandchildren)

**Fix:** Add RNRB fields to `taxParameters.json` and apply in `calculateIHTBill`. May need a new input flag (`has_residential_property_for_descendants` or similar) since not all estates qualify.

---

### 4. PET Taper Relief Function Exists But Is Never Called
**File:** `trustLogic.ts` (function defined), never imported/called elsewhere
**Severity:** HIGH — overstates IHT on gifts made 3-7 years ago

The `getPETTaperRate` function returns correct UK taper percentages:
- 0-3 years: 0% relief (full 40% IHT)
- 3-4 years: 20% relief
- 4-5 years: 40% relief
- 5-6 years: 60% relief
- 6-7 years: 80% relief
- 7+ years: 100% relief (falls out of estate)

But this function is **never called** in the IHT calculation. All PETs within 7 years are taxed at the full 40% rate.

**Fix:** In the IHT calculation, when computing the chargeable amount from gifts within 7 years, apply `getPETTaperRate` to reduce the tax on older gifts.

---

### 5. Potential Income Double-Counting with Growth Rate
**File:** `decumulation.ts`, ~lines 646-689
**Severity:** MEDIUM — could systematically overstate portfolio values

Growth is applied first (`asset.value *= (1 + asset.growthRate)`), then `income_generated` is extracted separately. If the growth rate represents *total return* (capital appreciation + income yield), the income is counted twice:
1. Once in the growth multiplier (asset value increases by total return)
2. Again as explicit cash extracted (`income_generated`)

**Fix options:**
- Document that `assumed_growth_rate` should be capital-only growth (exclude income yield)
- OR subtract income yield from growth before applying: `asset.value *= (1 + asset.growthRate - incomeYield)`
- Add a tooltip/help text in the asset editor to clarify

---

### 6. Funded Years Overcounts After a Gap
**File:** `decumulation.ts`, ~line 1216
**Severity:** MEDIUM — misleading summary metric

If spending is met for years 1-5, fails in year 6, then met again for years 7-10, `fundedYears` reports 10 even though year 6 had a shortfall.

```typescript
// CURRENT:
if (spendMet && !isShadow) {
  fundedYears = planYear;  // Always updates to latest funded year
}
```

`firstShortfallYear` is correct (stays at 6), but `fundedYears = 10` is misleading.

**Fix:** Only count consecutive funded years from the start, or clearly label as "last funded year" rather than "total funded years".

---

## Minor Issues

### 7. Gross-Up Always Uses Year 1 Tax Params
**File:** `decumulation.ts`, line 495
The net-to-gross income conversion uses year 1 tax parameters regardless of plan year. If tax rates change mid-plan (as they do between 2025/26 and 2026/27), the gross-up is slightly inaccurate for later years.

### 8. No Annual Gift Exemption Carry-Forward
**File:** `decumulation.ts`, ~line 705
The UK £3,000 annual gift exemption can carry forward one unused year. This carry-forward is not modelled. Minor impact for most scenarios.

### 9. Hardcoded NRB in Warning Evaluator
**File:** `warningEvaluator.ts`, lines 147, 153, 157
Uses hardcoded 325,000 instead of reading from tax parameters. Would break if NRB changes.

### 10. Hardcoded Base Year 2025
**File:** `warningEvaluator.ts`, lines 165, 178
`const currentCalendarYear = 2025 + snapshot.planYear - 1` assumes the plan always starts in tax year 2025/26.

### 11. No Secondary CGT on Tax Payments
**File:** `decumulation.ts`, ~lines 1136-1159
When assets are sold to pay income tax and CGT, those sales could themselves generate additional CGT on unwrapped assets. This secondary tax is not computed, mildly understating total tax.

### 12. EIS Deferred Gains Only Crystallize at Exactly Year 7
**File:** `decumulation.ts`, ~lines 853-858
The deferred gain trigger fires at `yearsHeld === 7` only. If the EIS cohort is held past year 7 without disposal, the deferred gain is never crystallized.

### 13. VCT Worst-Case Model Goes to Zero at 10+ Years
**File:** `decumulation.ts`, ~line 968
Linear loss model: `1 - 0.50 * (yearsHeld / 5)` reaches zero at year 10. Cohorts held longer show zero value, which is overly pessimistic since liquidation happens at year 5.

### 14. BPR Warning Only Fires in Plan Years 1-2
**File:** `warningEvaluator.ts`, line 166
The `planYear <= 2` constraint suppresses BPR qualification warnings for later years, even if an asset doesn't qualify until year 4+.

### 15. PSA Band Determination Edge Case
**File:** `taxLogic.ts`, lines 101-106
For savings income that straddles multiple tax bands, the PSA is determined at the start position. Generally correct but edge cases with income exactly at band boundaries could produce slightly wrong PSA allocation.

### 16. `getParamsForYear` Fallback Returns Last Entry
**File:** `taxLogic.ts`, line 53
If `planYear` is 0 or negative, returns the last schedule entry instead of the first. Low practical risk since planYear starts at 1.

---

## Verification Notes

### Tax Parameters to Verify (taxParameters.json)
- 2026/27 dividend rates: basic 10.75%, higher 35.75% — confirm against announced UK policy
- 2026/27 CGT rates: 18%/24% — confirm unchanged
- All thresholds for 2026/27 tax year

### Architecture Notes
- Simulation runs client-side in the browser
- Tax parameters are in `data/taxParameters.json` with a schedule for years 1 and 2 (2025/26 and 2026/27)
- The optimiser runs multiple simulations with different weights to find the best strategy
