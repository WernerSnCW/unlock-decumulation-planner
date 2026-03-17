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
  original_subscription_amount: number | null;
  tax_relief_claimed: number;
  assumed_growth_rate: number;
  income_generated: number;
  reinvested_pct: number;
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
  disposal_type: 'none' | 'transfer';
  transfer_year: number | null;
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

export interface GloryYearsConfig {
  enabled: boolean;
  duration: number;
  multiplier: number;
  target_is_glory: boolean;
}

export interface StrategyMechanisms {
  preserve_eis_bpr: boolean;
  preserve_aim_bpr: boolean;
  preserve_vct_income: boolean;
  draw_isa_early: boolean;
  draw_pension_early: boolean;
  protect_property: boolean;
}

export const DEFAULT_MECHANISMS: StrategyMechanisms = {
  preserve_eis_bpr: true,
  preserve_aim_bpr: true,
  preserve_vct_income: false,
  draw_isa_early: false,
  draw_pension_early: false,
  protect_property: true,
};

export interface SimulationInputs {
  annual_income_target: number;
  income_is_net: boolean;
  plan_years: number;
  lifestyle_multiplier: LifestyleMultiplier;
  current_age: number;
  inflation_rate: number;
  priority_weights: PriorityWeights;
  strategy_mechanisms: StrategyMechanisms;
  annual_gift_amount: number;
  gift_type: GiftType;
  state_pension_annual: number;
  private_pension_income: number;
  apply_2026_bpr_cap: boolean;
  apply_2027_pension_iht: boolean;
  cash_reserve: number;
  legacy_target: number;
  glory_years: GloryYearsConfig;
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
  iht_no_plan_baseline: number;
  shadow_funded_years: number;
  legacy_target: number;
  legacy_shortfall: number;
  net_estate_after_iht: number;
  grossed_up_income: number;
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

function scoreAssetForDrawdown(asset: AssetState, weights: PriorityWeights, planYear: number, toggles: Toggles, allAssets: AssetState[], mechanisms: StrategyMechanisms): number {
  const calendarYear = 2025 + planYear - 1;

  const taxCostOrder: Record<string, number> = {
    cash: 0.9,
    isa: mechanisms.draw_isa_early ? 1.0 : 0.7,
    pension: mechanisms.draw_pension_early ? 0.8 : 0.5,
    vct: mechanisms.preserve_vct_income ? 0.5 : 0.85,
    eis: 0.6,
    aim_shares: 0.4,
    property_investment: mechanisms.protect_property ? 0.15 : 0.3,
    property_residential: 0.1,
  };
  const taxScore = taxCostOrder[asset.assetClass] ?? 0.5;

  let ihtScore = 0;
  if (asset.assetClass === 'vct') {
    ihtScore = 0.8;
  } else if (asset.isIHTExempt && asset.assetClass === 'eis') {
    if (mechanisms.preserve_eis_bpr) {
      if (asset.bprQualifyingDate) {
        const qualifyingYear = new Date(asset.bprQualifyingDate).getFullYear();
        if (calendarYear >= qualifyingYear) {
          if (toggles.apply_2026_bpr_cap && calendarYear >= 2026) {
            const bprPool = allAssets
              .filter(a => (a.assetClass === 'eis' || a.assetClass === 'aim_shares') && a.isIHTExempt && a.value > 0)
              .reduce((sum, a) => {
                if (a.bprQualifyingDate) {
                  const qy = new Date(a.bprQualifyingDate).getFullYear();
                  if (calendarYear >= qy) return sum + a.value;
                }
                return sum;
              }, 0);
            const cap = 2500000;
            const priorTotal = bprPool - Math.max(0, asset.value);
            if (priorTotal >= cap) {
              ihtScore = 0.4;
            } else if (priorTotal + Math.max(0, asset.value) <= cap) {
              ihtScore = 0.05;
            } else {
              const withinCap = cap - priorTotal;
              const ratio = withinCap / Math.max(1, Math.max(0, asset.value));
              ihtScore = 0.05 * ratio + 0.4 * (1 - ratio);
            }
          } else {
            ihtScore = 0.05;
          }
        } else {
          ihtScore = 0.6;
        }
      } else {
        ihtScore = 0.05;
      }
    } else {
      ihtScore = 0.7;
    }
  } else if (asset.isIHTExempt && asset.assetClass === 'aim_shares') {
    if (mechanisms.preserve_aim_bpr) {
      if (asset.bprQualifyingDate) {
        const qualifyingYear = new Date(asset.bprQualifyingDate).getFullYear();
        if (calendarYear >= qualifyingYear) {
          if (toggles.apply_2026_bpr_cap && calendarYear >= 2026) {
            const bprPool = allAssets
              .filter(a => (a.assetClass === 'eis' || a.assetClass === 'aim_shares') && a.isIHTExempt && a.value > 0)
              .reduce((sum, a) => {
                if (a.bprQualifyingDate) {
                  const qy = new Date(a.bprQualifyingDate).getFullYear();
                  if (calendarYear >= qy) return sum + a.value;
                }
                return sum;
              }, 0);
            const cap = 2500000;
            const priorTotal = bprPool - Math.max(0, asset.value);
            if (priorTotal >= cap) {
              ihtScore = 0.4;
            } else if (priorTotal + Math.max(0, asset.value) <= cap) {
              ihtScore = 0.05;
            } else {
              const withinCap = cap - priorTotal;
              const ratio = withinCap / Math.max(1, Math.max(0, asset.value));
              ihtScore = 0.05 * ratio + 0.4 * (1 - ratio);
            }
          } else {
            ihtScore = 0.05;
          }
        } else {
          ihtScore = 0.6;
        }
      } else {
        ihtScore = 0.05;
      }
    } else {
      ihtScore = 0.7;
    }
  } else {
    ihtScore = 0.8;
  }
  const pensionInEstate = toggles.apply_2027_pension_iht && calendarYear >= 2027;
  if (asset.assetClass === 'pension') {
    if (mechanisms.draw_pension_early) {
      ihtScore = 0.9;
    } else {
      ihtScore = pensionInEstate ? 0.95 : 0.1;
    }
  }
  if ((asset.assetClass === 'property_investment' || asset.assetClass === 'property_residential') && mechanisms.protect_property) {
    ihtScore = Math.min(ihtScore, 0.3);
  }

  const maxGrowth = 0.12;
  const preserveGrowthScore = 1 - Math.min(asset.growthRate / maxGrowth, 1);

  const liquidityOrder: Record<string, number> = {
    cash: 1.0,
    isa: mechanisms.draw_isa_early ? 0.95 : 0.85,
    aim_shares: 0.7,
    vct: 0.5,
    eis: 0.4,
    pension: mechanisms.draw_pension_early ? 0.6 : 0.3,
    property_investment: mechanisms.protect_property ? 0.05 : 0.1,
    property_residential: 0.05,
  };
  const liquidityScore = liquidityOrder[asset.assetClass] ?? 0.5;

  return (
    weights.tax_efficiency * taxScore +
    weights.iht_reduction * ihtScore +
    weights.preserve_growth * preserveGrowthScore +
    weights.liquidity * liquidityScore
  );
}

function getDrawdownPriority(weights: PriorityWeights, assets: AssetState[], planYear: number, toggles: Toggles, mechanisms: StrategyMechanisms): string[] {
  return assets
    .filter(a => a.value > 0)
    .map(a => ({ id: a.id, score: scoreAssetForDrawdown(a, weights, planYear, toggles, assets, mechanisms) }))
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
  acquisitionDate: string | null;
  originalSubscriptionAmount: number | null;
  growthRate: number;
  incomeGenerated: number;
  reinvestedPct: number;
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
  disposalType: 'none' | 'transfer';
  transferYear: number | null;
  transferred: boolean;
}

function grossUpFromNet(netTarget: number, taxParams: TaxParametersFile): number {
  const params = getParamsForYear(taxParams, 1);
  let lo = netTarget;
  let hi = netTarget * 2.5;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const tax = calculateIncomeTax(mid, 0, 0, params);
    const net = mid - tax;
    if (net < netTarget) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return Math.round((lo + hi) / 2);
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
        iht_no_plan_baseline: 0,
        shadow_funded_years: 0,
        legacy_target: inputs.legacy_target,
        legacy_shortfall: inputs.legacy_target,
        net_estate_after_iht: 0,
        grossed_up_income: inputs.annual_income_target
      },
      registerWarnings
    };
  }

  const multiplier = LIFESTYLE_MULTIPLIERS[inputs.lifestyle_multiplier];
  const toggles: Toggles = {
    apply_2026_bpr_cap: inputs.apply_2026_bpr_cap,
    apply_2027_pension_iht: inputs.apply_2027_pension_iht
  };

  let grossIncomeTarget = inputs.annual_income_target;
  if (inputs.income_is_net) {
    grossIncomeTarget = grossUpFromNet(inputs.annual_income_target, taxParams);
  }
  const effectiveInputs = { ...inputs, annual_income_target: grossIncomeTarget };

  let assets: AssetState[] = register.map(a => ({
    id: a.asset_id,
    assetClass: a.asset_class,
    wrapperType: a.wrapper_type,
    label: a.label,
    value: a.current_value,
    acquisitionCost: a.acquisition_cost,
    acquisitionDate: a.acquisition_date,
    originalSubscriptionAmount: a.original_subscription_amount,
    growthRate: a.assumed_growth_rate,
    incomeGenerated: a.income_generated,
    reinvestedPct: a.reinvested_pct ?? 0,
    isIHTExempt: a.is_iht_exempt,
    bprQualifyingDate: a.bpr_qualifying_date,
    pensionType: a.pension_type,
    taxReliefClaimed: a.tax_relief_claimed,
    reliefClaimedType: a.relief_claimed_type,
    deferredGainAmount: a.deferred_gain_amount,
    mortgageBalance: a.mortgage_balance,
    allowableImprovementCosts: a.allowable_improvement_costs,
    estimatedDisposalCostPct: a.estimated_disposal_cost_pct,
    cgtExemptDate: a.cgt_exempt_date,
    disposalType: a.disposal_type ?? 'none',
    transferYear: a.transfer_year ?? null,
    transferred: false
  }));

  let tflsRemaining = taxParams.schedule[0].tfls_lifetime_limit - (register.find(a => a.pension_type)?.tfls_used_amount ?? 0);
  const giftHistory: GiftHistoryEntry[] = [];
  const shadowHorizon = Math.max(inputs.plan_years, 35, 90 - inputs.current_age);
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
    let gloryMultiplier = 1.0;
    if (inputs.glory_years.enabled) {
      const inGlory = planYear <= inputs.glory_years.duration;
      if (inputs.glory_years.target_is_glory) {
        gloryMultiplier = inGlory ? 1.0 : (1.0 / inputs.glory_years.multiplier);
      } else {
        gloryMultiplier = inGlory ? inputs.glory_years.multiplier : 1.0;
      }
    }
    const totalPensionIncome = inputs.state_pension_annual + inputs.private_pension_income;
    const spendTarget = effectiveInputs.annual_income_target * multiplier * gloryMultiplier * inflationFactor;

    // Step 1: Apply growth to all assets
    for (const asset of assets) {
      asset.value *= (1 + asset.growthRate);
    }

    // Step 1b: Handle property transfers (PET disposal)
    for (const asset of assets) {
      if (asset.disposalType === 'transfer' && !asset.transferred && asset.transferYear !== null && planYear >= asset.transferYear) {
        const transferValue = asset.value;
        if (transferValue > 0) {
          giftHistory.push({ year: planYear, amount: transferValue });
        }
        asset.value = 0;
        asset.incomeGenerated = 0;
        asset.mortgageBalance = 0;
        asset.transferred = true;
      }
    }

    // Step 2: Collect baseline income (interest, rent, dividends)
    // Income is extracted from asset values — growth rate is total return,
    // income_generated is the yield portion paid out to the client
    let baselineCashIncome = totalPensionIncome;
    let rentalIncome = 0;
    let savingsIncome = 0;
    let dividendIncome = 0;

    for (const asset of assets) {
      if (asset.value <= 0 || asset.transferred) continue;
      const totalIncome = Math.min(asset.incomeGenerated, asset.value);
      if (totalIncome <= 0) continue;

      const reinvestedFraction = (asset.reinvestedPct ?? 0) / 100;
      const reinvested = totalIncome * reinvestedFraction;
      const cashIncome = totalIncome - reinvested;

      if (asset.assetClass === 'cash') {
        savingsIncome += cashIncome;
      } else if (asset.assetClass === 'property_investment' || asset.assetClass === 'property_residential') {
        rentalIncome += cashIncome;
      } else if (asset.assetClass === 'vct' || asset.assetClass === 'eis' || asset.assetClass === 'aim_shares') {
        dividendIncome += cashIncome;
      }
      baselineCashIncome += cashIncome;
      asset.value -= cashIncome;
    }

    // Step 3: Calculate remaining needed from drawdowns (including estimated tax)
    const totalPortfolioPre = assets.reduce((s, a) => s + Math.max(0, a.value), 0);
    let remaining = Math.max(0, spendTarget - baselineCashIncome);
    let legacyAtRisk = false;
    if (inputs.legacy_target > 0 && !isShadow) {
      const maxDrawForLegacy = Math.max(0, totalPortfolioPre - inputs.legacy_target);
      if (remaining > maxDrawForLegacy) {
        legacyAtRisk = true;
      }
    }

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
    let effectiveWeights = inputs.priority_weights;
    if (inputs.legacy_target > 0 && !isShadow) {
      const pensionVal = assets.filter(a => a.assetClass === 'pension').reduce((s, a) => s + Math.max(0, a.value), 0);
      const mortgages = assets.reduce((s, a) => s + (a.mortgageBalance > 0 ? a.mortgageBalance : 0), 0);
      const pensionInEstate = toggles.apply_2027_pension_iht && calendarYear >= 2027;
      const netEstateProxy = totalPortfolioPre - (pensionInEstate ? 0 : pensionVal) - mortgages;
      const ratio = Math.max(0, netEstateProxy) / Math.max(1, inputs.legacy_target);
      if (ratio < 2.0) {
        const urgency = Math.max(0, Math.min(1, 1 - (ratio - 1)));
        const boost = urgency * 0.25;
        const totalOriginal = effectiveWeights.tax_efficiency + effectiveWeights.iht_reduction +
          effectiveWeights.preserve_growth + effectiveWeights.liquidity;
        const boostedIHT = effectiveWeights.iht_reduction + boost * 0.5;
        const boostedGrowth = effectiveWeights.preserve_growth + boost * 0.5;
        const scale = totalOriginal / (effectiveWeights.tax_efficiency + boostedIHT + boostedGrowth + effectiveWeights.liquidity);
        effectiveWeights = {
          tax_efficiency: effectiveWeights.tax_efficiency * scale,
          iht_reduction: boostedIHT * scale,
          preserve_growth: boostedGrowth * scale,
          liquidity: effectiveWeights.liquidity * scale,
        };
      }
    }
    const priority = getDrawdownPriority(effectiveWeights, assets, planYear, toggles, inputs.strategy_mechanisms);
    let pensionDrawTaxable = 0;
    let totalCGTGain = 0;
    let totalDeferredGainRealized = 0;

    const totalCashValue = assets.filter(a => a.assetClass === 'cash').reduce((s, a) => s + Math.max(0, a.value), 0);
    const cashFloor = Math.min(inputs.cash_reserve, totalCashValue);
    let cashDrawnSoFar = 0;
    const maxCashDraw = totalCashValue - cashFloor;

    for (const assetId of priority) {
      if (remaining <= 0) break;
      const asset = assets.find(a => a.id === assetId);
      if (!asset || asset.value <= 0 || asset.transferred) continue;

      let available = asset.value;
      if (asset.assetClass === 'cash' && cashFloor > 0) {
        const cashRoomLeft = maxCashDraw - cashDrawnSoFar;
        available = Math.min(asset.value, cashRoomLeft);
        if (available <= 0) continue;
      }
      const draw = Math.min(remaining, available);
      if (asset.assetClass === 'cash') cashDrawnSoFar += draw;
      asset.value -= draw;
      drawsByAsset[assetId] = (drawsByAsset[assetId] || 0) + draw;
      remaining -= draw;

      if (asset.assetClass === 'pension') {
        const pclsResult = calculatePCLS(draw, tflsRemaining);
        tflsRemaining = pclsResult.newRemainingLSA;
        pensionDrawTaxable += pclsResult.taxableDraw;
      } else if (asset.wrapperType === 'unwrapped' && asset.assetClass !== 'cash') {
        if (asset.assetClass === 'vct') {
          if (asset.acquisitionDate) {
            const acquisitionDateObj = new Date(asset.acquisitionDate);
            const fiveYearAnniversary = new Date(acquisitionDateObj);
            fiveYearAnniversary.setFullYear(fiveYearAnniversary.getFullYear() + 5);
            const disposalDate = new Date(calendarYear, 3, 5);
            if (disposalDate < fiveYearAnniversary && asset.reliefClaimedType !== 'none') {
              const subscriptionBasis = asset.originalSubscriptionAmount ?? asset.acquisitionCost ?? 0;
              const isPost2026 = acquisitionDateObj >= new Date('2026-04-06');
              const clawbackRate = isPost2026 ? 0.20 : 0.30;
              const preDrawValue = draw + asset.value;
              const proportion = preDrawValue > 0 ? draw / preDrawValue : 1;
              const derivedClawback = subscriptionBasis * clawbackRate * proportion;
              const proportionalReliefClaimed = asset.taxReliefClaimed * proportion;
              const clawback = Math.min(derivedClawback, proportionalReliefClaimed);
              pensionDrawTaxable += clawback;
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
        } else if (asset.assetClass === 'property_investment' || asset.assetClass === 'property_residential') {
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
    const nonSavingsIncome = totalPensionIncome + rentalIncome + pensionDrawTaxable;
    const incomeTax = calculateIncomeTax(nonSavingsIncome, savingsIncome, dividendIncome, params);
    const taxableIncomeAfterPA = Math.max(0, (nonSavingsIncome + savingsIncome + dividendIncome) - params.personal_allowance);
    const totalCGTGainWithDeferred = totalCGTGain + totalDeferredGainRealized;
    const cgt = calculateCGT(totalCGTGainWithDeferred, taxableIncomeAfterPA, params);

    // Step 6b: Deduct tax liabilities from portfolio (draw from most liquid first, respecting cash reserve)
    let taxToPay = incomeTax + cgt;
    const postDrawCashTotal = assets.filter(a => a.assetClass === 'cash').reduce((s, a) => s + Math.max(0, a.value), 0);
    const taxCashFloor = Math.min(inputs.cash_reserve, postDrawCashTotal);
    let taxCashDrawn = 0;
    const taxMaxCashDraw = postDrawCashTotal - taxCashFloor;
    const taxPayPriority = [...assets]
      .filter(a => a.value > 0)
      .sort((a, b) => {
        const liq: Record<string, number> = { cash: 0, isa: 1, pension: 5, vct: 3, eis: 4, aim_shares: 2, property_investment: 6, property_residential: 7 };
        return (liq[a.assetClass] ?? 99) - (liq[b.assetClass] ?? 99);
      });
    for (const asset of taxPayPriority) {
      if (taxToPay <= 0) break;
      let maxDeduction = asset.value;
      if (asset.assetClass === 'cash' && taxCashFloor > 0) {
        maxDeduction = Math.min(asset.value, taxMaxCashDraw - taxCashDrawn);
        if (maxDeduction <= 0) continue;
      }
      const deduction = Math.min(taxToPay, maxDeduction);
      asset.value -= deduction;
      taxToPay -= deduction;
      if (asset.assetClass === 'cash') taxCashDrawn += deduction;
    }

    // Step 7: Calculate portfolio totals
    const valuesByAssetClass: Record<string, number> = {};
    for (const asset of assets) {
      const cls = asset.assetClass;
      valuesByAssetClass[cls] = (valuesByAssetClass[cls] || 0) + Math.max(0, asset.value);
    }
    const totalPortfolioValue = assets.reduce((sum, a) => sum + Math.max(0, a.value), 0);
    const pensionValue = valuesByAssetClass['pension'] || 0;

    // Step 8: Calculate IHT — VCTs never qualify for BPR (IHTA 1984 s.105(3))
    let bprTotal = 0;
    let totalMortgageLiabilities = 0;
    for (const asset of assets) {
      if (asset.mortgageBalance > 0) {
        totalMortgageLiabilities += asset.mortgageBalance;
      }
      if (asset.assetClass === 'vct') continue;
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
    const estateForIHT = Math.max(0, totalPortfolioValue - pensionValue - totalMortgageLiabilities);
    const ihtBill = calculateIHTBill(estateForIHT, bprTotal, cltCumulative, pensionValue, toggles, params, calendarYear);

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
      currentAge: age,
      legacyAtRisk,
      legacyTarget: inputs.legacy_target,
      netEstateProjected: Math.max(0, totalPortfolioValue - ihtBill)
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

  const planEndYear = perYear.find(yr => yr.planYear === inputs.plan_years);
  const noPlanIHT = calculateNoPlanIHT(register, taxParams, inputs, toggles);
  const actualIHTAtPlanEnd = planEndYear?.estimatedIHTBill ?? 0;
  const ihtSaving = Math.max(0, noPlanIHT - actualIHTAtPlanEnd);
  const estateAtEnd = planEndYear?.totalPortfolioValue ?? 0;
  const netEstateAfterIHT = Math.max(0, estateAtEnd - actualIHTAtPlanEnd);
  const legacyShortfall = inputs.legacy_target > 0
    ? Math.max(0, inputs.legacy_target - netEstateAfterIHT)
    : 0;

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
      estate_at_end: estateAtEnd,
      iht_at_end: actualIHTAtPlanEnd,
      iht_saving_vs_no_plan: ihtSaving,
      iht_no_plan_baseline: noPlanIHT,
      shadow_funded_years: shadowFundedYears,
      legacy_target: inputs.legacy_target,
      legacy_shortfall: legacyShortfall,
      net_estate_after_iht: netEstateAfterIHT,
      grossed_up_income: grossIncomeTarget
    },
    registerWarnings
  };
}

function calculateNoPlanIHT(register: Asset[], taxParams: TaxParametersFile, inputs: SimulationInputs, toggles: Toggles): number {
  const assets = register.map(a => ({
    value: a.current_value,
    growthRate: a.assumed_growth_rate,
    incomeGenerated: a.income_generated,
    assetClass: a.asset_class,
    isIHTExempt: a.is_iht_exempt,
    bprQualifyingDate: a.bpr_qualifying_date,
    pensionType: a.pension_type,
    mortgageBalance: a.mortgage_balance,
  }));

  for (let planYear = 1; planYear <= inputs.plan_years; planYear++) {
    for (const asset of assets) {
      asset.value *= (1 + asset.growthRate);
      const income = Math.min(asset.incomeGenerated, asset.value);
      if (income > 0) asset.value -= income;
    }
  }

  const lastPlanYear = inputs.plan_years;
  const calendarYear = 2025 + lastPlanYear - 1;
  const params = getParamsForYear(taxParams, lastPlanYear);

  let bprTotal = 0;
  let pensionValue = 0;
  let totalValue = 0;
  let totalMortgages = 0;
  for (const asset of assets) {
    const val = Math.max(0, asset.value);
    totalValue += val;
    if (asset.mortgageBalance > 0) totalMortgages += asset.mortgageBalance;
    if (asset.pensionType) pensionValue += val;
    if (asset.assetClass === 'vct') continue;
    if (asset.isIHTExempt && val > 0) {
      if (asset.bprQualifyingDate) {
        const qualifyingYear = new Date(asset.bprQualifyingDate).getFullYear();
        if (calendarYear >= qualifyingYear) bprTotal += val;
      } else {
        bprTotal += val;
      }
    }
  }

  const estateForIHT = Math.max(0, totalValue - pensionValue - totalMortgages);
  return calculateIHTBill(estateForIHT, bprTotal, 0, pensionValue, toggles, params, calendarYear);
}

export interface OptimiserResult {
  optimal_income: number;
  optimal_buffer: number;
  net_estate_after_iht: number;
  funded_years: number;
  legacy_met: boolean;
  glory_phase_income: number;
  calm_phase_income: number;
  iterations: number;
}

export function runOptimiser(
  baseInputs: SimulationInputs,
  register: Asset[],
  taxParams: TaxParametersFile,
  mode: 'max_income' | 'max_estate' | 'balanced'
): OptimiserResult {
  const totalPortfolio = register.reduce((s, a) => s + a.current_value, 0);
  const incomeFloor = 5000;
  const incomeCeiling = Math.max(incomeFloor + 1000, Math.min(totalPortfolio / Math.max(1, baseInputs.plan_years) * 2, 500000));
  let bestIncome = incomeFloor;
  let bestBuffer = baseInputs.cash_reserve;
  let bestResult: SimulationResult | null = null;
  let iterations = 0;
  const maxIterations = 40;

  const isFeasible = (r: SimulationResult): boolean => {
    const fullyFunded = r.summary.funded_years >= baseInputs.plan_years;
    const legacyMet = baseInputs.legacy_target <= 0 || r.summary.net_estate_after_iht >= baseInputs.legacy_target;
    return fullyFunded && legacyMet;
  };

  if (mode === 'max_income') {
    let lo = incomeFloor;
    let hi = incomeCeiling;
    while (hi - lo > 500 && iterations < maxIterations) {
      iterations++;
      const mid = Math.round((lo + hi) / 2);
      const testInputs = { ...baseInputs, annual_income_target: mid, income_is_net: false };
      const result = runSimulation(testInputs, register, taxParams);
      if (isFeasible(result)) {
        bestIncome = mid;
        bestResult = result;
        lo = mid;
      } else {
        hi = mid;
      }
    }
  } else if (mode === 'max_estate') {
    const bufferCandidates = [0, 10000, 25000, 50000, 75000, 100000, 150000, 200000, 300000];
    const incomeCandidates: number[] = [];
    for (let inc = incomeFloor; inc <= incomeCeiling; inc += Math.max(5000, Math.round((incomeCeiling - incomeFloor) / 20))) {
      incomeCandidates.push(inc);
    }
    let bestEstate = -1;
    for (const buffer of bufferCandidates) {
      for (const income of incomeCandidates) {
        iterations++;
        if (iterations > 200) break;
        const testInputs = { ...baseInputs, annual_income_target: income, cash_reserve: buffer, income_is_net: false };
        const result = runSimulation(testInputs, register, taxParams);
        if (isFeasible(result) && result.summary.net_estate_after_iht > bestEstate) {
          bestEstate = result.summary.net_estate_after_iht;
          bestBuffer = buffer;
          bestIncome = income;
          bestResult = result;
        }
      }
      if (iterations > 200) break;
    }
  } else {
    const bufferOptions = [0, 25000, 50000, 75000, 100000, 150000, 200000];
    let bestScore = -Infinity;
    for (const buffer of bufferOptions) {
      let incLo = incomeFloor;
      let incHi = incomeCeiling;
      let bufBestIncome = incLo;
      let bufBestResult: SimulationResult | null = null;
      let subIter = 0;
      while (incHi - incLo > 500 && subIter < 25) {
        subIter++;
        iterations++;
        const mid = Math.round((incLo + incHi) / 2);
        const testInputs = { ...baseInputs, annual_income_target: mid, cash_reserve: buffer, income_is_net: false };
        const result = runSimulation(testInputs, register, taxParams);
        if (isFeasible(result)) {
          bufBestIncome = mid;
          bufBestResult = result;
          incLo = mid;
        } else {
          incHi = mid;
        }
      }
      if (bufBestResult) {
        const incomeScore = bufBestIncome / 100000;
        const estateScore = bufBestResult.summary.net_estate_after_iht / totalPortfolio;
        const score = incomeScore * 0.6 + estateScore * 0.4;
        if (score > bestScore) {
          bestScore = score;
          bestIncome = bufBestIncome;
          bestBuffer = buffer;
          bestResult = bufBestResult;
        }
      }
    }
  }

  if (!bestResult) {
    const testInputs = { ...baseInputs, annual_income_target: bestIncome, cash_reserve: bestBuffer, income_is_net: false };
    bestResult = runSimulation(testInputs, register, taxParams);
  }

  const gloryEnabled = baseInputs.glory_years.enabled;
  let gloryPhaseIncome = bestIncome;
  let calmPhaseIncome = bestIncome;
  if (gloryEnabled) {
    if (baseInputs.glory_years.target_is_glory) {
      gloryPhaseIncome = bestIncome;
      calmPhaseIncome = Math.round(bestIncome / baseInputs.glory_years.multiplier);
    } else {
      gloryPhaseIncome = Math.round(bestIncome * baseInputs.glory_years.multiplier);
      calmPhaseIncome = bestIncome;
    }
  }

  return {
    optimal_income: bestIncome,
    optimal_buffer: bestBuffer,
    net_estate_after_iht: bestResult.summary.net_estate_after_iht,
    funded_years: bestResult.summary.funded_years,
    legacy_met: baseInputs.legacy_target <= 0 || bestResult.summary.net_estate_after_iht >= baseInputs.legacy_target,
    glory_phase_income: gloryPhaseIncome,
    calm_phase_income: calmPhaseIncome,
    iterations,
  };
}
