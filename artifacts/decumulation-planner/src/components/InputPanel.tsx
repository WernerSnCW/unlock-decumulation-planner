import { useState } from 'react';
import type { SimulationInputs, LifestyleMultiplier, GiftType, PriorityWeights, DrawdownStrategy } from '../engine/decumulation';
import { STRATEGY_PRESETS } from '../engine/decumulation';
import { getPETTaperRate } from '../engine/trustLogic';

interface InputPanelProps {
  inputs: SimulationInputs;
  onChange: (inputs: SimulationInputs) => void;
}

const PRESETS: { value: DrawdownStrategy; label: string }[] = [
  { value: 'tax_optimised', label: 'Tax' },
  { value: 'iht_optimised', label: 'IHT' },
  { value: 'income_first', label: 'Income' },
  { value: 'growth_first', label: 'Growth' },
];

const WEIGHT_KEYS: { key: keyof PriorityWeights; label: string; color: string }[] = [
  { key: 'tax_efficiency', label: 'Tax Efficiency', color: '#00BB77' },
  { key: 'iht_reduction', label: 'IHT Reduction', color: '#EF4444' },
  { key: 'preserve_growth', label: 'Preserve Growth', color: '#3B82F6' },
  { key: 'liquidity', label: 'Liquidity', color: '#F59E0B' },
];

const LIFESTYLES: { value: LifestyleMultiplier; label: string; mult: string }[] = [
  { value: 'modest', label: 'Modest', mult: '\u00D70.7' },
  { value: 'comfortable', label: 'Comfortable', mult: '\u00D71.0' },
  { value: 'generous', label: 'Generous', mult: '\u00D71.5' },
  { value: 'unlimited', label: 'Unlimited', mult: '\u00D72.2' },
];

const INFLATION_OPTIONS = [
  { value: 0.02, label: '2%' },
  { value: 0.03, label: '3%' },
  { value: 0.04, label: '4%' },
  { value: 0.05, label: '5%' },
];

function validate(field: string, value: number): string | null {
  switch (field) {
    case 'annual_income_target':
      if (value < 20000 || value > 500000) return '\u00A320k \u2013 \u00A3500k';
      return null;
    case 'plan_years':
      if (value < 5 || value > 50) return '5 \u2013 50 years';
      return null;
    case 'current_age':
      if (value < 55 || value > 90) return '55 \u2013 90';
      return null;
    case 'state_pension_annual':
      if (value < 0 || value > 50000) return '\u00A30 \u2013 \u00A350k';
      return null;
    case 'annual_gift_amount':
      if (value < 0 || value > 500000) return '\u00A30 \u2013 \u00A3500k';
      return null;
    default:
      return null;
  }
}

function getActivePreset(weights: PriorityWeights): DrawdownStrategy | null {
  for (const [key, preset] of Object.entries(STRATEGY_PRESETS) as [DrawdownStrategy, PriorityWeights][]) {
    if (
      Math.abs(weights.tax_efficiency - preset.tax_efficiency) < 0.01 &&
      Math.abs(weights.iht_reduction - preset.iht_reduction) < 0.01 &&
      Math.abs(weights.preserve_growth - preset.preserve_growth) < 0.01 &&
      Math.abs(weights.liquidity - preset.liquidity) < 0.01
    ) {
      return key;
    }
  }
  return null;
}

export default function InputPanel({ inputs, onChange }: InputPanelProps) {
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const update = (field: keyof SimulationInputs, value: any) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (typeof numValue === 'number') {
      const err = validate(field, numValue);
      setErrors(prev => ({ ...prev, [field]: err }));
    }
    onChange({ ...inputs, [field]: value });
  };

  const handleWeightChange = (key: keyof PriorityWeights, rawPct: number) => {
    const newFraction = rawPct / 100;
    const otherKeys = WEIGHT_KEYS.map(w => w.key).filter(k => k !== key);
    const otherTotal = otherKeys.reduce((sum, k) => sum + inputs.priority_weights[k], 0);
    const remaining = 1 - newFraction;

    const newWeights = { ...inputs.priority_weights, [key]: newFraction };
    if (otherTotal > 0) {
      const scale = remaining / otherTotal;
      for (const k of otherKeys) {
        newWeights[k] = inputs.priority_weights[k] * scale;
      }
    } else {
      const share = remaining / otherKeys.length;
      for (const k of otherKeys) {
        newWeights[k] = share;
      }
    }
    onChange({ ...inputs, priority_weights: newWeights });
  };

  const applyPreset = (strategy: DrawdownStrategy) => {
    onChange({ ...inputs, priority_weights: { ...STRATEGY_PRESETS[strategy] } });
  };

  const activePreset = getActivePreset(inputs.priority_weights);

  return (
    <div className="sidebar">
      <div className="section-title">Income Target</div>

      <div className="input-group">
        <label>Annual Income Target</label>
        <div className="input-prefix">
          <span>{'\u00A3'}</span>
          <input
            type="number"
            value={inputs.annual_income_target}
            onChange={e => update('annual_income_target', parseInt(e.target.value) || 0)}
            className={errors.annual_income_target ? 'input-error' : ''}
          />
        </div>
        {errors.annual_income_target && <span className="error-text">{errors.annual_income_target}</span>}
      </div>

      <div className="input-group">
        <label>Plan Duration (years)</label>
        <input
          type="number"
          value={inputs.plan_years}
          onChange={e => update('plan_years', parseInt(e.target.value) || 5)}
          className={errors.plan_years ? 'input-error' : ''}
        />
        {errors.plan_years && <span className="error-text">{errors.plan_years}</span>}
      </div>

      <div className="input-group">
        <label>Lifestyle Level</label>
        <select
          value={inputs.lifestyle_multiplier}
          onChange={e => update('lifestyle_multiplier', e.target.value as LifestyleMultiplier)}
        >
          {LIFESTYLES.map(l => (
            <option key={l.value} value={l.value}>{l.label} ({l.mult})</option>
          ))}
        </select>
      </div>

      <div className="input-group">
        <label>Current Age</label>
        <input
          type="number"
          value={inputs.current_age}
          onChange={e => update('current_age', parseInt(e.target.value) || 65)}
          className={errors.current_age ? 'input-error' : ''}
        />
        {errors.current_age && <span className="error-text">{errors.current_age}</span>}
      </div>

      <div className="divider" />

      <div className="section-title">Drawdown Priorities</div>

      <div className="preset-row">
        {PRESETS.map(p => (
          <button
            key={p.value}
            className={`preset-btn ${activePreset === p.value ? 'active' : ''}`}
            onClick={() => applyPreset(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="weight-sliders">
        {WEIGHT_KEYS.map(w => {
          const pct = Math.round(inputs.priority_weights[w.key] * 100);
          return (
            <div key={w.key} className="weight-slider-row">
              <div className="weight-label">
                <span className="weight-dot" style={{ background: w.color }} />
                <span>{w.label}</span>
                <span className="weight-pct">{pct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={pct}
                onChange={e => handleWeightChange(w.key, parseInt(e.target.value))}
                className="weight-range"
                style={{ '--slider-color': w.color } as React.CSSProperties}
              />
            </div>
          );
        })}
      </div>

      {!activePreset && (
        <div className="blend-indicator">Custom blend</div>
      )}

      <div className="divider" />

      <div className="section-title">Scenario Toggles</div>

      <div className="toggle-row">
        <label>Apply 2026 BPR Cap</label>
        <button
          className={`toggle-switch ${inputs.apply_2026_bpr_cap ? 'active' : 'inactive'}`}
          onClick={() => update('apply_2026_bpr_cap', !inputs.apply_2026_bpr_cap)}
        >
          <div className="toggle-knob" />
        </button>
      </div>

      <div className="toggle-row">
        <label>Apply 2027 Pension IHT</label>
        <button
          className={`toggle-switch ${inputs.apply_2027_pension_iht ? 'active' : 'inactive'}`}
          onClick={() => update('apply_2027_pension_iht', !inputs.apply_2027_pension_iht)}
        >
          <div className="toggle-knob" />
        </button>
      </div>

      <div className="divider" />

      <div className="section-title">Gifting</div>

      <div className="input-group gifting-section">
        <label>Annual Gift Amount</label>
        <div className="input-prefix">
          <span>{'\u00A3'}</span>
          <input
            type="number"
            value={inputs.annual_gift_amount}
            onChange={e => update('annual_gift_amount', parseInt(e.target.value) || 0)}
            className={errors.annual_gift_amount ? 'input-error' : ''}
          />
        </div>
        {errors.annual_gift_amount && <span className="error-text">{errors.annual_gift_amount}</span>}
      </div>

      <div className="input-group">
        <label>Gift Type</label>
        <select
          value={inputs.gift_type}
          onChange={e => update('gift_type', e.target.value as GiftType)}
        >
          <option value="pet">Potentially Exempt Transfer (PET)</option>
          <option value="discretionary_trust">Discretionary Trust (CLT)</option>
          <option value="nefi">Normal Expenditure (NEFI)</option>
        </select>
      </div>

      {inputs.gift_type === 'pet' && inputs.annual_gift_amount > 0 && (
        <div>
          <div className="section-title" style={{ marginTop: 8 }}>PET Taper Relief</div>
          <div className="pet-taper-grid">
            {[3, 4, 5, 6, 7].map(yr => (
              <div key={yr} className="pet-taper-item">
                <div className="year-label">{yr}yr</div>
                <div>{Math.round(getPETTaperRate(yr) * 100)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="divider" />

      <div className="section-title">Cash Buffer</div>

      <div className="input-group">
        <label>Minimum Cash Reserve</label>
        <div className="input-prefix">
          <span>{'\u00A3'}</span>
          <input
            type="number"
            value={inputs.cash_reserve}
            onChange={e => update('cash_reserve', parseInt(e.target.value) || 0)}
          />
        </div>
        <span style={{ fontSize: 11, color: 'var(--unlock-muted)' }}>
          Keep this amount in cash accounts — not drawn for income
        </span>
      </div>

      <div className="divider" />

      <div className="section-title">Legacy Target</div>

      <div className="input-group">
        <label>Amount to Leave in Will</label>
        <div className="input-prefix">
          <span>{'\u00A3'}</span>
          <input
            type="number"
            value={inputs.legacy_target}
            onChange={e => update('legacy_target', parseInt(e.target.value) || 0)}
          />
        </div>
        <span style={{ fontSize: 11, color: 'var(--unlock-muted)' }}>
          Soft target — living costs always funded first. Warning shown if projected estate falls below this amount
        </span>
      </div>

      <div className="divider" />

      <div className="section-title">Optional</div>

      <div className="input-group">
        <label>Inflation Rate</label>
        <select
          value={inputs.inflation_rate}
          onChange={e => update('inflation_rate', parseFloat(e.target.value))}
        >
          {INFLATION_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="input-group">
        <label>State Pension (annual)</label>
        <div className="input-prefix">
          <span>{'\u00A3'}</span>
          <input
            type="number"
            value={inputs.state_pension_annual}
            onChange={e => update('state_pension_annual', parseInt(e.target.value) || 0)}
            className={errors.state_pension_annual ? 'input-error' : ''}
          />
        </div>
        {errors.state_pension_annual && <span className="error-text">{errors.state_pension_annual}</span>}
      </div>
    </div>
  );
}
