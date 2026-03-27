import { useState } from 'react';
import type { Asset } from '../engine/decumulation';

/* ─── Field checks: what matters and why ─── */

interface FieldCheck {
  key: string;
  label: string;
  weight: number; // 0–1, how much this field matters for accuracy
  appliesTo: (a: Asset) => boolean;
  isMissing: (a: Asset) => boolean;
  consequence: string;
}

const FIELD_CHECKS: FieldCheck[] = [
  {
    key: 'assumed_growth_rate',
    label: 'Growth Rate',
    weight: 0.25,
    appliesTo: () => true,
    isMissing: (a) => !a.assumed_growth_rate || a.assumed_growth_rate === 0,
    consequence: 'Projection will assume 0% growth — portfolio value will shrink each year as income is drawn.',
  },
  {
    key: 'acquisition_cost',
    label: 'Acquisition Cost',
    weight: 0.20,
    appliesTo: (a) => ['isa', 'property_investment', 'property_residential', 'aim_shares', 'vct', 'eis'].includes(a.asset_class) || a.wrapper_type === 'unwrapped',
    isMissing: (a) => a.acquisition_cost == null || a.acquisition_cost === 0,
    consequence: 'CGT will assume zero cost basis — maximum possible taxable gain on disposal.',
  },
  {
    key: 'income_generated',
    label: 'Annual Income',
    weight: 0.15,
    appliesTo: (a) => ['property_investment', 'vct', 'cash'].includes(a.asset_class),
    isMissing: (a) => !a.income_generated || a.income_generated === 0,
    consequence: 'No income will be modelled from this asset — more drawdown from other assets needed.',
  },
  {
    key: 'is_iht_exempt',
    label: 'IHT Exempt Status',
    weight: 0.15,
    appliesTo: (a) => ['eis', 'aim_shares'].includes(a.asset_class),
    isMissing: (a) => a.is_iht_exempt !== true,
    consequence: 'Asset will be included in IHT-liable estate — BPR relief will not be applied.',
  },
  {
    key: 'wrapper_type',
    label: 'Wrapper Type',
    weight: 0.10,
    appliesTo: () => true,
    isMissing: (a) => !a.wrapper_type,
    consequence: 'Tax treatment will default to unwrapped — ISA and pension benefits ignored.',
  },
  {
    key: 'pension_type',
    label: 'Pension Type',
    weight: 0.10,
    appliesTo: (a) => a.asset_class === 'pension',
    isMissing: (a) => !a.pension_type,
    consequence: 'Pension type will default to SIPP — may affect drawdown rules if this is a DB pension.',
  },
  {
    key: 'tax_relief_claimed',
    label: 'Tax Relief Claimed',
    weight: 0.08,
    appliesTo: (a) => ['vct', 'eis'].includes(a.asset_class),
    isMissing: (a) => !a.tax_relief_claimed || a.tax_relief_claimed === 0,
    consequence: 'No prior relief will be recorded — net cost calculations will overstate the true cost.',
  },
  {
    key: 'original_subscription_amount',
    label: 'Original Subscription',
    weight: 0.08,
    appliesTo: (a) => ['vct', 'eis'].includes(a.asset_class),
    isMissing: (a) => !a.original_subscription_amount,
    consequence: 'Relief entitlement cannot be validated against the original investment amount.',
  },
  {
    key: 'estimated_disposal_cost_pct',
    label: 'Disposal Cost %',
    weight: 0.05,
    appliesTo: (a) => ['property_investment', 'property_residential'].includes(a.asset_class),
    isMissing: (a) => !a.estimated_disposal_cost_pct || a.estimated_disposal_cost_pct === 0,
    consequence: 'No selling costs will be deducted — net proceeds will be overstated.',
  },
  {
    key: 'acquisition_date',
    label: 'Acquisition Date',
    weight: 0.04,
    appliesTo: (a) => ['eis', 'aim_shares', 'property_investment'].includes(a.asset_class),
    isMissing: (a) => !a.acquisition_date,
    consequence: 'BPR qualifying period cannot be verified — may affect IHT relief timing.',
  },
  {
    key: 'mortgage_balance',
    label: 'Mortgage Balance',
    weight: 0.04,
    appliesTo: (a) => ['property_investment', 'property_residential'].includes(a.asset_class),
    isMissing: (a) => false, // 0 is valid (no mortgage)
    consequence: '',
  },
];

/* ─── Score calculation ─── */

interface AssetAssessment {
  asset: Asset;
  score: number; // 0–100
  missingFields: { check: FieldCheck; }[];
  applicableChecks: number;
}

function assessAsset(asset: Asset): AssetAssessment {
  const applicable = FIELD_CHECKS.filter(c => c.appliesTo(asset));
  const missing = applicable.filter(c => c.isMissing(asset));

  const totalWeight = applicable.reduce((s, c) => s + c.weight, 0);
  const missingWeight = missing.reduce((s, c) => s + c.weight, 0);

  const score = totalWeight > 0
    ? Math.round(((totalWeight - missingWeight) / totalWeight) * 100)
    : 100;

  return {
    asset,
    score,
    missingFields: missing.map(c => ({ check: c })),
    applicableChecks: applicable.length,
  };
}

/* ─── Portfolio-level observations ─── */

interface PortfolioObservation {
  level: 'info' | 'warning' | 'success';
  message: string;
}

function getPortfolioObservations(assets: Asset[]): PortfolioObservation[] {
  const obs: PortfolioObservation[] = [];
  const classes = new Set(assets.map(a => a.asset_class));

  if (assets.length === 1) {
    obs.push({
      level: 'info',
      message: 'Only 1 asset — drawdown strategy comparison and cross-wrapper optimisation will be limited.',
    });
  }

  if (classes.size === 1) {
    obs.push({
      level: 'info',
      message: `All assets are ${assets[0].asset_class.replace(/_/g, ' ')} — the tool works best with multiple asset classes to optimise drawdown sequencing.`,
    });
  }

  if (!classes.has('pension')) {
    obs.push({
      level: 'info',
      message: 'No pension assets in portfolio — pension drawdown and tax-free lump sum modelling will not apply.',
    });
  }

  if (!classes.has('isa')) {
    obs.push({
      level: 'info',
      message: 'No ISA holdings — tax-free drawdown from ISAs is a key optimisation lever.',
    });
  }

  const unwrappedWithoutCost = assets.filter(
    a => a.wrapper_type === 'unwrapped' && (!a.acquisition_cost || a.acquisition_cost === 0) && a.current_value > 10000
  );
  if (unwrappedWithoutCost.length > 0) {
    const totalVal = unwrappedWithoutCost.reduce((s, a) => s + a.current_value, 0);
    obs.push({
      level: 'warning',
      message: `${unwrappedWithoutCost.length} unwrapped asset${unwrappedWithoutCost.length > 1 ? 's' : ''} worth £${Math.round(totalVal).toLocaleString('en-GB')} have no acquisition cost — CGT will be calculated on the full value.`,
    });
  }

  const zeroGrowth = assets.filter(a => !a.assumed_growth_rate || a.assumed_growth_rate === 0);
  if (zeroGrowth.length > 0 && zeroGrowth.length < assets.length) {
    const totalVal = zeroGrowth.reduce((s, a) => s + a.current_value, 0);
    obs.push({
      level: 'warning',
      message: `${zeroGrowth.length} asset${zeroGrowth.length > 1 ? 's' : ''} worth £${Math.round(totalVal).toLocaleString('en-GB')} have 0% growth — portfolio value will shrink faster than expected.`,
    });
  }

  const allComplete = assets.every(a => assessAsset(a).score === 100);
  if (allComplete) {
    obs.push({
      level: 'success',
      message: 'All assets have complete data — simulation accuracy is at its highest.',
    });
  }

  return obs;
}

/* ─── Component ─── */

interface Props {
  assets: Asset[];
}

function scoreColor(score: number): string {
  if (score >= 90) return 'var(--tone-success)';
  if (score >= 70) return '#F59E0B';
  return '#EF4444';
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Incomplete';
}

export default function DataCompletenessPanel({ assets }: Props) {
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  if (assets.length === 0) return null;

  const assessments = assets
    .map(a => assessAsset(a))
    .sort((a, b) => a.score - b.score); // worst first

  // Value-weighted overall score
  const totalValue = assets.reduce((s, a) => s + a.current_value, 0);
  const overallScore = totalValue > 0
    ? Math.round(
        assessments.reduce((s, a) => s + a.score * a.asset.current_value, 0) / totalValue
      )
    : Math.round(assessments.reduce((s, a) => s + a.score, 0) / assessments.length);

  const observations = getPortfolioObservations(assets);
  const assetsWithGaps = assessments.filter(a => a.score < 100);

  return (
    <div className="completeness-panel">
      <button
        className="completeness-header"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="completeness-header-left">
          <div
            className="completeness-ring"
            style={{
              '--ring-pct': `${overallScore}%`,
              '--ring-color': scoreColor(overallScore),
            } as React.CSSProperties}
          >
            <span>{overallScore}</span>
          </div>
          <div>
            <span className="completeness-title">Data Completeness</span>
            <span className="completeness-subtitle">
              {scoreLabel(overallScore)} — {assetsWithGaps.length === 0
                ? 'all fields populated'
                : `${assetsWithGaps.length} asset${assetsWithGaps.length > 1 ? 's' : ''} with gaps`
              }
            </span>
          </div>
        </div>
        <span className={`settings-bar-chevron ${collapsed ? '' : 'open'}`}>▼</span>
      </button>

      {!collapsed && (
        <div className="completeness-body">
          {/* Portfolio observations */}
          {observations.length > 0 && (
            <div className="completeness-observations">
              {observations.map((o, i) => (
                <div key={i} className={`completeness-obs completeness-obs-${o.level}`}>
                  <span className="obs-icon">
                    {o.level === 'warning' ? '⚠' : o.level === 'success' ? '✓' : 'ℹ'}
                  </span>
                  <span>{o.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Per-asset rows */}
          {assessments.length > 0 && (
            <div className="completeness-assets">
              {assessments.map(a => {
                const isExpanded = expandedAsset === a.asset.asset_id;
                const hasMissing = a.missingFields.length > 0;
                return (
                  <div key={a.asset.asset_id} className="completeness-asset">
                    <button
                      className="completeness-asset-row"
                      onClick={() => setExpandedAsset(isExpanded ? null : a.asset.asset_id)}
                      disabled={!hasMissing}
                    >
                      <div className="completeness-asset-bar-wrap">
                        <div
                          className="completeness-asset-bar"
                          style={{
                            width: `${a.score}%`,
                            background: scoreColor(a.score),
                          }}
                        />
                      </div>
                      <span className="completeness-asset-name">{a.asset.label}</span>
                      <span className="completeness-asset-value">
                        £{Math.round(a.asset.current_value).toLocaleString('en-GB')}
                      </span>
                      <span
                        className="completeness-asset-score"
                        style={{ color: scoreColor(a.score) }}
                      >
                        {a.score}%
                      </span>
                      {hasMissing && (
                        <span className={`completeness-expand ${isExpanded ? 'open' : ''}`}>▸</span>
                      )}
                    </button>
                    {isExpanded && hasMissing && (
                      <div className="completeness-missing">
                        {a.missingFields.map(m => (
                          <div key={m.check.key} className="completeness-missing-row">
                            <span className="missing-field">{m.check.label}</span>
                            <span className="missing-consequence">{m.check.consequence}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
