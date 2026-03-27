import type { Asset } from '../engine/decumulation';

export type ImpactLevel = 'critical' | 'high' | 'medium' | 'low';

export interface FieldCheck {
  key: string;
  label: string;
  weight: number;
  impact: ImpactLevel;
  appliesTo: (a: Asset) => boolean;
  isMissing: (a: Asset) => boolean;
  consequence: string;
}

export const FIELD_CHECKS: FieldCheck[] = [
  {
    key: 'assumed_growth_rate',
    label: 'Growth Rate',
    weight: 0.25,
    impact: 'high',
    appliesTo: () => true,
    isMissing: (a) => !a.assumed_growth_rate || a.assumed_growth_rate === 0,
    consequence: 'Projection will assume 0% growth — portfolio value will shrink each year as income is drawn.',
  },
  {
    key: 'acquisition_cost',
    label: 'Acquisition Cost',
    weight: 0.20,
    impact: 'high',
    appliesTo: (a) => ['isa', 'property_investment', 'property_residential', 'aim_shares', 'vct', 'eis'].includes(a.asset_class) || a.wrapper_type === 'unwrapped',
    isMissing: (a) => a.acquisition_cost == null || a.acquisition_cost === 0,
    consequence: 'CGT will assume zero cost basis — maximum possible taxable gain on disposal.',
  },
  {
    key: 'income_generated',
    label: 'Annual Income',
    weight: 0.15,
    impact: 'high',
    appliesTo: (a) => ['property_investment', 'vct', 'cash'].includes(a.asset_class),
    isMissing: (a) => !a.income_generated || a.income_generated === 0,
    consequence: 'No income will be modelled from this asset — more drawdown from other assets needed.',
  },
  {
    key: 'is_iht_exempt',
    label: 'IHT Exempt Status',
    weight: 0.15,
    impact: 'high',
    appliesTo: (a) => ['eis', 'aim_shares'].includes(a.asset_class),
    isMissing: (a) => a.is_iht_exempt !== true,
    consequence: 'Asset will be included in IHT-liable estate — BPR relief will not be applied.',
  },
  {
    key: 'wrapper_type',
    label: 'Wrapper Type',
    weight: 0.10,
    impact: 'medium',
    appliesTo: () => true,
    isMissing: (a) => !a.wrapper_type,
    consequence: 'Tax treatment will default to unwrapped — ISA and pension benefits ignored.',
  },
  {
    key: 'pension_type',
    label: 'Pension Type',
    weight: 0.10,
    impact: 'medium',
    appliesTo: (a) => a.asset_class === 'pension',
    isMissing: (a) => !a.pension_type,
    consequence: 'Pension type will default to SIPP — may affect drawdown rules if this is a DB pension.',
  },
  {
    key: 'tax_relief_claimed',
    label: 'Tax Relief Claimed',
    weight: 0.08,
    impact: 'medium',
    appliesTo: (a) => ['vct', 'eis'].includes(a.asset_class),
    isMissing: (a) => !a.tax_relief_claimed || a.tax_relief_claimed === 0,
    consequence: 'No prior relief will be recorded — net cost calculations will overstate the true cost.',
  },
  {
    key: 'original_subscription_amount',
    label: 'Original Subscription',
    weight: 0.08,
    impact: 'medium',
    appliesTo: (a) => ['vct', 'eis'].includes(a.asset_class),
    isMissing: (a) => !a.original_subscription_amount,
    consequence: 'Relief entitlement cannot be validated against the original investment amount.',
  },
  {
    key: 'estimated_disposal_cost_pct',
    label: 'Disposal Cost %',
    weight: 0.05,
    impact: 'medium',
    appliesTo: (a) => ['property_investment', 'property_residential'].includes(a.asset_class),
    isMissing: (a) => !a.estimated_disposal_cost_pct || a.estimated_disposal_cost_pct === 0,
    consequence: 'No selling costs will be deducted — net proceeds will be overstated.',
  },
  {
    key: 'acquisition_date',
    label: 'Acquisition Date',
    weight: 0.04,
    impact: 'low',
    appliesTo: (a) => ['eis', 'aim_shares', 'property_investment'].includes(a.asset_class),
    isMissing: (a) => !a.acquisition_date,
    consequence: 'BPR qualifying period cannot be verified — may affect IHT relief timing.',
  },
  {
    key: 'relief_claimed_type',
    label: 'Relief Type',
    weight: 0.04,
    impact: 'medium',
    appliesTo: (a) => ['vct', 'eis'].includes(a.asset_class),
    isMissing: (a) => !a.relief_claimed_type || a.relief_claimed_type === 'none',
    consequence: 'Relief type unknown — programme summaries may be inaccurate.',
  },
];

/** Get the impact level for a specific field on a specific asset, or null if field is complete */
export function getFieldGap(asset: Asset, fieldKey: string): FieldCheck | null {
  const check = FIELD_CHECKS.find(c => c.key === fieldKey);
  if (!check) return null;
  if (!check.appliesTo(asset)) return null;
  if (!check.isMissing(asset)) return null;
  return check;
}

/** Assess a single asset, returning score and missing fields */
export function assessAsset(asset: Asset): {
  score: number;
  missingFields: FieldCheck[];
  applicableChecks: number;
} {
  const applicable = FIELD_CHECKS.filter(c => c.appliesTo(asset));
  const missing = applicable.filter(c => c.isMissing(asset));

  const totalWeight = applicable.reduce((s, c) => s + c.weight, 0);
  const missingWeight = missing.reduce((s, c) => s + c.weight, 0);

  const score = totalWeight > 0
    ? Math.round(((totalWeight - missingWeight) / totalWeight) * 100)
    : 100;

  return { score, missingFields: missing, applicableChecks: applicable.length };
}
