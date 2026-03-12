import { useState } from 'react';
import type { SimulationInputs, OptimiserResult } from '../engine/decumulation';

type OptMode = 'max_income' | 'max_estate' | 'balanced';

interface OptimiserPanelProps {
  inputs: SimulationInputs;
  optimiserResult: OptimiserResult | null;
  optimiserRunning: boolean;
  onRunOptimiser: (mode: OptMode) => void;
  onApply: () => void;
}

const MODE_OPTIONS: { value: OptMode; label: string; desc: string }[] = [
  { value: 'max_income', label: 'Max Income', desc: 'Highest annual income that keeps you fully funded' },
  { value: 'max_estate', label: 'Max Estate', desc: 'Maximise what you leave behind after IHT' },
  { value: 'balanced', label: 'Balanced', desc: 'Best trade-off between income and estate' },
];

function fmt(n: number): string {
  return '\u00A3' + Math.round(n).toLocaleString('en-GB');
}

export default function OptimiserPanel({ inputs, optimiserResult, optimiserRunning, onRunOptimiser, onApply }: OptimiserPanelProps) {
  const [mode, setMode] = useState<OptMode>('max_income');
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card optimiser-panel">
      <button className="disclosure-header" onClick={() => setExpanded(!expanded)}>
        <span className="action-plan-title">Optimiser</span>
        <span className="disclosure-chevron">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>

      {expanded && (
        <div className="optimiser-body">
          <div className="optimiser-desc">
            Find the optimal income and buffer for your plan duration
            {inputs.legacy_target > 0 && <> while preserving your {fmt(inputs.legacy_target)} legacy target</>}
            {inputs.glory_years.enabled && <> with Glory Years active ({inputs.glory_years.duration}yr at {Math.round(inputs.glory_years.multiplier * 100)}%)</>}.
          </div>

          <div className="optimiser-modes">
            {MODE_OPTIONS.map(m => (
              <button
                key={m.value}
                className={`optimiser-mode-btn ${mode === m.value ? 'active' : ''}`}
                onClick={() => setMode(m.value)}
              >
                <span className="mode-label">{m.label}</span>
                <span className="mode-desc">{m.desc}</span>
              </button>
            ))}
          </div>

          <button
            className="optimiser-run-btn"
            onClick={() => onRunOptimiser(mode)}
            disabled={optimiserRunning}
          >
            {optimiserRunning ? 'Calculating...' : 'Run Optimiser'}
          </button>

          {optimiserResult && optimiserResult.funded_years < inputs.plan_years && !optimiserResult.legacy_met && (
            <div className="optimiser-no-solution">
              No feasible combination found that fully funds your plan
              {inputs.legacy_target > 0 ? ' while meeting your legacy target' : ''}.
              Consider reducing your plan duration, legacy target, or lifestyle level.
            </div>
          )}

          {optimiserResult && (optimiserResult.funded_years >= inputs.plan_years || optimiserResult.legacy_met) && (
            <div className="optimiser-results">
              <div className="optimiser-result-grid">
                <div className="optimiser-result-item">
                  <span className="label">Optimal Annual Income</span>
                  <span className="value mono">{fmt(optimiserResult.optimal_income)}</span>
                </div>
                <div className="optimiser-result-item">
                  <span className="label">Optimal Cash Buffer</span>
                  <span className="value mono">{fmt(optimiserResult.optimal_buffer)}</span>
                </div>
                <div className="optimiser-result-item">
                  <span className="label">Net Estate After IHT</span>
                  <span className="value mono">{fmt(optimiserResult.net_estate_after_iht)}</span>
                </div>
                <div className="optimiser-result-item">
                  <span className="label">Funded Years</span>
                  <span className="value mono">{optimiserResult.funded_years} / {inputs.plan_years}</span>
                </div>
                {inputs.legacy_target > 0 && (
                  <div className="optimiser-result-item">
                    <span className="label">Legacy Target Met</span>
                    <span className={`value mono ${optimiserResult.legacy_met ? 'funded-green' : 'funded-red'}`}>
                      {optimiserResult.legacy_met ? 'Yes' : 'No'}
                    </span>
                  </div>
                )}
                {inputs.glory_years.enabled && (
                  <>
                    <div className="optimiser-result-item">
                      <span className="label">Glory Years Income</span>
                      <span className="value mono">{fmt(optimiserResult.glory_phase_income)}/yr</span>
                    </div>
                    <div className="optimiser-result-item">
                      <span className="label">Calm Years Income</span>
                      <span className="value mono">{fmt(optimiserResult.calm_phase_income)}/yr</span>
                    </div>
                  </>
                )}
              </div>

              <button className="optimiser-apply-btn" onClick={onApply}>
                Apply to Plan
              </button>

              <div className="optimiser-footnote">
                Applying will update your income target and cash buffer to match these results.
                The optimiser ran {optimiserResult.iterations} iterations.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
