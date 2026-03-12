import type { Asset } from './decumulation';
import type { Toggles } from './taxLogic';

export interface Warning {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface YearSnapshot {
  year: number;
  planYear: number;
  totalPortfolioValue: number;
  ihtBill: number;
  spendTarget: number;
  spendMet: boolean;
  shortfall: number;
  cltCumulative: number;
  tflsRemaining: number;
  drawsByAsset: Record<string, number>;
  flags: string[];
  currentAge: number;
}

export function evaluateRegisterWarnings(register: Asset[]): Warning[] {
  const warnings: Warning[] = [];

  for (const asset of register) {
    if (!asset.acquisition_date) {
      warnings.push({
        id: `MISSING_ACQUISITION_DATE_${asset.asset_id}`,
        severity: 'error',
        message: `${asset.label}: Missing acquisition date — CGT calculation may be inaccurate.`
      });
    }
    if (asset.acquisition_cost === null || asset.acquisition_cost === undefined) {
      warnings.push({
        id: `MISSING_ACQUISITION_COST_${asset.asset_id}`,
        severity: 'error',
        message: `${asset.label}: Missing acquisition cost — CGT calculation will use estimate.`
      });
    }
  }

  return warnings;
}

export function evaluateYearWarnings(
  snapshot: YearSnapshot,
  register: Asset[],
  toggles: Toggles,
  _planYears: number
): Warning[] {
  const warnings: Warning[] = [];

  if (!snapshot.spendMet) {
    warnings.push({
      id: `SHORTFALL_YEAR_${snapshot.planYear}`,
      severity: 'error',
      message: `Shortfall of £${formatMoney(snapshot.shortfall)} in year ${snapshot.planYear} (age ${snapshot.currentAge}).`
    });
  }

  if (snapshot.cltCumulative >= 325000) {
    warnings.push({
      id: `CLT_BREACHED_${snapshot.planYear}`,
      severity: 'error',
      message: `CLT 7-year cumulative (£${formatMoney(snapshot.cltCumulative)}) exceeds nil-rate band (£325,000). Lifetime IHT charge applies.`
    });
  } else if (snapshot.cltCumulative >= 260000) {
    warnings.push({
      id: `CLT_APPROACHING_${snapshot.planYear}`,
      severity: 'warning',
      message: `CLT 7-year cumulative (£${formatMoney(snapshot.cltCumulative)}) approaching nil-rate band (£325,000).`
    });
  }

  for (const asset of register) {
    if (asset.asset_class === 'vct' || asset.asset_class === 'eis' || asset.asset_class === 'aim_shares') {
      if (asset.bpr_qualifying_date) {
        const qualifyingYear = new Date(asset.bpr_qualifying_date).getFullYear();
        const currentCalendarYear = 2025 + snapshot.planYear - 1;
        if (currentCalendarYear < qualifyingYear && snapshot.planYear <= 2) {
          warnings.push({
            id: `BPR_NOT_YET_QUALIFYING_${asset.asset_id}_${snapshot.planYear}`,
            severity: 'warning',
            message: `${asset.label}: BPR not yet qualifying until ${asset.bpr_qualifying_date}. Disposal before then loses IHT relief.`
          });
        }
      }
    }
  }

  if (toggles.apply_2026_bpr_cap && snapshot.planYear === 1) {
    warnings.push({
      id: 'SCENARIO_2026_BPR',
      severity: 'info',
      message: 'Scenario: April 2026 BPR cap at £1M (50% relief above) is active.'
    });
  }

  if (toggles.apply_2027_pension_iht && snapshot.planYear <= 2) {
    const calendarYear = 2025 + snapshot.planYear - 1;
    if (calendarYear >= 2027) {
      warnings.push({
        id: `SCENARIO_2027_PENSION_IHT_${snapshot.planYear}`,
        severity: 'info',
        message: 'Scenario: From April 2027 undrawn pension included in IHT estate.'
      });
    }
  }

  return warnings;
}

function formatMoney(value: number): string {
  return Math.round(value).toLocaleString('en-GB');
}
