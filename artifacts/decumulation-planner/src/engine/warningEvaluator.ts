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
  legacyAtRisk: boolean;
  legacyTarget: number;
  netEstateProjected: number;
}

export function evaluateRegisterWarnings(register: Asset[]): Warning[] {
  const warnings: Warning[] = [];

  for (const asset of register) {
    if (asset.asset_class === 'vct' && asset.is_iht_exempt) {
      warnings.push({
        id: `VCT_IHT_EXEMPT_FLAG_INCORRECT_${asset.asset_id}`,
        severity: 'error',
        message: `${asset.label}: VCT holdings cannot qualify for Business Property Relief (HMRC IHTM18113). The is_iht_exempt flag is incorrectly set. VCTs are in your estate at full value for IHT.`
      });
    }

    if (asset.asset_class === 'vct' && !asset.acquisition_date) {
      warnings.push({
        id: `MISSING_ACQUISITION_DATE_${asset.asset_id}`,
        severity: 'error',
        message: `${asset.label}: Acquisition date missing — 5-year hold clock and relief clawback clock cannot be calculated.`
      });
    }

    if ((asset.asset_class === 'eis' || asset.asset_class === 'aim_shares') && !asset.acquisition_date) {
      warnings.push({
        id: `MISSING_ACQUISITION_DATE_${asset.asset_id}`,
        severity: 'error',
        message: `${asset.label}: Acquisition date missing — BPR qualifying date and CGT exemption clock cannot be determined.`
      });
    }

    if (asset.acquisition_cost === null || asset.acquisition_cost === undefined) {
      const cgtApplies = ['property_investment', 'aim_shares'].includes(asset.asset_class) ||
        (asset.asset_class === 'eis' && asset.cgt_exempt_date !== null);
      if (cgtApplies) {
        warnings.push({
          id: `MISSING_ACQUISITION_COST_${asset.asset_id}`,
          severity: 'error',
          message: `${asset.label}: Acquisition cost missing — CGT cannot be calculated for this asset.`
        });
      }
    }

    if (asset.asset_class === 'vct' && asset.relief_claimed_type !== 'none' && asset.tax_relief_claimed > 0) {
      const subscriptionBasis = asset.original_subscription_amount ?? asset.acquisition_cost;
      if (subscriptionBasis && subscriptionBasis > 0) {
        const actualRate = asset.tax_relief_claimed / subscriptionBasis;
        const acquisitionDate = asset.acquisition_date ? new Date(asset.acquisition_date) : null;
        const isPost2026 = acquisitionDate && acquisitionDate >= new Date('2026-04-06');
        const expectedRate = isPost2026 ? 0.20 : 0.30;
        const tolerance = 0.02;
        if (Math.abs(actualRate - expectedRate) > tolerance) {
          warnings.push({
            id: `VCT_RELIEF_RATE_MISMATCH_${asset.asset_id}`,
            severity: 'warning',
            message: `${asset.label}: VCT relief rate appears to be ${(actualRate * 100).toFixed(1)}% but expected ${(expectedRate * 100).toFixed(0)}% for ${isPost2026 ? 'post' : 'pre'}-April 2026 subscriptions. Check tax_relief_claimed and original_subscription_amount.`
          });
        }
      }
    }

    if (asset.asset_class === 'eis' && (asset.relief_claimed_type === 'cgt_deferral' || asset.relief_claimed_type === 'both') && !asset.deferred_gain_amount) {
      warnings.push({
        id: `EIS_DEFERRED_GAIN_MISSING_${asset.asset_id}`,
        severity: 'warning',
        message: `${asset.label}: EIS lot may have a revived deferred CGT gain. revived_deferred_gain is missing — disposal-year CGT may be understated.`
      });
    }

    if ((asset.asset_class === 'eis' || asset.asset_class === 'aim_shares') && asset.bpr_last_reviewed) {
      const reviewDate = new Date(asset.bpr_last_reviewed);
      const now = new Date();
      const monthsSinceReview = (now.getFullYear() - reviewDate.getFullYear()) * 12 + (now.getMonth() - reviewDate.getMonth());
      if (monthsSinceReview > 12) {
        warnings.push({
          id: `BPR_LAST_REVIEWED_STALE_${asset.asset_id}`,
          severity: 'warning',
          message: `${asset.label}: BPR qualification was last reviewed more than 12 months ago. Confirm with adviser that qualification still holds.`
        });
      }
    }
  }

  const hasPension = register.some(a => a.pension_type);
  if (hasPension) {
    const pensionAsset = register.find(a => a.pension_type);
    if (pensionAsset && pensionAsset.current_value > 100000 && (pensionAsset.tfls_used_amount ?? 0) === 0) {
      warnings.push({
        id: 'PCLS_HISTORY_UNCERTAIN',
        severity: 'warning',
        message: `Pension has no TFLS history recorded. If you have previously taken tax-free cash from any pension scheme, update tfls_used_amount or future PCLS calculations will be overstated.`
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

  if (snapshot.legacyAtRisk) {
    warnings.push({
      id: `LEGACY_FLOOR_AT_RISK_${snapshot.planYear}`,
      severity: 'warning',
      message: `Legacy target of £${formatMoney(snapshot.legacyTarget)} may not be met. Net estate projected at £${formatMoney(snapshot.netEstateProjected)}. Living costs funded first — consider reducing spend or adjusting the target.`
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
    if (asset.asset_class === 'eis' || asset.asset_class === 'aim_shares') {
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

  if (toggles.apply_2026_bpr_cap) {
    const calendarYear = 2025 + snapshot.planYear - 1;
    if (calendarYear === 2026) {
      warnings.push({
        id: 'BPR_CAP_RULE_CHANGE_YEAR',
        severity: 'info',
        message: 'Proposed BPR/APR cap takes effect. IHT relief on combined EIS+AIM qualifying assets above £2.5M per estate is now modelled at 50%. VCT holdings are unaffected — they are not BPR-qualifying.'
      });
    }
    if (snapshot.planYear === 1) {
      warnings.push({
        id: 'SCENARIO_2026_BPR',
        severity: 'info',
        message: 'Scenario: April 2026 BPR cap at £2.5M (50% relief above) is active.'
      });
    }
  }

  if (toggles.apply_2027_pension_iht) {
    const calendarYear = 2025 + snapshot.planYear - 1;
    if (calendarYear === 2027) {
      warnings.push({
        id: 'PENSION_IHT_RULE_CHANGE_YEAR',
        severity: 'info',
        message: 'Proposed pension IHT rule change takes effect. Undrawn pension is now included in the estimated IHT calculation.'
      });
    }
  }

  return warnings;
}

function formatMoney(value: number): string {
  return Math.round(value).toLocaleString('en-GB');
}
