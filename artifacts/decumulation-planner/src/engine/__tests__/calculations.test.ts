import { describe, it, expect } from 'vitest';
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
  type GiftHistoryEntry,
} from '../trustLogic';
import taxParametersJson from '../../data/taxParameters.json';

// Use the actual 2025/26 schedule row from taxParameters.json
const params2025: TaxParams = taxParametersJson.schedule[0] as TaxParams;

// ---------------------------------------------------------------------------
// 1. calculateIncomeTax — worked example from CALCULATIONS.json
//    55k non-savings, 2k savings, 3k dividends => 10,875.75
// ---------------------------------------------------------------------------
describe('calculateIncomeTax', () => {
  it('should match the worked example (55k non-savings, 2k savings, 3k dividends)', () => {
    const tax = calculateIncomeTax(55_000, 2_000, 3_000, params2025);
    expect(tax).toBe(10_875.75);
  });

  it('should return 0 when total income is within the personal allowance', () => {
    const tax = calculateIncomeTax(12_570, 0, 0, params2025);
    expect(tax).toBe(0);
  });

  it('should handle zero income', () => {
    const tax = calculateIncomeTax(0, 0, 0, params2025);
    expect(tax).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. calculateMarginalRate — PA trap at 110k, basic at 30k, additional at 200k
// ---------------------------------------------------------------------------
describe('calculateMarginalRate', () => {
  it('should return 0.60 for income at 110k (PA taper trap)', () => {
    const rate = calculateMarginalRate(110_000, 0, 0, params2025);
    expect(rate).toBe(0.60);
  });

  it('should return basic rate (0.20) for income at 30k', () => {
    const rate = calculateMarginalRate(30_000, 0, 0, params2025);
    expect(rate).toBe(0.20);
  });

  it('should return additional rate (0.45) for income at 200k', () => {
    const rate = calculateMarginalRate(200_000, 0, 0, params2025);
    expect(rate).toBe(0.45);
  });

  it('should return 0 for zero income', () => {
    const rate = calculateMarginalRate(0, 0, 0, params2025);
    expect(rate).toBe(0);
  });

  it('should return higher rate (0.40) for income just above basic band', () => {
    // Income of 60k: taxableIncome = 60000-12570=47430, basicBandSize=37700 => higher band
    const rate = calculateMarginalRate(60_000, 0, 0, params2025);
    expect(rate).toBe(0.40);
  });
});

// ---------------------------------------------------------------------------
// 3. calculatePCLS — worked example (100k crystallisation, 268275 LSA)
// ---------------------------------------------------------------------------
describe('calculatePCLS', () => {
  it('should match the worked example (100k crystallisation, full LSA)', () => {
    const result = calculatePCLS(100_000, 268_275);
    expect(result.pcls).toBe(25_000);
    expect(result.taxableDraw).toBe(75_000);
    expect(result.newRemainingLSA).toBe(243_275);
  });

  it('should cap PCLS at remaining LSA when LSA is less than 25%', () => {
    const result = calculatePCLS(100_000, 10_000);
    expect(result.pcls).toBe(10_000);
    expect(result.taxableDraw).toBe(90_000);
    expect(result.newRemainingLSA).toBe(0);
  });

  it('should return zero PCLS when LSA is exhausted', () => {
    const result = calculatePCLS(100_000, 0);
    expect(result.pcls).toBe(0);
    expect(result.taxableDraw).toBe(100_000);
    expect(result.newRemainingLSA).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. calculateCGT — worked example (20k gain, 40k gross income)
//    Note: second param is grossIncome, not taxableIncomeAfterPA
// ---------------------------------------------------------------------------
describe('calculateCGT', () => {
  it('should match the worked example (20k gain, 40k grossIncome)', () => {
    const cgt = calculateCGT(20_000, 40_000, params2025);
    // taxableGain = 20000 - 3000 = 17000
    // basicBandRemaining = 50270 - 40000 = 10270
    // inBasic = 10270, inHigher = 6730
    // cgt = 10270 * 0.18 + 6730 * 0.24 = 1848.60 + 1615.20 = 3463.80
    expect(cgt).toBeCloseTo(3_463.80, 2);
  });

  it('should return 0 when gain is within the exempt amount', () => {
    const cgt = calculateCGT(3_000, 40_000, params2025);
    expect(cgt).toBe(0);
  });

  it('should apply all gain at higher rate when grossIncome exceeds basic band', () => {
    const cgt = calculateCGT(10_000, 60_000, params2025);
    // taxableGain = 10000 - 3000 = 7000
    // basicBandRemaining = max(0, 50270 - 60000) = 0
    // all at higher rate: 7000 * 0.24 = 1680
    expect(cgt).toBeCloseTo(1_680, 2);
  });
});

// ---------------------------------------------------------------------------
// 5. calculateIHTBill — worked example
//    (2.2M estate, 300k BPR, 500k pension, 2027 toggle on, rnrbQualifies=true)
//    Expected IHT = 830,000
// ---------------------------------------------------------------------------
describe('calculateIHTBill', () => {
  it('should match the worked example (2.2M estate, pension IHT on, RNRB tapered to 0)', () => {
    const toggles: Toggles = {
      apply_2026_bpr_cap: false,
      apply_2027_pension_iht: true,
    };
    const iht = calculateIHTBill(
      2_200_000,  // estate
      300_000,    // bprTotal
      0,          // cltCumulative
      500_000,    // pensionValue
      toggles,
      params2025,
      2028,       // calendarYear
      true,       // rnrbQualifies
      0           // charitablePct
    );
    // grossEstate = 2200000 + 500000 = 2700000
    // RNRB: excess = 700000, RNRB = max(0, 175000 - 350000) = 0
    // taxableEstate = 2700000 - 300000 = 2400000
    // totalNRB = 325000; taxableAboveNRB = 2075000
    // IHT = 2075000 * 0.40 = 830000
    expect(iht).toBe(830_000);
  });

  // ---------------------------------------------------------------------------
  // 6. calculateIHTBill — test RNRB (estate under 2M, full RNRB)
  // ---------------------------------------------------------------------------
  it('should apply full RNRB of 175k when estate is under 2M and rnrbQualifies is true', () => {
    const toggles: Toggles = {
      apply_2026_bpr_cap: false,
      apply_2027_pension_iht: false,
    };
    const iht = calculateIHTBill(
      1_500_000,  // estate (under 2M)
      0,          // bprTotal
      0,          // cltCumulative
      0,          // pensionValue
      toggles,
      params2025,
      2025,       // calendarYear
      true,       // rnrbQualifies
      0           // charitablePct
    );
    // grossEstate = 1500000 (no pension added)
    // RNRB: 1500000 <= 2000000 => full RNRB = 175000
    // taxableEstate = 1500000 - 0 = 1500000
    // totalNRB = 325000 + 175000 = 500000
    // taxableAboveNRB = 1500000 - 500000 = 1000000
    // IHT = 1000000 * 0.40 = 400000
    expect(iht).toBe(400_000);
  });

  // ---------------------------------------------------------------------------
  // 7. calculateIHTBill — test charitable (charitablePct=10, should use 36% rate)
  // ---------------------------------------------------------------------------
  it('should apply 36% charitable rate when charitablePct >= 10', () => {
    const toggles: Toggles = {
      apply_2026_bpr_cap: false,
      apply_2027_pension_iht: false,
    };
    const iht = calculateIHTBill(
      1_000_000,  // estate
      0,          // bprTotal
      0,          // cltCumulative
      0,          // pensionValue
      toggles,
      params2025,
      2025,       // calendarYear
      false,      // rnrbQualifies
      10          // charitablePct — triggers 36% rate
    );
    // grossEstate = 1000000
    // RNRB = 0 (rnrbQualifies is false)
    // taxableEstate = 1000000
    // totalNRB = 325000; taxableAboveNRB = 675000
    // charitableDeduction = 675000 * 0.10 = 67500
    // taxableAfterCharity = 675000 - 67500 = 607500
    // IHT = 607500 * 0.36 = 218700
    expect(iht).toBe(218_700);
  });

  it('should use standard 40% rate when charitablePct is below 10', () => {
    const toggles: Toggles = {
      apply_2026_bpr_cap: false,
      apply_2027_pension_iht: false,
    };
    const iht = calculateIHTBill(
      1_000_000,
      0,
      0,
      0,
      toggles,
      params2025,
      2025,
      false,
      9  // below 10 — standard rate
    );
    // taxableAboveNRB = 1000000 - 325000 = 675000
    // IHT = 675000 * 0.40 = 270000
    expect(iht).toBe(270_000);
  });
});

// ---------------------------------------------------------------------------
// 8. getCLTCumulative — worked example
// ---------------------------------------------------------------------------
describe('getCLTCumulative', () => {
  it('should match the worked example (year 1 gift excluded, year 5 gift included at currentYear 8)', () => {
    const giftHistory: GiftHistoryEntry[] = [
      { year: 1, amount: 325_000 },
      { year: 5, amount: 100_000 },
    ];
    // Window: year > 8 - 7 = year > 1
    // Year 1: 1 > 1 is false => excluded
    // Year 5: 5 > 1 is true => included
    const result = getCLTCumulative(giftHistory, 8);
    expect(result).toBe(100_000);
  });

  it('should return 0 for empty gift history', () => {
    const result = getCLTCumulative([], 10);
    expect(result).toBe(0);
  });

  it('should include gifts exactly at the boundary (year > currentYear - 7)', () => {
    const giftHistory: GiftHistoryEntry[] = [
      { year: 2, amount: 50_000 },
    ];
    // currentYear=8: year > 1 => 2 > 1 is true => included
    expect(getCLTCumulative(giftHistory, 8)).toBe(50_000);

    // currentYear=9: year > 2 => 2 > 2 is false => excluded (strict >)
    expect(getCLTCumulative(giftHistory, 9)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 9. getPETTaperRate — test all bracket boundaries
// ---------------------------------------------------------------------------
describe('getPETTaperRate', () => {
  it('should return 0.00 for 0-3 years (no taper relief)', () => {
    expect(getPETTaperRate(0)).toBe(0);
    expect(getPETTaperRate(1)).toBe(0);
    expect(getPETTaperRate(2)).toBe(0);
    expect(getPETTaperRate(3)).toBe(0);
  });

  it('should return 0.20 for 3-4 years', () => {
    expect(getPETTaperRate(3.5)).toBe(0.20);
    expect(getPETTaperRate(4)).toBe(0.20);
  });

  it('should return 0.40 for 4-5 years', () => {
    expect(getPETTaperRate(4.5)).toBe(0.40);
    expect(getPETTaperRate(5)).toBe(0.40);
  });

  it('should return 0.60 for 5-6 years', () => {
    expect(getPETTaperRate(5.5)).toBe(0.60);
    expect(getPETTaperRate(6)).toBe(0.60);
  });

  it('should return 0.80 for 6-7 years', () => {
    expect(getPETTaperRate(6.5)).toBe(0.80);
    expect(getPETTaperRate(7)).toBe(0.80);
  });

  it('should return 1.00 for 7+ years (fully exempt)', () => {
    expect(getPETTaperRate(7.1)).toBe(1.0);
    expect(getPETTaperRate(10)).toBe(1.0);
    expect(getPETTaperRate(100)).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// 10. checkNEFI — worked example
// ---------------------------------------------------------------------------
describe('checkNEFI', () => {
  it('should return true when income covers spend + gift (worked example)', () => {
    // 80000 >= 50000 + 25000 = 75000 => true
    const result = checkNEFI(80_000, 50_000, 25_000);
    expect(result).toBe(true);
  });

  it('should return false when income is insufficient', () => {
    // 70000 >= 50000 + 25000 = 75000 => false
    const result = checkNEFI(70_000, 50_000, 25_000);
    expect(result).toBe(false);
  });

  it('should return true when income exactly equals spend + gift', () => {
    // 75000 >= 50000 + 25000 = 75000 => true (>= comparison)
    const result = checkNEFI(75_000, 50_000, 25_000);
    expect(result).toBe(true);
  });
});
