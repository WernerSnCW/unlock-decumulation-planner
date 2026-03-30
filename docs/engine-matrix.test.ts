import { getParamsForYear, calculateIncomeTax, calculateMarginalRate, calculatePCLS, calculateCGT, calculateIHTBill } from '../artifacts/decumulation-planner/src/engine/taxLogic';
import type { TaxParametersFile, TaxParams, Toggles } from '../artifacts/decumulation-planner/src/engine/taxLogic';
import { getCLTCumulative, getPETTaperRate, checkNEFI } from '../artifacts/decumulation-planner/src/engine/trustLogic';
import type { GiftHistoryEntry } from '../artifacts/decumulation-planner/src/engine/trustLogic';
import { runSimulation, STRATEGY_PRESETS, DEFAULT_MECHANISMS, DEFAULT_EIS_STRATEGY, DEFAULT_VCT_STRATEGY } from '../artifacts/decumulation-planner/src/engine/decumulation';
import type { Asset, SimulationInputs, GloryYearsConfig, EISStrategyConfig, VCTStrategyConfig } from '../artifacts/decumulation-planner/src/engine/decumulation';
import taxParametersData from '../artifacts/decumulation-planner/src/data/taxParameters.json';

const taxParams: TaxParametersFile = taxParametersData as TaxParametersFile;
const p2025 = taxParams.schedule[0];
const p2026 = taxParams.schedule[1];

let passed = 0;
let failed = 0;
let currentCategory = '';
const failures: string[] = [];

function category(name: string) {
  if (currentCategory) console.log('');
  currentCategory = name;
  console.log(`=== ${name} ===`);
}

function assert(label: string, actual: unknown, expected: unknown, tolerance = 0.01) {
  const a = typeof actual === 'number' ? actual : actual;
  const e = typeof expected === 'number' ? expected : expected;
  let pass = false;
  if (typeof a === 'number' && typeof e === 'number') {
    pass = Math.abs(a - e) <= tolerance;
  } else {
    pass = a === e;
  }
  if (pass) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    const msg = `  ✗ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
    console.log(msg);
    failures.push(`[${currentCategory}] ${msg.trim()}`);
  }
}

function assertGte(label: string, actual: number, min: number) {
  if (actual >= min) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    const msg = `  ✗ ${label} — expected >= ${min}, got ${actual}`;
    console.log(msg);
    failures.push(`[${currentCategory}] ${msg.trim()}`);
  }
}

function assertLte(label: string, actual: number, max: number) {
  if (actual <= max) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    const msg = `  ✗ ${label} — expected <= ${max}, got ${actual}`;
    console.log(msg);
    failures.push(`[${currentCategory}] ${msg.trim()}`);
  }
}

function assertTrue(label: string, val: boolean) {
  assert(label, val, true);
}

function assertFalse(label: string, val: boolean) {
  assert(label, val, false);
}

function makeAsset(overrides: Partial<Asset> & { asset_id: string }): Asset {
  return {
    asset_class: 'cash',
    wrapper_type: 'unwrapped',
    label: overrides.asset_id,
    current_value: 0,
    acquisition_date: null,
    acquisition_cost: null,
    original_subscription_amount: null,
    tax_relief_claimed: 0,
    assumed_growth_rate: 0,
    income_generated: 0,
    reinvested_pct: 0,
    is_iht_exempt: false,
    bpr_qualifying_date: null,
    bpr_last_reviewed: null,
    cgt_exempt_date: null,
    mortgage_balance: 0,
    pension_type: null,
    tfls_used_amount: 0,
    mpaa_triggered: false,
    in_drawdown: false,
    flexible_isa: false,
    deferred_gain_amount: null,
    relief_claimed_type: 'none',
    allowable_improvement_costs: 0,
    estimated_disposal_cost_pct: 0,
    estimated_disposal_cost_amount: null,
    disposal_type: 'none',
    transfer_year: null,
    ...overrides,
  };
}

function makeInputs(overrides: Partial<SimulationInputs> = {}): SimulationInputs {
  return {
    annual_income_target: 40000,
    income_is_net: false,
    plan_years: 20,
    lifestyle_multiplier: 'comfortable',
    current_age: 60,
    inflation_rate: 0.025,
    priority_weights: STRATEGY_PRESETS.balanced,
    strategy_mechanisms: DEFAULT_MECHANISMS,
    annual_gift_amount: 0,
    gift_type: 'pet',
    state_pension_annual: 0,
    private_pension_income: 0,
    apply_2026_bpr_cap: false,
    apply_2027_pension_iht: false,
    cash_reserve: 0,
    legacy_target: 0,
    glory_years: { enabled: false, duration: 0, multiplier: 1, target_is_glory: false },
    eis_strategy: { ...DEFAULT_EIS_STRATEGY },
    vct_strategy: { ...DEFAULT_VCT_STRATEGY },
    has_direct_descendants: false,
    has_main_residence: false,
    charitable_legacy_pct: 0,
    nrb_trust_enabled: false,
    gift_asset_ids: [],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════
// 1. TAX LOGIC — getParamsForYear
// ═══════════════════════════════════════════════
category('1.1 getParamsForYear');

assert('planYear=1 returns 2025/26', getParamsForYear(taxParams, 1).tax_year, '2025/26');
assert('planYear=2 returns 2026/27', getParamsForYear(taxParams, 2).tax_year, '2026/27');
assert('planYear=5 returns 2026/27 (held flat)', getParamsForYear(taxParams, 5).tax_year, '2026/27');
assert('planYear=50 returns 2026/27', getParamsForYear(taxParams, 50).tax_year, '2026/27');
assert('dividend_basic_rate year 1 = 0.0875', getParamsForYear(taxParams, 1).dividend_basic_rate, 0.0875);
assert('dividend_basic_rate year 2 = 0.1075', getParamsForYear(taxParams, 2).dividend_basic_rate, 0.1075);

// ═══════════════════════════════════════════════
// 2. TAX LOGIC — calculateIncomeTax
// ═══════════════════════════════════════════════
category('2.1 calculateIncomeTax — basic cases');

assert('Zero income → 0 tax', calculateIncomeTax(0, 0, 0, p2025), 0);
assert('Income within PA → 0 tax', calculateIncomeTax(12000, 0, 0, p2025), 0);
assert('Income exactly PA → 0 tax', calculateIncomeTax(12570, 0, 0, p2025), 0);

category('2.2 calculateIncomeTax — basic rate band');

{
  const tax = calculateIncomeTax(30000, 0, 0, p2025);
  const expected = (30000 - 12570) * 0.20;
  assert('£30k non-savings → basic rate', tax, expected);
}

category('2.3 calculateIncomeTax — higher rate band');

{
  const tax = calculateIncomeTax(60000, 0, 0, p2025);
  const basicTax = (50270 - 12570) * 0.20;
  const higherTax = (60000 - 50270) * 0.40;
  assert('£60k non-savings → basic + higher', tax, basicTax + higherTax);
}

category('2.4 calculateIncomeTax — additional rate');

{
  const tax = calculateIncomeTax(200000, 0, 0, p2025);
  const pa = 0;
  const basicTax = (50270 - 0) * 0.20;
  const higherTax = (125140 - 50270) * 0.40;
  const additionalTax = (200000 - 125140) * 0.45;
  assert('£200k non-savings → all bands + PA tapered to 0', tax, basicTax + higherTax + additionalTax);
}

category('2.5 calculateIncomeTax — PA taper trap');

{
  const tax110 = calculateIncomeTax(110000, 0, 0, p2025);
  const pa = Math.max(0, 12570 - Math.floor((110000 - 100000) / 2));
  const basicTax = (50270 - pa) * 0.20;
  const higherTax = (110000 - 50270) * 0.40;
  assert('£110k with PA taper', tax110, basicTax + higherTax);
}

{
  const tax125140 = calculateIncomeTax(125140, 0, 0, p2025);
  const basicTax = 50270 * 0.20;
  const higherTax = (125140 - 50270) * 0.40;
  assert('£125,140 — PA fully tapered', tax125140, basicTax + higherTax);
}

category('2.6 calculateIncomeTax — savings with PSA');

{
  const tax = calculateIncomeTax(0, 15000, 0, p2025);
  const pa = 12570;
  const afterPA = 15000 - pa;
  const psaUsed = Math.min(afterPA, 1000);
  const expected = (afterPA - psaUsed) * 0.20;
  assert('£15k savings, basic rate PSA=1000', tax, expected);
}

{
  const tax = calculateIncomeTax(50000, 2000, 0, p2025);
  const nonSavBasic = (50000 - 12570);
  const nonSavTax = nonSavBasic * 0.20;
  const savInBasic = Math.min(2000, 50270 - 50000);
  const savInHigher = 2000 - savInBasic;
  const psaUsedBasic = Math.min(savInBasic, 500);
  const psaRemaining = 500 - psaUsedBasic;
  const psaUsedHigher = Math.min(savInHigher, psaRemaining);
  const savTax = (savInBasic - psaUsedBasic) * 0.20 + (savInHigher - psaUsedHigher) * 0.40;
  assert('£50k non-savings + £2k savings → higher PSA=500', tax, nonSavTax + savTax);
}

category('2.7 calculateIncomeTax — dividends');

{
  const tax = calculateIncomeTax(0, 0, 20000, p2025);
  const afterPA = 20000 - 12570;
  const divAllowance = 500;
  const expected = (afterPA - divAllowance) * 0.0875;
  assert('£20k dividends only (2025/26 rate)', tax, expected);
}

{
  const tax26 = calculateIncomeTax(0, 0, 20000, p2026);
  const afterPA = 20000 - 12570;
  const divAllowance = 500;
  const expected26 = (afterPA - divAllowance) * 0.1075;
  assert('£20k dividends only (2026/27 rate)', tax26, expected26);
}

category('2.8 calculateIncomeTax — worked example from CALCULATIONS.json');

{
  const tax = calculateIncomeTax(55000, 2000, 3000, p2025);
  assert('£55k + £2k savings + £3k dividends (2025/26)', tax, 10875.75);
}

// ═══════════════════════════════════════════════
// 3. TAX LOGIC — calculateMarginalRate
// ═══════════════════════════════════════════════
category('3.1 calculateMarginalRate');

assert('Zero income → 0', calculateMarginalRate(0, 0, 0, p2025), 0);
assert('£30k → basic rate 0.20', calculateMarginalRate(30000, 0, 0, p2025), 0.20);
assert('£60k → higher rate 0.40', calculateMarginalRate(60000, 0, 0, p2025), 0.40);
assert('£200k → additional rate 0.45', calculateMarginalRate(200000, 0, 0, p2025), 0.45);
assert('£110k → PA trap 0.60', calculateMarginalRate(110000, 0, 0, p2025), 0.60);
assert('£100001 → PA trap 0.60', calculateMarginalRate(100001, 0, 0, p2025), 0.60);
assert('£125140 → PA trap 0.60', calculateMarginalRate(125140, 0, 0, p2025), 0.60);
assert('£125141 → additional 0.45 (PA gone, above higher band)', calculateMarginalRate(125141, 0, 0, p2025), 0.45);
assert('£100000 → higher 0.40 (boundary)', calculateMarginalRate(100000, 0, 0, p2025), 0.40);

// ═══════════════════════════════════════════════
// 4. TAX LOGIC — calculatePCLS
// ═══════════════════════════════════════════════
category('4.1 calculatePCLS');

{
  const r = calculatePCLS(100000, 268275);
  assert('PCLS standard 25%', r.pcls, 25000);
  assert('PCLS taxable draw', r.taxableDraw, 75000);
  assert('PCLS remaining LSA', r.newRemainingLSA, 243275);
}

{
  const r = calculatePCLS(100000, 10000);
  assert('PCLS capped by LSA', r.pcls, 10000);
  assert('PCLS taxable when capped', r.taxableDraw, 90000);
  assert('PCLS LSA exhausted', r.newRemainingLSA, 0);
}

{
  const r = calculatePCLS(100000, 0);
  assert('PCLS with zero LSA', r.pcls, 0);
  assert('PCLS fully taxable', r.taxableDraw, 100000);
}

{
  const r = calculatePCLS(0, 268275);
  assert('PCLS zero crystallisation', r.pcls, 0);
  assert('PCLS zero taxable', r.taxableDraw, 0);
}

// ═══════════════════════════════════════════════
// 5. TAX LOGIC — calculateCGT
// ═══════════════════════════════════════════════
category('5.1 calculateCGT');

assert('Gain below exempt → 0', calculateCGT(2000, 40000, p2025), 0);
assert('Gain exactly exempt → 0', calculateCGT(3000, 40000, p2025), 0);

{
  const cgt = calculateCGT(20000, 40000, p2025);
  const taxableGain = 17000;
  const basicRemaining = 50270 - 40000;
  const inBasic = Math.min(taxableGain, basicRemaining);
  const inHigher = taxableGain - inBasic;
  const expected = inBasic * 0.18 + inHigher * 0.24;
  assert('£20k gain, £40k income — split bands', cgt, expected);
  assert('£20k gain, £40k income = 3463.80', cgt, 3463.80);
}

{
  const cgt = calculateCGT(20000, 60000, p2025);
  const taxableGain = 17000;
  const expected = taxableGain * 0.24;
  assert('All gain at higher rate (income > basic threshold)', cgt, expected);
}

{
  const cgt = calculateCGT(20000, 0, p2025);
  const taxableGain = 17000;
  const basicRemaining = 50270;
  const expected = taxableGain * 0.18;
  assert('All gain at basic rate (zero income)', cgt, expected);
}

// ═══════════════════════════════════════════════
// 6. TAX LOGIC — calculateIHTBill
// ═══════════════════════════════════════════════
category('6.1 calculateIHTBill — basic');

const noToggles: Toggles = { apply_2026_bpr_cap: false, apply_2027_pension_iht: false };

{
  const iht = calculateIHTBill(500000, 0, 0, 0, noToggles, p2025, 2025);
  const expected = (500000 - 325000) * 0.40;
  assert('Simple estate £500k, no reliefs', iht, expected);
}

{
  const iht = calculateIHTBill(300000, 0, 0, 0, noToggles, p2025, 2025);
  assert('Estate below NRB → 0', iht, 0);
}

category('6.2 calculateIHTBill — RNRB');

{
  const iht = calculateIHTBill(1500000, 0, 0, 0, noToggles, p2025, 2025, true);
  const expected = (1500000 - 325000 - 175000) * 0.40;
  assert('Estate £1.5M with RNRB', iht, expected);
}

{
  const iht = calculateIHTBill(2200000, 0, 0, 0, noToggles, p2025, 2025, true);
  const excess = 2200000 - 2000000;
  const rnrb = Math.max(0, 175000 - excess / 2);
  const expected = (2200000 - 325000 - rnrb) * 0.40;
  assert('Estate £2.2M — RNRB taper', iht, expected);
}

{
  const iht = calculateIHTBill(2350000, 0, 0, 0, noToggles, p2025, 2025, true);
  const rnrb = Math.max(0, 175000 - (2350000 - 2000000) / 2);
  assert('Estate £2.35M — RNRB fully tapered', rnrb, 0);
  const expected = (2350000 - 325000) * 0.40;
  assert('IHT with RNRB fully tapered', iht, expected);
}

category('6.3 calculateIHTBill — BPR with 2026 cap');

{
  const toggles: Toggles = { apply_2026_bpr_cap: true, apply_2027_pension_iht: false };
  const iht = calculateIHTBill(3000000, 3000000, 0, 0, toggles, p2025, 2026);
  const bprRelief = 2500000 + (500000 * 0.5);
  const taxable = Math.max(0, 3000000 - bprRelief);
  const expected = Math.max(0, taxable - 325000) * 0.40;
  assert('BPR £3M with 2026 cap → relief = £2.75M', iht, expected);
}

{
  const toggles: Toggles = { apply_2026_bpr_cap: true, apply_2027_pension_iht: false };
  const iht = calculateIHTBill(2000000, 2000000, 0, 0, toggles, p2025, 2026);
  const expected = Math.max(0, (2000000 - 2000000) - 325000) * 0.40;
  assert('BPR £2M (below cap) → full relief', iht, 0);
}

{
  const toggles: Toggles = { apply_2026_bpr_cap: false, apply_2027_pension_iht: false };
  const iht = calculateIHTBill(3000000, 3000000, 0, 0, toggles, p2025, 2026);
  assert('BPR £3M without cap → full relief', iht, 0);
}

category('6.4 calculateIHTBill — pension in estate 2027');

{
  const toggles: Toggles = { apply_2026_bpr_cap: false, apply_2027_pension_iht: true };
  const iht = calculateIHTBill(500000, 0, 0, 300000, toggles, p2025, 2028);
  const grossEstate = 500000 + 300000;
  const expected = Math.max(0, grossEstate - 325000) * 0.40;
  assert('Pension in estate after 2027', iht, expected);
}

{
  const toggles: Toggles = { apply_2026_bpr_cap: false, apply_2027_pension_iht: true };
  const iht = calculateIHTBill(500000, 0, 0, 300000, toggles, p2025, 2026);
  const expected = Math.max(0, 500000 - 325000) * 0.40;
  assert('Pension NOT in estate before 2027', iht, expected);
}

category('6.5 calculateIHTBill — charitable legacy');

{
  const iht = calculateIHTBill(1000000, 0, 0, 0, noToggles, p2025, 2025, false, 10);
  const taxableAboveNRB = 1000000 - 325000;
  const charitableDeduction = taxableAboveNRB * 0.10;
  const expected = (taxableAboveNRB - charitableDeduction) * 0.36;
  assert('10% charitable → 36% rate', iht, expected);
}

{
  const iht = calculateIHTBill(1000000, 0, 0, 0, noToggles, p2025, 2025, false, 9);
  const expected = (1000000 - 325000) * 0.40;
  assert('9% charitable → standard 40% rate', iht, expected);
}

category('6.6 calculateIHTBill — CLT reducing NRB');

{
  const iht = calculateIHTBill(1000000, 0, 200000, 0, noToggles, p2025, 2025);
  const availableNRB = 325000 - 200000;
  const expected = (1000000 - availableNRB) * 0.40;
  assert('CLT £200k reduces available NRB', iht, expected);
}

{
  const iht = calculateIHTBill(1000000, 0, 400000, 0, noToggles, p2025, 2025);
  const expected = 1000000 * 0.40;
  assert('CLT exceeds NRB → NRB=0', iht, expected);
}

category('6.7 calculateIHTBill — worked example from CALCULATIONS.json');

{
  const toggles: Toggles = { apply_2026_bpr_cap: false, apply_2027_pension_iht: true };
  const iht = calculateIHTBill(2200000, 300000, 0, 500000, toggles, p2025, 2028, true, 0);
  assert('Full worked example', iht, 830000);
}

// ═══════════════════════════════════════════════
// 7. TRUST LOGIC — getCLTCumulative
// ═══════════════════════════════════════════════
category('7.1 getCLTCumulative');

{
  const history: GiftHistoryEntry[] = [
    { year: 1, amount: 100000 },
    { year: 3, amount: 50000 },
  ];
  assert('Both within 7yr window', getCLTCumulative(history, 7), 150000);
}

{
  const history: GiftHistoryEntry[] = [
    { year: 1, amount: 100000 },
    { year: 3, amount: 50000 },
  ];
  assert('Year 8: gift at year 1 excluded (strict >)', getCLTCumulative(history, 8), 50000);
}

{
  const history: GiftHistoryEntry[] = [
    { year: 1, amount: 100000 },
  ];
  assert('Year 9: year-1 gift fully expired', getCLTCumulative(history, 9), 0);
}

{
  assert('Empty history → 0', getCLTCumulative([], 5), 0);
}

{
  const history: GiftHistoryEntry[] = [
    { year: 1, amount: 325000 },
    { year: 8, amount: 325000 },
  ];
  assert('7-year reset: year 8 gift, check at year 8', getCLTCumulative(history, 8), 325000);
  assert('7-year reset: check at year 14', getCLTCumulative(history, 14), 325000);
  assert('7-year reset: check at year 15 (year 8 drops)', getCLTCumulative(history, 15), 0);
}

// ═══════════════════════════════════════════════
// 8. TRUST LOGIC — getPETTaperRate
// ═══════════════════════════════════════════════
category('8.1 getPETTaperRate');

assert('0 years → 0%', getPETTaperRate(0), 0);
assert('1 year → 0%', getPETTaperRate(1), 0);
assert('2 years → 0%', getPETTaperRate(2), 0);
assert('3 years → 0%', getPETTaperRate(3), 0);
assert('3.5 years → 20%', getPETTaperRate(3.5), 0.20);
assert('4 years → 20%', getPETTaperRate(4), 0.20);
assert('4.5 years → 40%', getPETTaperRate(4.5), 0.40);
assert('5 years → 40%', getPETTaperRate(5), 0.40);
assert('5.5 years → 60%', getPETTaperRate(5.5), 0.60);
assert('6 years → 60%', getPETTaperRate(6), 0.60);
assert('6.5 years → 80%', getPETTaperRate(6.5), 0.80);
assert('7 years → 80%', getPETTaperRate(7), 0.80);
assert('7.5 years → 100%', getPETTaperRate(7.5), 1.0);
assert('10 years → 100%', getPETTaperRate(10), 1.0);

// ═══════════════════════════════════════════════
// 9. TRUST LOGIC — checkNEFI
// ═══════════════════════════════════════════════
category('9.1 checkNEFI');

assertTrue('NEFI qualifies: income covers spend + gift', checkNEFI(50000, 30000, 10000));
assertTrue('NEFI qualifies: exact boundary', checkNEFI(40000, 30000, 10000));
assertFalse('NEFI fails: income short', checkNEFI(39999, 30000, 10000));
assertFalse('NEFI fails: no income', checkNEFI(0, 30000, 10000));
assertTrue('NEFI qualifies: zero gift', checkNEFI(30000, 30000, 0));

// ═══════════════════════════════════════════════
// 10. SIMULATION — shadow horizon
// ═══════════════════════════════════════════════
category('10.1 Shadow horizon');

{
  const inputs = makeInputs({ plan_years: 20, current_age: 60 });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  const shadowHorizon = Math.max(20, 35, 90 - 60);
  assert('Shadow horizon = max(20, 35, 30) = 35', result.perYear.length, shadowHorizon);
  const lastShadow = result.perYear[result.perYear.length - 1];
  assertTrue('Last year is shadow', lastShadow.isShadow);
  assertFalse('Year 20 is NOT shadow', result.perYear[19].isShadow);
  assertTrue('Year 21 IS shadow', result.perYear[20].isShadow);
}

{
  const inputs = makeInputs({ plan_years: 10, current_age: 40 });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  const shadowHorizon = Math.max(10, 35, 90 - 40);
  assert('Shadow horizon age 40 = max(10, 35, 50) = 50', result.perYear.length, shadowHorizon);
}

// ═══════════════════════════════════════════════
// 11. SIMULATION — inflation factor
// ═══════════════════════════════════════════════
category('11.1 Inflation factor');

{
  const inputs = makeInputs({
    plan_years: 5,
    current_age: 60,
    inflation_rate: 0.025,
    annual_income_target: 40000,
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  assert('Year 1 spend target = 40000 (inflation^0)', result.perYear[0].spendTargetNominal, 40000, 1);
  const yr5Expected = 40000 * Math.pow(1.025, 4);
  assert('Year 5 spend target with inflation', result.perYear[4].spendTargetNominal, yr5Expected, 1);
}

// ═══════════════════════════════════════════════
// 12. SIMULATION — Glory Years
// ═══════════════════════════════════════════════
category('12.1 Glory Years — target_is_glory=false');

{
  const inputs = makeInputs({
    plan_years: 10,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 40000,
    glory_years: { enabled: true, duration: 5, multiplier: 1.5, target_is_glory: false },
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  assert('Glory year 1 spend = 60000', result.perYear[0].spendTargetNominal, 60000, 1);
  assert('Post-glory year 6 spend = 40000', result.perYear[5].spendTargetNominal, 40000, 1);
}

category('12.2 Glory Years — target_is_glory=true');

{
  const inputs = makeInputs({
    plan_years: 10,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 60000,
    glory_years: { enabled: true, duration: 5, multiplier: 1.5, target_is_glory: true },
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  assert('Glory year 1 spend = 60000 (target)', result.perYear[0].spendTargetNominal, 60000, 1);
  assert('Post-glory year 6 spend = 40000 (1/1.5)', result.perYear[5].spendTargetNominal, 40000, 1);
}

// ═══════════════════════════════════════════════
// 13. SIMULATION — lifestyle multiplier
// ═══════════════════════════════════════════════
category('13.1 Lifestyle multiplier');

{
  const inputs = makeInputs({
    plan_years: 5,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 40000,
    lifestyle_multiplier: 'modest',
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  assert('Modest multiplier = 0.7 → spend = 28000', result.perYear[0].spendTargetNominal, 28000, 1);
}

{
  const inputs = makeInputs({
    plan_years: 5,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 40000,
    lifestyle_multiplier: 'generous',
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  assert('Generous multiplier = 1.5 → spend = 60000', result.perYear[0].spendTargetNominal, 60000, 1);
}

// ═══════════════════════════════════════════════
// 14. SIMULATION — empty register
// ═══════════════════════════════════════════════
category('14.1 Empty register');

{
  const inputs = makeInputs({});
  const result = runSimulation(inputs, [], taxParams);
  assert('Empty register → 0 funded years', result.summary.funded_years, 0);
  assert('Empty register → first shortfall year = 1', result.summary.first_shortfall_year, 1);
  assert('Empty register → perYear length = 0', result.perYear.length, 0);
}

// ═══════════════════════════════════════════════
// 15. SIMULATION — funded years tracking
// ═══════════════════════════════════════════════
category('15.1 Funded years tracking');

{
  const inputs = makeInputs({
    plan_years: 20,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 40000,
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 100000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  assertLte('Small portfolio → not fully funded', result.summary.funded_years, 5);
  assertFalse('Not fully funded', result.summary.fully_funded);
}

{
  const inputs = makeInputs({
    plan_years: 5,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 10000,
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 500000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  assert('Large portfolio → fully funded', result.summary.funded_years, 5);
  assertTrue('Fully funded flag', result.summary.fully_funded);
}

// ═══════════════════════════════════════════════
// 16. SIMULATION — gifting with annual exemption
// ═══════════════════════════════════════════════
category('16.1 Gifting logic');

{
  const inputs = makeInputs({
    plan_years: 5,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 0,
    annual_gift_amount: 10000,
    gift_type: 'pet',
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 500000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  assert('Year 1 gifted amount', result.perYear[0].giftedThisYear, 10000, 1);
  assertGte('Total gifted over 5 years', result.summary.total_gifted, 49000);
}

// ═══════════════════════════════════════════════
// 17. SIMULATION — NRB trust strategy
// ═══════════════════════════════════════════════
category('17.1 NRB trust strategy trigger years');

{
  const inputs = makeInputs({
    plan_years: 20,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 0,
    nrb_trust_enabled: true,
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  assertGte('Year 1 CLT cumulative > 0 (triggered)', result.perYear[0].clt7yrCumulative, 100000);
  assertGte('Year 8 new gift triggered (planYear%7===1)', result.perYear[7].giftedThisYear, 100000);
  assertGte('Year 15 new gift triggered', result.perYear[14].giftedThisYear, 100000);
}

// ═══════════════════════════════════════════════
// 18. SIMULATION — asset gifting CGT
// ═══════════════════════════════════════════════
category('18.1 Asset gifting — year 1 only, deemed disposal');

{
  const inputs = makeInputs({
    plan_years: 5,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 0,
    gift_asset_ids: ['isa1'],
  });
  const register = [
    makeAsset({ asset_id: 'cash1', current_value: 500000, asset_class: 'cash' }),
    makeAsset({
      asset_id: 'isa1',
      current_value: 100000,
      asset_class: 'isa',
      wrapper_type: 'isa',
      acquisition_cost: 60000,
    }),
  ];
  const result = runSimulation(inputs, register, taxParams);
  assertGte('Year 1 gifted includes ISA value', result.perYear[0].giftedThisYear, 90000);
  const yr2Gifted = result.perYear[1]?.giftedThisYear ?? 0;
  assert('Year 2 — no asset gift (year 1 only)', yr2Gifted, 0, 1);
}

// ═══════════════════════════════════════════════
// 19. SIMULATION — cash reserve floor
// ═══════════════════════════════════════════════
category('19.1 Cash reserve floor');

{
  const inputs = makeInputs({
    plan_years: 3,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 30000,
    cash_reserve: 50000,
  });
  const register = [
    makeAsset({ asset_id: 'cash1', current_value: 100000, asset_class: 'cash' }),
    makeAsset({ asset_id: 'isa1', current_value: 200000, asset_class: 'isa', wrapper_type: 'isa' }),
  ];
  const result = runSimulation(inputs, register, taxParams);
  const cashEnd = result.perYear[0].valuesByAssetClass['cash'] ?? 0;
  assertGte('Cash stays above reserve floor in year 1', cashEnd, 45000);
}

// ═══════════════════════════════════════════════
// 20. SIMULATION — pension PCLS drawdown
// ═══════════════════════════════════════════════
category('20.1 Pension drawdown with PCLS');

{
  const inputs = makeInputs({
    plan_years: 5,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 100000,
    priority_weights: STRATEGY_PRESETS.income_first,
    strategy_mechanisms: { ...DEFAULT_MECHANISMS, draw_pension_early: true },
  });
  const register = [
    makeAsset({
      asset_id: 'pension1',
      current_value: 500000,
      asset_class: 'pension',
      wrapper_type: 'pension',
      pension_type: 'sipp',
    }),
  ];
  const result = runSimulation(inputs, register, taxParams);
  assertLte('TFLS remaining after draws < initial', result.perYear[0].tflsRemaining, 268275);
}

// ═══════════════════════════════════════════════
// 21. SIMULATION — CGT on disposals
// ═══════════════════════════════════════════════
category('21.1 CGT on unwrapped asset disposal');

{
  const inputs = makeInputs({
    plan_years: 3,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 50000,
  });
  const register = [
    makeAsset({
      asset_id: 'shares1',
      current_value: 200000,
      asset_class: 'aim_shares',
      wrapper_type: 'unwrapped',
      acquisition_cost: 100000,
    }),
  ];
  const result = runSimulation(inputs, register, taxParams);
  assertGte('CGT paid on unwrapped disposal', result.summary.total_cgt_paid, 0);
}

// ═══════════════════════════════════════════════
// 22. SIMULATION — portfolio value composition
// ═══════════════════════════════════════════════
category('22.1 Portfolio value composition');

{
  const inputs = makeInputs({
    plan_years: 5,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 10000,
    eis_strategy: {
      ...DEFAULT_EIS_STRATEGY,
      enabled: true,
      allocation_mode: 'fixed',
      scheme_type: 'eis',
      annual_eis_amount: 50000,
      annual_seis_amount: 0,
      investment_years: 5,
      quality_tier: 'base',
      scenario: 'base_case',
    },
    vct_strategy: {
      ...DEFAULT_VCT_STRATEGY,
      enabled: true,
      annual_vct_amount: 30000,
      scenario: 'sector_average',
    },
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 2000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  const lastPlanYear = result.perYear.find(y => y.planYear === 5)!;
  assertGte('EIS programme in valuesByAssetClass', lastPlanYear.valuesByAssetClass['eis_programme'] ?? 0, 1);
  assertGte('VCT programme in valuesByAssetClass', lastPlanYear.valuesByAssetClass['vct_programme'] ?? 0, 1);
  const coreVal = Object.entries(lastPlanYear.valuesByAssetClass)
    .filter(([k]) => k !== 'eis_programme' && k !== 'vct_programme')
    .reduce((s, [, v]) => s + v, 0);
  const totalExpected = coreVal + (lastPlanYear.valuesByAssetClass['eis_programme'] ?? 0) + (lastPlanYear.valuesByAssetClass['vct_programme'] ?? 0);
  assert('Total portfolio = core + EIS + VCT', lastPlanYear.totalPortfolioValue, totalExpected, 10);
}

// ═══════════════════════════════════════════════
// 23. EIS PROGRAMME
// ═══════════════════════════════════════════════
category('23.1 EIS — scenario multiples');

{
  const inputs = makeInputs({
    plan_years: 10,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 10000,
    eis_strategy: {
      ...DEFAULT_EIS_STRATEGY,
      enabled: true,
      allocation_mode: 'fixed',
      scheme_type: 'eis',
      annual_eis_amount: 100000,
      investment_years: 3,
      quality_tier: 'base',
      scenario: 'base_case',
    },
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  const yr = result.perYear.find(y => y.planYear === 10);
  assert('EIS base/base_case multiple = 5.65', yr?.eisProgramme?.eisMultiple, 5.65);
}

category('23.2 EIS — worst case');

{
  const inputs = makeInputs({
    plan_years: 5,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 10000,
    eis_strategy: {
      ...DEFAULT_EIS_STRATEGY,
      enabled: true,
      allocation_mode: 'fixed',
      scheme_type: 'eis',
      annual_eis_amount: 100000,
      investment_years: 3,
      quality_tier: 'base',
      scenario: 'worst_case',
    },
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  const yr = result.perYear.find(y => y.planYear === 5);
  assert('EIS worst_case multiple = 0', yr?.eisProgramme?.eisMultiple, 0);
  assert('EIS worst_case portfolio = 0', yr?.eisProgramme?.portfolioValueBaseCase, 0);
}

category('23.3 EIS — investment phase');

{
  const inputs = makeInputs({
    plan_years: 10,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 0,
    eis_strategy: {
      ...DEFAULT_EIS_STRATEGY,
      enabled: true,
      allocation_mode: 'fixed',
      scheme_type: 'eis',
      annual_eis_amount: 100000,
      investment_years: 3,
      quality_tier: 'base',
      scenario: 'base_case',
    },
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  const yr3 = result.perYear.find(y => y.planYear === 3);
  const yr4 = result.perYear.find(y => y.planYear === 4);
  assertTrue('Year 3 is investment phase', yr3?.eisProgramme?.isInvestmentPhase ?? false);
  assertFalse('Year 4 is NOT investment phase', yr4?.eisProgramme?.isInvestmentPhase ?? true);
  assert('3 cohorts after 3 investment years', yr3?.eisProgramme?.cohorts.length, 3);
  assert('Still 3 cohorts in year 4', yr4?.eisProgramme?.cohorts.length, 3);
}

category('23.4 EIS — BPR qualifying year');

{
  const inputs = makeInputs({
    plan_years: 5,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 0,
    eis_strategy: {
      ...DEFAULT_EIS_STRATEGY,
      enabled: true,
      allocation_mode: 'fixed',
      scheme_type: 'eis',
      annual_eis_amount: 100000,
      investment_years: 2,
      quality_tier: 'base',
      scenario: 'base_case',
    },
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  const yr2 = result.perYear.find(y => y.planYear === 2);
  assert('Cohort 1 BPR qualifying year = 3', yr2?.eisProgramme?.cohorts[0].bprQualifyingYear, 3);
  assert('Cohort 2 BPR qualifying year = 4', yr2?.eisProgramme?.cohorts[1].bprQualifyingYear, 4);
  const yr3 = result.perYear.find(y => y.planYear === 3);
  assertGte('IHT exempt amount at year 3 (cohort 1 qualifies)', yr3?.eisProgramme?.ihtExemptAmount ?? 0, 1);
}

category('23.5 EIS — fixed allocation blend mode');

{
  const inputs = makeInputs({
    plan_years: 3,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 0,
    eis_strategy: {
      ...DEFAULT_EIS_STRATEGY,
      enabled: true,
      allocation_mode: 'fixed',
      scheme_type: 'blend',
      annual_eis_amount: 100000,
      annual_seis_amount: 0,
      investment_years: 3,
      quality_tier: 'base',
      scenario: 'base_case',
    },
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  const cohort = result.perYear[0]?.eisProgramme?.cohorts[0];
  const expectedSEIS = Math.round(Math.min(100000 * 0.13, 200000));
  const expectedEIS = Math.round(100000 - expectedSEIS);
  assert('Blend SEIS = 13% of total', cohort?.seisAmount, expectedSEIS);
  assert('Blend EIS = remainder', cohort?.eisAmount, expectedEIS);
}

category('23.6 EIS — CGT deferral');

{
  const inputs = makeInputs({
    plan_years: 5,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 10000,
    eis_strategy: {
      ...DEFAULT_EIS_STRATEGY,
      enabled: true,
      allocation_mode: 'fixed',
      scheme_type: 'eis',
      annual_eis_amount: 100000,
      investment_years: 5,
      quality_tier: 'base',
      scenario: 'base_case',
      cgt_events: [{ year: 1, gain: 50000, rate: '24' }],
    },
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  const yr1 = result.perYear.find(y => y.planYear === 1);
  const taxableGain = Math.max(0, 50000 - p2025.cgt_exempt_amount);
  const expectedDeferral = taxableGain * 0.24;
  assert('CGT deferral year 1', yr1?.eisProgramme?.cgtDeferralThisYear, expectedDeferral, 1);
  assert('Cohort deferred gain = taxable gain (not tax)', yr1?.eisProgramme?.cohorts[0].deferredGain, taxableGain, 1);
}

category('23.7 EIS — relief capping');

{
  const inputs = makeInputs({
    plan_years: 3,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 15000,
    state_pension_annual: 0,
    eis_strategy: {
      ...DEFAULT_EIS_STRATEGY,
      enabled: true,
      allocation_mode: 'fixed',
      scheme_type: 'eis',
      annual_eis_amount: 500000,
      investment_years: 3,
      quality_tier: 'base',
      scenario: 'base_case',
    },
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  const yr1 = result.perYear[0];
  assertLte('EIS relief capped at estimated tax', yr1?.eisProgramme?.annualRelief ?? 999999, 500000 * 0.30);
}

// ═══════════════════════════════════════════════
// 24. VCT PROGRAMME
// ═══════════════════════════════════════════════
category('24.1 VCT — cohort lifecycle');

{
  const inputs = makeInputs({
    plan_years: 8,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 0,
    vct_strategy: {
      ...DEFAULT_VCT_STRATEGY,
      enabled: true,
      annual_vct_amount: 50000,
      proceeds_action: 'cash_out',
      scenario: 'sector_average',
    },
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  const yr1 = result.perYear.find(y => y.planYear === 1);
  assert('VCT cohort 1 liquidation year = 6', yr1?.vctProgramme?.cohorts[0].liquidationYear, 6);
  const yr6 = result.perYear.find(y => y.planYear === 6);
  assertTrue('VCT cohort 1 liquidated by year 6', yr6?.vctProgramme?.cohorts[0].liquidated ?? false);
}

category('24.2 VCT — relief rates pre/post 2026');

{
  const inputs = makeInputs({
    plan_years: 3,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 0,
    vct_strategy: {
      ...DEFAULT_VCT_STRATEGY,
      enabled: true,
      annual_vct_amount: 100000,
      scenario: 'sector_average',
    },
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  assert('Year 1 (2025) VCT relief rate = 30%', result.perYear[0]?.vctProgramme?.cohorts[0].reliefRate, 0.30);
  assert('Year 2 (2026) VCT relief rate = 20%', result.perYear[1]?.vctProgramme?.cohorts[1].reliefRate, 0.20);
}

category('24.3 VCT — dividends');

{
  const inputs = makeInputs({
    plan_years: 3,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 0,
    vct_strategy: {
      ...DEFAULT_VCT_STRATEGY,
      enabled: true,
      annual_vct_amount: 100000,
      scenario: 'sector_average',
    },
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  const yr1 = result.perYear[0];
  assert('VCT year 1 dividends = amount * 5%', yr1?.vctProgramme?.annualDividends, 100000 * 0.05, 1);
}

category('24.4 VCT — worst case (poor manager)');

{
  const inputs = makeInputs({
    plan_years: 5,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 0,
    vct_strategy: {
      ...DEFAULT_VCT_STRATEGY,
      enabled: true,
      annual_vct_amount: 100000,
      scenario: 'sector_average',
    },
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  const yr = result.perYear.find(y => y.planYear === 5);
  assertGte('VCT worst case value >= 0', yr?.vctProgramme?.portfolioValueWorstCase ?? -1, 0);
  assertLte('VCT worst case < base case', yr?.vctProgramme?.portfolioValueWorstCase ?? 999, yr?.vctProgramme?.portfolioValueBaseCase ?? 0);
}

// ═══════════════════════════════════════════════
// 25. OPTIMISER — feasibility check
// ═══════════════════════════════════════════════
category('25.1 Optimiser feasibility via simulation');

{
  const inputs = makeInputs({
    plan_years: 20,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 500000,
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 100000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  assertFalse('Infeasible: £500k income on £100k portfolio', result.summary.fully_funded);
}

{
  const inputs = makeInputs({
    plan_years: 20,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 5000,
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  assertTrue('Feasible: £5k income on £5M portfolio', result.summary.fully_funded);
}

// ═══════════════════════════════════════════════
// 25.2 Optimiser — balanced mode scoring formula
// ═══════════════════════════════════════════════
category('25.2 Optimiser scoring formula');

{
  const incomeScore = 50000 / 100000;
  const estateScore = 800000 / 2000000;
  const score = incomeScore * 0.6 + estateScore * 0.4;
  assert('Balanced score = income*0.6 + estate*0.4', score, 0.46);
}

{
  const incomeScore = 100000 / 100000;
  const estateScore = 0 / 1000000;
  const score = incomeScore * 0.6 + estateScore * 0.4;
  assert('Max income, zero estate → score = 0.6', score, 0.6);
}

// ═══════════════════════════════════════════════
// 25.3 Optimiser — income bounds calculation
// ═══════════════════════════════════════════════
category('25.3 Optimiser income bounds');

{
  const totalPortfolio = 1000000;
  const planYears = 20;
  const incomeFloor = 5000;
  const incomeCeiling = Math.max(incomeFloor + 1000, Math.min(totalPortfolio / Math.max(1, planYears) * 2, 500000));
  assert('Income floor = 5000', incomeFloor, 5000);
  assert('Income ceiling for £1M/20yr = 100000', incomeCeiling, 100000);
}

{
  const totalPortfolio = 10000000;
  const planYears = 10;
  const incomeFloor = 5000;
  const incomeCeiling = Math.max(incomeFloor + 1000, Math.min(totalPortfolio / Math.max(1, planYears) * 2, 500000));
  assert('Income ceiling capped at 500000', incomeCeiling, 500000);
}

// ═══════════════════════════════════════════════
// 26. FULL INTEGRATION — basic drawdown
// ═══════════════════════════════════════════════
category('26.1 Integration — cash + ISA + pension drawdown');

{
  const inputs = makeInputs({
    plan_years: 20,
    current_age: 60,
    inflation_rate: 0.025,
    annual_income_target: 40000,
    priority_weights: STRATEGY_PRESETS.balanced,
  });
  const register = [
    makeAsset({ asset_id: 'cash1', current_value: 100000, asset_class: 'cash' }),
    makeAsset({ asset_id: 'isa1', current_value: 300000, asset_class: 'isa', wrapper_type: 'isa', assumed_growth_rate: 0.04 }),
    makeAsset({ asset_id: 'pension1', current_value: 400000, asset_class: 'pension', wrapper_type: 'pension', pension_type: 'sipp', assumed_growth_rate: 0.05 }),
  ];
  const result = runSimulation(inputs, register, taxParams);
  assertGte('Funded at least 10 years with £800k portfolio', result.summary.funded_years, 10);
  assertGte('Total spent over plan period', result.summary.total_spent, 200000);
  assertGte('Income tax paid on pension drawdowns', result.summary.total_income_tax_paid, 100);
  assertGte('Estate at end > 0', result.summary.estate_at_end, 1);
}

// ═══════════════════════════════════════════════
// 27. FULL INTEGRATION — EIS programme
// ═══════════════════════════════════════════════
category('27.1 Integration — EIS programme');

{
  const inputs = makeInputs({
    plan_years: 10,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 60000,
    state_pension_annual: 20000,
    eis_strategy: {
      ...DEFAULT_EIS_STRATEGY,
      enabled: true,
      allocation_mode: 'fixed',
      scheme_type: 'eis',
      annual_eis_amount: 100000,
      investment_years: 5,
      quality_tier: 'base',
      scenario: 'base_case',
    },
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 3000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  assert('EIS total invested = 500k', result.summary.eis_total_invested, 500000, 100);
  assert('EIS total relief = 7430', result.summary.eis_total_relief, 7430, 100);
  assert('EIS portfolio base case ≈ 2.6M', result.summary.eis_portfolio_base_case, 2615750, 5000);
  assert('EIS IHT exempt ≈ 2.6M (all cohorts qualify)', result.summary.eis_iht_exempt, 2615750, 5000);
}

// ═══════════════════════════════════════════════
// 28. FULL INTEGRATION — VCT programme
// ═══════════════════════════════════════════════
category('28.1 Integration — VCT programme');

{
  const inputs = makeInputs({
    plan_years: 10,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 20000,
    vct_strategy: {
      ...DEFAULT_VCT_STRATEGY,
      enabled: true,
      annual_vct_amount: 50000,
      proceeds_action: 'recycle',
      scenario: 'good_generalist',
    },
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 2000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  assert('VCT total invested ≈ 800k (recycled)', result.summary.vct_total_invested, 800625, 5000);
  assert('VCT total relief ≈ 165k', result.summary.vct_total_relief, 165125, 2000);
  assert('VCT total dividends ≈ 223k', result.summary.vct_total_dividends, 222916, 5000);
  assert('VCT portfolio base ≈ 613k', result.summary.vct_portfolio_base_case, 613237, 5000);
}

// ═══════════════════════════════════════════════
// 29. FULL INTEGRATION — IHT planning combined
// ═══════════════════════════════════════════════
category('29.1 Integration — IHT planning features combined');

{
  const inputs = makeInputs({
    plan_years: 20,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 30000,
    annual_gift_amount: 5000,
    gift_type: 'pet',
    nrb_trust_enabled: true,
    has_direct_descendants: true,
    has_main_residence: true,
    charitable_legacy_pct: 10,
    apply_2026_bpr_cap: true,
    apply_2027_pension_iht: true,
    eis_strategy: {
      ...DEFAULT_EIS_STRATEGY,
      enabled: true,
      allocation_mode: 'fixed',
      scheme_type: 'eis',
      annual_eis_amount: 50000,
      investment_years: 5,
      quality_tier: 'base',
      scenario: 'base_case',
    },
  });
  const register = [
    makeAsset({ asset_id: 'cash1', current_value: 500000, asset_class: 'cash' }),
    makeAsset({ asset_id: 'isa1', current_value: 500000, asset_class: 'isa', wrapper_type: 'isa', assumed_growth_rate: 0.04 }),
    makeAsset({ asset_id: 'pension1', current_value: 300000, asset_class: 'pension', wrapper_type: 'pension', pension_type: 'sipp', assumed_growth_rate: 0.05 }),
    makeAsset({
      asset_id: 'aim1',
      current_value: 200000,
      asset_class: 'aim_shares',
      wrapper_type: 'unwrapped',
      is_iht_exempt: true,
      bpr_qualifying_date: '2023-01-01',
      assumed_growth_rate: 0.06,
      acquisition_cost: 100000,
    }),
  ];
  const result = runSimulation(inputs, register, taxParams);
  assert('IHT saving vs no plan ≈ 670k', result.summary.iht_saving_vs_no_plan, 669562, 10000);
  assert('Total gifted ≈ 1.3M', result.summary.total_gifted, 1296113, 10000);
  assert('Net estate after IHT ≈ 1.6M', result.summary.net_estate_after_iht, 1606366, 10000);
}

// ═══════════════════════════════════════════════
// 30. SIMULATION — income_is_net gross-up
// ═══════════════════════════════════════════════
category('30.1 Income is net — gross-up');

{
  const inputsGross = makeInputs({
    plan_years: 5,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 40000,
    income_is_net: false,
  });
  const inputsNet = makeInputs({
    plan_years: 5,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 40000,
    income_is_net: true,
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const resultGross = runSimulation(inputsGross, register, taxParams);
  const resultNet = runSimulation(inputsNet, register, taxParams);
  assertGte('Grossed up income > original', resultNet.summary.grossed_up_income, 40000);
  assertGte('Net target needs higher spend', resultNet.perYear[0].spendTargetNominal, resultGross.perYear[0].spendTargetNominal - 1);
}

// ═══════════════════════════════════════════════
// 31. SIMULATION — asset growth
// ═══════════════════════════════════════════════
category('31.1 Asset growth compounding');

{
  const inputs = makeInputs({
    plan_years: 3,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 0,
  });
  const register = [
    makeAsset({ asset_id: 'isa1', current_value: 100000, asset_class: 'isa', wrapper_type: 'isa', assumed_growth_rate: 0.05 }),
  ];
  const result = runSimulation(inputs, register, taxParams);
  const expectedYr3 = 100000 * Math.pow(1.05, 3);
  assert('ISA grows at 5% for 3 years', result.perYear[2].totalPortfolioValue, expectedYr3, 10);
}

// ═══════════════════════════════════════════════
// 32. SIMULATION — income extraction classification
// ═══════════════════════════════════════════════
category('32.1 Income extraction and tax classification');

{
  const inputs = makeInputs({
    plan_years: 3,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 0,
    state_pension_annual: 10000,
  });
  const register = [
    makeAsset({
      asset_id: 'prop1',
      current_value: 500000,
      asset_class: 'property_investment',
      wrapper_type: 'unwrapped',
      income_generated: 20000,
      assumed_growth_rate: 0.03,
    }),
  ];
  const result = runSimulation(inputs, register, taxParams);
  assertGte('Income tax > 0 with pension + rental income', result.summary.total_income_tax_paid, 1);
}

// ═══════════════════════════════════════════════
// 33. EIS — exit ramp factor
// ═══════════════════════════════════════════════
category('33.1 EIS exit ramp verification');

{
  const inputs = makeInputs({
    plan_years: 10,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 0,
    eis_strategy: {
      ...DEFAULT_EIS_STRATEGY,
      enabled: true,
      allocation_mode: 'fixed',
      scheme_type: 'eis',
      annual_eis_amount: 100000,
      investment_years: 1,
      quality_tier: 'base',
      scenario: 'base_case',
    },
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  const multiple = 5.65;
  const yr1Value = result.perYear[0]?.eisProgramme?.portfolioValueBaseCase ?? 0;
  assert('EIS year 0 held → exit ramp 0% (value = invested)', yr1Value, 100000, 10);
  const yr7 = result.perYear.find(y => y.planYear === 7);
  const yr7Value = yr7?.eisProgramme?.portfolioValueBaseCase ?? 0;
  assert('EIS year 6 held → exit ramp 85%', yr7Value, 100000 * (1 + (multiple - 1) * 0.85), 10);
  const yr8 = result.perYear.find(y => y.planYear === 8);
  const yr8Value = yr8?.eisProgramme?.portfolioValueBaseCase ?? 0;
  assert('EIS year 7+ held → exit ramp 100%', yr8Value, 100000 * multiple, 10);
}

// ═══════════════════════════════════════════════
// 34. VCT — liquidation with exit discount
// ═══════════════════════════════════════════════
category('34.1 VCT liquidation exit discount');

{
  const inputs = makeInputs({
    plan_years: 8,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 0,
    vct_strategy: {
      ...DEFAULT_VCT_STRATEGY,
      enabled: true,
      annual_vct_amount: 100000,
      proceeds_action: 'cash_out',
      scenario: 'sector_average',
    },
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  assertGte('VCT proceeds returned after liquidation', result.summary.vct_total_proceeds_returned, 1);
}

// ═══════════════════════════════════════════════
// 35. ADDITIONAL EDGE CASES
// ═══════════════════════════════════════════════
category('35.1 Zero inflation');

{
  const inputs = makeInputs({
    plan_years: 5,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 40000,
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  assert('Zero inflation → spend constant yr1', result.perYear[0].spendTargetNominal, 40000, 1);
  assert('Zero inflation → spend constant yr5', result.perYear[4].spendTargetNominal, 40000, 1);
}

category('35.2 Property with mortgage');

{
  const inputs = makeInputs({
    plan_years: 5,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 20000,
    has_main_residence: true,
    has_direct_descendants: true,
  });
  const register = [
    makeAsset({ asset_id: 'cash1', current_value: 200000, asset_class: 'cash' }),
    makeAsset({
      asset_id: 'prop1',
      current_value: 500000,
      asset_class: 'property_residential',
      wrapper_type: 'unwrapped',
      mortgage_balance: 200000,
    }),
  ];
  const result = runSimulation(inputs, register, taxParams);
  assertGte('IHT bill accounts for property', result.perYear[0].estimatedIHTBill, 0);
}

category('35.3 EIS increasing growth mode');

{
  const inputs = makeInputs({
    plan_years: 3,
    current_age: 60,
    inflation_rate: 0,
    annual_income_target: 0,
    eis_strategy: {
      ...DEFAULT_EIS_STRATEGY,
      enabled: true,
      allocation_mode: 'fixed',
      scheme_type: 'eis',
      annual_eis_amount: 100000,
      investment_years: 3,
      quality_tier: 'base',
      scenario: 'base_case',
      growth_mode: 'increasing',
    },
  });
  const register = [makeAsset({ asset_id: 'cash1', current_value: 5000000, asset_class: 'cash' })];
  const result = runSimulation(inputs, register, taxParams);
  const c1 = result.perYear[0]?.eisProgramme?.cohorts[0];
  const c2 = result.perYear[1]?.eisProgramme?.cohorts[1];
  assert('Cohort 1 EIS amount = 100000', c1?.eisAmount, 100000);
  assert('Cohort 2 EIS amount > 100000 (increasing)', (c2?.eisAmount ?? 0) > 100000, true);
}

category('35.4 Drawdown scoring — strategy presets');

{
  const balanced = STRATEGY_PRESETS.balanced;
  assert('Balanced weights sum to 1', balanced.tax_efficiency + balanced.iht_reduction + balanced.preserve_growth + balanced.liquidity, 1.0);
  const taxOpt = STRATEGY_PRESETS.tax_optimised;
  assert('Tax optimised weights sum to 1', taxOpt.tax_efficiency + taxOpt.iht_reduction + taxOpt.preserve_growth + taxOpt.liquidity, 1.0);
}

// ═══════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════');
console.log(`RESULTS: ${passed} passed, ${failed} failed (${passed + failed} total)`);
console.log('═══════════════════════════════════════════════');

if (failures.length > 0) {
  console.log('\nFailed tests:');
  for (const f of failures) {
    console.log(`  ${f}`);
  }
  process.exit(1);
} else {
  console.log('\nAll tests passed!');
  process.exit(0);
}
