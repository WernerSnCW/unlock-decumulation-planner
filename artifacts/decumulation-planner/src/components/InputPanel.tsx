import { useState, useEffect, useRef, type ReactNode } from 'react';
import type { SimulationInputs, SimulationSummary, LifestyleMultiplier, GiftType, PriorityWeights, DrawdownStrategy, GloryYearsConfig, StrategyMechanisms, EISStrategyConfig, VCTStrategyConfig, EISCGTEvent, Asset } from '../engine/decumulation';
import { DEFAULT_EIS_STRATEGY, DEFAULT_VCT_STRATEGY } from '../engine/decumulation';

function InfoTip({ text }: { text: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const iconRef = useRef<HTMLSpanElement>(null);

  const show = () => {
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    const bubbleWidth = 240;
    let left = rect.left + rect.width / 2 - bubbleWidth / 2;
    if (left < 8) left = 8;
    if (left + bubbleWidth > window.innerWidth - 8) left = window.innerWidth - 8 - bubbleWidth;
    setPos({ top: rect.top - 8, left });
  };

  const hide = () => setPos(null);

  return (
    <span className="info-tip" onMouseEnter={show} onMouseLeave={hide}>
      <span className="info-tip-icon" ref={iconRef}>i</span>
      {pos && (
        <span
          className="info-tip-bubble visible"
          style={{ top: pos.top, left: pos.left, transform: 'translateY(-100%)' }}
        >
          {text}
        </span>
      )}
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

function CollapsibleSection({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = title.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={`collapsible-section ${open ? '' : 'collapsed'}`}>
      <button
        type="button"
        className="collapsible-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={`section-${id}`}
      >
        <div className="section-title">{title}</div>
        <span className="collapsible-chevron">{'\u25BC'}</span>
      </button>
      <div
        id={`section-${id}`}
        className="collapsible-body"
        style={{ maxHeight: open ? '9999px' : '0' }}
        {...(!open ? { inert: true as any } : {})}
      >
        {children}
      </div>
    </div>
  );
}

interface InputPanelProps {
  inputs: SimulationInputs;
  summary: SimulationSummary | null;
  assets: Asset[];
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

export default function InputPanel({ inputs, summary, assets: portfolioAssets, onChange }: InputPanelProps) {
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
      <div className="section-title">Core Settings</div>
      <div className="settings-core-row">

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

      </div>{/* end settings-core-row */}

      <div className="settings-sections-grid">

      <CollapsibleSection title="Glory Years" defaultOpen={false}>

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

      </CollapsibleSection>

      <div className="divider" />

      <CollapsibleSection title="EIS Strategy" defaultOpen={false}>

      <div className="toggle-row">
        <label>Model EIS programme <InfoTip text="Annual allocation into EIS/SEIS qualifying companies. Models income tax relief, BPR (IHT exemption after 2 years), and portfolio growth based on quality tier and scenario. Choose from Cautious/Base/Strong quality tiers and Bear/Base/Bull/All Fail scenarios." /></label>
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
        const isTaxMode = (eis.allocation_mode ?? 'fixed') === 'tax_allowance';
        const eisAmt = isTaxMode ? (summary?.eis_annual_eis_used ?? 0) : eis.annual_eis_amount;
        const seisAmt = isTaxMode ? (summary?.eis_annual_seis_used ?? 0) : eis.annual_seis_amount;
        const totalAllocation = eisAmt + seisAmt;
        const annualRelief = (eisAmt * 0.30) + (seisAmt * 0.50);
        const effectiveCost = totalAllocation - annualRelief;
        return (
          <>
            <div className="input-group">
              <label>Allocation Mode <InfoTip text="Fixed: set exact EIS/SEIS amounts. Tax Allowance: auto-calculate the maximum EIS/SEIS investment needed to zero out your estimated income tax, then invest a percentage of that allowance. SEIS fills first (up to £200k cap, 50% relief) then EIS (30% relief)." /></label>
              <div className="gross-net-row">
                <button
                  className={`gross-net-btn ${!isTaxMode ? 'active' : ''}`}
                  onClick={() => onChange({
                    ...inputs,
                    eis_strategy: { ...eis, allocation_mode: 'fixed' }
                  })}
                >Fixed</button>
                <button
                  className={`gross-net-btn ${isTaxMode ? 'active' : ''}`}
                  onClick={() => onChange({
                    ...inputs,
                    eis_strategy: { ...eis, allocation_mode: 'tax_allowance' }
                  })}
                >Tax Allowance</button>
              </div>
            </div>

            {isTaxMode ? (
              <>
                <div className="input-group">
                  <label>% of Tax Allowance to Invest <InfoTip text="100% invests enough EIS/SEIS to fully zero out your income tax. Lower percentages invest proportionally less." /></label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={5}
                      value={eis.allowance_pct ?? 100}
                      onChange={e => onChange({
                        ...inputs,
                        eis_strategy: { ...eis, allowance_pct: Number(e.target.value) }
                      })}
                      style={{ flex: 1 }}
                    />
                    <span style={{ minWidth: '42px', textAlign: 'right', color: 'var(--unlock-accent)', fontWeight: 600 }}>{eis.allowance_pct ?? 100}%</span>
                  </div>
                </div>

                {summary && (
                  <div className="eis-summary">
                    <div className="eis-row" style={{ color: '#94A3B8' }}>
                      <span>Estimated income tax</span>
                      <span>{'\u00A3'}{Math.round(summary.eis_tax_allowance_income_tax).toLocaleString('en-GB')}</span>
                    </div>
                    <div className="eis-row" style={{ color: '#94A3B8' }}>
                      <span>Max SEIS to zero tax</span>
                      <span>{'\u00A3'}{Math.round(summary.eis_tax_allowance_max_seis).toLocaleString('en-GB')}</span>
                    </div>
                    <div className="eis-row" style={{ color: '#94A3B8' }}>
                      <span>Max EIS to zero tax</span>
                      <span>{'\u00A3'}{Math.round(summary.eis_tax_allowance_max_eis).toLocaleString('en-GB')}</span>
                    </div>
                    <div className="eis-divider" />
                    <div className="eis-row">
                      <span>SEIS @ {eis.allowance_pct ?? 100}%</span>
                      <span>{'\u00A3'}{Math.round(seisAmt).toLocaleString('en-GB')}</span>
                    </div>
                    <div className="eis-row">
                      <span>EIS @ {eis.allowance_pct ?? 100}%</span>
                      <span>{'\u00A3'}{Math.round(eisAmt).toLocaleString('en-GB')}</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
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
              </>
            )}

            {!isTaxMode && (
            <div className="input-group">
              <label>Scheme Type <InfoTip text="EIS: standard EIS only. SEIS: seed EIS only (50% relief, £200k cap). Blend: auto-split 13% SEIS / 87% EIS — typical fund allocation." /></label>
              <select
                value={eis.scheme_type ?? 'eis'}
                onChange={e => onChange({
                  ...inputs,
                  eis_strategy: { ...eis, scheme_type: e.target.value as 'eis' | 'seis' | 'blend' }
                })}
              >
                <option value="eis">EIS only</option>
                <option value="seis">SEIS only</option>
                <option value="blend">Blend (13% SEIS / 87% EIS)</option>
              </select>
            </div>
            )}

            <div className="input-group">
              <label>Quality Tier <InfoTip text="Affects expected exit multiples. Cautious: lower-risk, lower-return managers (2.9× base). Base: typical established EIS funds (5.65× base). Strong: top-tier managers with strong track records (10.25× base)." /></label>
              <select
                value={eis.quality_tier ?? 'base'}
                onChange={e => onChange({
                  ...inputs,
                  eis_strategy: { ...eis, quality_tier: e.target.value as 'cautious' | 'base' | 'strong' }
                })}
              >
                <option value="cautious">Cautious (2.9× base)</option>
                <option value="base">Base (5.65× base)</option>
                <option value="strong">Strong (10.25× base)</option>
              </select>
            </div>

            <div className="input-group">
              <label>Scenario</label>
              <div className="gross-net-row" style={{ flexWrap: 'wrap', gap: '4px' }}>
                {([
                  ['bear', 'Bear'],
                  ['base_case', 'Base Case'],
                  ['bull', 'Bull'],
                  ['worst_case', 'All Fail'],
                ] as const).map(([val, label]) => (
                  <button
                    key={val}
                    className={`gross-net-btn ${eis.scenario === val ? 'active' : ''}`}
                    style={{ flex: '1 1 auto', minWidth: '70px', fontSize: '0.75rem' }}
                    onClick={() => onChange({
                      ...inputs,
                      eis_strategy: { ...eis, scenario: val }
                    })}
                  >{label}</button>
                ))}
              </div>
            </div>

            {!isTaxMode && (
            <div className="input-group">
              <label>Growth Mode <InfoTip text="Flat: same annual investment each year. Increasing: investment grows 5% per year to keep pace with inflation and rising wealth." /></label>
              <div className="gross-net-row">
                <button
                  className={`gross-net-btn ${(eis.growth_mode ?? 'flat') === 'flat' ? 'active' : ''}`}
                  onClick={() => onChange({
                    ...inputs,
                    eis_strategy: { ...eis, growth_mode: 'flat' }
                  })}
                >Flat</button>
                <button
                  className={`gross-net-btn ${eis.growth_mode === 'increasing' ? 'active' : ''}`}
                  onClick={() => onChange({
                    ...inputs,
                    eis_strategy: { ...eis, growth_mode: 'increasing' }
                  })}
                >+5% pa</button>
              </div>
            </div>
            )}

            <div className="input-group">
              <label>Investment Phase (years) <InfoTip text="How many years to deploy new EIS/SEIS capital. After this, existing positions continue to mature along the exit ramp but no new money goes in. Set to 0 for continuous investment throughout the plan." /></label>
              <NumInput
                value={eis.investment_years ?? 0}
                onChange={v => onChange({
                  ...inputs,
                  eis_strategy: { ...eis, investment_years: v }
                })}
                min={0}
                max={inputs.plan_years}
                step={1}
              />
              {(eis.investment_years ?? 0) > 0 && (
                <span style={{ fontSize: '0.75rem', color: 'var(--unlock-muted)', marginTop: '4px' }}>
                  Invest years 1–{eis.investment_years}, harvest years {(eis.investment_years ?? 0) + 1}–{inputs.plan_years}
                </span>
              )}
            </div>

            <div className="input-group">
              <label>CGT Deferral Events <InfoTip text="Capital gains from other assets (e.g. property, business sale) that can be deferred by investing the proceeds into EIS within 1 year before or 3 years after the gain. The deferred CGT is tracked as a benefit of the EIS programme." /></label>
              {(eis.cgt_events ?? []).map((evt: EISCGTEvent, idx: number) => (
                <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ flex: '0 0 55px' }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--unlock-muted)' }}>Year</label>
                    <NumInput
                      value={evt.year}
                      onChange={v => {
                        const events = [...(eis.cgt_events ?? [])];
                        events[idx] = { ...events[idx], year: v };
                        onChange({ ...inputs, eis_strategy: { ...eis, cgt_events: events } });
                      }}
                      min={1}
                      max={inputs.plan_years}
                      step={1}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--unlock-muted)' }}>Gain</label>
                    <NumInput
                      value={evt.gain}
                      onChange={v => {
                        const events = [...(eis.cgt_events ?? [])];
                        events[idx] = { ...events[idx], gain: v };
                        onChange({ ...inputs, eis_strategy: { ...eis, cgt_events: events } });
                      }}
                      min={0}
                      step={10000}
                    />
                  </div>
                  <div style={{ flex: '0 0 65px' }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--unlock-muted)' }}>Rate</label>
                    <select
                      value={evt.rate}
                      onChange={e => {
                        const events = [...(eis.cgt_events ?? [])];
                        events[idx] = { ...events[idx], rate: e.target.value as 'auto' | '18' | '24' };
                        onChange({ ...inputs, eis_strategy: { ...eis, cgt_events: events } });
                      }}
                      style={{ width: '100%', padding: '6px 4px', background: 'var(--unlock-surface)', color: 'var(--unlock-text)', border: '1px solid var(--unlock-border)', borderRadius: '6px', fontSize: '0.8rem' }}
                    >
                      <option value="auto">Auto</option>
                      <option value="18">18%</option>
                      <option value="24">24%</option>
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      const events = (eis.cgt_events ?? []).filter((_: EISCGTEvent, i: number) => i !== idx);
                      onChange({ ...inputs, eis_strategy: { ...eis, cgt_events: events } });
                    }}
                    style={{ marginTop: '14px', background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '1.1rem', padding: '4px' }}
                    title="Remove event"
                  >{'\u00D7'}</button>
                </div>
              ))}
              <button
                onClick={() => {
                  const events = [...(eis.cgt_events ?? []), { year: 1, gain: 0, rate: 'auto' as const }];
                  onChange({ ...inputs, eis_strategy: { ...eis, cgt_events: events } });
                }}
                style={{ background: 'var(--unlock-surface)', color: 'var(--unlock-accent)', border: '1px dashed var(--unlock-border)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem', width: '100%' }}
              >+ Add CGT Event</button>
            </div>

            {totalAllocation > 0 && (
              <div className="eis-summary">
                <div className="eis-row">
                  <span>Annual allocation</span>
                  <span>{'\u00A3'}{Math.round(totalAllocation).toLocaleString('en-GB')}</span>
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
                      <span>EIS portfolio ({(eis.quality_tier ?? 'base')} {eis.scenario === 'worst_case' ? 'fail' : eis.scenario === 'bear' ? 'bear' : eis.scenario === 'bull' ? 'bull' : 'base'})</span>
                      <span>{'\u00A3'}{Math.round(summary.eis_portfolio_base_case).toLocaleString('en-GB')}</span>
                    </div>
                    <div className="eis-row" style={{ color: '#EF4444' }}>
                      <span>Net cost if all fail</span>
                      <span>{'\u00A3'}{Math.round(summary.eis_worst_case_net_cost).toLocaleString('en-GB')}{summary.eis_total_invested > 0 ? ` (${Math.round(summary.eis_worst_case_net_cost / summary.eis_total_invested * 100)}p/\u00A3)` : ''}</span>
                    </div>
                    <div className="eis-row">
                      <span>IHT-exempt (BPR)</span>
                      <span>{'\u00A3'}{Math.round(summary.eis_iht_exempt).toLocaleString('en-GB')}</span>
                    </div>
                    {summary.eis_cgt_deferral > 0 && (
                      <div className="eis-row" style={{ color: '#F59E0B' }}>
                        <span>CGT deferred</span>
                        <span>{'\u00A3'}{Math.round(summary.eis_cgt_deferral).toLocaleString('en-GB')}</span>
                      </div>
                    )}
                    {(eis.investment_years ?? 0) > 0 && (
                      <div className="eis-row" style={{ color: '#94A3B8' }}>
                        <span>Phase</span>
                        <span>Invest {summary.eis_investment_years}yr + Harvest {inputs.plan_years - summary.eis_investment_years}yr</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        );
      })()}

      </CollapsibleSection>

      <div className="divider" />

      <CollapsibleSection title="VCT Strategy" defaultOpen={false}>

      <div className="toggle-row">
        <label>Model VCT programme <InfoTip text="Annual allocation into Venture Capital Trusts. 20% income tax relief (was 30% pre-2026), tax-free dividends (~5% pa), CGT-free on disposal. 5-year hold cycle: invest → hold → liquidate → reinvest. VCTs do NOT qualify for IHT relief." /></label>
        <button
          className={`toggle-switch ${(inputs.vct_strategy ?? DEFAULT_VCT_STRATEGY).enabled ? 'active' : 'inactive'}`}
          onClick={() => onChange({
            ...inputs,
            vct_strategy: { ...(inputs.vct_strategy ?? DEFAULT_VCT_STRATEGY), enabled: !(inputs.vct_strategy ?? DEFAULT_VCT_STRATEGY).enabled }
          })}
        >
          <div className="toggle-knob" />
        </button>
      </div>

      {(inputs.vct_strategy ?? DEFAULT_VCT_STRATEGY).enabled && (() => {
        const vct = inputs.vct_strategy ?? DEFAULT_VCT_STRATEGY;
        const reliefRate = 0.20;
        const annualRelief = vct.annual_vct_amount * reliefRate;
        const effectiveCost = vct.annual_vct_amount - annualRelief;
        const annualDividends = vct.annual_vct_amount * 0.05;
        return (
          <>
            <div className="input-group">
              <label>Annual VCT Investment (20% relief)</label>
              <NumInput
                value={vct.annual_vct_amount}
                onChange={v => onChange({
                  ...inputs,
                  vct_strategy: { ...vct, annual_vct_amount: v }
                })}
                min={0}
                step={5000}
              />
            </div>

            <div className="input-group">
              <label>At 5-year liquidation</label>
              <div className="gross-net-row">
                <button
                  className={`gross-net-btn ${vct.proceeds_action === 'recycle' ? 'active' : ''}`}
                  onClick={() => onChange({
                    ...inputs,
                    vct_strategy: { ...vct, proceeds_action: 'recycle' }
                  })}
                >Reinvest</button>
                <button
                  className={`gross-net-btn ${vct.proceeds_action === 'cash_out' ? 'active' : ''}`}
                  onClick={() => onChange({
                    ...inputs,
                    vct_strategy: { ...vct, proceeds_action: 'cash_out' }
                  })}
                >Cash Out</button>
              </div>
            </div>

            <div className="input-group">
              <label>Scenario</label>
              <div className="gross-net-row">
                <button
                  className={`gross-net-btn ${vct.scenario === 'base_case' ? 'active' : ''}`}
                  onClick={() => onChange({
                    ...inputs,
                    vct_strategy: { ...vct, scenario: 'base_case' }
                  })}
                >Base Case</button>
                <button
                  className={`gross-net-btn ${vct.scenario === 'worst_case' ? 'active' : ''}`}
                  onClick={() => onChange({
                    ...inputs,
                    vct_strategy: { ...vct, scenario: 'worst_case' }
                  })}
                >-50% Loss</button>
              </div>
            </div>

            {vct.annual_vct_amount > 0 && (
              <div className="eis-summary">
                <div className="eis-row">
                  <span>Annual allocation</span>
                  <span>{'\u00A3'}{vct.annual_vct_amount.toLocaleString('en-GB')}</span>
                </div>
                <div className="eis-row" style={{ color: 'var(--unlock-accent)' }}>
                  <span>Income tax relief (20%)</span>
                  <span>{'\u2212\u00A3'}{Math.round(annualRelief).toLocaleString('en-GB')}</span>
                </div>
                <div className="eis-row">
                  <span>Effective annual cost</span>
                  <span>{'\u00A3'}{Math.round(effectiveCost).toLocaleString('en-GB')}</span>
                </div>
                <div className="eis-row" style={{ color: '#22D3EE' }}>
                  <span>Est. tax-free dividends</span>
                  <span>~{'\u00A3'}{Math.round(annualDividends).toLocaleString('en-GB')}/yr</span>
                </div>
                {summary && summary.vct_total_invested > 0 && (() => {
                  const freshCapital = vct.annual_vct_amount * inputs.plan_years;
                  const totalSubscribed = summary.vct_total_invested;
                  const hasRecycled = totalSubscribed > freshCapital * 1.01;
                  return (
                    <>
                      <div className="eis-divider" />
                      <div className="eis-row">
                        <span>Fresh capital ({inputs.plan_years}yr)</span>
                        <span>{'\u00A3'}{Math.round(freshCapital).toLocaleString('en-GB')}</span>
                      </div>
                      {hasRecycled && (
                        <div className="eis-row">
                          <span>Total subscribed (inc. recycled)</span>
                          <span>{'\u00A3'}{Math.round(totalSubscribed).toLocaleString('en-GB')}</span>
                        </div>
                      )}
                      <div className="eis-row" style={{ color: 'var(--unlock-accent)' }}>
                        <span>Total relief</span>
                        <span>{'\u00A3'}{Math.round(summary.vct_total_relief).toLocaleString('en-GB')}</span>
                      </div>
                      <div className="eis-row" style={{ color: '#22D3EE' }}>
                        <span>Total dividends</span>
                        <span>{'\u00A3'}{Math.round(summary.vct_total_dividends).toLocaleString('en-GB')}</span>
                      </div>
                      <div className="eis-row" style={{ color: '#8B5CF6' }}>
                        <span>VCT portfolio (base)</span>
                        <span>{'\u00A3'}{Math.round(summary.vct_portfolio_base_case).toLocaleString('en-GB')}</span>
                      </div>
                      {summary.vct_total_proceeds_returned > 0 && (
                        <div className="eis-row">
                          <span>Proceeds returned</span>
                          <span>{'\u00A3'}{Math.round(summary.vct_total_proceeds_returned).toLocaleString('en-GB')}</span>
                        </div>
                      )}
                      <div className="eis-row" style={{ fontSize: 10, color: 'var(--unlock-muted)' }}>
                        <span>No IHT relief (VCTs excluded)</span>
                        <span></span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </>
        );
      })()}

      </CollapsibleSection>

      <div className="divider" />

      <CollapsibleSection title="Drawdown Priorities">

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

      </CollapsibleSection>

      <div className="divider" />

      <CollapsibleSection title="Strategy Mechanisms" defaultOpen={false}>
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

      </CollapsibleSection>

      <div className="divider" />

      <CollapsibleSection title="Scenario Toggles" defaultOpen={false}>

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

      </CollapsibleSection>

      <div className="divider" />

      <CollapsibleSection title="Gifting" defaultOpen={false}>

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

      </CollapsibleSection>

      <div className="divider" />

      <CollapsibleSection title="Cash Buffer" defaultOpen={false}>

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

      </CollapsibleSection>

      <div className="divider" />

      <CollapsibleSection title="Legacy Target" defaultOpen={false}>

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

      </CollapsibleSection>

      <div className="divider" />

      <CollapsibleSection title="Estate & IHT" defaultOpen={false}>

      <div className="toggle-row">
        <label>Has main residence<InfoTip text="Do you own a main residence that will be left to direct descendants? If yes, the Residence Nil-Rate Band (RNRB) of up to £175,000 applies, reducing your IHT bill." /></label>
        <button
          className={`toggle-switch ${inputs.has_main_residence ? 'active' : 'inactive'}`}
          onClick={() => update('has_main_residence', !inputs.has_main_residence)}
        >
          <div className="toggle-knob" />
        </button>
      </div>

      <div className="toggle-row">
        <label>Has direct descendants<InfoTip text="Children or grandchildren who will inherit. Required alongside main residence for the RNRB allowance." /></label>
        <button
          className={`toggle-switch ${inputs.has_direct_descendants ? 'active' : 'inactive'}`}
          onClick={() => update('has_direct_descendants', !inputs.has_direct_descendants)}
        >
          <div className="toggle-knob" />
        </button>
      </div>

      {inputs.has_main_residence && inputs.has_direct_descendants && (
        <div style={{ fontSize: 11, color: 'var(--unlock-accent)', padding: '4px 0' }}>
          RNRB active — up to £175,000 additional nil-rate band applied
        </div>
      )}

      <div className="input-group">
        <label>Charitable legacy (%)<InfoTip text="Percentage of your estate left to charity. If 10% or more, your IHT rate drops from 40% to 36%." /></label>
        <NumInput
          value={inputs.charitable_legacy_pct}
          onChange={v => update('charitable_legacy_pct', Math.min(30, Math.max(0, v)))}
          min={0}
        />
        {inputs.charitable_legacy_pct >= 10 && (
          <div style={{ fontSize: 11, color: 'var(--unlock-accent)', padding: '2px 0' }}>
            Reduced IHT rate of 36% applies
          </div>
        )}
      </div>

      <div className="toggle-row">
        <label>NRB trust strategy<InfoTip text="Automatically gift up to the nil-rate band (£325,000) into a discretionary trust every 7 years to reduce your estate for IHT. Gifts are funded from drawdowns." /></label>
        <button
          className={`toggle-switch ${inputs.nrb_trust_enabled ? 'active' : 'inactive'}`}
          onClick={() => update('nrb_trust_enabled', !inputs.nrb_trust_enabled)}
        >
          <div className="toggle-knob" />
        </button>
      </div>

      {/* Gift specific assets as PETs in year 1 */}
      {(() => {
        const giftableAssets = portfolioAssets.filter(a =>
          a.asset_class !== 'cash' &&
          a.asset_class !== 'pension' &&
          a.disposal_type !== 'transfer' &&
          a.current_value > 0
        );
        if (giftableAssets.length === 0) return null;
        const selectedIds = inputs.gift_asset_ids ?? [];
        const totalGiftValue = giftableAssets
          .filter(a => selectedIds.includes(a.asset_id))
          .reduce((s, a) => s + a.current_value, 0);
        return (
          <div className="gift-assets-section">
            <label>Gift Specific Assets<InfoTip text="Select assets to gift as PETs in year 1. Their full value is removed from your portfolio, recorded as a PET for the 7-year IHT clock, and any capital gain triggers CGT." /></label>
            <div className="gift-assets-list">
              {giftableAssets.map(a => (
                <label key={a.asset_id} className="gift-asset-item">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(a.asset_id)}
                    onChange={e => {
                      const newIds = e.target.checked
                        ? [...selectedIds, a.asset_id]
                        : selectedIds.filter(id => id !== a.asset_id);
                      onChange({ ...inputs, gift_asset_ids: newIds });
                    }}
                  />
                  <span className="gift-asset-label">{a.label}</span>
                  <span className="gift-asset-value">{'\u00A3'}{Math.round(a.current_value).toLocaleString('en-GB')}</span>
                </label>
              ))}
            </div>
            {totalGiftValue > 0 && (
              <div style={{ fontSize: 11, color: 'var(--unlock-accent)', padding: '4px 0' }}>
                Total gift value: {'\u00A3'}{Math.round(totalGiftValue).toLocaleString('en-GB')}
              </div>
            )}
          </div>
        );
      })()}

      </CollapsibleSection>

      <div className="divider" />

      <CollapsibleSection title="Optional" defaultOpen={false}>

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

      </CollapsibleSection>
      </div>{/* end settings-sections-grid */}
    </div>
  );
}
