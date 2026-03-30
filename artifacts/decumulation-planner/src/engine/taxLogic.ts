export interface TaxParams {
  tax_year: string;
  plan_year_start: number;
  personal_allowance: number;
  basic_rate_threshold: number;
  higher_rate_threshold: number;
  pa_taper_start: number;
  basic_rate: number;
  higher_rate: number;
  additional_rate: number;
  dividend_basic_rate: number;
  dividend_higher_rate: number;
  dividend_additional_rate: number;
  dividend_allowance: number;
  psa_basic: number;
  psa_higher: number;
  psa_additional: number;
  cgt_exempt_amount: number;
  cgt_rate_basic: number;
  cgt_rate_higher: number;
  iht_rate: number;
  iht_rate_lifetime_clt: number;
  iht_charitable_rate: number;
  nil_rate_band: number;
  rnrb: number;
  rnrb_taper_start: number;
  tfls_lifetime_limit: number;
  annual_gift_exemption: number;
  isa_annual_limit: number;
  pension_annual_allowance: number;
  mpaa: number;
  vct_annual_limit: number;
  eis_annual_limit: number;
  eis_ki_annual_limit: number;
  bpr_full_relief_cap: number;
}

export interface TaxParametersFile {
  schedule: TaxParams[];
  hold_flat_from: string;
  hold_flat_disclosure: string;
}

export interface Toggles {
  apply_2026_bpr_cap: boolean;
  apply_2027_pension_iht: boolean;
}

export function getParamsForYear(taxParams: TaxParametersFile, planYear: number): TaxParams {
  const schedule = taxParams.schedule;
  for (let i = schedule.length - 1; i >= 0; i--) {
    if (planYear >= schedule[i].plan_year_start) {
      return schedule[i];
    }
  }
  return schedule[schedule.length - 1];
}

export function calculateIncomeTax(
  nonSavingsIncome: number,
  savingsIncome: number,
  dividendIncome: number,
  params: TaxParams
): number {
  const totalIncome = nonSavingsIncome + savingsIncome + dividendIncome;

  let pa = params.personal_allowance;
  if (totalIncome > params.pa_taper_start) {
    const reduction = Math.floor((totalIncome - params.pa_taper_start) / 2);
    pa = Math.max(0, pa - reduction);
  }

  let tax = 0;
  let bandUsed = 0;

  let dividendAllowanceUsed = 0;
  let psaUsedTotal = 0;

  const applyToBands = (income: number, isSavings: boolean, isDividend: boolean): number => {
    let remaining = income;
    let t = 0;

    if (remaining <= 0) return 0;

    const paRemaining = Math.max(0, pa - bandUsed);
    const paUsed = Math.min(remaining, paRemaining);
    remaining -= paUsed;
    bandUsed += paUsed;

    if (remaining <= 0) return 0;

    const basicEnd = params.basic_rate_threshold;
    const higherEnd = params.higher_rate_threshold;

    const basicRemaining = Math.max(0, basicEnd - bandUsed);
    const inBasic = Math.min(remaining, basicRemaining);

    if (isDividend) {
      const dAllowanceRemaining = Math.max(0, params.dividend_allowance - dividendAllowanceUsed);
      const dAllowanceUsedHere = Math.min(inBasic, dAllowanceRemaining);
      dividendAllowanceUsed += dAllowanceUsedHere;
      t += (inBasic - dAllowanceUsedHere) * params.dividend_basic_rate;
    } else if (isSavings) {
      const bandLevel = bandUsed < basicEnd ? 'basic' : bandUsed < higherEnd ? 'higher' : 'additional';
      const psaLimit = bandLevel === 'basic' ? params.psa_basic : bandLevel === 'higher' ? params.psa_higher : params.psa_additional;
      const psaRemaining = Math.max(0, psaLimit - psaUsedTotal);
      const psaUsedHere = Math.min(inBasic, psaRemaining);
      psaUsedTotal += psaUsedHere;
      t += (inBasic - psaUsedHere) * params.basic_rate;
    } else {
      t += inBasic * params.basic_rate;
    }
    remaining -= inBasic;
    bandUsed += inBasic;

    if (remaining <= 0) return t;

    const higherRemaining = Math.max(0, higherEnd - bandUsed);
    const inHigher = Math.min(remaining, higherRemaining);

    if (isDividend) {
      const dAllowanceRemaining = Math.max(0, params.dividend_allowance - dividendAllowanceUsed);
      const dAllowanceUsedHere = Math.min(inHigher, dAllowanceRemaining);
      dividendAllowanceUsed += dAllowanceUsedHere;
      t += (inHigher - dAllowanceUsedHere) * params.dividend_higher_rate;
    } else if (isSavings) {
      const psaLimit = bandUsed < higherEnd ? params.psa_higher : params.psa_additional;
      const psaRemaining = Math.max(0, psaLimit - psaUsedTotal);
      const psaUsedHere = Math.min(inHigher, psaRemaining);
      psaUsedTotal += psaUsedHere;
      t += (inHigher - psaUsedHere) * params.higher_rate;
    } else {
      t += inHigher * params.higher_rate;
    }
    remaining -= inHigher;
    bandUsed += inHigher;

    if (remaining <= 0) return t;

    if (isDividend) {
      const dAllowanceRemaining = Math.max(0, params.dividend_allowance - dividendAllowanceUsed);
      const dAllowanceUsedHere = Math.min(remaining, dAllowanceRemaining);
      dividendAllowanceUsed += dAllowanceUsedHere;
      t += (remaining - dAllowanceUsedHere) * params.dividend_additional_rate;
    } else {
      t += remaining * params.additional_rate;
    }
    bandUsed += remaining;

    return t;
  };

  tax += applyToBands(nonSavingsIncome, false, false);
  tax += applyToBands(savingsIncome, true, false);
  tax += applyToBands(dividendIncome, false, true);

  return Math.round(tax * 100) / 100;
}

export function calculateMarginalRate(
  nonSavingsIncome: number,
  savingsIncome: number,
  dividendIncome: number,
  params: TaxParams
): number {
  const totalIncome = nonSavingsIncome + savingsIncome + dividendIncome;
  if (totalIncome <= 0) return 0;

  const inPATrap = totalIncome > params.pa_taper_start &&
    totalIncome <= params.pa_taper_start + params.personal_allowance * 2;

  let pa = params.personal_allowance;
  if (totalIncome > params.pa_taper_start) {
    const reduction = Math.floor((totalIncome - params.pa_taper_start) / 2);
    pa = Math.max(0, pa - reduction);
  }

  const taxableIncome = Math.max(0, totalIncome - pa);
  if (taxableIncome <= 0) return 0;

  let nominalRate: number;
  const basicBandSize = params.basic_rate_threshold - params.personal_allowance;
  const higherBandEnd = params.higher_rate_threshold - params.personal_allowance;

  if (taxableIncome <= basicBandSize) {
    nominalRate = params.basic_rate;
  } else if (taxableIncome <= higherBandEnd) {
    nominalRate = params.higher_rate;
  } else {
    nominalRate = params.additional_rate;
  }

  if (inPATrap) return 0.60;
  return nominalRate;
}

export function calculatePCLS(grossCrystallisation: number, remainingLSA: number): { pcls: number; taxableDraw: number; newRemainingLSA: number } {
  const maxPcls = 0.25 * grossCrystallisation;
  const pcls = Math.min(maxPcls, remainingLSA);
  const taxableDraw = grossCrystallisation - pcls;
  const newRemainingLSA = remainingLSA - pcls;
  return { pcls, taxableDraw, newRemainingLSA };
}

export function calculateCGT(gain: number, grossIncome: number, params: TaxParams): number {
  const taxableGain = Math.max(0, gain - params.cgt_exempt_amount);
  if (taxableGain <= 0) return 0;

  const basicBandRemaining = Math.max(0, params.basic_rate_threshold - grossIncome);
  const inBasic = Math.min(taxableGain, basicBandRemaining);
  const inHigher = taxableGain - inBasic;

  return inBasic * params.cgt_rate_basic + inHigher * params.cgt_rate_higher;
}

export function calculateIHTBill(
  estate: number,
  bprTotal: number,
  cltCumulative: number,
  pensionValue: number,
  toggles: Toggles,
  params: TaxParams,
  calendarYear: number,
  rnrbQualifies: boolean = false,
  charitablePct: number = 0
): number {
  // Step 1: BPR relief (with optional 2026 cap)
  let bprRelief = bprTotal;
  if (toggles.apply_2026_bpr_cap && calendarYear >= 2026 && bprTotal > params.bpr_full_relief_cap) {
    const excess = bprTotal - params.bpr_full_relief_cap;
    bprRelief = params.bpr_full_relief_cap + excess * 0.5;
  }

  // Step 2: Gross estate (pension included if 2027+ toggle)
  let grossEstate = estate;
  if (toggles.apply_2027_pension_iht && calendarYear >= 2027) {
    grossEstate += pensionValue;
  }

  // Step 3: RNRB (Residence Nil-Rate Band)
  let availableRNRB = 0;
  if (rnrbQualifies && params.rnrb > 0) {
    if (grossEstate > params.rnrb_taper_start) {
      const excess = grossEstate - params.rnrb_taper_start;
      availableRNRB = Math.max(0, params.rnrb - excess / 2);
    } else {
      availableRNRB = params.rnrb;
    }
  }

  // Step 4: Taxable estate
  const taxableEstate = Math.max(0, grossEstate - bprRelief);
  const availableNRB = Math.max(0, params.nil_rate_band - cltCumulative);
  const totalNRB = availableNRB + availableRNRB;
  const taxableAboveNRB = Math.max(0, taxableEstate - totalNRB);

  // Step 5: Charitable deduction and rate
  const isCharitableRate = charitablePct >= 10;
  const charitableDeduction = isCharitableRate ? taxableAboveNRB * (charitablePct / 100) : 0;
  const taxableAfterCharity = Math.max(0, taxableAboveNRB - charitableDeduction);
  const ihtRate = isCharitableRate ? params.iht_charitable_rate : params.iht_rate;
  const iht = taxableAfterCharity * ihtRate;

  return Math.round(iht * 100) / 100;
}
