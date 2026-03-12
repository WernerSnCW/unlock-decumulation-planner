import { useState } from 'react';
import type { SimulationInputs, DrawdownStrategy, LifestyleMultiplier, GiftType } from '../engine/decumulation';
import { getPETTaperRate } from '../engine/trustLogic';

interface InputPanelProps {
  inputs: SimulationInputs;
  onChange: (inputs: SimulationInputs) => void;
}

const STRATEGIES: { value: DrawdownStrategy; label: string }[] = [
  { value: 'tax_optimised', label: 'Tax Optimised' },
  { value: 'iht_optimised', label: 'IHT Optimised' },
  { value: 'income_first', label: 'Income First' },
  { value: 'growth_first', label: 'Growth First' },
];

const LIFESTYLES: { value: LifestyleMultiplier; label: string; mult: string }[] = [
  { value: 'modest', label: 'Modest', mult: '×0.7' },
  { value: 'comfortable', label: 'Comfortable', mult: '×1.0' },
  { value: 'generous', label: 'Generous', mult: '×1.5' },
  { value: 'unlimited', label: 'Unlimited', mult: '×2.2' },
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
      if (value < 20000 || value > 500000) return '£20k – £500k';
      return null;
    case 'plan_years':
      if (value < 5 || value > 50) return '5 – 50 years';
      return null;
    case 'current_age':
      if (value < 40 || value > 90) return '40 – 90';
      return null;
    case 'state_pension_annual':
      if (value < 0 || value > 50000) return '£0 – £50k';
      return null;
    case 'annual_gift_amount':
      if (value < 0 || value > 500000) return '£0 – £500k';
      return null;
    default:
      return null;
  }
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

  return (
    <div className="sidebar">
      <div className="section-title">Income Target</div>

      <div className="input-group">
        <label>Annual Income Target</label>
        <div className="input-prefix">
          <span>£</span>
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

      <div className="section-title">Drawdown Strategy</div>
      <div className="strategy-tabs">
        {STRATEGIES.map(s => (
          <button
            key={s.value}
            className={`strategy-tab ${inputs.drawdown_strategy === s.value ? 'active' : ''}`}
            onClick={() => update('drawdown_strategy', s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

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
          <span>£</span>
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
          <span>£</span>
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
