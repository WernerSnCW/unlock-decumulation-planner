import { useState } from 'react';
import { Link } from 'wouter';
import { usePlanner } from '../context/PlannerContext';
import InputPanel from '../components/InputPanel';
import OptimiserPanel from '../components/OptimiserPanel';
import StrategyComparison from '../components/StrategyComparison';
import EISScenarioComparison from '../components/EISScenarioComparison';
import PageGuide from '../components/PageGuide';
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
        <PageGuide
          title="Planning"
          summary="Configure your retirement income target, strategy, and simulation parameters."
          actions={[
            'Set your target annual income and plan duration',
            'Choose a drawdown strategy: tax-optimised, IHT-optimised, or balanced',
            'Open the settings bar to fine-tune advanced options',
          ]}
          tips={[
            'The simulation recalculates instantly as you change any input',
            'Glory Years lets you model higher spending in early retirement',
            'The Optimiser can search for the best combination of settings',
          ]}
        />
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
          data-tour="settings-bar"
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          <div className="settings-bar-summary">
            <span className="settings-bar-title">
              {settingsOpen ? 'Settings' : 'Settings'}
            </span>
            {!settingsOpen && (
              <div className="settings-bar-chips">
                {/* Portfolio value */}
                <span className="settings-chip highlight" title={`Total portfolio value across ${assets.length} assets`}>{fmt(assets.reduce((s, a) => s + (a.current_value ?? 0), 0))}</span>

                {/* Core settings */}
                <span className="settings-chip" title={`Annual income target (${inputs.income_is_net ? 'after tax' : 'before tax'})`}>{fmt(inputs.annual_income_target)} {inputs.income_is_net ? 'net' : 'gross'}</span>
                <span className="settings-chip" title={`Plan runs for ${inputs.plan_years} years from age ${inputs.current_age} to age ${inputs.current_age + inputs.plan_years}`}>{inputs.plan_years}yr · Age {inputs.current_age}–{inputs.current_age + inputs.plan_years}</span>
                <span className="settings-chip" title={`Lifestyle spending level — adjusts the income target by a multiplier`}>{lifestyle}</span>
                <span className="settings-chip" title={`Drawdown strategy — controls how assets are prioritised for withdrawal`}>{strategy}</span>
                <span className="settings-chip" title={`Assumed annual inflation rate applied to spending targets`}>Inflation {(inputs.inflation_rate * 100).toFixed(0)}%</span>

                {/* Pension income */}
                {(inputs.state_pension_annual > 0 || inputs.private_pension_income > 0) && (
                  <span className="settings-chip" title={`State pension: ${fmt(inputs.state_pension_annual)}/yr\nPrivate pension: ${fmt(inputs.private_pension_income)}/yr`}>Pension {fmt(inputs.state_pension_annual + inputs.private_pension_income)}/yr</span>
                )}

                {/* Legacy & reserve */}
                {inputs.legacy_target > 0 && <span className="settings-chip" title="Target amount to leave as inheritance at end of plan">Legacy {fmt(inputs.legacy_target)}</span>}
                {inputs.cash_reserve > 0 && <span className="settings-chip" title="Minimum cash balance to maintain throughout the plan">Reserve {fmt(inputs.cash_reserve)}</span>}

                {/* Gifting */}
                {inputs.annual_gift_amount > 0 && (
                  <span className="settings-chip accent" title={`Annual gifting of ${fmt(inputs.annual_gift_amount)} as ${inputs.gift_type.replace(/_/g, ' ')}`}>Gifting {fmt(inputs.annual_gift_amount)}/yr</span>
                )}

                {/* Optional programmes */}
                {inputs.glory_years?.enabled && (
                  <span className="settings-chip accent" title={`Spend ${((inputs.glory_years.multiplier - 1) * 100).toFixed(0)}% more in the first ${inputs.glory_years.duration} years of the plan`}>Glory Years ({inputs.glory_years.duration}yr +{((inputs.glory_years.multiplier - 1) * 100).toFixed(0)}%)</span>
                )}
                {inputs.eis_strategy?.enabled && (
                  <span className="settings-chip accent" title={`Enterprise Investment Scheme — ${fmt(inputs.eis_strategy.annual_amount ?? 0)}/yr for income tax relief and IHT exemption after 2 years`}>EIS {fmt(inputs.eis_strategy.annual_amount ?? 0)}/yr</span>
                )}
                {inputs.vct_strategy?.enabled && (
                  <span className="settings-chip accent" title={`Venture Capital Trust — ${fmt(inputs.vct_strategy.annual_amount ?? 0)}/yr for 30% income tax relief and tax-free dividends`}>VCT {fmt(inputs.vct_strategy.annual_amount ?? 0)}/yr</span>
                )}

                {/* Estate & IHT */}
                {inputs.has_main_residence && inputs.has_direct_descendants && (
                  <span className="settings-chip accent" title="Residence Nil-Rate Band active — up to £175,000 additional nil-rate band reduces IHT">RNRB</span>
                )}
                {inputs.charitable_legacy_pct >= 10 && (
                  <span className="settings-chip accent" title={`${inputs.charitable_legacy_pct}% of estate to charity — IHT rate reduced from 40% to 36%`}>Charity {inputs.charitable_legacy_pct}%</span>
                )}
                {inputs.nrb_trust_enabled && (
                  <span className="settings-chip accent" title="NRB trust strategy — gifts up to £325,000 into trust every 7 years to reduce estate">NRB Trust</span>
                )}

                {/* Scenario flags */}
                {inputs.apply_2026_bpr_cap && <span className="settings-chip warn" title="Models the proposed 2026 cap on Business Property Relief at £1m (50% relief above)">2026 BPR Cap</span>}
                {inputs.apply_2027_pension_iht && <span className="settings-chip warn" title="Models the proposed 2027 change bringing pensions into the IHT-liable estate">2027 Pension IHT</span>}
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
              assets={assets}
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
            {inputs.eis_strategy?.enabled && (
              <EISScenarioComparison
                inputs={inputs}
                register={assets}
                taxParams={taxParams}
                currentScenario={inputs.eis_strategy.scenario ?? 'base_case'}
              />
            )}
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
