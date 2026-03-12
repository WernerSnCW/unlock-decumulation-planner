export interface GiftHistoryEntry {
  year: number;
  amount: number;
}

export function getCLTCumulative(giftHistory: GiftHistoryEntry[], currentYear: number): number {
  return giftHistory
    .filter(g => g.year > currentYear - 7)
    .reduce((sum, g) => sum + g.amount, 0);
}

export function getPETTaperRate(yearsSinceGift: number): number {
  if (yearsSinceGift <= 3) return 0;
  if (yearsSinceGift <= 4) return 0.20;
  if (yearsSinceGift <= 5) return 0.40;
  if (yearsSinceGift <= 6) return 0.60;
  if (yearsSinceGift <= 7) return 0.80;
  return 1.0;
}

export function checkNEFI(baselineCashIncome: number, spendTarget: number, giftAmount: number): boolean {
  return baselineCashIncome >= spendTarget + giftAmount;
}
