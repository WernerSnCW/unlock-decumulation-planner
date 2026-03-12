import { useState } from 'react';
import type { YearResult, Asset, SimulationInputs } from '../engine/decumulation';

interface Props {
  perYear: YearResult[];
  register: Asset[];
  inputs: SimulationInputs;
}

function formatMoney(value: number): string {
  if (Math.abs(value) >= 10000) {
    return '£' + Math.round(value).toLocaleString('en-GB');
  }
  return '£' + value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

interface ActionStep {
  type: 'draw' | 'tax' | 'gift' | 'milestone' | 'shortfall';
  label: string;
  amount?: number;
  detail?: string;
}

function getAssetVerb(asset: Asset): string {
  const cls = asset.asset_class || '';
  const wrapper = asset.wrapper_type || '';
  if (wrapper === 'pension') return 'Draw';
  if (wrapper === 'isa') return 'Withdraw from';
  if (cls === 'cash' || wrapper === 'cash') return 'Withdraw from';
  if (cls.includes('property') || wrapper === 'property') return 'Sell / release equity from';
  if (cls === 'vct' || wrapper === 'vct') return 'Sell holdings in';
  if (cls === 'eis' || wrapper === 'eis') return 'Sell holdings in';
  if (cls.includes('aim') || wrapper === 'aim') return 'Sell holdings in';
  return 'Draw from';
}

function buildYearActions(
  yr: YearResult,
  prevYr: YearResult | null,
  register: Asset[],
  inputs: SimulationInputs
): ActionStep[] {
  const steps: ActionStep[] = [];
  const assetMap = new Map(register.map(a => [a.asset_id, a]));

  if (yr.baselineCashIncome > 0) {
    const parts: string[] = [];
    if (inputs.state_pension_annual > 0) parts.push('State Pension');
    for (const a of register) {
      if (a.income_generated > 0 && (yr.valuesByAssetClass[a.asset_class] ?? 0) > 0) {
        parts.push(a.label);
      }
    }
    steps.push({
      type: 'draw',
      label: `Receive natural income`,
      amount: yr.baselineCashIncome,
      detail: parts.length > 0 ? `From: ${parts.join(', ')}` : undefined,
    });
  }

  const sortedDraws = Object.entries(yr.drawsByAsset)
    .filter(([, amount]) => amount > 0)
    .sort(([, a], [, b]) => b - a);

  for (const [assetId, amount] of sortedDraws) {
    const asset = assetMap.get(assetId);
    if (!asset) continue;
    const verb = getAssetVerb(asset);
    const isPension = asset.wrapper_type === 'pension';

    let detail: string | undefined;
    if (isPension && prevYr && yr.tflsRemaining < prevYr.tflsRemaining) {
      const pclsTaken = prevYr.tflsRemaining - yr.tflsRemaining;
      if (pclsTaken > 0) {
        detail = `Includes ${formatMoney(pclsTaken)} tax-free lump sum (PCLS)`;
      }
    }

    steps.push({
      type: 'draw',
      label: `${verb} ${asset.label}`,
      amount,
      detail,
    });
  }

  if (yr.giftedThisYear > 0) {
    const giftLabel = inputs.gift_type === 'pet'
      ? 'Potentially Exempt Transfer (PET)'
      : inputs.gift_type === 'discretionary_trust'
        ? 'Discretionary Trust (CLT)'
        : 'Normal Expenditure (NEFI)';
    const giftDetail = inputs.gift_type === 'discretionary_trust'
      ? `7-year cumulative CLT: ${formatMoney(yr.clt7yrCumulative)}`
      : inputs.gift_type === 'pet'
        ? `PET — becomes exempt after 7 years if donor survives`
        : `Normal expenditure from income — immediately IHT exempt`;
    steps.push({
      type: 'gift',
      label: `Make gift — ${giftLabel}`,
      amount: yr.giftedThisYear,
      detail: giftDetail,
    });
  }

  if (yr.incomeTaxThisYear > 0 || yr.cgtThisYear > 0) {
    const parts: string[] = [];
    if (yr.incomeTaxThisYear > 0) parts.push(`Income Tax ${formatMoney(yr.incomeTaxThisYear)}`);
    if (yr.cgtThisYear > 0) parts.push(`CGT ${formatMoney(yr.cgtThisYear)}`);
    steps.push({
      type: 'tax',
      label: `Pay tax: ${parts.join(' + ')}`,
      amount: yr.incomeTaxThisYear + yr.cgtThisYear,
    });
  }

  if (!yr.spendMet) {
    steps.push({
      type: 'shortfall',
      label: `Shortfall — target not met`,
      amount: yr.shortfall,
      detail: `Income target: ${formatMoney(yr.spendTargetNominal)}, shortfall: ${formatMoney(yr.shortfall)}`,
    });
  }

  if (prevYr && yr.tflsRemaining <= 0 && prevYr.tflsRemaining > 0) {
    steps.push({
      type: 'milestone',
      label: 'Tax-free lump sum (PCLS/LSA) fully used',
    });
  }

  if (yr.year === 2026 && inputs.apply_2026_bpr_cap) {
    steps.push({
      type: 'milestone',
      label: 'BPR cap takes effect — relief limited to 50% above £1M',
    });
  }

  if (yr.year === 2027 && inputs.apply_2027_pension_iht) {
    steps.push({
      type: 'milestone',
      label: 'Undrawn pension enters IHT estate',
    });
  }

  for (const flag of yr.flags) {
    if (flag.severity === 'error' || flag.severity === 'warning') {
      const alreadyCovered = steps.some(s => s.type === 'milestone' && s.label.includes(flag.message.substring(0, 20)));
      if (!alreadyCovered) {
        steps.push({
          type: 'milestone',
          label: flag.message,
        });
      }
    }
  }

  return steps;
}

function getStepIcon(type: ActionStep['type']): string {
  switch (type) {
    case 'draw': return '↗';
    case 'tax': return '◇';
    case 'gift': return '♡';
    case 'milestone': return '◆';
    case 'shortfall': return '✗';
  }
}

function getStepColorClass(type: ActionStep['type']): string {
  switch (type) {
    case 'draw': return 'step-draw';
    case 'tax': return 'step-tax';
    case 'gift': return 'step-gift';
    case 'milestone': return 'step-milestone';
    case 'shortfall': return 'step-shortfall';
  }
}

export default function ActionPlan({ perYear, register, inputs }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [showAllYears, setShowAllYears] = useState(false);

  const planYears = perYear.filter(yr => !yr.isShadow);
  if (planYears.length === 0) return null;

  const significantYears = planYears.filter((yr, idx) => {
    const prevYr = idx > 0 ? planYears[idx - 1] : null;
    const actions = buildYearActions(yr, prevYr, register, inputs);
    const hasDraws = Object.keys(yr.drawsByAsset).length > 0;
    const hasMilestone = actions.some(a => a.type === 'milestone');
    const hasGift = yr.giftedThisYear > 0;
    const hasShortfall = !yr.spendMet;

    if (idx === 0) return true;
    if (hasMilestone || hasShortfall || hasGift) return true;
    if (idx === planYears.length - 1) return true;

    if (prevYr && hasDraws) {
      const prevDrawKeys = new Set(Object.keys(prevYr.drawsByAsset));
      const currDrawKeys = new Set(Object.keys(yr.drawsByAsset));
      const changed = [...currDrawKeys].some(k => !prevDrawKeys.has(k)) ||
                      [...prevDrawKeys].some(k => !currDrawKeys.has(k));
      if (changed) return true;
    }

    return false;
  });

  const yearsToShow = showAllYears ? planYears : significantYears;

  return (
    <div className="action-plan">
      <button
        className="action-plan-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="action-plan-title">Recommended Action Plan</span>
        <span className="action-plan-count">{planYears.length} years</span>
        <span className="disclosure-chevron">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="action-plan-body">
          <div className="action-plan-controls">
            <button
              className={`action-view-btn ${!showAllYears ? 'active' : ''}`}
              onClick={() => setShowAllYears(false)}
            >
              Key years ({significantYears.length})
            </button>
            <button
              className={`action-view-btn ${showAllYears ? 'active' : ''}`}
              onClick={() => setShowAllYears(true)}
            >
              All years ({planYears.length})
            </button>
          </div>

          <div className="action-timeline">
            {yearsToShow.map((yr, idx) => {
              const prevYr = (() => {
                const planIdx = planYears.indexOf(yr);
                return planIdx > 0 ? planYears[planIdx - 1] : null;
              })();
              const actions = buildYearActions(yr, prevYr, register, inputs);
              const isLastYear = idx === yearsToShow.length - 1;

              return (
                <div key={yr.planYear} className="timeline-year">
                  <div className="timeline-marker">
                    <div className="timeline-dot" />
                    {!isLastYear && <div className="timeline-line" />}
                  </div>

                  <div className="timeline-content">
                    <div className="timeline-year-header">
                      <span className="timeline-year-label">
                        {yr.year}
                      </span>
                      <span className="timeline-age">Age {yr.age}</span>
                      <span className="timeline-portfolio">
                        Portfolio: {formatMoney(yr.totalPortfolioValue)}
                      </span>
                      {yr.estimatedIHTBill > 0 && (
                        <span className="timeline-iht">
                          IHT: {formatMoney(yr.estimatedIHTBill)}
                        </span>
                      )}
                    </div>

                    <div className="timeline-steps">
                      {actions.map((step, i) => (
                        <div key={i} className={`action-step ${getStepColorClass(step.type)}`}>
                          <span className="step-icon">{getStepIcon(step.type)}</span>
                          <div className="step-content">
                            <div className="step-label">
                              {step.label}
                              {step.amount !== undefined && (
                                <span className="step-amount">{formatMoney(step.amount)}</span>
                              )}
                            </div>
                            {step.detail && (
                              <div className="step-detail">{step.detail}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {!showAllYears && idx < yearsToShow.length - 1 && (() => {
                      const currIdx = planYears.indexOf(yr);
                      const nextShown = yearsToShow[idx + 1];
                      const nextIdx = planYears.indexOf(nextShown);
                      const skipped = nextIdx - currIdx - 1;
                      if (skipped > 0) {
                        return (
                          <div className="timeline-skip">
                            {skipped} year{skipped > 1 ? 's' : ''} with no major changes
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="action-plan-summary">
            <div className="plan-summary-item">
              <span className="plan-summary-label">Total income drawn</span>
              <span className="plan-summary-value">
                {formatMoney(planYears.reduce((sum, yr) => sum + yr.spendTargetNominal - yr.shortfall, 0))}
              </span>
            </div>
            <div className="plan-summary-item">
              <span className="plan-summary-label">Total tax paid</span>
              <span className="plan-summary-value">
                {formatMoney(planYears.reduce((sum, yr) => sum + yr.incomeTaxThisYear + yr.cgtThisYear, 0))}
              </span>
            </div>
            <div className="plan-summary-item">
              <span className="plan-summary-label">Total gifted</span>
              <span className="plan-summary-value">
                {formatMoney(planYears.reduce((sum, yr) => sum + yr.giftedThisYear, 0))}
              </span>
            </div>
            <div className="plan-summary-item">
              <span className="plan-summary-label">Estate at plan end</span>
              <span className="plan-summary-value">
                {formatMoney(planYears[planYears.length - 1]?.totalPortfolioValue ?? 0)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
