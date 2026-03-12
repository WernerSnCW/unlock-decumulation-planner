import type { TaxParametersFile, Toggles, TaxParams } from './taxLogic';
import { getParamsForYear, calculateIncomeTax, calculatePCLS, calculateCGT, calculateIHTBill } from './taxLogic';
import type { GiftHistoryEntry } from './trustLogic';
import { getCLTCumulative, checkNEFI } from './trustLogic';
import { evaluateYearWarnings, evaluateRegisterWarnings } from './warningEvaluator';
import type { Warning, YearSnapshot } from './warningEvaluator';

export interface Asset {
  asset_id: string;
  wrapper_type: string;
  asset_class: string;
  label: string;
  current_value: number;
  acquisition_date: string | null;
  acquisition_cost: number | null;
  tax_relief_claimed: number;
  assumed_growth_rate: number;
  income_generated: number;
  is_iht_exempt: boolean;
  bpr_qualifying_date: string | null;
  bpr_last_reviewed: string | null;
  cgt_exempt_date: string | null;
  mortgage_balance: number;
  pension_type: string | null;
  tfls_used_amount: number;
  mpaa_triggered: boolean;
  in_drawdown: boolean;
  flexible_isa: boolean;
  deferred_gain_amount: number | null;
  relief_claimed_type: string;
  allowable_improvement_costs: number;
  estimated_disposal_cost_pct: number;
  estimated_disposal_cost_amount: number | null;
}

export type DrawdownStrategy = 'tax_optimised' | 'iht_optimised' | 'income_first' | 'growth_first';
export type LifestyleMultiplier = 'modest' | 'comfortable' | 'generous' | 'unlimited';
export type GiftType = 'discretionary_trust' | 'pet' | 'nefi';

export interface PriorityWeights {
  tax_efficiency: number;
  iht_reduction: number;
  preserve_growth: number;
  liquidity: number;
}

export const STRATEGY_PRESETS: Record<DrawdownStrategy, PriorityWeights> = {
  tax_optimised:  { tax_efficiency: 0.70, iht_reduction: 0.10, preserve_growth: 0.10, liquidity: 0.10 },
  iht_optimised:  { tax_efficiency: 0.10, iht_reduction: 0.70, preserve_growth: 0.10, liquidity: 0.10 },
  income_first:   { tax_efficiency: 0.15, iht_reduction: 0.10, preserve_growth: 0.05, liquidity: 0.70 },
  growth_first:   { tax_efficiency: 0.15, iht_reduction: 0.10, preserve_growth: 0.60, liquidity: 0.15 },
};

export interface SimulationInputs {
  annual_income_target: number;
  plan_years: number;
  lifestyle_multiplier: LifestyleMultiplier;
  current_age: number;
  inflation_rate: number;
  priority_weights: PriorityWeights;
  annual_gift_amount: number;
  gift_type: GiftType;
  state_pension_annual: number;
  apply_2026_bpr_cap: boolean;
  apply_2027_pension_iht: boolean;
}

export interface YearResult {
  year: number;
  planYear: number;
  age: number;
  totalPortfolioValue: number;
  ihtExemptTotal: number;
  estimatedIHTBill: number;
  incomeTaxThisYear: number;
  cgtThisYear: number;
  spendTargetNominal: number;
  spendMet: boolean;
  shortfall: number;
  baselineCashIncome: number;
  giftedThisYear: number;
  clt7yrCumulative: number;
  tflsRemaining: number;
  drawsByAsset: Record<string, number>;
  valuesByAssetClass: Record<string, number>;
  flags: Warning[];
  isShadow: boolean;
}

export interface SimulationSummary {
  funded_years: number;
  fully_funded: boolean;
  first_shortfall_year: number | null;
  total_spent: number;
  total_income_tax_paid: number;
  total_cgt_paid: number;
  total_tax_paid: number;
  total_gifted: number;
  estate_at_end: number;
  iht_at_end: number;
  iht_saving_vs_no_plan: number;
  shadow_funded_years: number;
}

export interface SimulationResult {
  perYear: YearResult[];
  summary: SimulationSummary;
  registerWarnings: Warning[];
}

const LIFESTYLE_MULTIPLIERS: Record<LifestyleMultiplier, number> = {
  modest: 0.7,
  comfortable: 1.0,
  generous: 1.5,
  unlimited: 2.2
};

function scoreAssetForDrawdown(asset: AssetState, weights: PriorityWeights, planYear: number, toggles: Toggles): number {
  const calendarYear = 2025 + planYear - 1;

  const taxCostOrder: Record<string, number> = {
    cash: 0.9,
    isa: 1.0,
    pension: 0.5,
    vct: 0.85,
    eis: 0.6,
    aim_shares: 0.4,
    property_investment: 0.3,
  };
  const taxScore = taxCostOrder[asset.assetClass] ?? 0.5;

  let ihtScore = 0;
  if (asset.isIHTExempt) {
    ihtScore = 0.2;
  } else {
    ihtScore = 0.8;
  }
  const pensionInEstate = toggles.apply_2027_pension_iht && calendarYear >= 2027;
  if (asset.assetClass === 'pension') {
    ihtScore = pensionInEstate ? 0.95 : 0.1;
  }

  const maxGrowth = 0.12;
  const preserveGrowthScore = 1 - Math.min(asset.growthRate / maxGrowth, 1);

  const liquidityOrder: Record<string, number> = {
    cash: 1.0,
    isa: 0.85,
    aim_shares: 0.7,
    vct: 0.5,
    eis: 0.4,
    pension: 0.3,
    property_investment: 0.1,
  };
  const liquidityScore = liquidityOrder[asset.assetClass] ?? 0.5;

  return (
    weights.tax_efficiency * taxScore +
    weights.iht_reduction * ihtScore +
    weights.preserve_growth * preserveGrowthScore +
    weights.liquidity * liquidityScore
  );
}

function getDrawdownPriority(weights: PriorityWeights, assets: AssetState[], planYear: number, toggles: Toggles): string[] {
  return assets
    .filter(a => a.value > 0)
    .map(a => ({ id: a.id, score: scoreAssetForDrawdown(a, weights, planYear, toggles) }))
    .sort((a, b) => b.score - a.score)
    .map(a => a.id);
}

interface AssetState {
  id: string;
  assetClass: string;
  wrapperType: string;
  label: string;
  value: number;
  acquisitionCost: number | null;
  growthRate: number;
  incomeGenerated: number;
  isIHTExempt: boolean;
  bprQualifyingDate: string | null;
  pensionType: string | null;
  taxReliefClaimed: number;
  reliefClaimedType: string;
  deferredGainAmount: number | null;
  mortgageBalance: number;
  allowableImprovementCosts: number;
  estimatedDisposalCostPct: number;
  cgtExemptDate: string | null;
}

export function runSimulation(inputs: SimulationInputs, register: Asset[], taxParams: TaxParametersFile): SimulationResult {
  const registerWarnings = evaluateRegisterWarnings(register);

  if (register.length === 0) {
    return {
      perYear: [],
      summary: {
        funded_years: 0,
        fully_funded: false,
        first_shortfall_year: 1,
        total_spent: 0,
        total_income_tax_paid: 0,
        total_cgt_paid: 0,
        total_tax_paid: 0,
        total_gifted: 0,
        estate_at_end: 0,
        iht_at_end: 0,
        iht_saving_vs_no_plan: 0,
        shadow_funded_years: 0
      },
      registerWarnings
    };
  }

  const multiplier = LIFESTYLE_MULTIPLIERS[inputs.lifestyle_multiplier];
  const toggles: Toggles = {
    apply_2026_bpr_cap: inputs.apply_2026_bpr_cap,
    apply_2027_pension_iht: inputs.apply_2027_pension_iht
  };

  let assets: AssetState[] = register.map(a => ({
    id: a.asset_id,
    assetClass: a.asset_class,
    wrapperType: a.wrapper_type,
    label: a.label,
    value: a.current_value,
    acquisitionCost: a.acquisition_cost,
    growthRate: a.assumed_growth_rate,
    incomeGenerated: a.income_generated,
    isIHTExempt: a.is_iht_exempt,
    bprQualifyingDate: a.bpr_qualifying_date,
    pensionType: a.pension_type,
    taxReliefClaimed: a.tax_relief_claimed,
    reliefClaimedType: a.relief_claimed_type,
    deferredGainAmount: a.deferred_gain_amount,
    mortgageBalance: a.mortgage_balance,
    allowableImprovementCosts: a.allowable_improvement_costs,
    estimatedDisposalCostPct: a.estimated_disposal_cost_pct,
    cgtExemptDate: a.cgt_exempt_date
  }));

  let tflsRemaining = taxParams.schedule[0].tfls_lifetime_limit - (register.find(a => a.pension_type)?.tfls_used_amount ?? 0);
  const giftHistory: GiftHistoryEntry[] = [];
  const shadowHorizon = Math.max(inputs.plan_years, 90 - inputs.current_age);
  const perYear: YearResult[] = [];

  let totalSpent = 0;
  let totalIncomeTax = 0;
  let totalCGT = 0;
  let totalGifted = 0;
  let fundedYears = 0;
  let firstShortfallYear: number | null = null;

  for (let planYear = 1; planYear <= shadowHorizon; planYear++) {
    const isShadow = planYear > inputs.plan_years;
    const params = getParamsForYear(taxParams, planYear);
    const calendarYear = 2025 + planYear - 1;
    const age = inputs.current_age + planYear - 1;
    const inflationFactor = Math.pow(1 + inputs.inflation_rate, planYear - 1);
    const spendTarget = inputs.annual_income_target * multiplier * inflationFactor;

    // Step 1: Apply growth to all assets
    for (const asset of assets) {
      asset.value *= (1 + asset.growthRate);
    }

    // Step 2: Collect baseline income (interest, rent, dividends)
    let baselineCashIncome = inputs.state_pension_annual;
    let rentalIncome = 0;
    let savingsIncome = 0;
    let dividendIncome = 0;

    for (const asset of assets) {
      if (asset.value <= 0) continue;
      const income = asset.incomeGenerated;
      if (income <= 0) continue;

      if (asset.assetClass === 'cash') {
        savingsIncome += income;
      } else if (asset.assetClass === 'property_investment') {
        rentalIncome += income;
      } else if (asset.assetClass === 'vct' || asset.assetClass === 'eis' || asset.assetClass === 'aim_shares') {
        dividendIncome += income;
      }
      baselineCashIncome += income;
    }

    // Step 3: Calculate remaining needed from drawdowns (including estimated tax)
    let remaining = Math.max(0, spendTarget - baselineCashIncome);

    // Step 4: Apply gifting
    let giftedThisYear = 0;
    if (inputs.annual_gift_amount > 0) {
      const exemption = Math.min(inputs.annual_gift_amount, params.annual_gift_exemption);
      const classifiable = inputs.annual_gift_amount - exemption;

      if (inputs.gift_type === 'discretionary_trust' || inputs.gift_type === 'pet') {
        giftHistory.push({ year: planYear, amount: classifiable });
      }

      giftedThisYear = inputs.annual_gift_amount;
      remaining += inputs.annual_gift_amount;
    }

    // Step 5: Draw from assets in priority order
    const drawsByAsset: Record<string, number> = {};
    const priority = getDrawdownPriority(inputs.priority_weights, assets, planYear, toggles);
    let pensionDrawTaxable = 0;
    let totalCGTGain = 0;
    let totalDeferredGainRealized = 0;

    for (const assetId of priority) {
      if (remaining <= 0) break;
      const asset = assets.find(a => a.id === assetId);
      if (!asset || asset.value <= 0) continue;

      const draw = Math.min(remaining, asset.value);
      asset.value -= draw;
      drawsByAsset[assetId] = (drawsByAsset[assetId] || 0) + draw;
      remaining -= draw;

      if (asset.assetClass === 'pension') {
        const pclsResult = calculatePCLS(draw, tflsRemaining);
        tflsRemaining = pclsResult.newRemainingLSA;
        pensionDrawTaxable += pclsResult.taxableDraw;
      } else if (asset.wrapperType === 'unwrapped' && asset.assetClass !== 'cash') {
        if (asset.assetClass === 'vct') {
          const acquisitionDate = register.find(r => r.asset_id === asset.id)?.acquisition_date;
          if (acquisitionDate) {
            const yearsHeld = calendarYear - new Date(acquisitionDate).getFullYear();
            if (yearsHeld < 5 && asset.reliefClaimedType !== 'none') {
              const preDrawValue = draw + asset.value;
              const proportion = preDrawValue > 0 ? draw / preDrawValue : 1;
              pensionDrawTaxable += asset.taxReliefClaimed * proportion;
            }
          }
        } else if (asset.assetClass === 'eis') {
          if (asset.cgtExemptDate) {
            const exemptYear = new Date(asset.cgtExemptDate).getFullYear();
            if (calendarYear < exemptYear) {
              const costBasis = asset.acquisitionCost ?? 0;
              const preDrawValue = draw + asset.value;
              const proportion = preDrawValue > 0 ? draw / preDrawValue : 1;
              const allocatedCost = costBasis * proportion;
              const gain = draw - allocatedCost;
              if (gain > 0) totalCGTGain += gain;
              if (asset.acquisitionCost !== null) {
                asset.acquisitionCost -= allocatedCost;
              }
            }
          }
          if (asset.deferredGainAmount && asset.deferredGainAmount > 0) {
            const preDrawValue = draw + asset.value;
            const proportion = preDrawValue > 0 ? draw / preDrawValue : 1;
            const deferredRealized = asset.deferredGainAmount * proportion;
            totalDeferredGainRealized += deferredRealized;
            asset.deferredGainAmount -= deferredRealized;
          }
        } else if (asset.assetClass === 'property_investment') {
          const preDrawValue = draw + asset.value;
          const costBasis = asset.acquisitionCost ?? preDrawValue * 0.5;
          const proportion = preDrawValue > 0 ? draw / preDrawValue : 1;
          const allocatedCost = costBasis * proportion;
          const improvements = asset.allowableImprovementCosts * proportion;
          const disposalCost = draw * asset.estimatedDisposalCostPct;
          const gain = draw - allocatedCost - improvements - disposalCost;
          if (gain > 0) totalCGTGain += gain;
          if (asset.acquisitionCost !== null) {
            asset.acquisitionCost -= allocatedCost;
          }
          asset.allowableImprovementCosts -= improvements;
        } else if (asset.assetClass === 'aim_shares') {
          const costBasis = asset.acquisitionCost ?? 0;
          const preDrawValue = draw + asset.value;
          const proportion = preDrawValue > 0 ? draw / preDrawValue : 1;
          const allocatedCost = costBasis * proportion;
          const gain = draw - allocatedCost;
          if (gain > 0) totalCGTGain += gain;
          if (asset.acquisitionCost !== null) {
            asset.acquisitionCost -= allocatedCost;
          }
        }
      }
    }

    // Step 6: Calculate taxes
    const nonSavingsIncome = inputs.state_pension_annual + rentalIncome + pensionDrawTaxable + totalDeferredGainRealized;
    const incomeTax = calculateIncomeTax(nonSavingsIncome, savingsIncome, dividendIncome, params);
    const taxableIncomeAfterPA = Math.max(0, (nonSavingsIncome + savingsIncome + dividendIncome) - params.personal_allowance);
    const cgt = calculateCGT(totalCGTGain, taxableIncomeAfterPA, params);

    // Step 6b: Deduct tax liabilities from portfolio (draw from most liquid first)
    let taxToPay = incomeTax + cgt;
    const taxPayPriority = [...assets]
      .filter(a => a.value > 0)
      .sort((a, b) => {
        const liq: Record<string, number> = { cash: 0, isa: 1, pension: 5, vct: 3, eis: 4, aim_shares: 2, property_investment: 6 };
        return (liq[a.assetClass] ?? 99) - (liq[b.assetClass] ?? 99);
      });
    for (const asset of taxPayPriority) {
      if (taxToPay <= 0) break;
      const deduction = Math.min(taxToPay, asset.value);
      asset.value -= deduction;
      taxToPay -= deduction;
    }

    // Step 7: Calculate portfolio totals
    const valuesByAssetClass: Record<string, number> = {};
    for (const asset of assets) {
      const cls = asset.assetClass;
      valuesByAssetClass[cls] = (valuesByAssetClass[cls] || 0) + Math.max(0, asset.value);
    }
    const totalPortfolioValue = assets.reduce((sum, a) => sum + Math.max(0, a.value), 0);
    const pensionValue = valuesByAssetClass['pension'] || 0;

    // Step 8: Calculate IHT
    let bprTotal = 0;
    for (const asset of assets) {
      if (asset.isIHTExempt && asset.value > 0) {
        if (asset.bprQualifyingDate) {
          const qualifyingYear = new Date(asset.bprQualifyingDate).getFullYear();
          if (calendarYear >= qualifyingYear) {
            bprTotal += asset.value;
          }
        } else {
          bprTotal += asset.value;
        }
      }
    }

    const cltCumulative = getCLTCumulative(giftHistory, planYear);
    const estateWithoutPension = totalPortfolioValue - pensionValue;
    const ihtBill = calculateIHTBill(estateWithoutPension, bprTotal, cltCumulative, pensionValue, toggles, params, calendarYear);

    const ihtExemptTotal = bprTotal;
    const actualSpend = spendTarget - remaining;
    const spendMet = remaining <= 0.01;
    const shortfall = Math.max(0, remaining);

    if (spendMet && !isShadow) {
      fundedYears = planYear;
    } else if (!spendMet && firstShortfallYear === null) {
      firstShortfallYear = planYear;
      if (!isShadow && fundedYears < planYear) {
        fundedYears = planYear - 1;
      }
    }

    totalSpent += actualSpend;
    totalIncomeTax += incomeTax;
    totalCGT += cgt;
    totalGifted += giftedThisYear;

    // Step 9: Evaluate warnings
    const snapshot: YearSnapshot = {
      year: calendarYear,
      planYear,
      totalPortfolioValue,
      ihtBill,
      spendTarget,
      spendMet,
      shortfall,
      cltCumulative,
      tflsRemaining,
      drawsByAsset,
      flags: [],
      currentAge: age
    };

    const yearWarnings = evaluateYearWarnings(snapshot, register, toggles, inputs.plan_years);

    perYear.push({
      year: calendarYear,
      planYear,
      age,
      totalPortfolioValue,
      ihtExemptTotal,
      estimatedIHTBill: ihtBill,
      incomeTaxThisYear: incomeTax,
      cgtThisYear: cgt,
      spendTargetNominal: spendTarget,
      spendMet,
      shortfall,
      baselineCashIncome,
      giftedThisYear,
      clt7yrCumulative: cltCumulative,
      tflsRemaining,
      drawsByAsset,
      valuesByAssetClass,
      flags: yearWarnings,
      isShadow
    });
  }

  if (firstShortfallYear === null) {
    fundedYears = inputs.plan_years;
  }

  const shadowFundedYears = firstShortfallYear ? firstShortfallYear - 1 : shadowHorizon;
  const lastYear = perYear[perYear.length - 1];
  const fullyFunded = fundedYears >= inputs.plan_years && shadowFundedYears >= shadowHorizon;

  return {
    perYear,
    summary: {
      funded_years: fundedYears,
      fully_funded: fullyFunded,
      first_shortfall_year: firstShortfallYear,
      total_spent: totalSpent,
      total_income_tax_paid: totalIncomeTax,
      total_cgt_paid: totalCGT,
      total_tax_paid: totalIncomeTax + totalCGT,
      total_gifted: totalGifted,
      estate_at_end: lastYear?.totalPortfolioValue ?? 0,
      iht_at_end: lastYear?.estimatedIHTBill ?? 0,
      iht_saving_vs_no_plan: 0,
      shadow_funded_years: shadowFundedYears
    },
    registerWarnings
  };
}
