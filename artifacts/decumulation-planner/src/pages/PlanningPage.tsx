import { useState } from 'react';
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
                <span className="settings-chip">{fmt(inputs.annual_income_target)} {inputs.income_is_net ? 'net' : 'gross'}</span>
                <span className="settings-chip">{inputs.plan_years}yr</span>
                <span className="settings-chip">Age {inputs.current_age}</span>
                <span className="settings-chip">{lifestyle}</span>
                <span className="settings-chip">{strategy}</span>
                {inputs.glory_years.enabled && <span className="settings-chip accent">Glory Years</span>}
                {inputs.eis_strategy?.enabled && <span className="settings-chip accent">EIS</span>}
                {inputs.vct_strategy?.enabled && <span className="settings-chip accent">VCT</span>}
                {inputs.annual_gift_amount > 0 && <span className="settings-chip accent">Gifting</span>}
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
      </div>
    </div>
  );
}
