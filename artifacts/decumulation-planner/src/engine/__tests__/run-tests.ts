/**
 * Standalone calculation tests — run with: npx tsx src/engine/__tests__/run-tests.ts
 */
import {
  calculateIncomeTax,
  calculateMarginalRate,
  calculatePCLS,
  calculateCGT,
  calculateIHTBill,
  type TaxParams,
  type Toggles,
} from '../taxLogic';
import {
  getCLTCumulative,
  getPETTaperRate,
  checkNEFI,
} from '../trustLogic';
import taxParametersJson from '../../data/taxParameters.json';

const params2025 = taxParametersJson.schedule[0] as TaxParams;

let pass = 0;
let fail = 0;

function assert(name: string, actual: number | boolean, expected: number | boolean, tolerance = 0.01) {
  if (typeof actual === 'number' && typeof expected === 'number') {
    if (Math.abs(actual - expected) <= tolerance) {
      pass++;
      console.log(`  ✓ ${name}`);
    } else {
      fail++;
      console.log(`  ✗ ${name}: expected ${expected}, got ${actual}`);
    }
  } else {
    if (actual === expected) {
      pass++;
      console.log(`  ✓ ${name}`);
    } else {
      fail++;
      console.log(`  ✗ ${name}: expected ${expected}, got ${actual}`);
    }
  }
}

console.log('\n=== calculateIncomeTax ===');
assert('Worked example (55k/2k/3k)', calculateIncomeTax(55000, 2000, 3000, params2025), 10875.75);
assert('Within PA (12570)', calculateIncomeTax(12570, 0, 0, params2025), 0);
assert('Zero income', calculateIncomeTax(0, 0, 0, params2025), 0);

console.log('\n=== calculateMarginalRate ===');
assert('PA trap at 110k', calculateMarginalRate(110000, 0, 0, params2025), 0.60);
assert('Basic rate at 30k', calculateMarginalRate(30000, 0, 0, params2025), 0.20);
assert('Additional rate at 200k', calculateMarginalRate(200000, 0, 0, params2025), 0.45);
assert('Higher rate at 60k', calculateMarginalRate(60000, 0, 0, params2025), 0.40);
assert('Zero income', calculateMarginalRate(0, 0, 0, params2025), 0);

console.log('\n=== calculatePCLS ===');
const pcls1 = calculatePCLS(100000, 268275);
assert('PCLS amount', pcls1.pcls, 25000);
assert('Taxable draw', pcls1.taxableDraw, 75000);
assert('New LSA', pcls1.newRemainingLSA, 243275);
const pcls2 = calculatePCLS(100000, 10000);
assert('PCLS capped at LSA', pcls2.pcls, 10000);
const pcls3 = calculatePCLS(100000, 0);
assert('PCLS zero when LSA exhausted', pcls3.pcls, 0);

console.log('\n=== calculateCGT (grossIncome parameter) ===');
assert('Worked example (20k gain, 40k gross)', calculateCGT(20000, 40000, params2025), 3463.80);
assert('Gain within exempt amount', calculateCGT(3000, 40000, params2025), 0);
assert('All at higher rate (gross > basic band)', calculateCGT(10000, 60000, params2025), 1680);

console.log('\n=== calculateIHTBill ===');
const togglesOff: Toggles = { apply_2026_bpr_cap: false, apply_2027_pension_iht: false };
const togglesPension: Toggles = { apply_2026_bpr_cap: false, apply_2027_pension_iht: true };

// Worked example: 2.2M estate, 300k BPR, 500k pension, 2027 on, RNRB tapered to 0
assert('Worked example (830k)',
  calculateIHTBill(2200000, 300000, 0, 500000, togglesPension, params2025, 2028, true, 0), 830000);

// RNRB: 1.5M estate, full RNRB of 175k
assert('Full RNRB (400k)',
  calculateIHTBill(1500000, 0, 0, 0, togglesOff, params2025, 2025, true, 0), 400000);

// No RNRB: same estate, rnrbQualifies=false
assert('No RNRB (470k)',
  calculateIHTBill(1500000, 0, 0, 0, togglesOff, params2025, 2025, false, 0), 470000);

// Charitable: 10% → 36% rate
assert('Charitable 10% (218700)',
  calculateIHTBill(1000000, 0, 0, 0, togglesOff, params2025, 2025, false, 10), 218700);

// Standard: 9% → 40% rate (no deduction)
assert('Standard rate at 9% (270000)',
  calculateIHTBill(1000000, 0, 0, 0, togglesOff, params2025, 2025, false, 9), 270000);

console.log('\n=== getCLTCumulative ===');
const gifts = [{ year: 1, amount: 325000 }, { year: 5, amount: 100000 }];
assert('Worked example (100k)', getCLTCumulative(gifts, 8), 100000);
assert('Empty history', getCLTCumulative([], 10), 0);
assert('Boundary: year 2 at currentYear 8 (included)', getCLTCumulative([{ year: 2, amount: 50000 }], 8), 50000);
assert('Boundary: year 2 at currentYear 9 (excluded)', getCLTCumulative([{ year: 2, amount: 50000 }], 9), 0);

console.log('\n=== getPETTaperRate ===');
assert('0-3 years: 0%', getPETTaperRate(2), 0);
assert('3 years: 0%', getPETTaperRate(3), 0);
assert('3.5 years: 20%', getPETTaperRate(3.5), 0.20);
assert('4.5 years: 40%', getPETTaperRate(4.5), 0.40);
assert('5.5 years: 60%', getPETTaperRate(5.5), 0.60);
assert('6.5 years: 80%', getPETTaperRate(6.5), 0.80);
assert('7+ years: 100%', getPETTaperRate(10), 1.0);

console.log('\n=== checkNEFI ===');
assert('Worked example (true)', checkNEFI(80000, 50000, 25000), true);
assert('Insufficient (false)', checkNEFI(70000, 50000, 25000), false);
assert('Exact boundary (true)', checkNEFI(75000, 50000, 25000), true);

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${pass} passed, ${fail} failed out of ${pass + fail} tests`);
if (fail > 0) process.exit(1);
