import { useState, useEffect, useRef, type ReactNode } from 'react';
import type { SimulationInputs, SimulationSummary, LifestyleMultiplier, GiftType, PriorityWeights, DrawdownStrategy, GloryYearsConfig, StrategyMechanisms, EISStrategyConfig } from '../engine/decumulation';
import { DEFAULT_EIS_STRATEGY } from '../engine/decumulation';

function InfoTip({ text }: { text: string }) {
  return (
    <span className="info-tip">
      <span className="info-tip-icon">i</span>
      <span className="info-tip-bubble">{text}</span>
    </span>
  );
}

function NumInput({ value, onChange, className, min, max, step }: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [raw, setRaw] = useState(String(value));
  const ref = useRef(value);

  useEffect(() => {
    if (value !== ref.current) {
      setRaw(String(value));
      ref.current = value;
    }
  }, [value]);

  return (
    <input
      type="number"
      value={raw}
      onChange={e => {
        setRaw(e.target.value);
        const n = parseFloat(e.target.value);
        if (!isNaN(n)) {
          ref.current = n;
          onChange(n);
        }
      }}
      onBlur={() => {
        const n = parseFloat(raw);
        if (isNaN(n) || raw.trim() === '') {
          const fallback = min ?? 0;
          setRaw(String(fallback));
          ref.current = fallback;
          onChange(fallback);
        }
      }}
      className={className}
      min={min}
      max={max}
      step={step}
    />
  );
}
import { STRATEGY_PRESETS } from '../engine/decumulation';
import { getPETTaperRate } from '../engine/trustLogic';

interface InputPanelProps {
  inputs: SimulationInputs;
  summary: SimulationSummary | null;
  onChange: (inputs: SimulationInputs) => void;
}

const PRESETS: { value: DrawdownStrategy; label: string }[] = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'tax_optimised', label: 'Tax' },
  { value: 'iht_optimised', label: 'IHT' },
  { value: 'income_first', label: 'Income' },
  { value: 'growth_first', label: 'Growth' },
];

const WEIGHT_KEYS: { key: keyof PriorityWeights; label: string; color: string; tip: string }[] = [
  { key: 'tax_efficiency', label: 'Tax Efficiency', color: '#00BB77', tip: 'Prioritise drawing from assets that minimise income tax and CGT each year.' },
  { key: 'iht_reduction', label: 'IHT Reduction', color: '#EF4444', tip: 'Inheritance Tax — prioritise spending assets that would be taxed at 40% on death.' },
  { key: 'preserve_growth', label: 'Preserve Growth', color: '#3B82F6', tip: 'Keep high-growth assets invested longer so the portfolio compounds more over time.' },
  { key: 'liquidity', label: 'Liquidity', color: '#F59E0B', tip: 'Prefer drawing from easily accessible assets first (cash, ISAs) before illiquid ones (property, pensions).' },
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
    case 'private_pension_income':
      if (value < 0 || value > 500000) return '\u00A30 \u2013 \u00A3500k';
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

function formatMoney(v: number): string {
  return '\u00A3' + Math.round(v).toLocaleString('en-GB');
}

export default function InputPanel({ inputs, summary, onChange }: InputPanelProps) {
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
          <NumInput
            value={inputs.annual_income_target}
            onChange={v => update('annual_income_target', v)}
            className={errors.annual_income_target ? 'input-error' : ''}
          />
        </div>
        {errors.annual_income_target && <span className="error-text">{errors.annual_income_target}</span>}
        <div className="gross-net-row">
          <button
            className={`gross-net-btn ${!inputs.income_is_net ? 'active' : ''}`}
            onClick={() => onChange({ ...inputs, income_is_net: false })}
          >Gross</button>
          <button
            className={`gross-net-btn ${inputs.income_is_net ? 'active' : ''}`}
            onClick={() => onChange({ ...inputs, income_is_net: true })}
          >Net</button>
        </div>
        {inputs.income_is_net && summary && (
          <div className="gross-net-hint">
            Gross equivalent: {formatMoney(summary.grossed_up_income)}
          </div>
        )}
        {!inputs.income_is_net && inputs.annual_income_target > 0 && summary && (
          <div className="gross-net-hint">
            Est. net after tax: {formatMoney(inputs.annual_income_target - (summary.total_income_tax_paid / Math.max(1, inputs.plan_years)))}
          </div>
        )}
      </div>

      <div className="input-group">
        <label>Plan Duration (years)</label>
        <NumInput
          value={inputs.plan_years}
          onChange={v => update('plan_years', v)}
          className={errors.plan_years ? 'input-error' : ''}
          min={1}
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
        <NumInput
          value={inputs.current_age}
          onChange={v => update('current_age', v)}
          className={errors.current_age ? 'input-error' : ''}
          min={55}
        />
        {errors.current_age && <span className="error-text">{errors.current_age}</span>}
      </div>

      <div className="divider" />

      <div className="section-title">Glory Years</div>

      <div className="toggle-row">
        <label>Spend more in early years</label>
        <button
          className={`toggle-switch ${inputs.glory_years.enabled ? 'active' : 'inactive'}`}
          onClick={() => onChange({
            ...inputs,
            glory_years: { ...inputs.glory_years, enabled: !inputs.glory_years.enabled }
          })}
        >
          <div className="toggle-knob" />
        </button>
      </div>

      {inputs.glory_years.enabled && (() => {
        const t = inputs.annual_income_target;
        const m = inputs.glory_years.multiplier;
        const isGlory = inputs.glory_years.target_is_glory;
        const earlyAmt = isGlory ? t : Math.round(t * m);
        const laterAmt = isGlory ? Math.round(t / m) : t;
        return (
        <>
          <div className="input-group">
            <div className="gross-net-row">
              <button
                className={`gross-net-btn ${!isGlory ? 'active' : ''}`}
                onClick={() => onChange({
                  ...inputs,
                  glory_years: { ...inputs.glory_years, target_is_glory: false }
                })}
              >Increase early years</button>
              <button
                className={`gross-net-btn ${isGlory ? 'active' : ''}`}
                onClick={() => onChange({
                  ...inputs,
                  glory_years: { ...inputs.glory_years, target_is_glory: true }
                })}
              >Reduce later years</button>
            </div>
            <span style={{ fontSize: 11, color: 'var(--unlock-muted)', marginTop: 4, display: 'block' }}>
              {isGlory
                ? `Your £${t.toLocaleString('en-GB')} target stays for the first ${inputs.glory_years.duration} years, then drops to £${laterAmt.toLocaleString('en-GB')}`
                : `Your £${t.toLocaleString('en-GB')} target increases to £${earlyAmt.toLocaleString('en-GB')} for the first ${inputs.glory_years.duration} years`}
            </span>
          </div>

          <div className="input-group">
            <label>How many early years</label>
            <input
              type="range"
              min="1"
              max={Math.min(inputs.plan_years, 15)}
              value={inputs.glory_years.duration}
              onChange={e => onChange({
                ...inputs,
                glory_years: { ...inputs.glory_years, duration: parseInt(e.target.value) }
              })}
              className="weight-range"
              style={{ '--slider-color': '#F59E0B' } as React.CSSProperties}
            />
            <div className="glory-years-label">
              <span>First {inputs.glory_years.duration} years</span>
              <span className="glory-years-value">then {inputs.plan_years - inputs.glory_years.duration} years after</span>
            </div>
          </div>

          <div className="input-group">
            <label>By how much ({Math.round(m * 100 - 100)}% {isGlory ? 'reduction' : 'increase'})</label>
            <input
              type="range"
              min="110"
              max="300"
              step="10"
              value={Math.round(m * 100)}
              onChange={e => onChange({
                ...inputs,
                glory_years: { ...inputs.glory_years, multiplier: parseInt(e.target.value) / 100 }
              })}
              className="weight-range"
              style={{ '--slider-color': '#F59E0B' } as React.CSSProperties}
            />
          </div>

          <div className="glory-years-summary">
            <div className="glory-phase">
              <span className="phase-label">Early years (yr 1{'\u2013'}{inputs.glory_years.duration})</span>
              <span className="phase-amount">
                {'\u00A3'}{earlyAmt.toLocaleString('en-GB')}/yr
              </span>
            </div>
            <div className="glory-phase calm">
              <span className="phase-label">Later years (yr {inputs.glory_years.duration + 1}+)</span>
              <span className="phase-amount">
                {'\u00A3'}{laterAmt.toLocaleString('en-GB')}/yr
              </span>
            </div>
          </div>
        </>
        );
      })()}

      <div className="divider" />

      <div className="section-title">EIS Strategy</div>

      <div className="toggle-row">
        <label>Model EIS programme <InfoTip text="Annual allocation into EIS/SEIS qualifying companies. Models income tax relief, BPR (IHT exemption after 2 years), and portfolio growth at the 3.8× base case or total loss worst case." /></label>
        <button
          className={`toggle-switch ${(inputs.eis_strategy ?? DEFAULT_EIS_STRATEGY).enabled ? 'active' : 'inactive'}`}
          onClick={() => onChange({
            ...inputs,
            eis_strategy: { ...(inputs.eis_strategy ?? DEFAULT_EIS_STRATEGY), enabled: !(inputs.eis_strategy ?? DEFAULT_EIS_STRATEGY).enabled }
          })}
        >
          <div className="toggle-knob" />
        </button>
      </div>

      {(inputs.eis_strategy ?? DEFAULT_EIS_STRATEGY).enabled && (() => {
        const eis = inputs.eis_strategy ?? DEFAULT_EIS_STRATEGY;
        const totalAllocation = eis.annual_eis_amount + eis.annual_seis_amount;
        const annualRelief = (eis.annual_eis_amount * 0.30) + (eis.annual_seis_amount * 0.50);
        const effectiveCost = totalAllocation - annualRelief;
        return (
          <>
            <div className="input-group">
              <label>Annual EIS Investment (30% relief)</label>
              <NumInput
                value={eis.annual_eis_amount}
                onChange={v => onChange({
                  ...inputs,
                  eis_strategy: { ...eis, annual_eis_amount: v }
                })}
                min={0}
                step={5000}
              />
            </div>

            <div className="input-group">
              <label>Annual SEIS Investment (50% relief)</label>
              <NumInput
                value={eis.annual_seis_amount}
                onChange={v => onChange({
                  ...inputs,
                  eis_strategy: { ...eis, annual_seis_amount: v }
                })}
                min={0}
                max={200000}
                step={5000}
              />
            </div>

            <div className="input-group">
              <label>Scenario</label>
              <div className="gross-net-row">
                <button
                  className={`gross-net-btn ${eis.scenario === 'base_case' ? 'active' : ''}`}
                  onClick={() => onChange({
                    ...inputs,
                    eis_strategy: { ...eis, scenario: 'base_case' }
                  })}
                >Base Case (3.8×)</button>
                <button
                  className={`gross-net-btn ${eis.scenario === 'worst_case' ? 'active' : ''}`}
                  onClick={() => onChange({
                    ...inputs,
                    eis_strategy: { ...eis, scenario: 'worst_case' }
                  })}
                >All Fail</button>
              </div>
            </div>

            {totalAllocation > 0 && (
              <div className="eis-summary">
                <div className="eis-row">
                  <span>Annual allocation</span>
                  <span>{'\u00A3'}{totalAllocation.toLocaleString('en-GB')}</span>
                </div>
                <div className="eis-row" style={{ color: 'var(--unlock-accent)' }}>
                  <span>Income tax relief</span>
                  <span>{'\u2212\u00A3'}{Math.round(annualRelief).toLocaleString('en-GB')}</span>
                </div>
                <div className="eis-row">
                  <span>Effective annual cost</span>
                  <span>{'\u00A3'}{Math.round(effectiveCost).toLocaleString('en-GB')}</span>
                </div>
                {summary && summary.eis_total_invested > 0 && (
                  <>
                    <div className="eis-divider" />
                    <div className="eis-row">
                      <span>Total invested ({inputs.plan_years}yr)</span>
                      <span>{'\u00A3'}{Math.round(summary.eis_total_invested).toLocaleString('en-GB')}</span>
                    </div>
                    <div className="eis-row" style={{ color: 'var(--unlock-accent)' }}>
                      <span>Total relief</span>
                      <span>{'\u00A3'}{Math.round(summary.eis_total_relief).toLocaleString('en-GB')}</span>
                    </div>
                    <div className="eis-row" style={{ color: '#EC4899' }}>
                      <span>EIS portfolio (base)</span>
                      <span>{'\u00A3'}{Math.round(summary.eis_portfolio_base_case).toLocaleString('en-GB')}</span>
                    </div>
                    <div className="eis-row" style={{ color: '#EF4444' }}>
                      <span>Net cost if all fail</span>
                      <span>{'\u00A3'}{Math.round(summary.eis_worst_case_net_cost).toLocaleString('en-GB')}</span>
                    </div>
                    <div className="eis-row">
                      <span>IHT-exempt (BPR)</span>
                      <span>{'\u00A3'}{Math.round(summary.eis_iht_exempt).toLocaleString('en-GB')}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        );
      })()}

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
                <span>{w.label}<InfoTip text={w.tip} /></span>
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

      <div className="section-title">Strategy Mechanisms</div>
      <span style={{ fontSize: 11, color: 'var(--unlock-muted)', display: 'block', marginBottom: 8 }}>
        Control which asset types to protect or draw from first
      </span>

      <div className="mechanism-group">
        <div className="mechanism-header">IHT Reduction</div>
        <div className="toggle-row compact">
          <label>Preserve EIS for BPR<InfoTip text="Business Property Relief (BPR) — EIS shares held 2+ years qualify for up to 100% IHT relief. Keeping them protects your estate from inheritance tax." /></label>
          <button
            className={`toggle-switch ${inputs.strategy_mechanisms.preserve_eis_bpr ? 'active' : 'inactive'}`}
            onClick={() => onChange({
              ...inputs,
              strategy_mechanisms: { ...inputs.strategy_mechanisms, preserve_eis_bpr: !inputs.strategy_mechanisms.preserve_eis_bpr }
            })}
          >
            <div className="toggle-knob" />
          </button>
        </div>
        <div className="toggle-row compact">
          <label>Preserve AIM for BPR<InfoTip text="AIM shares can qualify for Business Property Relief (BPR) after 2 years, giving up to 100% IHT relief — subject to the 2026 cap if enabled." /></label>
          <button
            className={`toggle-switch ${inputs.strategy_mechanisms.preserve_aim_bpr ? 'active' : 'inactive'}`}
            onClick={() => onChange({
              ...inputs,
              strategy_mechanisms: { ...inputs.strategy_mechanisms, preserve_aim_bpr: !inputs.strategy_mechanisms.preserve_aim_bpr }
            })}
          >
            <div className="toggle-knob" />
          </button>
        </div>
        <div className="toggle-row compact">
          <label>Protect property<InfoTip text="Avoids selling property assets during drawdown. Property is illiquid and selling incurs CGT and disposal costs." /></label>
          <button
            className={`toggle-switch ${inputs.strategy_mechanisms.protect_property ? 'active' : 'inactive'}`}
            onClick={() => onChange({
              ...inputs,
              strategy_mechanisms: { ...inputs.strategy_mechanisms, protect_property: !inputs.strategy_mechanisms.protect_property }
            })}
          >
            <div className="toggle-knob" />
          </button>
        </div>
      </div>

      <div className="mechanism-group">
        <div className="mechanism-header">Tax / Income</div>
        <div className="toggle-row compact">
          <label>Draw ISAs early<InfoTip text="ISA withdrawals are completely tax-free, but spending ISAs early means losing their tax-free growth. Best used when you need to reduce IHT exposure." /></label>
          <button
            className={`toggle-switch ${inputs.strategy_mechanisms.draw_isa_early ? 'active' : 'inactive'}`}
            onClick={() => onChange({
              ...inputs,
              strategy_mechanisms: { ...inputs.strategy_mechanisms, draw_isa_early: !inputs.strategy_mechanisms.draw_isa_early }
            })}
          >
            <div className="toggle-knob" />
          </button>
        </div>
        <div className="toggle-row compact">
          <label>Draw pension early<InfoTip text="Pension withdrawals are taxed as income. Drawing early can use up your personal allowance and basic rate band, but pensions are currently outside IHT (until 2027 rule)." /></label>
          <button
            className={`toggle-switch ${inputs.strategy_mechanisms.draw_pension_early ? 'active' : 'inactive'}`}
            onClick={() => onChange({
              ...inputs,
              strategy_mechanisms: { ...inputs.strategy_mechanisms, draw_pension_early: !inputs.strategy_mechanisms.draw_pension_early }
            })}
          >
            <div className="toggle-knob" />
          </button>
        </div>
        <div className="toggle-row compact">
          <label>Preserve VCT income<InfoTip text="VCT dividends are tax-free. Keeping VCT holdings preserves this income stream, but VCTs are not IHT-exempt." /></label>
          <button
            className={`toggle-switch ${inputs.strategy_mechanisms.preserve_vct_income ? 'active' : 'inactive'}`}
            onClick={() => onChange({
              ...inputs,
              strategy_mechanisms: { ...inputs.strategy_mechanisms, preserve_vct_income: !inputs.strategy_mechanisms.preserve_vct_income }
            })}
          >
            <div className="toggle-knob" />
          </button>
        </div>
      </div>

      <div className="divider" />

      <div className="section-title">Scenario Toggles</div>

      <div className="toggle-row">
        <label>Apply 2026 BPR Cap<InfoTip text="From April 2026, BPR relief is capped at £1M for AIM/unlisted shares. Above this, only 50% relief applies. This is a proposed rule change." /></label>
        <button
          className={`toggle-switch ${inputs.apply_2026_bpr_cap ? 'active' : 'inactive'}`}
          onClick={() => update('apply_2026_bpr_cap', !inputs.apply_2026_bpr_cap)}
        >
          <div className="toggle-knob" />
        </button>
      </div>

      <div className="toggle-row">
        <label>Apply 2027 Pension IHT<InfoTip text="From April 2027, unused pension funds may be included in your estate for IHT. Currently pensions pass outside your estate. This is a proposed rule change." /></label>
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
          <NumInput
            value={inputs.annual_gift_amount}
            onChange={v => update('annual_gift_amount', v)}
            className={errors.annual_gift_amount ? 'input-error' : ''}
          />
        </div>
        {errors.annual_gift_amount && <span className="error-text">{errors.annual_gift_amount}</span>}
      </div>

      <div className="input-group">
        <label>Gift Type<InfoTip text="PET: Gift to individuals, IHT-free if you survive 7 years. CLT: Gift into a trust, taxed at 20% above nil-rate band. NEFI: Regular gifts from surplus income, immediately IHT-free." /></label>
        <select
          value={inputs.gift_type}
          onChange={e => update('gift_type', e.target.value as GiftType)}
        >
          <option value="pet">Potentially Exempt Transfer (PET)</option>
          <option value="discretionary_trust">Chargeable Lifetime Transfer (CLT)</option>
          <option value="nefi">Normal Expenditure from Income (NEFI)</option>
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
          <NumInput
            value={inputs.cash_reserve}
            onChange={v => update('cash_reserve', v)}
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
          <NumInput
            value={inputs.legacy_target}
            onChange={v => update('legacy_target', v)}
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
        <label>Private Pension Income<InfoTip text="Guaranteed income from defined benefit or final salary pensions (e.g. Remploy, civil service). Not SIPP drawdown — that's handled separately." /></label>
        <div className="input-prefix">
          <span>{'\u00A3'}</span>
          <NumInput
            value={inputs.private_pension_income}
            onChange={v => update('private_pension_income', v)}
            className={errors.private_pension_income ? 'input-error' : ''}
          />
        </div>
        {errors.private_pension_income && <span className="error-text">{errors.private_pension_income}</span>}
        <div className="field-hint">Regular pension income (excl. SIPP draws & state pension)</div>
      </div>

      <div className="input-group">
        <label>State Pension (annual)</label>
        <div className="input-prefix">
          <span>{'\u00A3'}</span>
          <NumInput
            value={inputs.state_pension_annual}
            onChange={v => update('state_pension_annual', v)}
            className={errors.state_pension_annual ? 'input-error' : ''}
          />
        </div>
        {errors.state_pension_annual && <span className="error-text">{errors.state_pension_annual}</span>}
      </div>
    </div>
  );
}
