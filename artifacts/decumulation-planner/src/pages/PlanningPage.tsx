import { useState } from 'react';
import { Link } from 'wouter';
import { usePlanner } from '../context/PlannerContext';
import InputPanel from '../components/InputPanel';
import OptimiserPanel from '../components/OptimiserPanel';
import StrategyComparison from '../components/StrategyComparison';
import { STRATEGY_PRESETS } from '../engine/decumulation';
import type { DrawdownStrategy, PriorityWeights } from '../engine/decumulation';

function fmt(n: number): string {
  return '\u00A3' + Math.round(n).toLocaleString('en-GB');
}

export default function PlanningPage() {
  const {
    inputs,
    assets,
    result,
    optimiserResult,
    optimiserRunning,
    taxParams,
    updateInputs,
    runOptimiserAction,
    applyOptimiser,
  } = usePlanner();

  const [settingsOpen, setSettingsOpen] = useState(false);

  if (assets.length === 0) {
    return (
      <div className="page-placeholder">
        <h2>Add assets first</h2>
        <p>Go to the Portfolio tab to add your assets before configuring your plan.</p>
      </div>
    );
  }

  const lifestyle = inputs.lifestyle_multiplier.charAt(0).toUpperCase() + inputs.lifestyle_multiplier.slice(1);
  const strategy = (() => {
    const presetLabels: Record<string, string> = {
      balanced: 'Balanced', tax_optimised: 'Tax', iht_optimised: 'IHT',
      income_first: 'Income', growth_first: 'Growth',
    };
    const pw = inputs.priority_weights;
    for (const [key, preset] of Object.entries(STRATEGY_PRESETS) as [DrawdownStrategy, PriorityWeights][]) {
      if (
        Math.abs(pw.tax_efficiency - preset.tax_efficiency) < 0.01 &&
        Math.abs(pw.iht_reduction - preset.iht_reduction) < 0.01 &&
        Math.abs(pw.preserve_growth - preset.preserve_growth) < 0.01 &&
        Math.abs(pw.liquidity - preset.liquidity) < 0.01
      ) {
        return presetLabels[key] ?? key;
      }
    }
    return 'Custom';
  })();

  return (
    <div className="planning-page-v2">
      <div className="page-intro">
        <h2>Planning</h2>
        <p>Set your income target and strategy preferences. The simulation recalculates automatically as you change settings.</p>
        <details className="page-tip">
          <summary>Tip</summary>
          <span>Start with a strategy preset (Balanced, Tax, IHT) then fine-tune the sliders. Use the Optimiser to let the engine find the best weights for you.</span>
        </details>
      </div>

      {/* Collapsible settings bar */}
      <div className={`settings-bar ${settingsOpen ? 'open' : ''}`}>
        <button
          className="settings-bar-toggle"
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          <div className="settings-bar-summary">
            <span className="settings-bar-title">
              {settingsOpen ? 'Settings' : 'Settings'}
            </span>
            {!settingsOpen && (
              <div className="settings-bar-chips">
                {/* Portfolio value */}
                <span className="settings-chip highlight">{fmt(assets.reduce((s, a) => s + (a.current_value ?? 0), 0))}</span>

                {/* Core settings */}
                <span className="settings-chip">{fmt(inputs.annual_income_target)} {inputs.income_is_net ? 'net' : 'gross'}</span>
                <span className="settings-chip">{inputs.plan_years}yr · Age {inputs.current_age}–{inputs.current_age + inputs.plan_years}</span>
                <span className="settings-chip">{lifestyle}</span>
                <span className="settings-chip">{strategy}</span>
                <span className="settings-chip">Inflation {(inputs.inflation_rate * 100).toFixed(0)}%</span>

                {/* Pension income */}
                {(inputs.state_pension_annual > 0 || inputs.private_pension_income > 0) && (
                  <span className="settings-chip">Pension {fmt(inputs.state_pension_annual + inputs.private_pension_income)}/yr</span>
                )}

                {/* Legacy & reserve */}
                {inputs.legacy_target > 0 && <span className="settings-chip">Legacy {fmt(inputs.legacy_target)}</span>}
                {inputs.cash_reserve > 0 && <span className="settings-chip">Reserve {fmt(inputs.cash_reserve)}</span>}

                {/* Gifting */}
                {inputs.annual_gift_amount > 0 && (
                  <span className="settings-chip accent">Gifting {fmt(inputs.annual_gift_amount)}/yr</span>
                )}

                {/* Optional programmes */}
                {inputs.glory_years?.enabled && (
                  <span className="settings-chip accent">Glory Years ({inputs.glory_years.duration}yr +{((inputs.glory_years.multiplier - 1) * 100).toFixed(0)}%)</span>
                )}
                {inputs.eis_strategy?.enabled && (
                  <span className="settings-chip accent">EIS {fmt(inputs.eis_strategy.annual_amount ?? 0)}/yr</span>
                )}
                {inputs.vct_strategy?.enabled && (
                  <span className="settings-chip accent">VCT {fmt(inputs.vct_strategy.annual_amount ?? 0)}/yr</span>
                )}

                {/* Scenario flags */}
                {inputs.apply_2026_bpr_cap && <span className="settings-chip warn">2026 BPR Cap</span>}
                {inputs.apply_2027_pension_iht && <span className="settings-chip warn">2027 Pension IHT</span>}
              </div>
            )}
          </div>
          <span className={`settings-bar-chevron ${settingsOpen ? 'open' : ''}`}>
            {'\u25BC'}
          </span>
        </button>

        {settingsOpen && (
          <div className="settings-bar-body">
            <InputPanel
              inputs={inputs}
              summary={result?.summary ?? null}
              onChange={updateInputs}
            />
          </div>
        )}
      </div>

      {/* Full-width main content */}
      <div className="planning-main-v2">
        {result && (
          <>
            <OptimiserPanel
              inputs={inputs}
              optimiserResult={optimiserResult}
              optimiserRunning={optimiserRunning}
              onRunOptimiser={runOptimiserAction}
              onApply={applyOptimiser}
            />
            <StrategyComparison
              inputs={inputs}
              register={assets}
              taxParams={taxParams}
            />
          </>
        )}

        {!result && (
          <div className="page-placeholder">
            <h2>Simulation error</h2>
            <p>Check your inputs and try again.</p>
          </div>
        )}

        {result && (
          <div className="next-step">
            <Link href="/app/analysis" className="next-step-btn">
              Next: View analysis →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
